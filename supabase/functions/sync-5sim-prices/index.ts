import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ error: "Admin access required" }, 403);

    const { provider_id } = await req.json();
    const { data: provider } = await supabase.from("providers").select("*").eq("id", provider_id).maybeSingle();
    if (!provider || String(provider.slug).toLowerCase() !== "5sim") {
      return json({ error: "This sync is only available for the provider with slug 5sim." }, 400);
    }

    const { data: mappings, error: mappingsError } = await supabase
      .from("provider_services")
      .select("id, service_id, country_id, active, services(slug), countries(name, code)")
      .eq("provider_id", provider.id);
    if (mappingsError) return json({ error: mappingsError.message }, 500);

    const priceResponse = await fetch(`http://api1.5sim.net/stubs/handler_api.php?api_key=${encodeURIComponent(provider.api_key_encrypted)}&action=getPrices`, { headers: { Accept: "application/json" } });
    if (!priceResponse.ok) return json({ error: `5sim price request failed (${priceResponse.status})` }, 400);
    const prices = await priceResponse.json();

    let updated = 0;
    const failures: string[] = [];
    for (const mapping of mappings ?? []) {
      const serviceSlug = mapping.services?.slug;
      const country = mapping.countries;
      if (!serviceSlug || !country) continue;

      const countrySlug = countrySlugFor(country.name, country.code);
      const operators = prices?.[countrySlug]?.[serviceSlug];
      const product = operators && Object.values(operators).find((operator: any) => typeof operator?.cost === "number");
      if (!product || typeof (product as any).cost !== "number") {
        failures.push(`${country.name}/${serviceSlug}: product unavailable`);
        continue;
      }

      const providerPrice = Number((product as any).cost);
      const ourPrice = providerPrice * (1 + Number(provider.markup_percent || 0) / 100);
      const stock = Math.max(...Object.values(operators).map((operator: any) => Number(operator?.count || 0)));
      const { error: updateError } = await supabase
        .from("provider_services")
        .update({ provider_price: providerPrice, our_price: ourPrice, stock, updated_at: new Date().toISOString() })
        .eq("id", mapping.id);
      if (updateError) failures.push(`${country.name}/${serviceSlug}: ${updateError.message}`);
      else updated++;
    }

    return json({ success: true, updated, failures }, 200);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function countrySlugFor(name: string, code: string) {
  const aliases: Record<string, string> = {
    usa: "usa",
    us: "usa",
    unitedstates: "usa",
    uk: "england",
    gb: "england",
    nigeria: "nigeria",
    ng: "nigeria",
  };
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, "");
  const normalizedCode = code.toLowerCase().replace(/[^a-z]/g, "");
  return aliases[normalizedName] || aliases[normalizedCode] || normalizedName;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
