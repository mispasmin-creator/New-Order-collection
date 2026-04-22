-- Migration: Add Invoice Number and Management Remarks columns to Material Return
-- Run on Supabase SQL editor

ALTER TABLE "Material Return"
  ADD COLUMN IF NOT EXISTS "Invoice Number" TEXT,
  ADD COLUMN IF NOT EXISTS "Management Remarks" TEXT;
