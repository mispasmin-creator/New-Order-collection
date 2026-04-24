-- Migration: Add pi_copy and product_names columns to po_pi_records
-- Run this in Supabase SQL Editor

ALTER TABLE po_pi_records
  ADD COLUMN IF NOT EXISTS pi_copy TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_names TEXT[] DEFAULT NULL;
