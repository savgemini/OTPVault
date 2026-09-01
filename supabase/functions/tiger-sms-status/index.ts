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
      return json({ error: "Missing number_id" }, 400);
    }

    const { data: number, error: numberError } = await supabase
      .from("numbers")
      .select("*, providers(slug, base_url, api_key_encrypted)")
      .eq("id", number_id)
      .maybeSingle();

    if (numberError || !number) {
      return json({ error: "Number not found" }, 404);
    }

    if (number.user_id !== user.id) {
      return json({ error: "Not your number" }, 403);
    }

    if (!number.provider_activation_id) {
      return json({ success: false, waiting: true, status: "NO_ACTIVATION_ID" }, 200);
    }

    const providerSlug = String((number as any).providers?.slug || "").toLowerCase();
    if (!providerSlug.includes("tiger")) {
      return json({ success: false, waiting: false, status: "NOT_TIGER_SMS" }, 200);
    }

    const baseUrl = String((number as any).providers?.base_url || "").trim();
    const apiKey = String((number as any).providers?.api_key_encrypted || "").trim();

    if (!baseUrl || !apiKey) {
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

    let response: Response;
    try {
      response = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json, text/plain" },
      });
    } catch (error: any) {
      return json({ success: false, waiting: true, status: "FETCH_ERROR", message: error?.message || "request failed" }, 200);
    }

    const rawText = await response.text();
    const parsed = safeParseJson(rawText);

    let code = "";
    let message = "";
    let status = "STATUS_WAIT_CODE";

    if (parsed && typeof parsed === "object") {
      const verificationType = parsed.verificationType ?? parsed.verification_type;
      const sms = parsed.sms ?? parsed.data?.sms ?? parsed.data;

      if (verificationType === 1 && sms && typeof sms === "object") {
        message = String(sms.text || sms.message || "").trim();
        code = String(sms.code || extractCode(message) || "").trim();
        status = code ? "STATUS_OK" : "STATUS_WAIT_RETRY";
      }
    }

    if (!code && !message) {
      const lower = rawText.trim();
      if (/STATUS_OK:/i.test(lower)) {
        const match = lower.match(/STATUS_OK:(.+)$/i);
        code = (match?.[1] || "").trim();
        message = lower.trim();
        status = "STATUS_OK";
      } else if (/STATUS_WAIT_RETRY:/i.test(lower)) {
        const match = lower.match(/STATUS_WAIT_RETRY:(.+)$/i);
        code = (match?.[1] || "").trim();
        message = lower.trim();
        status = "STATUS_WAIT_RETRY";
      } else if (/STATUS_WAIT_CODE/i.test(lower)) {
        status = "STATUS_WAIT_CODE";
      } else if (/NO_ACTIVATION/i.test(lower)) {
        status = "NO_ACTIVATION";
      } else if (/ACCESS_CANCEL/i.test(lower)) {
        status = "ACCESS_CANCEL";
      }
    }

    if (code || message) {
      const { data: existing } = await supabase
        .from("sms_logs")
        .select("id")
        .eq("number_id", number.id)
        .ilike("code", `%${code || message}%`)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase.from("sms_logs").insert({
          number_id: number.id,
          sender: "tiger-sms",
          message: message || `TigerSMS status: ${code}`,
          code: code || "",
        });

        if (insertError) {
          return json({ success: false, waiting: false, status: "INSERT_FAILED", error: insertError.message }, 500);
        }
      }

      await supabase
        .from("numbers")
        .update({ status: "completed" })
        .eq("id", number.id)
        .neq("status", "completed");

      return json({ success: true, waiting: false, status, code, message }, 200);
    }

    return json({ success: false, waiting: true, status }, 200);
  } catch (err: any) {
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
