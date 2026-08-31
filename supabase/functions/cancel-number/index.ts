import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    const { number_id } = await req.json();

    const { data: number } = await supabase
      .from("numbers")
      .select("*")
      .eq("id", number_id)
      .maybeSingle();

    if (!number) return json({ error: "Number not found" }, 404);
    if (number.user_id !== user.id) return json({ error: "Not your number" }, 403);
    if (number.status !== "active" && number.status !== "pending") {
      return json({ error: "Number already " + number.status }, 400);
    }

    const { data: provider } = await supabase
      .from("providers")
      .select("slug, base_url, api_key_encrypted")
      .eq("id", number.provider_id)
      .maybeSingle();

    if (
      provider &&
      String(provider.slug || "").toLowerCase().includes("tiger") &&
      number.provider_activation_id
    ) {
      const baseUrl = String(provider.base_url || "").trim();
      const apiKey = String(provider.api_key_encrypted || "").trim();
      if (baseUrl && apiKey) {
        const endpoint = new URL(
          baseUrl.replace(/\/$/, "").endsWith("handler_api.php")
            ? baseUrl
            : `${baseUrl.replace(/\/$/, "")}/stubs/handler_api.php`
        );

        endpoint.search = new URLSearchParams({
          api_key: apiKey,
          action: "setStatus",
          status: "6",
          id: String(number.provider_activation_id),
        }).toString();

        await fetch(endpoint.toString(), {
          headers: { Accept: "text/plain, application/json" },
        }).catch(() => undefined);
      }
    }

    const { data: updatedNumber, error: cancelError } = await supabase
      .from("numbers")
      .update({ status: "cancelled" })
      .eq("id", number_id)
      .in("status", ["active", "pending"])
      .select("id, cost")
      .maybeSingle();

    if (cancelError) {
      return json({ error: "Failed to cancel number" }, 500);
    }

    if (!updatedNumber) {
      return json({ error: "Number already cancelled or unavailable" }, 400);
    }

    // Refund wallet only once after a successful provider-side cancellation transition.
    await supabase.rpc("credit_wallet", {
      p_user_id: user.id,
      p_amount: Number(updatedNumber.cost),
      p_description: "Refund - number cancelled",
      p_reference_type: "number_refund",
      p_reference_id: number_id,
    });

    return json({ success: true }, 200);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
