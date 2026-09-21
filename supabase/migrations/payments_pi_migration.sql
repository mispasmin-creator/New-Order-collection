-- Migration: Add Payments & PI columns to ORDER RECEIPT table
-- Run this in Supabase SQL Editor

ALTER TABLE "ORDER RECEIPT"
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS payment_received NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ DEFAULT NULL;

-- Index for quick lookups on Payments & PI page
CREATE INDEX IF NOT EXISTS idx_order_receipt_payment_status
  ON "ORDER RECEIPT" (payment_status);
