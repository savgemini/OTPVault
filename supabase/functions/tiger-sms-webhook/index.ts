import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tiger-Signature, X-Signature, X-TigerSMS-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.text();
    const payload = parsePayload(rawBody);
    if (!payload) {
      return json({ error: "Invalid webhook payload" }, 400);
    }

    const webhookSecret = Deno.env.get("TIGER_SMS_WEBHOOK_SECRET") || "";
    const signatureCheckDisabled = ["0", "false", "off", "disabled", "no"].includes((Deno.env.get("TIGER_SMS_WEBHOOK_SIGNATURE_CHECK") || "").toLowerCase());

    if (webhookSecret && !signatureCheckDisabled) {
      const signature = getSignature(req);
      if (!signature || !(await verifySignature(rawBody, signature, webhookSecret))) {
        return json({ error: "Invalid webhook signature" }, 401);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const messageText = extractMessage(payload);
    if (!messageText) {
      return json({ received: true, ignored: "No message body" }, 200);
    }

    const sender = extractSender(payload);
    const callerNumber = normalizeNumber(extractPhone(payload));
    const activationId = normalizeNumber(extractActivationId(payload));
    const code = extractCode(messageText);

    let matchQuery = supabase
      .from("numbers")
      .select("id, user_id, phone_number, provider_activation_id, status")
      .eq("status", "active");

    if (activationId) {
      matchQuery = matchQuery.or(`provider_activation_id.eq.${activationId},phone_number.eq.${activationId}`);
    } else if (callerNumber) {
      matchQuery = matchQuery.or(`phone_number.eq.${callerNumber},provider_activation_id.eq.${callerNumber}`);
    }

    let { data: matchedNumber, error: matchError } = await matchQuery.maybeSingle();
    if (matchError) {
      return json({ error: `Could not match incoming SMS: ${matchError.message}` }, 500);
    }

    if (!matchedNumber && activationId) {
      const fallback = await supabase
        .from("numbers")
        .select("id, user_id, phone_number, provider_activation_id, status")
        .eq("status", "active")
        .ilike("provider_activation_id", `%${activationId}%`)
        .maybeSingle();
      matchedNumber = fallback.data;
    }

    if (!matchedNumber) {
      return json({ received: true, ignored: "No active number matched this inbound message" }, 200);
    }

    const { error: insertError } = await supabase.from("sms_logs").insert({
      number_id: matchedNumber.id,
      sender: sender || "tiger-sms",
      message: messageText,
      code: code || "",
    });

    if (insertError) {
      return json({ error: `Failed to store SMS log: ${insertError.message}` }, 500);
    }

    await supabase
      .from("numbers")
      .update({ status: "completed" })
      .eq("id", matchedNumber.id)
      .neq("status", "completed");

    return json({ received: true, stored: true, number_id: matchedNumber.id }, 200);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function parsePayload(rawBody: string) {
  if (!rawBody) return null;

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Ignore and try form parsing below.
  }

  try {
    const searchParams = new URLSearchParams(rawBody);
    const object: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      object[key] = value;
    }
    return Object.keys(object).length ? object : null;
  } catch {
    return null;
  }
}

function getSignature(req: Request) {
  const headers = [
    "x-tiger-signature",
    "x-signature",
    "x-tigersms-signature",
    "x-tiger-sms-signature",
    "authorization",
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) return value;
  }

  return "";
}

async function verifySignature(rawBody: string, signature: string, secret: string) {
  const normalized = signature.trim();
  if (!normalized) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const signedBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(signedBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(signedBytes)));
  const variants = new Set<string>([
    normalized,
    normalized.replace(/^sha256=/i, ""),
    normalized.replace(/^hmac-sha256=/i, ""),
    normalized.toLowerCase(),
    normalized.toUpperCase(),
    expectedHex,
    expectedHex.toLowerCase(),
    expectedHex.toUpperCase(),
    expectedBase64,
    expectedBase64.replace(/\+/g, "-").replace(/\//g, "_"),
    expectedBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  ]);

  return Array.from(variants).some((value) => value === normalized || value.toLowerCase() === normalized.toLowerCase());
}

function extractMessage(payload: any): string {
  const candidates = [
    payload?.message,
    payload?.text,
    payload?.sms,
    payload?.body,
    payload?.content,
    payload?.data?.message,
    payload?.data?.text,
    payload?.data?.sms,
    payload?.data?.body,
    payload?.data?.content,
    payload?.payload?.message,
    payload?.payload?.text,
    payload?.payload?.sms,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function extractSender(payload: any): string {
  const candidates = [
    payload?.sender,
    payload?.from,
    payload?.from_number,
    payload?.phone,
    payload?.number,
    payload?.msisdn,
    payload?.data?.sender,
    payload?.data?.from,
    payload?.data?.phone,
    payload?.data?.number,
    payload?.payload?.sender,
    payload?.payload?.from,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "tiger-sms";
}

function extractPhone(payload: any): string | undefined {
  const candidates = [
    payload?.phone,
    payload?.number,
    payload?.to,
    payload?.destination,
    payload?.data?.phone,
    payload?.data?.number,
    payload?.data?.to,
    payload?.payload?.phone,
    payload?.payload?.number,
    payload?.payload?.to,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function extractActivationId(payload: any): string | undefined {
  const candidates = [
    payload?.activation_id,
    payload?.activationId,
    payload?.activationID,
    payload?.id,
    payload?.number_id,
    payload?.activation,
    payload?.data?.activation_id,
    payload?.data?.activationId,
    payload?.data?.activationID,
    payload?.data?.id,
    payload?.payload?.activation_id,
    payload?.payload?.activationId,
    payload?.payload?.activationID,
    payload?.payload?.id,
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }

  return undefined;
}

function normalizeNumber(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^\+/, "").replace(/\s+/g, "");
  return normalized || undefined;
}

function extractCode(message: string): string {
  const match = message.match(/\b\d{4,8}\b/);
  return match ? match[0] : "";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
