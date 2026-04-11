/**
 * Razorpay integration service.
 * Env vars required:
 *   RAZORPAY_KEY_ID      — rzp_live_... or rzp_test_...
 *   RAZORPAY_KEY_SECRET  — secret key (never exposed to frontend)
 */

import Razorpay from "razorpay";
import { createHmac } from "crypto";

function getClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars are required");
  }
  return new Razorpay({ key_id, key_secret });
}

export interface RazorpayOrderResult {
  id: string;           // rzp order id, e.g. order_abc123
  amount: number;       // in paise
  currency: string;
  receipt: string;
  key_id: string;       // safe to send to frontend
}

/**
 * Creates a Razorpay order for the given amount (in INR, not paise).
 */
export async function createRazorpayOrder(
  amountInr: number,
  receipt: string,
  notes?: Record<string, string>
): Promise<RazorpayOrderResult> {
  const rz = getClient();
  const amountPaise = Math.round(amountInr * 100);
  const order = await rz.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes: notes ?? {},
  });

  return {
    id: order.id,
    amount: amountPaise,
    currency: "INR",
    receipt: order.receipt ?? receipt,
    key_id: process.env.RAZORPAY_KEY_ID!,
  };
}

/**
 * Verifies the Razorpay payment signature after checkout.
 * Throws if signature is invalid.
 */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): void {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not set");

  const expected = createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    throw new Error("Invalid Razorpay payment signature");
  }
}
