import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { ApiError } from "../lib/errors.js";
import { resolveGstRate, sanitizeCustomCurtainSize } from "../lib/gst.js";

type Db = PostgresJsDatabase<typeof schema>;

export async function validateDiscountService(
  db: Db,
  code: string,
  cartTotal: number
): Promise<
  | { valid: true; discountAmount: number; type: string; value: number; code: string }
  | { valid: false; error: string }
> {
  if (!code) return { valid: false, error: "No code provided" };
  const upper = String(code).toUpperCase();
  const rows = await db
    .select()
    .from(schema.discounts)
    .where(
      and(eq(schema.discounts.code, upper), eq(schema.discounts.isActive, true))
    )
    .limit(1);
  if (rows.length === 0) return { valid: false, error: "Invalid coupon code" };
  const discount = rows[0];
  const now = new Date();
  if (discount.expiresAt && new Date(discount.expiresAt) < now) {
    return { valid: false, error: "Coupon has expired" };
  }
  if (discount.maxUses != null && (discount.usageCount ?? 0) >= discount.maxUses) {
    return { valid: false, error: "Coupon usage limit reached" };
  }
  const cart = Number(cartTotal) || 0;
  if (discount.minCartValue != null && cart < Number(discount.minCartValue)) {
    return {
      valid: false,
      error: `Minimum cart value ₹${discount.minCartValue} required`,
    };
  }
  let discountAmount = 0;
  if (discount.type === "percentage") {
    discountAmount = Math.round((cart * Number(discount.value)) / 100);
  } else {
    discountAmount = Math.min(Number(discount.value), cart);
  }
  return {
    valid: true,
    discountAmount,
    type: discount.type,
    value: Number(discount.value),
    code: discount.code,
  };
}

type OrderItemInput = {
  variantId: string;
  productId: string;
  quantity: number;
  customCurtainSize?: string;
};

export async function createOrderService(
  db: Db,
  userId: string,
  body: {
    items: OrderItemInput[];
    shippingAddress: Record<string, unknown>;
    paymentMethod: string;
    discountCode?: string;
  }
) {
  const { items, shippingAddress, paymentMethod, discountCode } = body;
  if (!items?.length) throw new ApiError(400, "Cart is empty", "invalid-argument");

  return db.transaction(async (tx) => {
    const variantIds = items.map((i) => i.variantId);
    const variantRows = await tx
      .select()
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.id, variantIds))
      .for("update");

    const variantMap = new Map(variantRows.map((v) => [v.id, v]));
    for (const item of items) {
      if (!variantMap.has(item.variantId)) {
        throw new ApiError(400, `Variant ${item.variantId} not found`, "invalid-argument");
      }
    }

    for (const item of items) {
      const v = variantMap.get(item.variantId)!;
      const stock = Number(v.stockQuantity ?? 0);
      const qty = Number(item.quantity) || 1;
      if (stock < qty) {
        throw new ApiError(
          412,
          `Insufficient stock for SKU ${v.sku}. Available: ${stock}`,
          "failed-precondition"
        );
      }
    }

    for (const item of items) {
      const v = variantMap.get(item.variantId)!;
      const qty = Number(item.quantity) || 1;
      const newStock = Number(v.stockQuantity ?? 0) - qty;
      await tx
        .update(schema.productVariants)
        .set({ stockQuantity: newStock, updatedAt: new Date().toISOString() })
        .where(eq(schema.productVariants.id, item.variantId));
    }

    const productIds = [...new Set(items.map((i) => variantMap.get(i.variantId)!.productId))];
    const productRows = await tx
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, productIds));

    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const categoryIds = [
      ...new Set(
        [...productMap.values()]
          .map((p) => p.categoryId)
          .filter((id): id is string => id != null && String(id).length > 0)
          .map((id) => String(id))
      ),
    ];

    const categorySlugById = new Map<string, string>();
    if (categoryIds.length) {
      const cats = await tx
        .select()
        .from(schema.categories)
        .where(inArray(schema.categories.id, categoryIds));
      for (const c of cats) {
        if (c.slug) categorySlugById.set(c.id, String(c.slug));
      }
    }

    let subtotal = 0;
    const orderItems: Array<{
      product_id: string;
      variant_id: string;
      product_name: string;
      variant_info: string;
      sku: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      gst_rate: number;
      gst_amount: number;
    }> = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId)!;
      const product = productMap.get(variant.productId);
      const lineTotal =
        Number(variant.price) * (Number(item.quantity) || 1);
      const gstRate = resolveGstRate(
        product
          ? {
              gst_rate: product.gstRate,
              category_id: product.categoryId,
            }
          : null,
        categorySlugById
      );
      const gstAmount = Math.round((lineTotal * gstRate) / (100 + gstRate));
      subtotal += lineTotal;
      const custom = sanitizeCustomCurtainSize(item.customCurtainSize);
      const baseVariantInfo =
        [variant.color, variant.size].filter(Boolean).join(" / ") || "Default";
      const variantInfo = custom
        ? `${baseVariantInfo} / Custom: ${custom}`
        : baseVariantInfo;
      orderItems.push({
        product_id: variant.productId,
        variant_id: item.variantId,
        product_name: product?.name ?? "Unknown",
        variant_info: variantInfo,
        sku: variant.sku,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(variant.price),
        total_price: lineTotal,
        gst_rate: gstRate,
        gst_amount: gstAmount,
      });
    }

    let discountAmount = 0;
    let appliedDiscountCode: string | null = null;

    if (discountCode) {
      const discRows = await tx
        .select()
        .from(schema.discounts)
        .where(
          and(
            eq(schema.discounts.code, String(discountCode).toUpperCase()),
            eq(schema.discounts.isActive, true)
          )
        )
        .limit(1)
        .for("update");

      if (discRows.length) {
        const disc = discRows[0];
        const now = new Date();
        const notExpired =
          !disc.expiresAt || new Date(disc.expiresAt) > now;
        const underUsage =
          disc.maxUses == null || (disc.usageCount ?? 0) < disc.maxUses;
        const meetsMin =
          disc.minCartValue == null || subtotal >= Number(disc.minCartValue);
        if (notExpired && underUsage && meetsMin) {
          if (disc.type === "percentage") {
            discountAmount = Math.round((subtotal * Number(disc.value)) / 100);
          } else {
            discountAmount = Math.min(Number(disc.value), subtotal);
          }
          appliedDiscountCode = disc.code;
          await tx
            .update(schema.discounts)
            .set({
              usageCount: (disc.usageCount ?? 0) + 1,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.discounts.id, disc.id));
        }
      }
    }

    const shipRows = await tx
      .select()
      .from(schema.shippingRules)
      .where(eq(schema.shippingRules.isActive, true))
      .limit(1);

    const shippingRules = shipRows[0] ?? null;
    const freeThreshold = Number(shippingRules?.freeShippingThreshold ?? 999);
    const flatRate = Number(shippingRules?.flatRate ?? 99);
    const codFeeRate = Number(shippingRules?.codFee ?? 49);
    const shippingAmount = subtotal >= freeThreshold ? 0 : flatRate;
    const codFee = paymentMethod === "cod" ? codFeeRate : 0;
    const gstTotal = Math.round((subtotal * 18) / 118);
    const discountNum = discountAmount;
    const totalAmount = subtotal - discountNum + shippingAmount + codFee;

    const orderNumber = `LNC-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
    const nowIso = new Date().toISOString();
    const orderId = nanoid();

    await tx.insert(schema.orders).values({
      id: orderId,
      orderNumber,
      userId,
      status: "pending",
      subtotal: String(subtotal),
      gstAmount: String(gstTotal),
      shippingAmount: String(shippingAmount),
      codFee: String(codFee),
      totalAmount: String(totalAmount),
      paymentMethod: paymentMethod || "cod",
      paymentStatus: "pending",
      shippingAddress: shippingAddress as object,
      billingAddress: shippingAddress as object,
      fulfillmentStatus: "unfulfilled",
      discountCode: appliedDiscountCode,
      discountAmount: appliedDiscountCode ? String(discountNum) : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    for (const oi of orderItems) {
      await tx.insert(schema.orderItems).values({
        id: nanoid(),
        orderId,
        productId: oi.product_id,
        variantId: oi.variant_id,
        productName: oi.product_name,
        variantInfo: oi.variant_info,
        sku: oi.sku,
        quantity: oi.quantity,
        unitPrice: String(oi.unit_price),
        totalPrice: String(oi.total_price),
        gstRate: String(oi.gst_rate),
        gstAmount: String(oi.gst_amount),
        createdAt: nowIso,
      });
    }

    return {
      orderId,
      orderNumber,
      totalAmount,
      discountAmount: discountNum,
    };
  });
}

export async function runBulkOperation(
  db: Db,
  operation: string,
  data: Record<string, unknown>,
  isAdmin: boolean
) {
  if (!isAdmin) throw new ApiError(403, "Forbidden", "permission-denied");

  switch (operation) {
    case "csv-import": {
      const products = (data?.products as Record<string, unknown>[]) || [];
      let created = 0;
      const errors: string[] = [];
      const now = new Date().toISOString();

      for (const row of products) {
        try {
          if (!row.name || !row.slug) {
            errors.push(`Row missing name or slug: ${JSON.stringify(row)}`);
            continue;
          }
          const slug = String(row.slug).trim();
          const existing = await db
            .select()
            .from(schema.products)
            .where(eq(schema.products.slug, slug))
            .limit(1);

          const payload = {
            name: row.name as string,
            slug,
            description: (row.description as string) || null,
            shortDescription: (row.short_description as string) || null,
            basePrice: String(Number(row.base_price || 0)),
            compareAtPrice:
              row.compare_at_price != null
                ? String(Number(row.compare_at_price))
                : null,
            categoryId: (row.category_id as string) || null,
            fabric: (row.fabric as string) || null,
            dimensions: (row.dimensions as string) || null,
            careInstructions: (row.care_instructions as string) || null,
            tags: row.tags
              ? String(row.tags)
                  .split(",")
                  .map((t: string) => t.trim())
              : null,
            isActive: row.is_active !== "false",
            isFeatured: row.is_featured === "true",
            updatedAt: now,
          };

          let productId: string;
          if (existing.length) {
            productId = existing[0].id;
            await db
              .update(schema.products)
              .set(payload)
              .where(eq(schema.products.id, productId));
          } else {
            productId = nanoid();
            await db.insert(schema.products).values({
              id: productId,
              ...payload,
              createdAt: now,
            });
          }

          if (row.sku && productId) {
            const sku = String(row.sku);
            const vSnap = await db
              .select()
              .from(schema.productVariants)
              .where(eq(schema.productVariants.sku, sku))
              .limit(1);

            const variantPayload = {
              productId,
              sku,
              color: (row.color as string) || null,
              size: (row.size as string) || null,
              price: String(
                Number(row.variant_price || row.base_price || 0)
              ),
              compareAtPrice:
                row.variant_compare_price != null
                  ? String(Number(row.variant_compare_price))
                  : null,
              stockQuantity: Number(row.stock_quantity || 0),
              isActive: true,
              updatedAt: now,
            };

            if (vSnap.length) {
              await db
                .update(schema.productVariants)
                .set(variantPayload)
                .where(eq(schema.productVariants.id, vSnap[0].id));
            } else {
              await db.insert(schema.productVariants).values({
                id: nanoid(),
                ...variantPayload,
                createdAt: now,
              });
            }
          }
          created++;
        } catch (e) {
          errors.push(`Row error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return { created, updated: 0, errors, total: products.length };
    }
    case "bulk-price-update": {
      const { variantIds, adjustmentType, adjustmentValue } = data as {
        variantIds?: string[];
        adjustmentType?: string;
        adjustmentValue?: number;
      };
      let updated = 0;
      const now = new Date().toISOString();
      for (const id of variantIds || []) {
        const snap = await db
          .select()
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, id))
          .limit(1);
        if (!snap.length) continue;
        const variant = snap[0];
        let newPrice = Number(variant.price);
        if (adjustmentType === "percentage") {
          newPrice = Math.round(newPrice * (1 + Number(adjustmentValue) / 100));
        } else if (adjustmentType === "fixed") {
          newPrice = newPrice + Number(adjustmentValue);
        } else if (adjustmentType === "set") {
          newPrice = Number(adjustmentValue);
        }
        if (newPrice > 0) {
          await db
            .update(schema.productVariants)
            .set({ price: String(newPrice), updatedAt: now })
            .where(eq(schema.productVariants.id, id));
          updated++;
        }
      }
      return { updated };
    }
    case "bulk-inventory-update": {
      const updates = (data?.updates as { variantId: string; quantity: number }[]) || [];
      let updated = 0;
      const now = new Date().toISOString();
      for (const u of updates) {
        const snap = await db
          .select()
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, u.variantId))
          .limit(1);
        if (snap.length) {
          await db
            .update(schema.productVariants)
            .set({
              stockQuantity: Number(u.quantity),
              updatedAt: now,
            })
            .where(eq(schema.productVariants.id, u.variantId));
          updated++;
        }
      }
      return { updated };
    }
    case "bulk-tag-update": {
      const { productIds, tagsToAdd, tagsToRemove } = data as {
        productIds?: string[];
        tagsToAdd?: string[];
        tagsToRemove?: string[];
      };
      const now = new Date().toISOString();
      for (const pid of productIds || []) {
        const snap = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, pid))
          .limit(1);
        if (!snap.length) continue;
        let tags = snap[0].tags ?? [];
        if (tagsToAdd?.length)
          tags = [...new Set([...tags, ...tagsToAdd])];
        if (tagsToRemove?.length)
          tags = tags.filter((t) => !tagsToRemove.includes(t));
        await db
          .update(schema.products)
          .set({ tags, updatedAt: now })
          .where(eq(schema.products.id, pid));
      }
      return { updated: (productIds || []).length };
    }
    case "bulk-tag-replace": {
      const { productIds, tags } = data as {
        productIds?: string[];
        tags?: string[];
      };
      const now = new Date().toISOString();
      const nextTags = tags ?? [];
      for (const pid of productIds || []) {
        await db
          .update(schema.products)
          .set({ tags: nextTags, updatedAt: now })
          .where(eq(schema.products.id, pid));
      }
      return { updated: (productIds || []).length };
    }
    default:
      throw new ApiError(400, "Unknown operation", "invalid-argument");
  }
}
