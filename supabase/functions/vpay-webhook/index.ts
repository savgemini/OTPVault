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

    const body = await req.json();
    const { reference, status, amount, account_number } = body;

    let query = supabase.from("deposits").select("*");
    if (reference) {
      query = query.eq("reference", reference);
    } else if (account_number) {
      query = query.eq("virtual_account_number", account_number).in("status", ["awaiting_payment", "pending"]);
    } else {
      return json({ error: "Missing reference or account_number" }, 400);
    }

    const { data: deposit, error } = await query.maybeSingle();
    if (error || !deposit) {
      return json({ error: "Deposit not found" }, 404);
    }

    if (deposit.status !== "awaiting_payment" && deposit.status !== "pending") {
      return json({ success: true, message: "Already processed" }, 200);
    }

    if (status === "successful" || status === "success" || body.status === "paid") {
      await supabase
        .from("deposits")
        .update({ status: "successful" })
        .eq("id", deposit.id);

      await supabase.rpc("credit_wallet", {
        p_user_id: deposit.user_id,
        p_amount: Number(amount || deposit.amount),
        p_description: "Deposit via virtual account - " + deposit.reference,
        p_reference_type: "deposit",
        p_reference_id: deposit.id,
      });

      return json({ success: true, message: "Wallet credited" }, 200);
    } else {
      await supabase
        .from("deposits")
        .update({ status: "failed" })
        .eq("id", deposit.id);

      return json({ success: true, message: "Deposit marked as failed" }, 200);
    }
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
