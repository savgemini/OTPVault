import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIGER_COUNTRY_IDS: Record<string, string> = {
  AF: "74", AL: "155", DZ: "58", AO: "76", AI: "181", AG: "169", AR: "39", AM: "148", AW: "179", AU: "175", AT: "50", AZ: "35",
  BS: "122", BH: "145", BD: "60", BB: "118", BY: "51", BE: "82", BZ: "124", BJ: "120", BM: "195", BT: "158", BO: "92", BA: "108",
  BW: "123", BR: "73", BN: "121", BG: "83", BF: "152", BI: "119", KH: "24", CM: "41", CA: "36", CV: "186", KY: "170", CF: "125",
  TD: "42", CL: "151", CO: "33", KM: "133", CD: "150", CG: "18", CR: "93", CI: "27", HR: "45", CU: "113", CY: "77", CZ: "63",
  DK: "172", DJ: "168", DM: "126", DO: "109", EC: "105", EG: "21", SV: "101", GQ: "167", ER: "176", EE: "34", ET: "71", FJ: "189",
  FI: "163", FR: "78", GF: "162", GA: "154", GM: "28", GE: "128", DE: "43", GH: "38", GR: "129", GD: "127", GP: "160", GT: "94",
  GN: "68", GW: "130", GY: "131", HT: "26", HN: "88", HK: "14", HU: "84", IS: "132", IN: "22", ID: "6", IR: "57", IQ: "47", IE: "23",
  IL: "13", IT: "86", JM: "103", JP: "182", JO: "116", KZ: "2", KE: "8", KR: "190", XK: "203", KW: "100", KG: "11", LA: "25",
  LV: "49", LB: "153", LS: "136", LR: "135", LY: "102", LT: "44", LU: "165", MO: "20", MK: "183", MG: "17", MW: "137", MY: "7",
  MV: "159", ML: "69", MT: "199", MR: "114", MU: "157", MX: "54", MD: "85", MC: "144", MN: "72", ME: "171", MS: "180", MA: "37",
  MZ: "80", MM: "5", NA: "138", NP: "81", NL: "48", NC: "185", NZ: "67", NI: "90", NE: "139", NG: "19", NO: "174", OM: "107",
  PK: "66", PS: "188", PA: "112", PG: "79", PY: "87", PE: "65", PH: "4", PL: "15", PT: "117", PR: "97", QA: "111", RE: "146",
  RO: "32", RW: "140", KN: "134", LC: "164", VC: "166", WS: "198", ST: "178", SA: "53", SN: "61", RS: "29", SC: "184", SL: "115",
  SG: "196", SK: "141", SI: "59", SB: "193", SO: "149", ZA: "31", SS: "177", ES: "56", LK: "64", SD: "98", SR: "142", SZ: "106",
  SE: "46", CH: "173", SY: "110", TW: "55", TJ: "143", TZ: "9", TH: "52", TL: "91", TG: "99", TO: "197", TT: "104", TN: "89",
  TR: "62", TM: "161", UG: "75", UA: "1", AE: "95", GB: "16", US: "187", UY: "156", UZ: "40", VE: "70", VN: "10", YE: "30",
  ZM: "147", ZW: "96",
};

function resolveTigerCountryCode(rawCountry: string | undefined): string | undefined {
  if (!rawCountry) return undefined;
  const trimmed = rawCountry.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return trimmed;

  const normalized = trimmed.toUpperCase().replace(/[^A-Z]/g, "");
  return TIGER_COUNTRY_IDS[normalized] ?? trimmed;
}

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
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { provider_service_id, service_id, country_id, cost } = await req.json();

    // Check wallet balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, banned")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);
    if (profile.banned) return json({ error: "Account banned" }, 403);
    // Get provider service details
    const { data: ps } = await supabase
      .from("provider_services")
      .select("*, providers(name, base_url, api_key_encrypted, slug), services(slug), countries(code)")
      .eq("id", provider_service_id)
      .maybeSingle();

    if (!ps) return json({ error: "Service not available" }, 404);
    if (!Number.isFinite(Number(ps.our_price)) || Number(ps.our_price) <= 0) {
      return json({ error: "This service has no valid selling price. Sync 5sim prices or configure the provider price first." }, 400);
    }
    if (Number(profile.wallet_balance) < Number(ps.our_price)) {
      return json({ error: "Insufficient wallet balance" }, 400);
    }

    const providerSlug = String(ps.providers?.slug || "").toLowerCase();
    if (!providerSlug.includes("tiger") && providerSlug !== "5sim") {
      return json({ error: "This provider is not supported yet. Configure Tiger SMS for real number purchases." }, 400);
    }

    const providerResult = providerSlug === "5sim"
      ? await request5sim({ baseUrl: ps.providers.base_url, apiKey: ps.providers.api_key_encrypted, service: ps.services?.slug, countryName: ps.countries?.name, countryCode: ps.countries?.code })
      : await requestTigerSms({ baseUrl: ps.providers.base_url, apiKey: ps.providers.api_key_encrypted, service: ps.services?.slug, country: ps.countries?.code, maxPrice: Number(ps.max_price ?? ps.our_price ?? 0) });
    if (!providerResult.success) return json({ error: providerResult.error }, 400);

    // Debit wallet
    const { error: debitError } = await supabase.rpc("debit_wallet", {
      p_user_id: user.id,
      p_amount: Number(ps.our_price),
      p_description: `Number purchase - ${ps.providers?.name ?? "provider"}`,
      p_reference_type: "number_purchase",
      p_reference_id: provider_service_id,
    });

    if (debitError) {
      if (providerSlug.includes("tiger")) await cancelTigerSms(ps.providers.base_url, ps.providers.api_key_encrypted, providerResult.activationId!);
      return json({ error: "Payment failed: " + debitError.message }, 400);
    }

    // Create number record
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const { data: number, error: numError } = await supabase
      .from("numbers")
      .insert({
        user_id: user.id,
        provider_id: ps.provider_id,
        service_id,
        country_id,
        phone_number: "",
        provider_activation_id: "",
        status: "pending",
        cost: Number(ps.our_price),
        expires_at: expiresAt,
      })
      .select()
      .maybeSingle();

    if (numError || !number) {
      await supabase.rpc("credit_wallet", {
        p_user_id: user.id,
        p_amount: Number(cost),
        p_description: "Refund - number creation failed",
      });
      if (providerSlug.includes("tiger")) await cancelTigerSms(ps.providers.base_url, ps.providers.api_key_encrypted, providerResult.activationId!);
      return json({ error: "Failed to create number" }, 500);
    }

    await supabase
      .from("numbers")
      .update({
        phone_number: providerResult.phoneNumber,
        provider_activation_id: providerResult.activationId,
        status: "active",
      })
      .eq("id", number.id);

    const updatedNumber = { ...number, phone_number: providerResult.phoneNumber, provider_activation_id: providerResult.activationId, status: "active" };

    return json({ number: updatedNumber }, 200);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

async function requestTigerSms({ baseUrl, apiKey, service, country, maxPrice }: { baseUrl: string; apiKey: string; service?: string; country?: string; maxPrice?: number | string }) {
  const tigerCountry = resolveTigerCountryCode(country);
  if (!baseUrl || !apiKey || !service || !tigerCountry) {
    return { success: false, error: "Tiger SMS provider is missing its base URL, API key, service slug, or country code." };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl.replace(/\/$/, "").endsWith("handler_api.php") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/stubs/handler_api.php`);
  } catch {
    return { success: false, error: "Tiger SMS base URL is invalid. Use https://api.tigersms.com or the full handler_api.php URL." };
  }

  const params: Record<string, string> = { api_key: apiKey, action: "getNumber", service, country: tigerCountry };
  const resolvedMaxPrice = Number(maxPrice ?? 0);
  if (Number.isFinite(resolvedMaxPrice) && resolvedMaxPrice > 0) {
    params.maxPrice = String(resolvedMaxPrice);
  }

  endpoint.search = new URLSearchParams(params).toString();

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), { headers: { Accept: "text/plain, application/json" } });
  } catch (error: any) {
    return { success: false, error: `Could not connect to Tiger SMS: ${error.message || "network error"}` };
  }
  const raw = await response.text();
  if (!response.ok) return { success: false, error: `Tiger SMS request failed (${response.status})` };

  const text = raw.trim();
  if (text.startsWith("ACCESS_NUMBER:")) {
    const [, activationId, phoneNumber] = text.split(":");
    if (activationId && phoneNumber) return { success: true, activationId, phoneNumber };
  }

  let message = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.status === "success" && parsed?.data?.id && parsed?.data?.phone) {
      return { success: true, activationId: String(parsed.data.id), phoneNumber: String(parsed.data.phone) };
    }
    message = parsed?.message || parsed?.error || text;
  } catch {
    // Tiger SMS returns plain-text error codes for failed reservations.
  }
  return { success: false, error: `Tiger SMS could not provide a number: ${message}` };
}

async function request5sim({ baseUrl, apiKey, service, countryName, countryCode }: { baseUrl: string; apiKey: string; service?: string; countryName?: string; countryCode?: string }) {
  if (!baseUrl || !apiKey || !service || !countryName) {
    return { success: false, error: "5sim provider is missing its base URL, API key, service slug, or country." };
  }

  const country = countrySlugFor(countryName, countryCode || "");
  const endpoint = `http://api1.5sim.net/stubs/handler_api.php?api_key=${encodeURIComponent(apiKey)}&action=getNumber&service=${encodeURIComponent(service)}&operator=any&country=${encodeURIComponent(country)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { Accept: "text/plain" } });
  } catch (error: any) {
    return { success: false, error: `Could not connect to 5sim: ${error.message || "network error"}` };
  }

  const body = await response.text();
  if (!response.ok || !body.startsWith("ACCESS_NUMBER:")) {
    return { success: false, error: `5sim could not provide a number: ${body || `HTTP ${response.status}`}` };
  }
  const [, activationId, phoneNumber] = body.trim().split(":");
  if (!activationId || !phoneNumber) return { success: false, error: "5sim returned an invalid number response." };
  return { success: true, activationId, phoneNumber };
}

function countrySlugFor(name: string, code: string) {
  const aliases: Record<string, string> = { usa: "usa", us: "usa", unitedstates: "usa", uk: "england", gb: "england" };
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, "");
  const normalizedCode = code.toLowerCase().replace(/[^a-z]/g, "");
  return aliases[normalizedName] || aliases[normalizedCode] || normalizedName;
}

async function cancelTigerSms(baseUrl: string, apiKey: string, activationId: string) {
  const endpoint = new URL(baseUrl.replace(/\/$/, "").endsWith("handler_api.php") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/stubs/handler_api.php`);
  endpoint.search = new URLSearchParams({ api_key: apiKey, action: "setStatus", status: "6", id: activationId }).toString();
  await fetch(endpoint.toString()).catch(() => undefined);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
