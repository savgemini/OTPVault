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

    // Update status
    await supabase
      .from("numbers")
      .update({ status: "cancelled" })
      .eq("id", number_id);

    // Refund wallet
    await supabase.rpc("credit_wallet", {
      p_user_id: user.id,
      p_amount: Number(number.cost),
      p_description: "Refund - number cancelled",
      p_reference_type: "number_refund",
      p_reference_id: number_id,
    });

    // In production, call provider API to cancel/release the number here

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
