-- SQL update to add GP% column to the ORDER RECEIPT table
-- Execute this in your Supabase SQL Editor

ALTER TABLE public."ORDER RECEIPT" 
ADD COLUMN IF NOT EXISTS "GP%" TEXT;
