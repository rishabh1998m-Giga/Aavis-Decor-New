-- Shiprocket integration fields on orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_shipment_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_awb text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_courier_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_courier_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_label_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_tracking_events jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_last_synced text;
