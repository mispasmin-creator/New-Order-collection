-- Migration: Add return freight rate fields to Material Return table
-- Run this in the Supabase SQL editor before using return dispatch Paid by Us rate fields.

ALTER TABLE "Material Return"
  ADD COLUMN IF NOT EXISTS "Return Transporter Type" TEXT,
  ADD COLUMN IF NOT EXISTS "Return Transport Rate" NUMERIC;
