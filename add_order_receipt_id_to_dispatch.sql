-- Migration: Add "Order Receipt id" column to public."DISPATCH" table and relate it to public."ORDER RECEIPT" (id)
-- Run this query in your Supabase SQL Editor

ALTER TABLE public."DISPATCH"
  ADD COLUMN IF NOT EXISTS "Order Receipt id" bigint;

ALTER TABLE public."DISPATCH"
  ADD CONSTRAINT fk_dispatch_order_receipt
  FOREIGN KEY ("Order Receipt id")
  REFERENCES public."ORDER RECEIPT" (id)
  ON DELETE SET NULL;
