-- =============================================================
-- Módulo de Analítica Predictiva de Abandono Escolar
-- Esquema de base de datos — Supabase (PostgreSQL)
-- 7 tablas con llaves primarias UUID
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. INSTITUTIONS ----------------------------------------------
CREATE TABLE institutions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50) UNIQUE NOT NULL,
    address     TEXT,
    phone       VARCHAR(20),
    email       VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USERS -----------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'docente'
                    CHECK (role IN ('admin', 'coordinador', 'docente')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STUDENTS --------------------------------------------------
CREATE TABLE students (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    matricula           VARCHAR(50) UNIQUE NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    birth_date          DATE,
    gender              VARCHAR(20),
    socioeconomic_level VARCHAR(20)
                        CHECK (socioeconomic_level IN ('bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto')),
    enrollment_date     DATE,
    current_semester    INTEGER CHECK (current_semester BETWEEN 1 AND 12),
    program             VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'activo'
                        CHECK (status IN ('activo', 'baja_temporal', 'baja_definitiva', 'egresado')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACADEMIC_RECORDS ------------------------------------------
CREATE TABLE academic_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    period          VARCHAR(20) NOT NULL,            -- p. ej. '2025-1'
    gpa             NUMERIC(4,2) CHECK (gpa BETWEEN 0 AND 10),
    attendance_rate NUMERIC(5,2) CHECK (attendance_rate BETWEEN 0 AND 100),
    failed_subjects INTEGER NOT NULL DEFAULT 0 CHECK (failed_subjects >= 0),
    credits_earned  INTEGER NOT NULL DEFAULT 0 CHECK (credits_earned >= 0),
    credits_total   INTEGER NOT NULL DEFAULT 0 CHECK (credits_total >= 0),
    observations    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (credits_earned <= credits_total),
    UNIQUE (student_id, period)
);

-- 5. PREDICTIONS -----------------------------------------------
CREATE TABLE predictions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    risk_score            NUMERIC(5,4) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
    risk_level            VARCHAR(10) NOT NULL CHECK (risk_level IN ('bajo', 'medio', 'alto')),
    model_version         VARCHAR(50) NOT NULL DEFAULT 'stub-v1',
    contributing_features JSONB,                      -- top factores del modelo
    predicted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ALERTS ----------------------------------------------------
CREATE TABLE alerts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    prediction_id  UUID REFERENCES predictions(id) ON DELETE SET NULL,
    severity       VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'media', 'alta', 'critica')),
    title          VARCHAR(255) NOT NULL,
    message        TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                   CHECK (status IN ('pendiente', 'en_atencion', 'resuelta', 'descartada')),
    assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AUDIT_LOGS ------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,        -- CREATE | UPDATE | DELETE | LOGIN | PREDICT
    entity      VARCHAR(50) NOT NULL,        -- students | predictions | alerts ...
    entity_id   UUID,
    detail      JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  FOREACH t IN ARRAY ARRAY['institutions','users','students','academic_records','alerts']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
