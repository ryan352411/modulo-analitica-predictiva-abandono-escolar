-- =============================================================
-- Módulo de Analítica Predictiva de Abandono Escolar
-- Esquema de base de datos — Supabase (PostgreSQL)
--
-- Este archivo refleja el esquema REAL desplegado en Supabase
-- (proyecto en uso por el backend Express y la Edge Function).
-- Mantiene las columnas que el código escribe realmente, incluidas
-- las heredadas (student_code/semester) además de matricula/current_semester.
-- =============================================================

-- gen_random_uuid() está disponible de forma nativa en PostgreSQL 13+.

-- 1. INSTITUTIONS ----------------------------------------------
CREATE TABLE institutions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT UNIQUE,
    address     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS -----------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    full_name       TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT DEFAULT 'docente'
                    CHECK (role IN ('admin', 'coordinador', 'docente')),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS --------------------------------------------------
-- student_code es NOT NULL y único (columna heredada que el backend
-- sigue poblando con el valor de matricula). semester se mantiene en
-- paralelo a current_semester por la misma razón.
CREATE TABLE students (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id      UUID REFERENCES institutions(id) ON DELETE SET NULL,
    student_code        TEXT UNIQUE NOT NULL,
    matricula           TEXT UNIQUE,
    full_name           TEXT NOT NULL,
    email               TEXT,
    phone               TEXT,
    birth_date          DATE,
    gender              TEXT,
    socioeconomic_level TEXT
                        CHECK (socioeconomic_level IN ('bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto')),
    enrollment_date     DATE,
    semester            INTEGER,
    current_semester    INTEGER CHECK (current_semester BETWEEN 1 AND 12),
    program             TEXT,
    status              TEXT DEFAULT 'activo'
                        CHECK (status IN ('activo', 'baja_temporal', 'baja_definitiva', 'egresado')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACADEMIC_RECORDS ------------------------------------------
CREATE TABLE academic_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    period              TEXT NOT NULL,                 -- p. ej. '2025-1'
    gpa                 NUMERIC CHECK (gpa BETWEEN 0 AND 10),
    attendance_rate     NUMERIC CHECK (attendance_rate BETWEEN 0 AND 100),
    failed_subjects     INTEGER DEFAULT 0 CHECK (failed_subjects >= 0),
    participation_score NUMERIC,
    economic_aid        BOOLEAN DEFAULT FALSE,
    distance_km         NUMERIC,
    credits_earned      INTEGER NOT NULL DEFAULT 0 CHECK (credits_earned >= 0),
    credits_total       INTEGER NOT NULL DEFAULT 0 CHECK (credits_total >= 0),
    observations        TEXT,
    recorded_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (credits_earned <= credits_total),
    UNIQUE (student_id, period)
);

-- 5. PREDICTIONS -----------------------------------------------
CREATE TABLE predictions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    generated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    risk_score            NUMERIC NOT NULL,
    risk_level            TEXT NOT NULL CHECK (risk_level IN ('bajo', 'medio', 'alto')),
    model_version         TEXT DEFAULT 'v1.0',
    top_features          JSONB,                        -- columna heredada
    contributing_features JSONB,                        -- top factores del modelo
    predicted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ALERTS ----------------------------------------------------
CREATE TABLE alerts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    prediction_id  UUID REFERENCES predictions(id) ON DELETE SET NULL,
    assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
    alert_type     TEXT CHECK (alert_type IN ('academic', 'attendance', 'economic', 'general')),
    severity       TEXT CHECK (severity IN ('info', 'media', 'alta', 'critica')),
    title          TEXT,
    message        TEXT,
    status         TEXT DEFAULT 'pendiente'
                   CHECK (status IN ('pendiente', 'en_atencion', 'resuelta', 'descartada')),
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AUDIT_LOGS ------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,               -- CREATE | UPDATE | DELETE | LOGIN | PREDICT
    entity      TEXT,                        -- students | predictions | alerts ...
    entity_type TEXT,                        -- columna heredada (= entity)
    entity_id   UUID,
    detail      JSONB,
    metadata    JSONB,                       -- columna heredada (= detail)
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INTERVENTIONS ---------------------------------------------
CREATE TABLE interventions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    result      VARCHAR DEFAULT 'pending',
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES ------------------------------------------------------
CREATE INDEX idx_students_institution  ON students(institution_id);
CREATE INDEX idx_students_status       ON students(status);
CREATE INDEX idx_records_student       ON academic_records(student_id);
CREATE INDEX idx_predictions_student   ON predictions(student_id, predicted_at DESC);
CREATE INDEX idx_predictions_risk      ON predictions(risk_level);
CREATE INDEX idx_alerts_student        ON alerts(student_id);
CREATE INDEX idx_alerts_status         ON alerts(status);
CREATE INDEX idx_audit_user            ON audit_logs(user_id, created_at DESC);

-- RLS: el frontend no debe hablar directo con Supabase. El backend usa service_role
-- y aplica autorizacion por institucion en Express. Sin politicas publicas,
-- anon/authenticated quedan denegados por defecto en la Data API.
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

-- Trigger genérico para updated_at ----------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['institutions','users','students','academic_records','predictions','alerts','interventions']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
