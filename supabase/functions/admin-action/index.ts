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

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return json({ error: "Admin access required" }, 403);
    }

    const { action, user_id, banned, deposit_id, amount } = await req.json();

    switch (action) {
      case "toggle_ban": {
        const { error } = await supabase
          .from("profiles")
          .update({ banned: banned })
          .eq("id", user_id);
        if (error) return json({ error: error.message }, 400);

        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: banned ? "ban_user" : "unban_user",
          target_type: "profile",
          target_id: user_id,
        });

        return json({ success: true }, 200);
      }

      case "credit_wallet": {
        const { error } = await supabase.rpc("credit_wallet", {
          p_user_id: user_id,
          p_amount: Number(amount),
          p_description: "Admin wallet credit",
          p_reference_type: "admin_credit",
        });
        if (error) return json({ error: error.message }, 400);

        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: "credit_wallet",
          target_type: "profile",
          target_id: user_id,
          details: { amount: Number(amount) },
        });

        return json({ success: true }, 200);
      }

      case "approve_deposit": {
        const { data: deposit } = await supabase
          .from("deposits")
          .select("*")
          .eq("id", deposit_id)
          .maybeSingle();

        if (!deposit) return json({ error: "Deposit not found" }, 404);
        if (deposit.status !== "pending" && deposit.status !== "awaiting_payment") return json({ error: "Deposit already processed" }, 400);

        // Update deposit status
        await supabase
          .from("deposits")
          .update({ status: "successful" })
          .eq("id", deposit_id);

        // Credit wallet
        await supabase.rpc("credit_wallet", {
          p_user_id: deposit.user_id,
          p_amount: Number(deposit.amount),
          p_description: "Deposit approved - " + deposit.reference,
          p_reference_type: "deposit",
          p_reference_id: deposit_id,
        });

        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: "approve_deposit",
          target_type: "deposit",
          target_id: deposit_id,
          details: { amount: Number(deposit.amount) },
        });

        return json({ success: true }, 200);
      }

      case "reject_deposit": {
        const { data: deposit } = await supabase
          .from("deposits")
          .select("*")
          .eq("id", deposit_id)
          .maybeSingle();

        if (!deposit) return json({ error: "Deposit not found" }, 404);
        if (deposit.status !== "pending" && deposit.status !== "awaiting_payment") return json({ error: "Deposit already processed" }, 400);

        await supabase
          .from("deposits")
          .update({ status: "rejected", admin_note: "Rejected by admin" })
          .eq("id", deposit_id);

        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: "reject_deposit",
          target_type: "deposit",
          target_id: deposit_id,
        });

        return json({ success: true }, 200);
      }

      default:
        return json({ error: "Unknown action" }, 400);
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
