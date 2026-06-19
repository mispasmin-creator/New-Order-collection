-- Migration: Add Total Transporter Amount column to DISPATCH table
ALTER TABLE "DISPATCH" ADD COLUMN IF NOT EXISTS "Total Transporter Amount" numeric;
