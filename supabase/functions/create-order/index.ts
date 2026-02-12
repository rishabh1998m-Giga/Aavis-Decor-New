import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  variantId: string;
  quantity: number;
  productId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const { items, shippingAddress, paymentMethod, discountCode } = await req.json() as {
      items: CartItem[];
      shippingAddress: any;
      paymentMethod: string;
      discountCode?: string;
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Server-side price verification
    const variantIds = items.map((i) => i.variantId);
    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .select("id, price, stock_quantity, product_id, sku, color, size")
      .in("id", variantIds);

    if (variantError || !variants) {
      return new Response(JSON.stringify({ error: "Failed to fetch variants" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Get product names
    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, name, gst_rate")
      .in("id", productIds);
    const productMap = new Map((products || []).map((p) => [p.id, p]));

    // 2. Atomic inventory decrement
    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        return new Response(JSON.stringify({ error: `Variant ${item.variantId} not found` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: success } = await supabase.rpc("decrement_inventory", {
        p_variant_id: item.variantId,
        p_quantity: item.quantity,
      });

      if (!success) {
        return new Response(
          JSON.stringify({
            error: `Insufficient stock for SKU ${variant.sku}. Available: ${variant.stock_quantity}`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Calculate totals with verified prices
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId)!;
      const product = productMap.get(variant.product_id);
      const lineTotal = Number(variant.price) * item.quantity;
      const gstRate = Number(product?.gst_rate ?? 18);
      const gstAmount = Math.round((lineTotal * gstRate) / (100 + gstRate));
      subtotal += lineTotal;

      orderItems.push({
        product_id: variant.product_id,
        variant_id: item.variantId,
        product_name: product?.name || "Unknown",
        variant_info: [variant.color, variant.size].filter(Boolean).join(" / ") || "Default",
        sku: variant.sku,
        quantity: item.quantity,
        unit_price: Number(variant.price),
        total_price: lineTotal,
        gst_rate: gstRate,
        gst_amount: gstAmount,
      });
    }

    // 4. Validate discount
    let discountAmount = 0;
    let appliedDiscountCode: string | null = null;

    if (discountCode) {
      const { data: discount } = await supabase
        .from("discounts")
        .select("*")
        .eq("code", discountCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (discount) {
        const now = new Date();
        const notExpired = !discount.expires_at || new Date(discount.expires_at) > now;
        const underUsageLimit = !discount.max_uses || discount.usage_count < discount.max_uses;
        const meetsMinCart = !discount.min_cart_value || subtotal >= Number(discount.min_cart_value);

        if (notExpired && underUsageLimit && meetsMinCart) {
          if (discount.type === "percentage") {
            discountAmount = Math.round((subtotal * Number(discount.value)) / 100);
          } else {
            discountAmount = Math.min(Number(discount.value), subtotal);
          }
          appliedDiscountCode = discount.code;

          // Increment usage
          await supabase
            .from("discounts")
            .update({ usage_count: discount.usage_count + 1 })
            .eq("id", discount.id);
        }
      }
    }

    // 5. Shipping & COD
    const { data: shippingRules } = await supabase
      .from("shipping_rules")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    const freeThreshold = Number(shippingRules?.free_shipping_threshold ?? 999);
    const flatRate = Number(shippingRules?.flat_rate ?? 99);
    const codFeeRate = Number(shippingRules?.cod_fee ?? 49);

    const shippingAmount = subtotal >= freeThreshold ? 0 : flatRate;
    const codFee = paymentMethod === "cod" ? codFeeRate : 0;
    const gstAmount = Math.round((subtotal * 18) / 118);
    const totalAmount = subtotal - discountAmount + shippingAmount + codFee;

    // 6. Generate order number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `LNC-${timestamp}-${random}`;

    // 7. Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: userId,
        subtotal,
        shipping_amount: shippingAmount,
        gst_amount: gstAmount,
        cod_fee: codFee,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cod" ? "pending" : "pending",
        status: "pending",
        fulfillment_status: "unfulfilled",
        discount_code: appliedDiscountCode,
        discount_amount: discountAmount,
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
      })
      .select()
      .single();

    if (orderError) {
      // Rollback inventory
      for (const item of items) {
        await supabase.rpc("decrement_inventory", {
          p_variant_id: item.variantId,
          p_quantity: -item.quantity,
        });
      }
      throw orderError;
    }

    // 8. Insert order items
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        totalAmount: totalAmount,
        discountAmount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
