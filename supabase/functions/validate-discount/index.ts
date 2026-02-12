import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { code, cartTotal } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ valid: false, error: "No code provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: discount, error } = await supabase
      .from("discounts")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !discount) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid coupon code" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();

    if (discount.expires_at && new Date(discount.expires_at) < now) {
      return new Response(JSON.stringify({ valid: false, error: "Coupon has expired" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (discount.max_uses && discount.usage_count >= discount.max_uses) {
      return new Response(JSON.stringify({ valid: false, error: "Coupon usage limit reached" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (discount.min_cart_value && cartTotal < Number(discount.min_cart_value)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Minimum cart value ₹${discount.min_cart_value} required`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let discountAmount = 0;
    if (discount.type === "percentage") {
      discountAmount = Math.round((cartTotal * Number(discount.value)) / 100);
    } else {
      discountAmount = Math.min(Number(discount.value), cartTotal);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        discountAmount,
        type: discount.type,
        value: Number(discount.value),
        code: discount.code,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
