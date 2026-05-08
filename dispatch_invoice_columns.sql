-- Migration: Add Bill Number and Bill Copy columns to DISPATCH table
-- These are written by the Invoice page (Make Invoice) and read by Material Return lookup
-- Run this in the Supabase SQL editor

ALTER TABLE "DISPATCH"
  ADD COLUMN IF NOT EXISTS "Bill Number" text,
  ADD COLUMN IF NOT EXISTS "Bill Copy" text;
