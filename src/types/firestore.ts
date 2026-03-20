/** Shared types for Firestore documents. Field names match Firestore (snake_case). */

export type UserRole = "admin" | "staff" | "customer";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";
export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface AddressRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductRow {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  slug_aliases?: string[];
  description: string | null;
  short_description: string | null;
  design_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  base_price: number;
  compare_at_price: number | null;
  gst_rate: number | null;
  tags: string[] | null;
  fabric: string | null;
  dimensions: string | null;
  care_instructions: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  url: string;
  alt_text: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
  created_at: string | null;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  status: OrderStatus | null;
  subtotal: number;
  gst_amount: number | null;
  shipping_amount: number | null;
  cod_fee: number | null;
  total_amount: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  shipping_address: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  discount_code: string | null;
  discount_amount: number | null;
  fulfillment_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_info: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  gst_rate: number | null;
  gst_amount: number | null;
  created_at: string | null;
}

export interface DiscountRow {
  id: string;
  code: string;
  type: string;
  value: number;
  is_active: boolean;
  min_cart_value: number | null;
  max_uses: number | null;
  usage_count: number;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  type: string;
  rules: unknown;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CollectionProductRow {
  id: string;
  collection_id: string;
  product_id: string;
  sort_order: number;
}

export interface GstSettingsRow {
  id: string;
  business_name: string | null;
  business_address: string | null;
  business_state: string | null;
  gstin: string | null;
  default_gst_rate: number | null;
  is_gst_inclusive: boolean | null;
  invoice_prefix: string | null;
  next_invoice_number: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ShippingRuleRow {
  id: string;
  name: string;
  flat_rate: number | null;
  free_shipping_threshold: number | null;
  cod_fee: number | null;
  cod_min_order: number | null;
  is_cod_available: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PincodeServiceabilityRow {
  id: string;
  pincode: string;
  is_serviceable: boolean | null;
  is_cod_available: boolean | null;
  city: string | null;
  state: string | null;
  estimated_days: number | null;
  created_at: string | null;
}
