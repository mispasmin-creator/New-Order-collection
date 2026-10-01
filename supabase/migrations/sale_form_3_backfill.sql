-- Backfill: dispatches invoiced BEFORE Sale Form 3 existed already moved forward (TC / Delivery),
-- so record them in Sale Form 3 History as Approved. "Planned"/"Actual" = the invoice time (Actual4).
-- "Delivery Payload" stays NULL, so nothing new is inserted into DELIVERY for these rows.
-- Rows that already have a SALE FORM 3 entry (e.g. a genuinely Pending one) are left untouched.
--
-- To undo:  DELETE FROM "SALE FORM 3" WHERE "Action By" = 'System (before Sale Form 3)';

INSERT INTO "SALE FORM 3" (dispatch_id, "Status", "Planned", "Actual", "Remarks", "Action By", "Delivery Payload")
SELECT d.id, 'Approved', d."Actual4", d."Actual4",
       'Auto-approved: invoiced before Sale Form 3 was introduced',
       'System (before Sale Form 3)',
       NULL
FROM "DISPATCH" d
WHERE d."Actual4" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "SALE FORM 3" s WHERE s.dispatch_id = d.id)
ON CONFLICT (dispatch_id) DO NOTHING;
