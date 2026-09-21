-- Migration: Add PI Due Date column to ORDER RECEIPT table
-- Run this in Supabase SQL Editor

ALTER TABLE "ORDER RECEIPT"
  ADD COLUMN IF NOT EXISTS "PI Due Date" DATE DEFAULT NULL;
