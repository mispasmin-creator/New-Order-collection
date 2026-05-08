-- Database updates to support Weighment Entry in the DISPATCH table
-- This allows WeighmentEntryPage to follow TestReportPage (Stage 3 in the workflow)

ALTER TABLE public."DISPATCH" 
ADD COLUMN IF NOT EXISTS "Image Of Slip" text,
ADD COLUMN IF NOT EXISTS "Image Of Slip2" text,
ADD COLUMN IF NOT EXISTS "Image Of Slip3" text,
ADD COLUMN IF NOT EXISTS "Remarks" text,
ADD COLUMN IF NOT EXISTS "Actual Qty As Per Weighment Slip" numeric;

-- Ensure trigger exists for sequential workflow (if not already updated)
-- Stage 2 (Actual2) -> Stage 3 (Planned3)
-- Stage 3 (Actual3) -> Stage 4 (Planned4)
