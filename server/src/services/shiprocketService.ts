/**
 * Shiprocket API service.
 * Env vars required:
 *   SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD
 * Optional:
 *   SHIPROCKET_PICKUP_LOCATION_NAME (default "Primary")
 *   SHIPROCKET_DEFAULT_WEIGHT (default 0.5 kg)
 *   SHIPROCKET_DEFAULT_LENGTH, SHIPROCKET_DEFAULT_BREADTH, SHIPROCKET_DEFAULT_HEIGHT
 *   SHIPROCKET_CHANNEL_ID
 */

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

// --- Token cache ---
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function authenticate(): Promise<string> {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error("SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD env vars are required");
  }
  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket auth failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { token: string };
  cachedToken = data.token;
  // Tokens are valid ~10 days; refresh after 9 days
  tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authenticate();
}

async function srFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${SR_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  // Retry once on 401 (token expired)
  if (res.status === 401) {
    cachedToken = null;
    const freshToken = await authenticate();
    const retry = await fetch(`${SR_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${freshToken}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    if (!retry.ok) {
      const body = await retry.text();
      throw new Error(`Shiprocket API error ${retry.status}: ${body}`);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// --- Types ---
export interface SROrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
}

export interface SRAddress {
  full_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface SRCreateOrderResult {
  sr_order_id: number;
  shipment_id: number;
  status?: string;
  awb_code?: string;
  courier_company_id?: number;
  courier_name?: string;
}

export interface SRCourier {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  etd: string;
  cod?: boolean;
}

export interface SRTrackingEvent {
  date: string;
  activity: string;
  location: string;
  "sr-status"?: string;
  "sr-status-label"?: string;
}

export interface SRTrackingResult {
  current_status: string;
  expected_delivery: string | null;
  tracking_events: SRTrackingEvent[];
  awb: string;
}

// --- API functions ---

export async function createSROrder(
  orderNumber: string,
  orderDate: string,
  address: SRAddress,
  items: SROrderItem[],
  paymentMethod: string,
  subtotal: number,
  shippingCharges: number,
  discountAmount: number
): Promise<SRCreateOrderResult> {
  const pickupLocation =
    process.env.SHIPROCKET_PICKUP_LOCATION_NAME || "Primary";
  const weight = parseFloat(process.env.SHIPROCKET_DEFAULT_WEIGHT || "0.5");
  const length = parseFloat(process.env.SHIPROCKET_DEFAULT_LENGTH || "30");
  const breadth = parseFloat(process.env.SHIPROCKET_DEFAULT_BREADTH || "20");
  const height = parseFloat(process.env.SHIPROCKET_DEFAULT_HEIGHT || "10");
  const channelId = process.env.SHIPROCKET_CHANNEL_ID
    ? parseInt(process.env.SHIPROCKET_CHANNEL_ID)
    : undefined;

  const nameParts = (address.full_name || "Customer").split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || ".";

  const payload: Record<string, unknown> = {
    order_id: orderNumber,
    order_date: orderDate.slice(0, 19).replace("T", " "),
    pickup_location: pickupLocation,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: address.address_line1 || "",
    billing_address_2: address.address_line2 || "",
    billing_city: address.city || "",
    billing_pincode: address.pincode || "",
    billing_state: address.state || "",
    billing_country: "India",
    billing_email: "",
    billing_phone: address.phone || "",
    shipping_is_billing: true,
    order_items: items,
    payment_method: paymentMethod === "cod" ? "COD" : "Prepaid",
    shipping_charges: shippingCharges,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: discountAmount,
    sub_total: subtotal,
    length,
    breadth,
    height,
    weight,
  };
  if (channelId) payload.channel_id = channelId;

  const data = await srFetch<{
    order_id: number;
    shipment_id: number;
    status?: string;
    awb_code?: string;
    courier_company_id?: number;
    courier_name?: string;
  }>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    sr_order_id: data.order_id,
    shipment_id: data.shipment_id,
    status: data.status,
    awb_code: data.awb_code,
    courier_company_id: data.courier_company_id,
    courier_name: data.courier_name,
  };
}

export async function getSRCouriers(
  deliveryPincode: string,
  weightKg: number,
  cod: boolean
): Promise<SRCourier[]> {
  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || "";
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: cod ? "1" : "0",
  });
  const data = await srFetch<{
    data?: { available_courier_companies?: Array<{
      courier_company_id: number;
      courier_name: string;
      rate: number;
      etd: string;
      cod?: number;
    }> };
  }>(`/courier/serviceability?${params.toString()}`);

  return (data?.data?.available_courier_companies || []).map((c) => ({
    courier_company_id: c.courier_company_id,
    courier_name: c.courier_name,
    rate: c.rate,
    etd: c.etd,
    cod: c.cod === 1,
  }));
}

export async function assignAWB(
  shipmentId: number,
  courierId: number
): Promise<{ awb: string; courier_name: string }> {
  const data = await srFetch<{
    awb_assign_status?: number;
    response?: { data?: { awb_code?: string; courier_name?: string } };
  }>("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({ shipment_id: String(shipmentId), courier_id: courierId }),
  });

  const awb = data?.response?.data?.awb_code || "";
  const courierName = data?.response?.data?.courier_name || "";
  if (!awb) throw new Error("AWB assignment failed or not returned by Shiprocket");
  return { awb, courier_name: courierName };
}

export async function generateLabel(shipmentId: number): Promise<string> {
  const data = await srFetch<{ label_url?: string; response?: { label_url?: string } }>(
    "/courier/generate/label",
    {
      method: "POST",
      body: JSON.stringify({ shipment_id: [String(shipmentId)] }),
    }
  );
  const url = data?.label_url || data?.response?.label_url || "";
  if (!url) throw new Error("Label generation failed or URL not returned");
  return url;
}

export async function trackByAWB(awb: string): Promise<SRTrackingResult> {
  const data = await srFetch<{
    tracking_data?: {
      shipment_track?: Array<{
        current_status?: string;
        etd?: string;
        awb_code?: string;
      }>;
      shipment_track_activities?: SRTrackingEvent[];
    };
  }>(`/courier/track/awb/${encodeURIComponent(awb)}`);

  const track = data?.tracking_data?.shipment_track?.[0];
  const activities = data?.tracking_data?.shipment_track_activities || [];

  return {
    current_status: track?.current_status || "Unknown",
    expected_delivery: track?.etd || null,
    tracking_events: activities,
    awb: track?.awb_code || awb,
  };
}

export async function cancelSROrder(srOrderId: number): Promise<void> {
  await srFetch("/orders/cancel", {
    method: "POST",
    body: JSON.stringify({ ids: [srOrderId] }),
  });
}
