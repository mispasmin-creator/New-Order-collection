-- Run this in your Supabase SQL Editor.
-- Adds a dedicated "Cancelled Qty" column to ORDER RECEIPT so cancelled quantity is
-- tracked separately from Dispatched/Pending Qty, instead of being folded into Quantity.

-- 1. Add the new column
ALTER TABLE public."ORDER RECEIPT"
ADD COLUMN IF NOT EXISTS "Cancelled Qty" NUMERIC DEFAULT 0;

-- 2. One-time backfill / fix-up.
-- The very first version of the Cancel Order feature (before this fix) reduced "Quantity"
-- directly instead of using a separate column, and recorded the cancelled amount inside
-- order_cancelled_reason as "... (Cancelled Qty: X)". That made the item look fully
-- dispatched in History (Quantity == Delivered) instead of showing it as partly cancelled.
-- This restores the original Quantity and moves that amount into "Cancelled Qty" for every
-- row that still carries that marker (only rows cancelled before this fix have it) — this
-- includes the DO-465 / LC-80 order.
UPDATE public."ORDER RECEIPT"
SET
  "Quantity" = "Quantity" + (regexp_match(order_cancelled_reason, '\(Cancelled Qty: ([\d.]+)\)'))[1]::numeric,
  "Cancelled Qty" = COALESCE("Cancelled Qty", 0) + (regexp_match(order_cancelled_reason, '\(Cancelled Qty: ([\d.]+)\)'))[1]::numeric,
  order_cancelled_reason = trim(regexp_replace(order_cancelled_reason, '\s*\(Cancelled Qty: [\d.]+\)', ''))
WHERE order_cancelled_reason ~ '\(Cancelled Qty: [\d.]+\)';

-- 3. Sanity check — after running, this should show the corrected numbers.
-- SELECT id, "DO-Delivery Order No.", "Product Name", "Quantity", "Delivered", "Pending Qty",
--        "Cancelled Qty", order_cancelled_reason
-- FROM public."ORDER RECEIPT"
-- WHERE "DO-Delivery Order No." = 'DO-465';
