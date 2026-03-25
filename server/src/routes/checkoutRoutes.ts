import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";
import { createOrderService, validateDiscountService } from "../services/orderService.js";

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

  app.post("/api/checkout/orders", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        return reply.status(401).send({ error: "You must be signed in to place an order" });
      }
      const body = req.body as {
        items?: Array<{
          variantId: string;
          productId: string;
          quantity: number;
          customCurtainSize?: string;
        }>;
        shippingAddress?: Record<string, unknown>;
        paymentMethod?: string;
        discountCode?: string;
      };
      const result = await createOrderService(db, auth.sub, {
        items: body.items || [],
        shippingAddress: body.shippingAddress || {},
        paymentMethod: body.paymentMethod || "cod",
        discountCode: body.discountCode,
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
}
