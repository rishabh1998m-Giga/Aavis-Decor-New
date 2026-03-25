CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" text,
	"updated_at" text
);

CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"full_name" text,
	"phone" text,
	"avatar_url" text,
	"created_at" text,
	"updated_at" text
);

CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"role" text DEFAULT 'customer' NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" text,
	"updated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_categories_active_sort" ON "categories" ("is_active","sort_order");

CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text REFERENCES "categories"("id"),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"slug_aliases" text[],
	"description" text,
	"short_description" text,
	"design_name" text,
	"meta_title" text,
	"meta_description" text,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"base_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"max_variant_price" numeric(14, 2),
	"compare_at_price" numeric(14, 2),
	"gst_rate" numeric(8, 2),
	"tags" text[],
	"fabric" text,
	"dimensions" text,
	"care_instructions" text,
	"created_at" text,
	"updated_at" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_slug_unique" ON "products" ("slug");
CREATE INDEX IF NOT EXISTS "idx_products_active_cat_created" ON "products" ("is_active","category_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_products_active_base" ON "products" ("is_active","base_price");
CREATE INDEX IF NOT EXISTS "idx_products_active_name" ON "products" ("is_active","name");
CREATE INDEX IF NOT EXISTS "idx_products_cat_active" ON "products" ("category_id","is_active");

CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
	"sku" text NOT NULL,
	"color" text,
	"size" text,
	"price" numeric(14, 2) NOT NULL,
	"compare_at_price" numeric(14, 2),
	"stock_quantity" integer DEFAULT 0,
	"low_stock_threshold" integer,
	"is_active" boolean DEFAULT true,
	"created_at" text,
	"updated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_variants_product" ON "product_variants" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_variants_sku" ON "product_variants" ("sku");

CREATE TABLE IF NOT EXISTS "product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
	"variant_id" text,
	"url" text NOT NULL,
	"alt_text" text,
	"sort_order" integer DEFAULT 0,
	"is_primary" boolean DEFAULT false,
	"created_at" text
);
CREATE INDEX IF NOT EXISTS "idx_product_images_product_sort" ON "product_images" ("product_id","sort_order");

CREATE TABLE IF NOT EXISTS "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"type" text NOT NULL,
	"rules" jsonb,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" text,
	"updated_at" text
);

CREATE TABLE IF NOT EXISTS "collection_products" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
	"product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
	"sort_order" integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_cp_collection" ON "collection_products" ("collection_id","sort_order");

CREATE TABLE IF NOT EXISTS "discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"is_active" boolean DEFAULT true,
	"min_cart_value" numeric(14, 2),
	"max_uses" integer,
	"usage_count" integer DEFAULT 0,
	"expires_at" text,
	"created_at" text,
	"updated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_discounts_code_upper" ON "discounts" ("code","is_active");

CREATE TABLE IF NOT EXISTS "shipping_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"flat_rate" numeric(14, 2),
	"free_shipping_threshold" numeric(14, 2),
	"cod_fee" numeric(14, 2),
	"cod_min_order" numeric(14, 2),
	"is_cod_available" boolean,
	"is_active" boolean,
	"created_at" text,
	"updated_at" text
);

CREATE TABLE IF NOT EXISTS "gst_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text,
	"business_address" text,
	"business_state" text,
	"gstin" text,
	"default_gst_rate" numeric(8, 2),
	"is_gst_inclusive" boolean,
	"invoice_prefix" text,
	"next_invoice_number" integer,
	"created_at" text,
	"updated_at" text
);

CREATE TABLE IF NOT EXISTS "pincode_serviceability" (
	"id" text PRIMARY KEY NOT NULL,
	"pincode" text NOT NULL,
	"is_serviceable" boolean,
	"is_cod_available" boolean,
	"city" text,
	"state" text,
	"estimated_days" integer,
	"created_at" text
);
CREATE INDEX IF NOT EXISTS "idx_pincode" ON "pincode_serviceability" ("pincode");

CREATE TABLE IF NOT EXISTS "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"is_default" boolean,
	"created_at" text,
	"updated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_addresses_user" ON "addresses" ("user_id");

CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL UNIQUE,
	"user_id" text REFERENCES "users"("id"),
	"status" text,
	"subtotal" numeric(14, 2) NOT NULL,
	"gst_amount" numeric(14, 2),
	"shipping_amount" numeric(14, 2),
	"cod_fee" numeric(14, 2),
	"total_amount" numeric(14, 2) NOT NULL,
	"payment_method" text,
	"payment_status" text,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"discount_code" text,
	"discount_amount" numeric(14, 2),
	"fulfillment_status" text,
	"tracking_number" text,
	"tracking_url" text,
	"created_at" text,
	"updated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_orders_user" ON "orders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_orders_number" ON "orders" ("order_number");

CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
	"product_id" text,
	"variant_id" text,
	"product_name" text NOT NULL,
	"variant_info" text,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"total_price" numeric(14, 2) NOT NULL,
	"gst_rate" numeric(8, 2),
	"gst_amount" numeric(14, 2),
	"created_at" text
);
CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items" ("order_id");