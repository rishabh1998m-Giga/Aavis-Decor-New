-- Razorpay order id persistence (for pre-verify reconciliation)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders (razorpay_order_id);

-- Shiprocket last-error surfacing (shows failed fire-and-forget pushes in admin)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_last_error text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_last_error_at text;
