import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";
import { createOrderService, validateDiscountService } from "../services/orderService.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../services/razorpayService.js";
import { createSROrder, getSRCouriers } from "../services/shiprocketService.js";
import { resolveCurtainPrice } from "../lib/curtainPricing.js";
import { sanitizeCustomCurtainSize } from "../lib/gst.js";

type CartItemInput = {
  variantId: string;
  productId: string;
  quantity: number;
  customCurtainSize?: string;
  sku?: string;
};

/**
 * If a variantId stored in the customer's cart is stale (e.g. product was
 * re-imported and got a new nanoid), fall back to looking the variant up by
 * SKU so the order can still be placed without forcing a cart refresh.
 */
async function resolveCartItems(items: CartItemInput[]): Promise<CartItemInput[]> {
  if (!items.length) return items;

  const variantIds = items.map((i) => i.variantId);
  const found = await db
    .select({ id: schema.productVariants.id })
    .from(schema.productVariants)
    .where(inArray(schema.productVariants.id, variantIds));

  const foundIds = new Set(found.map((v) => v.id));
  const stale = items.filter((i) => !foundIds.has(i.variantId));
  if (!stale.length) return items;

  const staleSkus = stale.map((i) => i.sku).filter((s): s is string => Boolean(s));
  if (!staleSkus.length) return items;

  const bySkuRows = await db
    .select({ id: schema.productVariants.id, sku: schema.productVariants.sku })
    .from(schema.productVariants)
    .where(inArray(schema.productVariants.sku, staleSkus));

  const skuToId = new Map(bySkuRows.map((v) => [v.sku, v.id]));

  return items.map((item) => {
    if (foundIds.has(item.variantId)) return item;
    const resolvedId = item.sku ? skuToId.get(item.sku) : undefined;
    return resolvedId ? { ...item, variantId: resolvedId } : item;
  });
}

/** Push a freshly created order to Shiprocket (fire-and-forget). */
async function triggerShiprocket(orderId: string): Promise<void> {
  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!orderRows.length) return;
  const order = orderRows[0];
  if (order.shiprocketOrderId) return; // already pushed

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  const addr = (order.shippingAddress || {}) as Record<string, string>;
  const srItems = items.map((i) => ({
    name: i.productName,
    sku: i.sku || i.id,
    units: i.quantity,
    selling_price: Number(i.unitPrice ?? 0),
  }));

  try {
    const result = await createSROrder(
      order.orderNumber,
      order.createdAt || new Date().toISOString(),
      addr,
      srItems,
      order.paymentMethod || "cod",
      Number(order.subtotal ?? 0),
      Number(order.shippingAmount ?? 0),
      Number(order.discountAmount ?? 0)
    );

    const now = new Date().toISOString();
    await db
      .update(schema.orders)
      .set({
        shiprocketOrderId: String(result.sr_order_id),
        shiprocketShipmentId: String(result.shipment_id),
        shiprocketStatus: result.status || "New",
        shiprocketAwb: result.awb_code || null,
        shiprocketCourierName: result.courier_name || null,
        shiprocketCourierId: result.courier_company_id || null,
        shiprocketLastError: null,
        shiprocketLastErrorAt: null,
        status: "confirmed",
        updatedAt: now,
      })
      .where(eq(schema.orders.id, orderId));
  } catch (e) {
    // Record the failure so admin can surface + retry. Do NOT rethrow —
    // checkout must stay green for the customer; ops reconciles after.
    const message = e instanceof Error ? e.message : String(e);
    const now = new Date().toISOString();
    await db
      .update(schema.orders)
      .set({
        shiprocketLastError: message.slice(0, 2000),
        shiprocketLastErrorAt: now,
        updatedAt: now,
      })
      .where(eq(schema.orders.id, orderId));
    throw e;
  }
}

/**
 * Best-effort pincode serviceability pre-flight.
 * Returns null when OK, or an error string to block the checkout.
 * When Shiprocket is unreachable we log and return null (don't block revenue).
 */
async function checkPincodeServiceable(
  pincode: string | undefined,
  paymentMethod: string
): Promise<string | null> {
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return "Please enter a valid 6-digit pincode";
  }
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    return null; // Shiprocket not configured — skip pre-flight
  }
  try {
    const weight = parseFloat(process.env.SHIPROCKET_DEFAULT_WEIGHT || "0.5");
    const couriers = await getSRCouriers(pincode, weight, paymentMethod === "cod");
    if (!couriers.length) {
      return "Sorry — we don't ship to this pincode yet. Please try a different address.";
    }
    if (paymentMethod === "cod" && !couriers.some((c) => c.cod)) {
      return "Cash on Delivery is not available for this pincode. Please choose UPI.";
    }
    return null;
  } catch (e) {
    console.warn("[Shiprocket serviceability] check failed, allowing order:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function registerCheckoutRoutes(app: FastifyInstance) {
  app.post("/api/checkout/validate-discount", async (req, reply) => {
    try {
      const body = req.body as { code?: string; cartTotal?: number };
      const r = await validateDiscountService(
        db,
        String(body.code || ""),
        Number(body.cartTotal) || 0
      );
      return r;
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // COD order creation — auto-triggers Shiprocket after success
  app.post("/api/checkout/orders", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        return reply.status(401).send({ error: "You must be signed in to place an order" });
      }
      const body = req.body as {
        items?: CartItemInput[];
        shippingAddress?: Record<string, unknown>;
        paymentMethod?: string;
        discountCode?: string;
      };

      const addr = (body.shippingAddress || {}) as Record<string, string>;
      const preflight = await checkPincodeServiceable(addr.pincode, body.paymentMethod || "cod");
      if (preflight) {
        return reply.status(422).send({ error: preflight });
      }

      const resolvedItems = await resolveCartItems(body.items || []);
      const result = await createOrderService(db, auth.sub, {
        items: resolvedItems,
        shippingAddress: body.shippingAddress || {},
        paymentMethod: body.paymentMethod || "cod",
        discountCode: body.discountCode,
      });

      // Fire-and-forget Shiprocket
      triggerShiprocket(result.orderId).catch((e: unknown) => {
        console.error("[Shiprocket COD trigger] Failed:", e instanceof Error ? e.message : e);
      });

      return {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount,
        discountAmount: result.discountAmount,
      };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      if (err?.statusCode === 412 || err?.message?.includes("Insufficient")) {
        return reply.status(412).send({ error: err.message });
      }
      return sendError(reply, e);
    }
  });

  /**
   * Razorpay create-order: creates a Razorpay order AND a matching DB order
   * in `paymentStatus: "pending_payment"`. Stock is reserved immediately so
   * two customers can't race for the last unit during the payment window.
   *
   * If the customer abandons the modal, the order stays in "pending_payment"
   * and admin can reconcile against the Razorpay dashboard. If verify succeeds,
   * the existing row is promoted to "paid" (no second order created).
   */
  app.post("/api/checkout/razorpay/create-order", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        return reply.status(401).send({ error: "Sign in required to place an order" });
      }

      const body = req.body as {
        items?: CartItemInput[];
        shippingAddress?: Record<string, unknown>;
        discountCode?: string;
      };

      const rawItems = body.items || [];
      if (!rawItems.length) return reply.status(400).send({ error: "Cart is empty" });

      const addr = (body.shippingAddress || {}) as Record<string, string>;
      const preflight = await checkPincodeServiceable(addr.pincode, "upi");
      if (preflight) {
        return reply.status(422).send({ error: preflight });
      }

      // Resolve any stale variantIds via SKU fallback before touching Razorpay or DB.
      const items = await resolveCartItems(rawItems);

      // Create the Razorpay order first — if this fails we haven't touched DB.
      // We don't yet know the final amount (it's computed inside createOrderService),
      // so pre-compute it from the same pricing rules.
      const variantIds = items.map((i) => i.variantId);
      const variants = await db
        .select()
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.id, variantIds));
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      for (const item of items) {
        if (!variantMap.has(item.variantId)) {
          return reply.status(400).send({ error: `Variant ${item.variantId} not found` });
        }
      }
      const productIds = [...new Set(variants.map((v) => v.productId))];
      const products = productIds.length
        ? await db.select().from(schema.products).where(inArray(schema.products.id, productIds))
        : [];
      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const item of items) {
        const variant = variantMap.get(item.variantId)!;
        const product = productMap.get(variant.productId);
        const custom = sanitizeCustomCurtainSize(item.customCurtainSize);
        const curtainPrice = custom
          ? resolveCurtainPrice(custom, product?.tags ?? [], product?.name ?? null)
          : null;
        const unitPrice = curtainPrice ?? Number(variant.price);
        subtotal += unitPrice * (Number(item.quantity) || 1);
      }

      let discountAmount = 0;
      if (body.discountCode) {
        const discResult = await validateDiscountService(db, body.discountCode, subtotal);
        if (discResult.valid) discountAmount = discResult.discountAmount;
      }

      const shipRows = await db
        .select()
        .from(schema.shippingRules)
        .where(eq(schema.shippingRules.isActive, true))
        .limit(1);
      const freeThreshold = Number(shipRows[0]?.freeShippingThreshold ?? 999);
      const flatRate = Number(shipRows[0]?.flatRate ?? 99);
      const shippingAmount = subtotal >= freeThreshold ? 0 : flatRate;
      const total = subtotal - discountAmount + shippingAmount;

      const receipt = `rzp-${Date.now().toString(36)}`;
      const rzpOrder = await createRazorpayOrder(total, receipt, { user_id: auth.sub });

      // Now create the DB order with the razorpay_order_id linked.
      const result = await createOrderService(db, auth.sub, {
        items,
        shippingAddress: body.shippingAddress || {},
        paymentMethod: "upi",
        discountCode: body.discountCode,
        paymentStatus: "pending_payment",
        razorpayOrderId: rzpOrder.id,
      });

      return {
        razorpay_order_id: rzpOrder.id,
        amount_paise: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: rzpOrder.key_id,
        db_order_id: result.orderId,
        order_number: result.orderNumber,
      };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      if (err?.statusCode === 412 || err?.message?.includes("Insufficient")) {
        return reply.status(412).send({ error: err.message });
      }
      return sendError(reply, e);
    }
  });

  app.post("/api/checkout/validate-cart", async (req, reply) => {
    try {
      const body = req.body as { items?: { variantId: string }[] };
      const items = body.items || [];
      if (!items.length) return { invalidVariantIds: [] };

      const variantIds = items.map((i) => i.variantId).filter(Boolean);
      const found = await db
        .select({ id: schema.productVariants.id })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.id, variantIds));

      const foundIds = new Set(found.map((r) => r.id));
      const invalidVariantIds = variantIds.filter((id) => !foundIds.has(id));
      return { invalidVariantIds };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  /**
   * Razorpay verify: promotes a pre-created pending_payment order to paid.
   * Does NOT create a new order — that already happened in create-order.
   */
  app.post("/api/checkout/razorpay/verify", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        return reply.status(401).send({ error: "Sign in required" });
      }

      const body = req.body as {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      };

      if (!body.razorpay_payment_id || !body.razorpay_order_id || !body.razorpay_signature) {
        return reply.status(400).send({ error: "Missing Razorpay payment fields" });
      }

      verifyRazorpaySignature(
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature
      );

      // Look up the pre-created order
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.razorpayOrderId, body.razorpay_order_id))
        .limit(1);

      if (!rows.length) {
        return reply.status(404).send({
          error: "Payment received but order not found. Please contact support.",
        });
      }

      const order = rows[0];
      if (order.userId !== auth.sub) {
        return reply.status(403).send({ error: "Order does not belong to you" });
      }

      // Idempotency — verify may fire twice in race conditions
      if (order.paymentStatus === "paid") {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
        };
      }

      await db
        .update(schema.orders)
        .set({
          paymentStatus: "paid",
          razorpayPaymentId: body.razorpay_payment_id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.orders.id, order.id));

      triggerShiprocket(order.id).catch((e: unknown) => {
        console.error("[Shiprocket UPI trigger] Failed:", e instanceof Error ? e.message : e);
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
      };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      if (err?.message?.includes("Invalid Razorpay payment signature")) {
        return reply.status(400).send({ error: "Payment verification failed" });
      }
      return sendError(reply, e);
    }
  });
}
