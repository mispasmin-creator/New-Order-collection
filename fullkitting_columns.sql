-- Migration: Add Fullkitting workflow columns to DISPATCH table
-- Run this in the Supabase SQL editor before using the Fullkitting page.

ALTER TABLE "DISPATCH"
  ADD COLUMN IF NOT EXISTS "Fullkitting Actual" timestamp without time zone,
  ADD COLUMN IF NOT EXISTS "Fullkitting Amount" numeric,
  ADD COLUMN IF NOT EXISTS "Fullkitting Remarks" text,
  ADD COLUMN IF NOT EXISTS "Fullkitting Status" text,
  ADD COLUMN IF NOT EXISTS "Transporter Bill Image" text;
