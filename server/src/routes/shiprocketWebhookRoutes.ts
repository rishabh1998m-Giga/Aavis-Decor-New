import type { FastifyInstance } from "fastify";
import { eq, or } from "drizzle-orm";
import { createHmac } from "crypto";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";

/** Map Shiprocket status strings to our internal order status. */
function mapSRStatus(srStatus: string): string | null {
  const s = (srStatus || "").toLowerCase();
  if (s.includes("pickup scheduled") || s.includes("pickup queued") || s.includes("pending pickup")) return "confirmed";
  if (s.includes("picked up") || s.includes("in transit") || s.includes("out for delivery")) return "shipped";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("rto") || s.includes("cancelled") || s.includes("canceled") || s.includes("undelivered")) return "cancelled";
  return null;
}

export async function registerShiprocketWebhookRoutes(app: FastifyInstance) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !secret) {
    app.log.warn(
      "[Shiprocket webhook] SHIPROCKET_WEBHOOK_SECRET not set in production — all webhook POSTs will be rejected"
    );
  } else if (secret) {
    app.log.info("[Shiprocket webhook] signature verification enabled");
  } else {
    app.log.info("[Shiprocket webhook] running unsigned (dev mode)");
  }

  app.post("/api/webhooks/shiprocket", async (req, reply) => {
    // In production the secret is REQUIRED — unsigned webhooks are spoofable.
    // In development we allow unsigned posts so curl / Postman tests work locally.
    if (isProd && !secret) {
      return reply.status(401).send({ error: "Webhook signing not configured" });
    }
    if (secret) {
      const signature = req.headers["x-shiprocket-signature"] as string | undefined;
      if (!signature) {
        return reply.status(401).send({ error: "Missing signature" });
      }
      const expected = createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (signature !== expected) {
        return reply.status(401).send({ error: "Invalid signature" });
      }
    }

    const body = req.body as Record<string, unknown>;

    // Shiprocket sends multiple event shapes; normalise key fields
    const awb = String(body.awb || body.awb_code || "").trim();
    const shipmentIdRaw = body.shipment_id;
    const currentStatus = String(body.current_status || body.status || "").trim();
    const activities = (body.shipment_track_activities as unknown[] | undefined) ?? [];
    const etd = body.etd ? String(body.etd) : null;

    if (!awb && !shipmentIdRaw) {
      return reply.status(200).send({ ok: true, skipped: true });
    }

    // Find matching order
    const conditions = [];
    if (awb) conditions.push(eq(t.orders.shiprocketAwb, awb));
    if (shipmentIdRaw) conditions.push(eq(t.orders.shiprocketShipmentId, String(shipmentIdRaw)));

    const rows = await db
      .select()
      .from(t.orders)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (!rows.length) {
      return reply.status(200).send({ ok: true, not_found: true });
    }

    const order = rows[0];
    const now = new Date().toISOString();

    // Merge new activities into existing events (deduplicate by date+activity)
    const existing = (order.shiprocketTrackingEvents as unknown[] | null) ?? [];
    const existingKeys = new Set(
      (existing as Array<Record<string, unknown>>).map((e) => `${e.date}|${e.activity}`)
    );
    const newEvents = (activities as Array<Record<string, unknown>>).filter(
      (a) => !existingKeys.has(`${a.date}|${a.activity}`)
    );
    const mergedEvents = [...(existing as Array<Record<string, unknown>>), ...newEvents];

    const internalStatus = mapSRStatus(currentStatus);

    const update: Partial<typeof t.orders.$inferInsert> = {
      shiprocketStatus: currentStatus || undefined,
      shiprocketTrackingEvents: mergedEvents as object,
      shiprocketLastSynced: now,
      updatedAt: now,
    };
    if (awb && !order.shiprocketAwb) update.shiprocketAwb = awb;
    // etd is a date string, not a URL — not stored in trackingUrl
    if (internalStatus) update.status = internalStatus;

    await db.update(t.orders).set(update).where(eq(t.orders.id, order.id));

    return reply.status(200).send({ ok: true });
  });
}
