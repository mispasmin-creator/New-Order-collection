-- Migration: Standardize Role values to ADMIN / USER enum
-- Run this in Supabase SQL Editor

-- Promote existing 'master' role to ADMIN
UPDATE "USER" SET "Role" = 'ADMIN' WHERE "Role" = 'master';

-- All other roles become USER
UPDATE "USER" SET "Role" = 'USER' WHERE "Role" NOT IN ('ADMIN', 'USER');
