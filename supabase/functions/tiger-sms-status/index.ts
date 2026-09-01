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

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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

    const { number_id } = await req.json();
    if (!number_id) {
      console.log(`[tiger-sms-status] Missing number_id in request`);
      return json({ error: "Missing number_id" }, 400);
    }

    console.log(`[tiger-sms-status] Polling activation status for number ${number_id}...`);

    const { data: number, error: numberError } = await supabase
      .from("numbers")
      .select("*, providers(slug, base_url, api_key_encrypted)")
      .eq("id", number_id)
      .maybeSingle();

    if (numberError || !number) {
      console.log(`[tiger-sms-status] Number not found: ${number_id}`, numberError);
      return json({ error: "Number not found", debug: { numberError } }, 404);
    }

    if (number.user_id !== user.id) {
      console.log(`[tiger-sms-status] User mismatch: ${user.id} vs ${number.user_id}`);
      return json({ error: "Not your number" }, 403);
    }

    if (!number.provider_activation_id) {
      console.log(`[tiger-sms-status] No activation ID for number ${number_id}`);
      return json({ success: false, waiting: true, status: "NO_ACTIVATION_ID", number_id }, 200);
    }

    const providerSlug = String((number as any).providers?.slug || "").toLowerCase();
    if (!providerSlug.includes("tiger")) {
      console.log(`[tiger-sms-status] Not a Tiger SMS provider: ${providerSlug}`);
      return json({ success: false, waiting: false, status: "NOT_TIGER_SMS", provider: providerSlug }, 200);
    }

    const baseUrl = String((number as any).providers?.base_url || "").trim();
    const apiKey = String((number as any).providers?.api_key_encrypted || "").trim();

    if (!baseUrl || !apiKey) {
      console.log(`[tiger-sms-status] Missing config: baseUrl=${!!baseUrl}, apiKey=${!!apiKey}`);
      return json({ success: false, waiting: false, status: "MISSING_TIGER_CONFIG" }, 200);
    }

    const endpoint = new URL(
      baseUrl.replace(/\/$/, "").endsWith("handler_api.php")
        ? baseUrl
        : `${baseUrl.replace(/\/$/, "")}/stubs/handler_api.php`
    );

    endpoint.search = new URLSearchParams({
      api_key: apiKey,
      action: "getStatusV2",
      id: String(number.provider_activation_id),
    }).toString();

    console.log(`[tiger-sms-status] Fetching activation ${number.provider_activation_id} from ${endpoint.toString().replace(apiKey, "***")}`);

    // First: trigger SMS delivery by setting status to READY (status=1)
    const setStatusUrl = new URL(
      baseUrl.replace(/\/$/, "").endsWith("handler_api.php")
        ? baseUrl
        : `${baseUrl.replace(/\/$/, "")}/stubs/handler_api.php`
    );
    setStatusUrl.search = new URLSearchParams({
      api_key: apiKey,
      action: "setStatus",
      id: String(number.provider_activation_id),
      status: "1",
    }).toString();

    console.log(`[tiger-sms-status] Triggering SMS delivery with setStatus(1)...`);
    await fetch(setStatusUrl.toString(), {
      headers: { Accept: "text/plain, application/json" },
    }).catch((err) => {
      console.log(`[tiger-sms-status] setStatus call failed (not blocking): ${err?.message || "request failed"}`);
    });

    let response: Response;
    try {
      response = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json, text/plain" },
      });
    } catch (error: any) {
      console.log(`[tiger-sms-status] Fetch failed: ${error?.message || "request failed"}`);
      return json({ success: false, waiting: true, status: "FETCH_ERROR", message: error?.message || "request failed" }, 200);
    }

    const rawText = await response.text();
    console.log(`[tiger-sms-status] Raw response (${response.status}): ${rawText}`);
    const parsed = safeParseJson(rawText);

    let code = "";
    let message = "";
    let status = "STATUS_WAIT_CODE";

    if (parsed && typeof parsed === "object") {
      const verificationType = parsed.verificationType ?? parsed.verification_type;
      const sms = parsed.sms ?? parsed.data?.sms ?? parsed.data;

      console.log(`[tiger-sms-status] Parsed JSON: verificationType=${verificationType}, sms=`, sms);

      if (verificationType === 1 && sms && typeof sms === "object") {
        message = String(sms.text || sms.message || "").trim();
        code = String(sms.code || extractCode(message) || "").trim();
        status = code ? "STATUS_OK" : "STATUS_WAIT_RETRY";
        console.log(`[tiger-sms-status] Extracted from JSON: code="${code}", message="${message}", status="${status}"`);
      }
    }

    if (!code && !message) {
      console.log(`[tiger-sms-status] No code/message in JSON, trying plain text parse...`);
      const lower = rawText.trim();
      if (/STATUS_OK:/i.test(lower)) {
        const match = lower.match(/STATUS_OK:(.+)$/i);
        code = (match?.[1] || "").trim();
        message = lower.trim();
        status = "STATUS_OK";
        console.log(`[tiger-sms-status] Plain text STATUS_OK: code="${code}"`);
      } else if (/STATUS_WAIT_RETRY:/i.test(lower)) {
        const match = lower.match(/STATUS_WAIT_RETRY:(.+)$/i);
        code = (match?.[1] || "").trim();
        message = lower.trim();
        status = "STATUS_WAIT_RETRY";
        console.log(`[tiger-sms-status] Plain text STATUS_WAIT_RETRY: code="${code}"`);
      } else if (/STATUS_WAIT_CODE/i.test(lower)) {
        status = "STATUS_WAIT_CODE";
        console.log(`[tiger-sms-status] Status: waiting for code`);
      } else if (/NO_ACTIVATION/i.test(lower)) {
        status = "NO_ACTIVATION";
        console.log(`[tiger-sms-status] Status: NO_ACTIVATION (provider doesn't know this ID)`);
      } else if (/ACCESS_CANCEL/i.test(lower)) {
        status = "ACCESS_CANCEL";
        console.log(`[tiger-sms-status] Status: ACCESS_CANCEL (cancelled on provider side)`);
      }
    }

    console.log(`[tiger-sms-status] Final: status="${status}", code="${code}", message="${message}"`);

    if (code || message) {
      console.log(`[tiger-sms-status] Checking for duplicate SMS log for number ${number.id}...`);
      const { data: existing } = await supabase
        .from("sms_logs")
        .select("id")
        .eq("number_id", number.id)
        .ilike("code", `%${code || message}%`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`[tiger-sms-status] SMS log already exists, skipping insert`);
      } else {
        console.log(`[tiger-sms-status] Inserting SMS log: code="${code}", message="${message}"`);
        const { error: insertError } = await supabase.from("sms_logs").insert({
          number_id: number.id,
          sender: "tiger-sms",
          message: message || `TigerSMS status: ${code}`,
          code: code || "",
        });

        if (insertError) {
          console.log(`[tiger-sms-status] Insert failed: ${insertError.message}`);
          return json({ success: false, waiting: false, status: "INSERT_FAILED", error: insertError.message }, 500);
        }
        console.log(`[tiger-sms-status] SMS log inserted successfully`);
      }

      console.log(`[tiger-sms-status] Marking number ${number.id} as completed`);
      await supabase
        .from("numbers")
        .update({ status: "completed" })
        .eq("id", number.id)
        .neq("status", "completed");

      console.log(`[tiger-sms-status] SUCCESS: returning code to client`);
      return json({ success: true, waiting: false, status, code, message }, 200);
    }

    console.log(`[tiger-sms-status] No code/message found, still waiting...`);
    return json({ success: false, waiting: true, status }, 200);
  } catch (err: any) {
    console.log(`[tiger-sms-status] EXCEPTION: ${err.message || "Internal error"}`);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractCode(message: string): string {
  if (!message) return "";
  const match = message.match(/\b\d{4,8}\b/);
  return match ? match[0] : "";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
