import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const userRoles = pgTable("user_roles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("customer"),
});

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("idx_categories_active_sort").on(t.isActive, t.sortOrder)]
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").references(() => categories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    slugAliases: text("slug_aliases").array(),
    description: text("description"),
    shortDescription: text("short_description"),
    designName: text("design_name"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    isActive: boolean("is_active").default(true),
    isFeatured: boolean("is_featured").default(false),
    basePrice: numeric("base_price", { precision: 14, scale: 2 }).notNull().default("0"),
    maxVariantPrice: numeric("max_variant_price", { precision: 14, scale: 2 }),
    compareAtPrice: numeric("compare_at_price", { precision: 14, scale: 2 }),
    gstRate: numeric("gst_rate", { precision: 8, scale: 2 }),
    tags: text("tags").array(),
    fabric: text("fabric"),
    dimensions: text("dimensions"),
    careInstructions: text("care_instructions"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [
    uniqueIndex("idx_products_slug_unique").on(t.slug),
    index("idx_products_active_cat_created").on(t.isActive, t.categoryId, t.createdAt),
    index("idx_products_active_base").on(t.isActive, t.basePrice),
    index("idx_products_active_name").on(t.isActive, t.name),
    index("idx_products_cat_active").on(t.categoryId, t.isActive),
  ]
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    color: text("color"),
    size: text("size"),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 14, scale: 2 }),
    stockQuantity: integer("stock_quantity").default(0),
    lowStockThreshold: integer("low_stock_threshold"),
    isActive: boolean("is_active").default(true),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("idx_variants_product").on(t.productId), index("idx_variants_sku").on(t.sku)]
);

export const productImages = pgTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id"),
    url: text("url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0),
    isPrimary: boolean("is_primary").default(false),
    createdAt: text("created_at"),
  },
  (t) => [
    index("idx_product_images_product_sort").on(t.productId, t.sortOrder),
  ]
);

export const collections = pgTable("collections", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  type: text("type").notNull(),
  rules: jsonb("rules"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const collectionProducts = pgTable(
  "collection_products",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
  },
  (t) => [index("idx_cp_collection").on(t.collectionId, t.sortOrder)]
);

export const discounts = pgTable(
  "discounts",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type").notNull(),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true),
    minCartValue: numeric("min_cart_value", { precision: 14, scale: 2 }),
    maxUses: integer("max_uses"),
    usageCount: integer("usage_count").default(0),
    expiresAt: text("expires_at"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("idx_discounts_code_upper").on(t.code, t.isActive)]
);

export const shippingRules = pgTable("shipping_rules", {
  id: text("id").primaryKey(),
  name: text("name"),
  flatRate: numeric("flat_rate", { precision: 14, scale: 2 }),
  freeShippingThreshold: numeric("free_shipping_threshold", { precision: 14, scale: 2 }),
  codFee: numeric("cod_fee", { precision: 14, scale: 2 }),
  codMinOrder: numeric("cod_min_order", { precision: 14, scale: 2 }),
  isCodAvailable: boolean("is_cod_available"),
  isActive: boolean("is_active"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const gstSettings = pgTable("gst_settings", {
  id: text("id").primaryKey(),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessState: text("business_state"),
  gstin: text("gstin"),
  defaultGstRate: numeric("default_gst_rate", { precision: 8, scale: 2 }),
  isGstInclusive: boolean("is_gst_inclusive"),
  invoicePrefix: text("invoice_prefix"),
  nextInvoiceNumber: integer("next_invoice_number"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const pincodeServiceability = pgTable(
  "pincode_serviceability",
  {
    id: text("id").primaryKey(),
    pincode: text("pincode").notNull(),
    isServiceable: boolean("is_serviceable"),
    isCodAvailable: boolean("is_cod_available"),
    city: text("city"),
    state: text("state"),
    estimatedDays: integer("estimated_days"),
    createdAt: text("created_at"),
  },
  (t) => [index("idx_pincode").on(t.pincode)]
);

export const addresses = pgTable(
  "addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [index("idx_addresses_user").on(t.userId)]
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    userId: text("user_id").references(() => users.id),
    status: text("status"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }),
    shippingAmount: numeric("shipping_amount", { precision: 14, scale: 2 }),
    codFee: numeric("cod_fee", { precision: 14, scale: 2 }),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: text("payment_method"),
    paymentStatus: text("payment_status"),
    shippingAddress: jsonb("shipping_address"),
    billingAddress: jsonb("billing_address"),
    discountCode: text("discount_code"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }),
    fulfillmentStatus: text("fulfillment_status"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (t) => [
    index("idx_orders_user").on(t.userId),
    index("idx_orders_number").on(t.orderNumber),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    variantId: text("variant_id"),
    productName: text("product_name").notNull(),
    variantInfo: text("variant_info"),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
    gstRate: numeric("gst_rate", { precision: 8, scale: 2 }),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }),
    createdAt: text("created_at"),
  },
  (t) => [index("idx_order_items_order").on(t.orderId)]
);
