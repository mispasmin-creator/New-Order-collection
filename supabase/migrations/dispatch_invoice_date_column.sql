-- Migration: Add Bill Date column to DISPATCH table
-- This is used by the Invoice page (Make Invoice) to store the Date of invoice
-- Run this in the Supabase SQL editor

ALTER TABLE "DISPATCH"
  ADD COLUMN IF NOT EXISTS "Bill Date" date;
