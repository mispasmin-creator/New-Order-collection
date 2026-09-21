-- SQL to add tracking columns for cancelled orders in ORDER RECEIPT table
-- Run this in your Supabase SQL Editor

-- 1. Add tracking columns to ORDER RECEIPT
ALTER TABLE public."ORDER RECEIPT" 
ADD COLUMN IF NOT EXISTS order_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS order_cancelled_by TEXT;

-- 2. Query to track/view all cancelled orders
-- You can use this query to create a View or just run it to see the history
SELECT 
    id, 
    "PARTY PO NO (As Per Po Exact)" as po_number,
    "Party Names" as party_name,
    "Product Name" as product_name,
    "Quantity" as quantity,
    "Firm Name" as firm_name,
    order_cancelled_at,
    order_cancelled_by,
    logistics_status
FROM public."ORDER RECEIPT"
WHERE logistics_status = 'Order Cancelled'
ORDER BY order_cancelled_at DESC;
