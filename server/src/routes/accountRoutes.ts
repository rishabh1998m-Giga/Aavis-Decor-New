import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";
import { ApiError, sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/api/me/addresses", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) throw new ApiError(401, "Unauthorized");

      const rows = await db
        .select()
        .from(t.addresses)
        .where(eq(t.addresses.userId, auth.sub))
        .orderBy(desc(t.addresses.isDefault));

      return rows.map((r) => ({
        id: r.id,
        user_id: r.userId,
        full_name: r.fullName,
        phone: r.phone,
        address_line1: r.addressLine1,
        address_line2: r.addressLine2,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        is_default: r.isDefault,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.delete("/api/me/addresses/:id", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) throw new ApiError(401, "Unauthorized");
      const id = (req.params as { id: string }).id;
      const row = await db
        .select()
        .from(t.addresses)
        .where(eq(t.addresses.id, id))
        .limit(1);
      if (!row.length || row[0].userId !== auth.sub) {
        throw new ApiError(403, "Forbidden");
      }
      await db.delete(t.addresses).where(eq(t.addresses.id, id));
      return { ok: true };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get("/api/me/orders", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) throw new ApiError(401, "Unauthorized");

      const orderRows = await db
        .select()
        .from(t.orders)
        .where(eq(t.orders.userId, auth.sub))
        .orderBy(desc(t.orders.createdAt));

      const result = [];
      for (const order of orderRows.slice(0, 100)) {
        const items = await db
          .select()
          .from(t.orderItems)
          .where(eq(t.orderItems.orderId, order.id));
        result.push({
          id: order.id,
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
          discount_code: order.discountCode,
          discount_amount:
            order.discountAmount != null ? Number(order.discountAmount) : null,
          fulfillment_status: order.fulfillmentStatus,
          tracking_number: order.trackingNumber,
          tracking_url: order.trackingUrl,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
          order_items: items.map((d) => ({
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
          })),
        });
      }
      return result;
    } catch (e) {
      return sendError(reply, e);
    }
  });
}
