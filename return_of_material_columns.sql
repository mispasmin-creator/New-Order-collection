-- Migration: Add Return of Material dispatch columns to Material Return table
-- Run on Supabase SQL editor

ALTER TABLE "Material Return"
  ADD COLUMN IF NOT EXISTS "Return Transporter Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Transporter Mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Vehicle No" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Driver Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Driver Mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Dispatched At" TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS "Return Received At" TIMESTAMP WITHOUT TIME ZONE;
