-- Trigger function for DISPATCH table to handle sequential workflow and delays
CREATE OR REPLACE FUNCTION public.handle_dispatch_workflow()
RETURNS TRIGGER AS $$
BEGIN

  -- On INSERT: Set Planned1 equal to Timestamp
  IF TG_OP = 'INSERT' THEN
    IF NEW."Planned1" IS NULL THEN
      NEW."Planned1" := NEW."Timestamp";
    END IF;
  END IF;

  -- On UPDATE: Set next Planned equal to corresponding Actual
  IF TG_OP = 'UPDATE' THEN
    
    -- Stage 1 -> Stage 2
    IF NEW."Actual1" IS NOT NULL AND OLD."Actual1" IS NULL THEN
      NEW."Planned2" := NEW."Actual1";
    END IF;

    -- Stage 2 -> Stage 3
    IF NEW."Actual2" IS NOT NULL AND OLD."Actual2" IS NULL THEN
      NEW."Planned3" := NEW."Actual2";
    END IF;

    -- Stage 3 -> Stage 4
    IF NEW."Actual3" IS NOT NULL AND OLD."Actual3" IS NULL THEN
      NEW."Planned4" := NEW."Actual3";
    END IF;

  END IF;

  -- Calculate Delays for all stages (converted to hours)
  
  -- Stage 1 Delay
  IF NEW."Actual1" IS NOT NULL AND NEW."Planned1" IS NOT NULL THEN
    NEW."Delay1" := EXTRACT(EPOCH FROM (NEW."Actual1" - NEW."Planned1")) / 3600;
  END IF;

  -- Stage 2 Delay
  IF NEW."Actual2" IS NOT NULL AND NEW."Planned2" IS NOT NULL THEN
    NEW."Delay2" := EXTRACT(EPOCH FROM (NEW."Actual2" - NEW."Planned2")) / 3600;
  END IF;

  -- Stage 3 Delay
  IF NEW."Actual3" IS NOT NULL AND NEW."Planned3" IS NOT NULL THEN
    NEW."Delay3" := EXTRACT(EPOCH FROM (NEW."Actual3" - NEW."Planned3")) / 3600;
  END IF;

  -- Stage 4 Delay
  IF NEW."Actual4" IS NOT NULL AND NEW."Planned4" IS NOT NULL THEN
    NEW."Delay4" := EXTRACT(EPOCH FROM (NEW."Actual4" - NEW."Planned4")) / 3600;
  END IF;

  RETURN NEW;

END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_dispatch_workflow ON public."DISPATCH";

CREATE TRIGGER trg_dispatch_workflow
BEFORE INSERT OR UPDATE ON public."DISPATCH"
FOR EACH ROW EXECUTE FUNCTION public.handle_dispatch_workflow();
