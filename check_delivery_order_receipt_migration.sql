-- Move Check for Delivery to ORDER RECEIPT level (runs before Arrange Logistics)
-- Check for Delivery no longer operates on splits; it now checks PO rows directly
-- after Received Accounts (Actual 2) and before Arrange Logistics.

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_actual timestamp without time zone;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_in_stock_or_not text;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_production_order_no text;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_qty_transferred numeric;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_batch_number_remarks text;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_indent_self_batch_number text;

ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS check_delivery_gp_percent numeric;
