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

    const { amount, method, action, reference } = await req.json();

    if (action === "verify" && reference) {
      const { data: deposit } = await supabase
        .from("deposits")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!deposit) return json({ error: "Deposit not found" }, 404);
      if (deposit.status === "successful") return json({ success: true, status: "successful" }, 200);

      const { data: gateway } = await supabase
        .from("gateways")
        .select("paystack_secret_key")
        .eq("id", deposit.gateway_id)
        .maybeSingle();
      const paystackSecretKey = gateway?.paystack_secret_key || "";
      if (!paystackSecretKey) return json({ error: "Paystack secret key is missing from the active gateway." }, 400);

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}`, Accept: "application/json" },
      });
      const verifyData = await verifyResponse.json();
      const paidAmount = Number(verifyData?.data?.amount || 0) / 100;

      if (!verifyResponse.ok || verifyData?.data?.status !== "success") {
        return json({ success: false, status: verifyData?.data?.status || "pending" }, 200);
      }
      if (paidAmount !== Number(deposit.amount)) return json({ error: "Payment amount mismatch" }, 400);

      const { data: updatedDeposit, error: updateError } = await supabase
        .from("deposits")
        .update({ status: "successful" })
        .eq("id", deposit.id)
        .in("status", ["pending", "awaiting_payment"])
        .select("id")
        .maybeSingle();

      if (updateError) return json({ error: "Failed to update deposit" }, 500);
      if (!updatedDeposit) return json({ success: true, status: "successful" }, 200);

      const { error: creditError } = await supabase.rpc("credit_wallet", {
        p_user_id: deposit.user_id,
        p_amount: paidAmount,
        p_description: "Deposit via Paystack - " + deposit.reference,
        p_reference_type: "deposit",
        p_reference_id: deposit.id,
      });
      if (creditError) return json({ error: "Failed to credit wallet" }, 500);

      return json({ success: true, status: "successful" }, 200);
    }

    if (!amount || amount < 100) {
      return json({ error: "Minimum deposit is ₦100" }, 400);
    }

    let gatewayQuery = supabase
      .from("gateways")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (method === "paystack") {
      gatewayQuery = gatewayQuery.eq("gateway_type", "paystack");
    }

    const { data: gateway } = await gatewayQuery.limit(1).maybeSingle();

    if (!gateway) {
      return json({ error: "No active payment gateway configured. Please contact support." }, 400);
    }

    if (method === "paystack") {
      const paystackSecretKey = gateway.paystack_secret_key || "";
      if (!paystackSecretKey) {
        return json({ error: "Paystack secret key is missing from the active gateway." }, 400);
      }

      const { data: deposit, error: depError } = await supabase
        .from("deposits")
        .insert({
          user_id: user.id,
          amount: Number(amount),
          method: "paystack",
          status: "pending",
          gateway_id: gateway.id,
        })
        .select()
        .maybeSingle();

      if (depError || !deposit) {
        return json({ error: "Failed to create Paystack deposit" }, 500);
      }

      const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount) * 100),
          email: user.email,
          reference: deposit.reference,
          callback_url: `${appUrl}/dashboard/wallet`,
        }),
      });

      const paystackData = await paystackResponse.json();
      if (!paystackResponse.ok || !paystackData?.data?.authorization_url) {
        await supabase
          .from("deposits")
          .update({ status: "failed", admin_note: paystackData?.message || "Paystack initialization failed" })
          .eq("id", deposit.id);
        return json({ error: paystackData?.message || "Paystack checkout failed" }, 400);
      }

      return json({
        deposit_id: deposit.id,
        reference: deposit.reference,
        amount: Number(amount),
        status: "pending",
        checkout_url: paystackData.data.authorization_url,
      }, 200);
    }

    // For virtual_account: create deposit with "awaiting_payment" status
    // The user hasn't paid yet — this just reserves the account details for them
    if (method === "virtual_account") {
      const accountNumber = gateway.account_number || "";
      const bankName = gateway.bank_name || gateway.name || "";
      const accountName = gateway.account_name || "";

      if (!accountNumber) {
        return json({ error: "Virtual account not configured on the gateway. Ask admin to set account details." }, 400);
      }

      const { data: deposit, error: depError } = await supabase
        .from("deposits")
        .insert({
          user_id: user.id,
          amount: Number(amount),
          method: "virtual_account",
          status: "awaiting_payment",
          gateway_id: gateway.id,
          virtual_account_number: accountNumber,
        })
        .select()
        .maybeSingle();

      if (depError || !deposit) {
        return json({ error: "Failed to create deposit" }, 500);
      }

      return json({
        deposit_id: deposit.id,
        reference: deposit.reference,
        account_number: accountNumber,
        bank_name: bankName,
        account_name: accountName,
        amount: Number(amount),
        status: "awaiting_payment",
      }, 200);
    }

    // For manual/bank transfer: create with "pending" status for admin approval
    const { data: deposit, error: depError } = await supabase
      .from("deposits")
      .insert({
        user_id: user.id,
        amount: Number(amount),
        method: "manual",
        status: "pending",
        gateway_id: gateway.id,
      })
      .select()
      .maybeSingle();

    if (depError || !deposit) {
      return json({ error: "Failed to create deposit" }, 500);
    }

    return json({
      deposit_id: deposit.id,
      reference: deposit.reference,
      amount: Number(amount),
      status: "pending",
    }, 200);
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
