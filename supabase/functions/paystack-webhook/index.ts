import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Paystack-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const payload = JSON.parse(rawBody);
    if (payload.event !== "charge.success") return json({ received: true }, 200);

    const reference = payload.data?.reference;
    const paidAmount = Number(payload.data?.amount || 0) / 100;
    if (!reference || paidAmount <= 0) return json({ error: "Invalid payment payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: deposit } = await supabase
      .from("deposits")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!deposit) return json({ error: "Deposit not found" }, 404);
    const { data: gateway } = await supabase
      .from("gateways")
      .select("paystack_secret_key")
      .eq("id", deposit.gateway_id)
      .maybeSingle();
    const secretKey = gateway?.paystack_secret_key || Deno.env.get("PAYSTACK_SECRET_KEY") || "";
    if (!secretKey || !signature || !(await isValidSignature(rawBody, signature, secretKey))) {
      return json({ error: "Invalid signature" }, 401);
    }

    if (deposit.status === "successful") return json({ received: true }, 200);
    if (Number(deposit.amount) !== paidAmount) return json({ error: "Payment amount mismatch" }, 400);

    const { data: updatedDeposit, error: statusError } = await supabase
      .from("deposits")
      .update({ status: "successful" })
      .eq("id", deposit.id)
      .in("status", ["pending", "awaiting_payment"])
      .select("id")
      .maybeSingle();

    if (statusError) return json({ error: "Failed to update deposit" }, 500);
    if (!updatedDeposit) return json({ received: true }, 200);

    const { error: creditError } = await supabase.rpc("credit_wallet", {
      p_user_id: deposit.user_id,
      p_amount: paidAmount,
      p_description: "Deposit via Paystack - " + deposit.reference,
      p_reference_type: "deposit",
      p_reference_id: deposit.id,
    });

    if (creditError) return json({ error: "Failed to credit wallet" }, 500);
    return json({ received: true }, 200);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

async function isValidSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"]
  );
  const bytes = new Uint8Array(signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
