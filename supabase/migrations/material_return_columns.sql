-- Migration: Add Invoice Number and Management Remarks columns to Material Return
-- Run on Supabase SQL editor

ALTER TABLE "Material Return"
  ADD COLUMN IF NOT EXISTS "Invoice Number" TEXT,
  ADD COLUMN IF NOT EXISTS "Management Remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "Remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "Debit Note Number" TEXT,
  ADD COLUMN IF NOT EXISTS "Debit Note Amount" NUMERIC,
  ADD COLUMN IF NOT EXISTS "Debit Note Issued At" TIMESTAMP WITHOUT TIME ZONE;
