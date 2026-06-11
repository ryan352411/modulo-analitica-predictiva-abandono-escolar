-- Align an existing Supabase project schema with the Express backend contract.
-- This migration is additive where possible and preserves existing data.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

UPDATE public.users
SET institution_id = COALESCE(
  institution_id,
  (SELECT id FROM public.institutions ORDER BY created_at NULLS LAST, id LIMIT 1)
)
WHERE institution_id IS NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE public.users
SET role = CASE role
  WHEN 'coordinator' THEN 'coordinador'
  WHEN 'teacher' THEN 'docente'
  ELSE role
END;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'coordinador', 'docente'));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS matricula TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS socioeconomic_level TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS current_semester INTEGER;

UPDATE public.students
SET matricula = COALESCE(matricula, student_code),
    current_semester = COALESCE(current_semester, semester),
    socioeconomic_level = COALESCE(socioeconomic_level, 'medio');

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
UPDATE public.students
SET status = CASE status
  WHEN 'active' THEN 'activo'
  WHEN 'at_risk' THEN 'activo'
  WHEN 'dropped' THEN 'baja_definitiva'
  WHEN 'graduated' THEN 'egresado'
  ELSE status
END;
ALTER TABLE public.students
  ADD CONSTRAINT students_status_check CHECK (status IN ('activo', 'baja_temporal', 'baja_definitiva', 'egresado'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_matricula_key'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_matricula_key UNIQUE (matricula);
  END IF;
END $$;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_socioeconomic_level_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_socioeconomic_level_check CHECK (socioeconomic_level IN ('bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto'));

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_current_semester_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_current_semester_check CHECK (current_semester BETWEEN 1 AND 12);

ALTER TABLE public.academic_records ADD COLUMN IF NOT EXISTS credits_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.academic_records ADD COLUMN IF NOT EXISTS credits_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.academic_records ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE public.academic_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_gpa_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_gpa_check CHECK (gpa BETWEEN 0 AND 10);
ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_attendance_rate_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_attendance_rate_check CHECK (attendance_rate BETWEEN 0 AND 100);
ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_failed_subjects_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_failed_subjects_check CHECK (failed_subjects >= 0);
ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_credits_earned_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_credits_earned_check CHECK (credits_earned >= 0);
ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_credits_total_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_credits_total_check CHECK (credits_total >= 0);
ALTER TABLE public.academic_records DROP CONSTRAINT IF EXISTS academic_records_credits_bounds_check;
ALTER TABLE public.academic_records ADD CONSTRAINT academic_records_credits_bounds_check CHECK (credits_earned <= credits_total);

ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS contributing_features JSONB;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.predictions
SET contributing_features = COALESCE(contributing_features, top_features),
    predicted_at = COALESCE(predicted_at, created_at);

ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_risk_level_check;
UPDATE public.predictions
SET risk_level = CASE risk_level
  WHEN 'LOW' THEN 'bajo'
  WHEN 'MEDIUM' THEN 'medio'
  WHEN 'HIGH' THEN 'alto'
  WHEN 'CRITICAL' THEN 'alto'
  ELSE risk_level
END;
ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_risk_level_check CHECK (risk_level IN ('bajo', 'medio', 'alto'));

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE public.alerts
SET severity = COALESCE(
      severity,
      CASE alert_type
        WHEN 'attendance' THEN 'alta'
        WHEN 'academic' THEN 'alta'
        WHEN 'economic' THEN 'media'
        ELSE 'info'
      END
    ),
    title = COALESCE(title, 'Alerta de riesgo escolar');

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_status_check;
UPDATE public.alerts
SET status = CASE status
  WHEN 'open' THEN 'pendiente'
  WHEN 'in_progress' THEN 'en_atencion'
  WHEN 'resolved' THEN 'resuelta'
  ELSE status
END;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_status_check CHECK (status IN ('pendiente', 'en_atencion', 'resuelta', 'descartada'));
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_severity_check CHECK (severity IN ('info', 'media', 'alta', 'critica'));

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS detail JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

UPDATE public.audit_logs
SET entity = COALESCE(entity, entity_type),
    detail = COALESCE(detail, metadata);

CREATE INDEX IF NOT EXISTS idx_students_institution ON public.students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_records_student ON public.academic_records(student_id);
CREATE INDEX IF NOT EXISTS idx_predictions_student ON public.predictions(student_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_risk ON public.predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_alerts_student ON public.alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id, created_at DESC);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
