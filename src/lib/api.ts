/**
 * API base: empty string = same-origin (Vite proxy / production nginx /api).
 * Set VITE_API_URL when the SPA and API use different origins.
 */
export function apiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (v === undefined || v === null || String(v).trim() === "") return "";
  return String(v).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${p}`;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiRequestError(msg || "Request failed", res.status, data);
  }
  return data as T;
}

/** Multipart upload; do not set Content-Type (browser sets boundary). */
export async function apiUpload(
  path: string,
  form: FormData
): Promise<{ url: string }> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiRequestError(msg || "Upload failed", res.status, data);
  }
  return data as { url: string };
}

export function isApiConfigured(): boolean {
  return true;
}

export function apiConfigMessage(): string | null {
  return null;
}

/**
 * Convert raw API errors into customer-facing copy.
 * Server error strings are often developer-oriented ("Validation failed: pincode invalid");
 * this maps known patterns to softer messages. Unknown errors pass through unchanged.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;
  const lower = raw.toLowerCase();

  if (lower.includes("insufficient stock")) return "One of your items just sold out. Please refresh your cart.";
  if (lower.includes("payment cancelled")) return "Payment was cancelled. Your order was not placed.";
  if (lower.includes("payment verification failed") || lower.includes("invalid razorpay")) {
    return "We couldn't verify your payment. If money was deducted it will be refunded in 5–7 days. Please try again.";
  }
  if (lower.includes("cart is empty")) return "Your cart is empty.";
  if (lower.includes("sign in") || lower.includes("unauthorized")) return "Please sign in to continue.";
  if (lower.includes("don't ship to this pincode") || lower.includes("not shippable")) return raw;
  if (lower.includes("cash on delivery is not available")) return raw;
  if (lower.includes("valid 6-digit pincode")) return raw;
  if (lower.includes("variant") && lower.includes("not found")) return "One of your items is no longer available. Please refresh your cart.";
  if (lower.includes("coupon") || lower.includes("discount")) return raw;
  if (lower.includes("network") || lower.includes("failed to fetch")) return "Network error. Please check your connection and try again.";

  // Pass-through if the message is already short and customer-readable.
  if (raw.length < 120 && !raw.includes(":")) return raw;
  return fallback;
}
