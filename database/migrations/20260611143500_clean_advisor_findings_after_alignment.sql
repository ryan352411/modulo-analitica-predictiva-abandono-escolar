-- Clean advisory findings introduced by compatibility alignment.

CREATE INDEX IF NOT EXISTS idx_users_institution ON public.users(institution_id);

DROP INDEX IF EXISTS public.idx_records_student;
DROP INDEX IF EXISTS public.idx_alerts_student;
DROP INDEX IF EXISTS public.idx_predictions_risk;
DROP INDEX IF EXISTS public.idx_students_institution;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
