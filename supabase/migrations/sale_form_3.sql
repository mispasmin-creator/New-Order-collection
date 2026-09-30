-- Migration: Sale Form 3 approval stage (between Invoice and TC / Delivery)
-- Run this in the Supabase SQL editor BEFORE deploying the Sale Form 3 page —
-- the Invoice page writes to this table on submit.
--
-- One row per DISPATCH row. Invoice submit creates it as "Pending"; the Sale Form 3 page
-- sets it to "Approved" / "Rejected". Only on "Approved" does the dispatch move on:
--   * TC Required = No  -> the saved "Delivery Payload" is inserted into DELIVERY
--   * TC Required = Yes -> the row starts showing on the TC page
-- DISPATCH rows invoiced before this migration have no row here and keep flowing as before.

CREATE TABLE IF NOT EXISTS "SALE FORM 3" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_id bigint NOT NULL UNIQUE REFERENCES "DISPATCH"(id) ON DELETE CASCADE,
  "Status" text NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Approved', 'Rejected')),
  "Planned" timestamp without time zone,
  "Actual" timestamp without time zone,
  "Remarks" text,
  "Action By" text,
  "Delivery Payload" jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_form_3_status_idx ON "SALE FORM 3" ("Status");
