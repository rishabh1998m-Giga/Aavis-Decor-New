/** Dynamically load and open Razorpay Checkout. */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.head.appendChild(script);
  });
}

export interface RazorpayOptions {
  key: string;
  amount: number;         // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Opens Razorpay modal. Resolves on successful payment, rejects on failure/dismiss.
 */
export async function openRazorpay(options: RazorpayOptions): Promise<RazorpaySuccessPayload> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      handler: (response: RazorpaySuccessPayload) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
        ...options.modal,
      },
    });
    rzp.on("payment.failed", (response: { error: { description: string } }) => {
      reject(new Error(response.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}
