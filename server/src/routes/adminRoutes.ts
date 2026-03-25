import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, desc, asc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";
import { ApiError, sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";
import { runBulkOperation } from "../services/orderService.js";

async function assertAdmin(req: FastifyRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) throw new ApiError(401, "Unauthorized");
  const row = await db
    .select()
    .from(t.userRoles)
    .where(eq(t.userRoles.userId, auth.sub))
    .limit(1);
  const role = row[0]?.role;
  if (role !== "admin") throw new ApiError(403, "Forbidden");
  return auth;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  await app.register(async (inner) => {
    inner.addHook("preHandler", async (req, reply) => {
      try {
        await assertAdmin(req);
      } catch (e) {
        return sendError(reply, e);
      }
    });

    inner.get("/stats", async (_req, reply) => {
      try {
      const orders = await db.select().from(t.orders).orderBy(desc(t.orders.createdAt));
      const products = await db.select({ id: t.products.id }).from(t.products);
      const profiles = await db.select({ userId: t.profiles.userId }).from(t.profiles);
      const lowVariants = await db
        .select()
        .from(t.productVariants)
        .where(sql`COALESCE(${t.productVariants.stockQuantity}, 0) <= 5`);

      const totalRevenue = orders
        .filter(
          (o) =>
            o.paymentStatus === "paid" || o.paymentMethod === "cod"
        )
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      const pendingOrders = orders.filter((o) => o.status === "pending").length;
      const codOrders = orders.filter((o) => o.paymentMethod === "cod").length;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentRevenue = orders
        .filter((o) => new Date((o.createdAt as string) || "") > sevenDaysAgo)
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { revenue: 0, orders: 0 };
      }
      orders.forEach((o) => {
        const key = ((o.createdAt as string) || "").slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].revenue += Number(o.totalAmount);
          dailyMap[key].orders += 1;
        }
      });
      const dailyData = Object.entries(dailyMap).map(([date, v]) => ({
        date: new Date(date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        revenue: Math.round(v.revenue),
        orders: v.orders,
      }));

      const productIds = [
        ...new Set(lowVariants.map((v) => v.productId).filter(Boolean)),
      ] as string[];
      const productMap = new Map<string, string>();
      if (productIds.length) {
        const prows = await db
          .select()
          .from(t.products)
          .where(inArray(t.products.id, productIds.slice(0, 30)));
        prows.forEach((p) => productMap.set(p.id, p.name));
      }

      return {
        totalOrders: orders.length,
        totalRevenue,
        totalProducts: products.length,
        totalCustomers: profiles.length,
        lowStockItems: lowVariants.map((item) => ({
          ...item,
          product_id: item.productId,
          stock_quantity: item.stockQuantity,
          productName: productMap.get(item.productId) || "—",
        })),
        pendingOrders,
        codOrders,
        recentRevenue,
        recentOrders: orders.slice(0, 10).map((o) => ({
          id: o.id,
          status: o.status,
          created_at: o.createdAt,
          total_amount: o.totalAmount != null ? Number(o.totalAmount) : 0,
        })),
        dailyData,
      };
      } catch (e) {
        return sendError(reply, e);
      }
    });

    inner.get("/customers", async (_req, reply) => {
    const profiles = await db
      .select()
      .from(t.profiles)
      .orderBy(desc(t.profiles.createdAt));

    const userIds = profiles.map((p) => p.userId).filter(Boolean);
    const orderCounts = new Map<string, number>();
    if (userIds.length) {
      const orows = await db
        .select()
        .from(t.orders)
        .where(inArray(t.orders.userId, userIds.slice(0, 30) as string[]));
      orows.forEach((o) => {
        if (o.userId)
          orderCounts.set(o.userId, (orderCounts.get(o.userId) || 0) + 1);
      });
    }

    return profiles.map((p) => ({
      id: p.userId,
      user_id: p.userId,
      full_name: p.fullName,
      phone: p.phone,
      created_at: p.createdAt,
      orderCount: orderCounts.get(p.userId) || 0,
    }));
  });

    inner.get("/orders", async (_req, reply) => {
    const orderRows = await db.select().from(t.orders).orderBy(desc(t.orders.createdAt));
    const result = [];
    for (const order of orderRows) {
      const items = await db
        .select()
        .from(t.orderItems)
        .where(eq(t.orderItems.orderId, order.id));
      result.push({
        id: order.id,
        ...firestoreOrderShape(order),
        order_items: items.map(firestoreItemShape),
      });
    }
    return result;
  });

    inner.patch("/orders/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const setObj: Partial<typeof t.orders.$inferInsert> = { updatedAt: now };
    if (body.status != null) setObj.status = String(body.status);
    if (body.fulfillment_status != null)
      setObj.fulfillmentStatus = String(body.fulfillment_status);
    if (body.tracking_number !== undefined)
      setObj.trackingNumber = body.tracking_number
        ? String(body.tracking_number)
        : null;
    if (body.tracking_url !== undefined)
      setObj.trackingUrl = body.tracking_url ? String(body.tracking_url) : null;
    if (body.payment_status != null)
      setObj.paymentStatus = String(body.payment_status);

    await db.update(t.orders).set(setObj).where(eq(t.orders.id, id));

    return { ok: true };
  });

    inner.get("/discounts", async (_req, reply) => {
    const rows = await db
      .select()
      .from(t.discounts)
      .orderBy(desc(t.discounts.createdAt));
    return rows.map((d) => ({
      id: d.id,
      code: d.code,
      type: d.type,
      value: Number(d.value),
      is_active: d.isActive,
      min_cart_value: d.minCartValue != null ? Number(d.minCartValue) : null,
      max_uses: d.maxUses,
      usage_count: d.usageCount ?? 0,
      expires_at: d.expiresAt,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    }));
  });

  inner.post("/discounts", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const id = nanoid();
    await db.insert(t.discounts).values({
      id,
      code: String(body.code || "").toUpperCase(),
      type: String(body.type || "percentage"),
      value: String(body.value ?? 0),
      isActive: Boolean(body.is_active ?? true),
      minCartValue:
        body.min_cart_value != null ? String(body.min_cart_value) : null,
      maxUses: body.max_uses != null ? Number(body.max_uses) : null,
      usageCount: 0,
      expiresAt: body.expires_at ? String(body.expires_at) : null,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  });

  inner.put("/discounts/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    await db
      .update(t.discounts)
      .set({
        code: String(body.code || "").toUpperCase(),
        type: String(body.type || "percentage"),
        value: String(body.value ?? 0),
        isActive: Boolean(body.is_active ?? true),
        minCartValue:
          body.min_cart_value != null ? String(body.min_cart_value) : null,
        maxUses: body.max_uses != null ? Number(body.max_uses) : null,
        expiresAt: body.expires_at ? String(body.expires_at) : null,
        updatedAt: now,
      })
      .where(eq(t.discounts.id, id));
    return { ok: true };
  });

  inner.delete("/discounts/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await db.delete(t.discounts).where(eq(t.discounts.id, id));
    return { ok: true };
  });

  inner.get("/collections", async (_req, reply) => {
    const rows = await db
      .select()
      .from(t.collections)
      .orderBy(desc(t.collections.createdAt));
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      image_url: c.imageUrl,
      type: c.type,
      rules: c.rules,
      is_active: c.isActive,
      sort_order: c.sortOrder,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }));
  });

  inner.post("/collections", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const id = nanoid();
    await db.insert(t.collections).values({
      id,
      title: String(body.title || ""),
      slug: String(body.slug || ""),
      description: (body.description as string) || null,
      imageUrl: (body.image_url as string) || null,
      type: String(body.type || "manual"),
      rules: (body.rules as object) ?? null,
      isActive: Boolean(body.is_active ?? true),
      sortOrder: Number(body.sort_order ?? 0),
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  });

  inner.put("/collections/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    await db
      .update(t.collections)
      .set({
        title: String(body.title ?? ""),
        slug: String(body.slug ?? ""),
        description: (body.description as string) || null,
        imageUrl: (body.image_url as string) || null,
        type: String(body.type ?? "manual"),
        rules: (body.rules as object) ?? null,
        isActive: Boolean(body.is_active ?? true),
        sortOrder: Number(body.sort_order ?? 0),
        updatedAt: now,
      })
      .where(eq(t.collections.id, id));
    return { ok: true };
  });

  inner.delete("/collections/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await db.delete(t.collectionProducts).where(eq(t.collectionProducts.collectionId, id));
    await db.delete(t.collections).where(eq(t.collections.id, id));
    return { ok: true };
  });

  inner.get("/settings/gst", async (_req, reply) => {
    const GST_DOC_ID = "default";
    const rows = await db
      .select()
      .from(t.gstSettings)
      .where(eq(t.gstSettings.id, GST_DOC_ID))
      .limit(1);
    if (!rows.length) return null;
    const g = rows[0];
    return {
      id: g.id,
      business_name: g.businessName,
      gstin: g.gstin,
      default_gst_rate: g.defaultGstRate != null ? Number(g.defaultGstRate) : null,
      business_state: g.businessState,
      business_address: g.businessAddress,
      invoice_prefix: g.invoicePrefix,
      is_gst_inclusive: g.isGstInclusive,
      created_at: g.createdAt,
      updated_at: g.updatedAt,
    };
  });

  inner.put("/settings/gst", async (req, reply) => {
    const GST_DOC_ID = "default";
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(t.gstSettings)
      .where(eq(t.gstSettings.id, GST_DOC_ID))
      .limit(1);
    const payload = {
      id: GST_DOC_ID,
      businessName: String(body.business_name || ""),
      gstin: String(body.gstin || ""),
      defaultGstRate: String(body.default_gst_rate ?? 18),
      businessState: String(body.business_state || ""),
      businessAddress: String(body.business_address || ""),
      invoicePrefix: String(body.invoice_prefix || "INV"),
      isGstInclusive: Boolean(body.is_gst_inclusive),
      nextInvoiceNumber: existing[0]?.nextInvoiceNumber ?? 1,
      createdAt: existing[0]?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing.length) {
      await db
        .update(t.gstSettings)
        .set({
          businessName: payload.businessName,
          gstin: payload.gstin,
          defaultGstRate: payload.defaultGstRate,
          businessState: payload.businessState,
          businessAddress: payload.businessAddress,
          invoicePrefix: payload.invoicePrefix,
          isGstInclusive: payload.isGstInclusive,
          updatedAt: now,
        })
        .where(eq(t.gstSettings.id, GST_DOC_ID));
    } else {
      await db.insert(t.gstSettings).values(payload);
    }
    return { ok: true };
  });

  inner.get("/shipping-rules", async (_req, reply) => {
    const rows = await db
      .select()
      .from(t.shippingRules)
      .orderBy(asc(t.shippingRules.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      flat_rate: r.flatRate != null ? Number(r.flatRate) : null,
      free_shipping_threshold:
        r.freeShippingThreshold != null ? Number(r.freeShippingThreshold) : null,
      cod_fee: r.codFee != null ? Number(r.codFee) : null,
      cod_min_order: r.codMinOrder != null ? Number(r.codMinOrder) : null,
      is_cod_available: r.isCodAvailable,
      is_active: r.isActive,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  });

  inner.put("/shipping-rules/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    await db
      .update(t.shippingRules)
      .set({
        name: (body.name as string) || null,
        flatRate:
          body.flat_rate != null ? String(body.flat_rate) : null,
        freeShippingThreshold:
          body.free_shipping_threshold != null
            ? String(body.free_shipping_threshold)
            : null,
        codFee: body.cod_fee != null ? String(body.cod_fee) : null,
        codMinOrder:
          body.cod_min_order != null ? String(body.cod_min_order) : null,
        isCodAvailable: body.is_cod_available as boolean | null,
        isActive: body.is_active as boolean | null,
        updatedAt: now,
      })
      .where(eq(t.shippingRules.id, id));
    return { ok: true };
  });

  inner.get("/products", async (_req, reply) => {
    const productsSnap = await db
      .select()
      .from(t.products)
      .orderBy(desc(t.products.createdAt));
    const productIds = productsSnap.map((d) => d.id);
    const [variantsSnap, categoriesSnap] = await Promise.all([
      productIds.length
        ? db
            .select()
            .from(t.productVariants)
            .where(
              inArray(
                t.productVariants.productId,
                productIds.slice(0, 30)
              )
            )
        : Promise.resolve([]),
      db.select().from(t.categories),
    ]);
    const categoryMap = new Map(
      categoriesSnap.map((d) => [d.id, { name: d.name }])
    );
    const variantsByProduct = new Map<string, Record<string, unknown>[]>();
    for (const d of variantsSnap) {
      const v = { id: d.id, ...variantToFirestore(d) };
      const pid = d.productId;
      if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
      variantsByProduct.get(pid)!.push(v);
    }
    return productsSnap.map((row) => {
      const p = productToAdminRow(row);
      return {
        id: row.id,
        ...p,
        categories: row.categoryId ? categoryMap.get(row.categoryId) : null,
        product_variants: variantsByProduct.get(row.id) || [],
      };
    });
  });

  inner.delete("/products/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await db.delete(t.productImages).where(eq(t.productImages.productId, id));
    await db.delete(t.productVariants).where(eq(t.productVariants.productId, id));
    await db.delete(t.products).where(eq(t.products.id, id));
    return { ok: true };
  });

  inner.get("/products/:id/images", async (req) => {
    const id = (req.params as { id: string }).id;
    const rows = await db
      .select({ id: t.productImages.id, url: t.productImages.url })
      .from(t.productImages)
      .where(eq(t.productImages.productId, id))
      .orderBy(asc(t.productImages.sortOrder));
    return rows;
  });

  inner.post("/products/upsert", async (req, reply) => {
    const body = req.body as {
      editingId?: string | null;
      product?: Record<string, unknown>;
      variants?: Array<{
        id?: string;
        sku: string;
        color?: string;
        size?: string;
        price?: string;
        compare_at_price?: string;
        stock_quantity?: string;
      }>;
      images?: Array<{ id?: string; url: string }>;
    };

    const now = new Date().toISOString();
    const pdata = body.product || {};
    const variantList = body.variants || [];
    const imageList = body.images || [];

    const prices = variantList
      .filter((v) => v.sku)
      .map((v) => Number(v.price || pdata.base_price || 0));
    const maxVariantPrice =
      prices.length > 0 ? Math.max(...prices) : Number(pdata.base_price || 0);

    let productId: string;
    const productPayload = {
      name: String(pdata.name ?? ""),
      slug: String(pdata.slug ?? ""),
      description:
        pdata.description != null ? String(pdata.description) : null,
      shortDescription:
        pdata.short_description != null
          ? String(pdata.short_description)
          : null,
      basePrice: String(pdata.base_price ?? 0),
      compareAtPrice: pdata.compare_at_price
        ? String(pdata.compare_at_price)
        : null,
      designName:
        pdata.design_name != null ? String(pdata.design_name) : null,
      categoryId: (pdata.category_id as string) || null,
      fabric: pdata.fabric != null ? String(pdata.fabric) : null,
      dimensions: pdata.dimensions != null ? String(pdata.dimensions) : null,
      careInstructions:
        pdata.care_instructions != null
          ? String(pdata.care_instructions)
          : null,
      tags: pdata.tags
        ? String(pdata.tags)
            .split(",")
            .map((x: string) => x.trim())
            .filter(Boolean)
        : null,
      isFeatured: Boolean(pdata.is_featured),
      isActive: Boolean(pdata.is_active ?? true),
      maxVariantPrice: String(maxVariantPrice),
      updatedAt: now,
    };

    if (body.editingId) {
      productId = body.editingId;
      await db
        .update(t.products)
        .set(productPayload)
        .where(eq(t.products.id, productId));
    } else {
      productId = nanoid();
      await db.insert(t.products).values({
        id: productId,
        ...productPayload,
        createdAt: now,
      });
    }

    const existingVars = await db
      .select({ id: t.productVariants.id })
      .from(t.productVariants)
      .where(eq(t.productVariants.productId, productId));
    const keepVarIds = new Set(
      variantList.map((v) => v.id).filter(Boolean) as string[]
    );
    for (const ev of existingVars) {
      if (!keepVarIds.has(ev.id)) {
        await db.delete(t.productVariants).where(eq(t.productVariants.id, ev.id));
      }
    }

    for (const v of variantList) {
      if (!v.sku) continue;
      const variantPayload = {
        productId,
        sku: v.sku,
        color: v.color || null,
        size: v.size || null,
        price: String(
          Number(v.price || pdata.base_price || 0)
        ),
        compareAtPrice: v.compare_at_price
          ? String(Number(v.compare_at_price))
          : null,
        stockQuantity: Number(v.stock_quantity || 0),
        isActive: true,
        updatedAt: now,
      };
      if (v.id) {
        await db
          .update(t.productVariants)
          .set(variantPayload)
          .where(eq(t.productVariants.id, v.id));
      } else {
        await db.insert(t.productVariants).values({
          id: nanoid(),
          ...variantPayload,
          createdAt: now,
        });
      }
    }

    const existingImgs = await db
      .select()
      .from(t.productImages)
      .where(eq(t.productImages.productId, productId));
    const keepImgIds = new Set(
      imageList.map((i) => i.id).filter(Boolean) as string[]
    );
    for (const img of existingImgs) {
      if (!keepImgIds.has(img.id)) {
        await db.delete(t.productImages).where(eq(t.productImages.id, img.id));
      }
    }

    let sort = 0;
    for (const img of imageList) {
      if (img.id) {
        await db
          .update(t.productImages)
          .set({
            url: img.url,
            sortOrder: sort,
            isPrimary: sort === 0,
          })
          .where(eq(t.productImages.id, img.id));
      } else {
        await db.insert(t.productImages).values({
          id: nanoid(),
          productId,
          url: img.url,
          sortOrder: sort,
          isPrimary: sort === 0,
          createdAt: now,
        });
      }
      sort++;
    }

    return { productId };
  });

  inner.post("/bulk", async (req, reply) => {
    const auth = await getAuthFromRequest(req);
    if (!auth) throw new ApiError(401, "Unauthorized");
    const row = await db
      .select()
      .from(t.userRoles)
      .where(eq(t.userRoles.userId, auth.sub))
      .limit(1);
    const isAdmin = row[0]?.role === "admin";
    const body = req.body as { operation?: string; data?: Record<string, unknown> };
    const result = await runBulkOperation(
      db,
      String(body.operation || ""),
      body.data || {},
      isAdmin
    );
    return result;
  });

    inner.get("/categories", async (_req, reply) => {
    const rows = await db.select().from(t.categories).orderBy(asc(t.categories.sortOrder));
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image_url: c.imageUrl,
      is_active: c.isActive,
      sort_order: c.sortOrder,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }));
  });

    inner.get("/tag-preview", async (req) => {
      const tags = String((req.query as { tags?: string }).tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 10);
      if (!tags.length) return [];
      const active = await db
        .select({
          id: t.products.id,
          name: t.products.name,
          tags: t.products.tags,
        })
        .from(t.products)
        .where(eq(t.products.isActive, true))
        .limit(200);
      return active
        .filter((p) => tags.some((tg) => (p.tags ?? []).includes(tg)))
        .slice(0, 10)
        .map((p) => ({ id: p.id, name: p.name }));
    });
  }, { prefix: "/api/admin" });
}

function firestoreOrderShape(order: typeof t.orders.$inferSelect) {
  return {
    order_number: order.orderNumber,
    user_id: order.userId,
    status: order.status,
    subtotal: Number(order.subtotal),
    gst_amount: order.gstAmount != null ? Number(order.gstAmount) : null,
    shipping_amount:
      order.shippingAmount != null ? Number(order.shippingAmount) : null,
    cod_fee: order.codFee != null ? Number(order.codFee) : null,
    total_amount: Number(order.totalAmount),
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    shipping_address: order.shippingAddress,
    billing_address: order.billingAddress,
    discount_code: order.discountCode,
    discount_amount:
      order.discountAmount != null ? Number(order.discountAmount) : null,
    fulfillment_status: order.fulfillmentStatus,
    tracking_number: order.trackingNumber,
    tracking_url: order.trackingUrl,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function firestoreItemShape(d: typeof t.orderItems.$inferSelect) {
  return {
    id: d.id,
    order_id: d.orderId,
    product_id: d.productId,
    variant_id: d.variantId,
    product_name: d.productName,
    variant_info: d.variantInfo,
    sku: d.sku,
    quantity: d.quantity,
    unit_price: Number(d.unitPrice ?? 0),
    total_price: Number(d.totalPrice ?? 0),
    gst_rate: d.gstRate != null ? Number(d.gstRate) : null,
    gst_amount: d.gstAmount != null ? Number(d.gstAmount) : null,
    created_at: d.createdAt,
  };
}

function productToAdminRow(row: typeof t.products.$inferSelect) {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    short_description: row.shortDescription,
    base_price: Number(row.basePrice),
    compare_at_price: row.compareAtPrice != null ? Number(row.compareAtPrice) : null,
    design_name: row.designName,
    category_id: row.categoryId,
    fabric: row.fabric,
    dimensions: row.dimensions,
    care_instructions: row.careInstructions,
    tags: row.tags,
    is_featured: row.isFeatured,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function variantToFirestore(d: typeof t.productVariants.$inferSelect) {
  return {
    product_id: d.productId,
    sku: d.sku,
    color: d.color,
    size: d.size,
    price: Number(d.price),
    compare_at_price:
      d.compareAtPrice != null ? Number(d.compareAtPrice) : null,
    stock_quantity: d.stockQuantity ?? 0,
    is_active: d.isActive ?? true,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}
