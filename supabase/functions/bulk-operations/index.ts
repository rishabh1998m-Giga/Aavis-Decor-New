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

    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operation, data } = await req.json();

    switch (operation) {
      case "csv-import": {
        const { products } = data as { products: any[] };
        let created = 0;
        let updated = 0;
        const errors: string[] = [];

        for (const row of products) {
          try {
            if (!row.name || !row.slug) {
              errors.push(`Row missing name or slug: ${JSON.stringify(row)}`);
              continue;
            }

            // Upsert product
            const { data: product, error: prodError } = await supabase
              .from("products")
              .upsert(
                {
                  name: row.name,
                  slug: row.slug,
                  description: row.description || null,
                  short_description: row.short_description || null,
                  base_price: Number(row.base_price || 0),
                  compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null,
                  category_id: row.category_id || null,
                  fabric: row.fabric || null,
                  dimensions: row.dimensions || null,
                  care_instructions: row.care_instructions || null,
                  tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : null,
                  is_active: row.is_active !== "false",
                  is_featured: row.is_featured === "true",
                },
                { onConflict: "slug" }
              )
              .select()
              .single();

            if (prodError) {
              errors.push(`Product ${row.slug}: ${prodError.message}`);
              continue;
            }

            // Upsert variant if SKU provided
            if (row.sku && product) {
              await supabase.from("product_variants").upsert(
                {
                  product_id: product.id,
                  sku: row.sku,
                  color: row.color || null,
                  size: row.size || null,
                  price: Number(row.variant_price || row.base_price || 0),
                  compare_at_price: row.variant_compare_price ? Number(row.variant_compare_price) : null,
                  stock_quantity: Number(row.stock_quantity || 0),
                  is_active: true,
                },
                { onConflict: "sku" }
              );
            }

            created++;
          } catch (e: any) {
            errors.push(`Row error: ${e.message}`);
          }
        }

        return new Response(
          JSON.stringify({ created, updated, errors, total: products.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "bulk-price-update": {
        const { variantIds, adjustmentType, adjustmentValue } = data;
        let updated = 0;

        for (const id of variantIds) {
          const { data: variant } = await supabase
            .from("product_variants")
            .select("price")
            .eq("id", id)
            .single();

          if (!variant) continue;

          let newPrice = Number(variant.price);
          if (adjustmentType === "percentage") {
            newPrice = Math.round(newPrice * (1 + Number(adjustmentValue) / 100));
          } else if (adjustmentType === "fixed") {
            newPrice = newPrice + Number(adjustmentValue);
          } else if (adjustmentType === "set") {
            newPrice = Number(adjustmentValue);
          }

          if (newPrice > 0) {
            await supabase
              .from("product_variants")
              .update({ price: newPrice })
              .eq("id", id);
            updated++;
          }
        }

        return new Response(JSON.stringify({ updated }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk-inventory-update": {
        const { updates } = data as { updates: { variantId: string; quantity: number }[] };
        let updated = 0;

        for (const u of updates) {
          const { error } = await supabase
            .from("product_variants")
            .update({ stock_quantity: u.quantity })
            .eq("id", u.variantId);
          if (!error) updated++;
        }

        return new Response(JSON.stringify({ updated }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk-tag-update": {
        const { productIds, tagsToAdd, tagsToRemove } = data;

        for (const pid of productIds) {
          const { data: product } = await supabase
            .from("products")
            .select("tags")
            .eq("id", pid)
            .single();

          if (!product) continue;

          let tags = product.tags || [];
          if (tagsToAdd?.length) {
            tags = [...new Set([...tags, ...tagsToAdd])];
          }
          if (tagsToRemove?.length) {
            tags = tags.filter((t: string) => !tagsToRemove.includes(t));
          }

          await supabase.from("products").update({ tags }).eq("id", pid);
        }

        return new Response(JSON.stringify({ updated: productIds.length }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
