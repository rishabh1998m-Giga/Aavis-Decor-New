import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";

export async function registerPublicOrderRoutes(app: FastifyInstance) {
  app.get("/api/orders/by-number/:orderNumber", async (req, reply) => {
    const orderNumber = (req.params as { orderNumber: string }).orderNumber;
    const rows = await db
      .select()
      .from(t.orders)
      .where(eq(t.orders.orderNumber, orderNumber))
      .limit(1);
    if (!rows.length) return reply.status(404).send(null);

    const order = rows[0];
    const items = await db
      .select()
      .from(t.orderItems)
      .where(eq(t.orderItems.orderId, order.id));

    const order_items = items.map((d) => ({
      id: d.id,
      order_id: d.orderId,
      product_id: d.productId,
      variant_id: d.variantId,
      product_name: d.productName,
      variant_info: d.variantInfo,
      sku: d.sku,
      quantity: d.quantity,
      unit_price: d.unitPrice != null ? Number(d.unitPrice) : 0,
      total_price: d.totalPrice != null ? Number(d.totalPrice) : 0,
      gst_rate: d.gstRate != null ? Number(d.gstRate) : null,
      gst_amount: d.gstAmount != null ? Number(d.gstAmount) : null,
      created_at: d.createdAt,
    }));

    return {
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
      billing_address: order.billingAddress,
      discount_code: order.discountCode,
      discount_amount:
        order.discountAmount != null ? Number(order.discountAmount) : null,
      fulfillment_status: order.fulfillmentStatus,
      tracking_number: order.trackingNumber,
      tracking_url: order.trackingUrl,
      shiprocket_awb: order.shiprocketAwb,
      shiprocket_courier_name: order.shiprocketCourierName,
      shiprocket_status: order.shiprocketStatus,
      shiprocket_tracking_events: order.shiprocketTrackingEvents,
      shiprocket_last_synced: order.shiprocketLastSynced,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      order_items,
    };
  });
}
