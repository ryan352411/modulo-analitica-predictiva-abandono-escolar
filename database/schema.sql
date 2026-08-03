-- =============================================================
-- Módulo de Analítica Predictiva de Abandono Escolar
-- Esquema de base de datos — Supabase (PostgreSQL)
--
-- Este archivo refleja el esquema REAL desplegado en Supabase
-- (proyecto en uso por el backend Express y la Edge Function).
-- Toda la nomenclatura de tablas y columnas está en español.
-- Mantiene las columnas heredadas (codigo_alumno/semestre) además
-- de matricula/semestre_actual porque el código las sigue poblando.
-- =============================================================

-- gen_random_uuid() está disponible de forma nativa en PostgreSQL 13+.

-- 1. INSTITUCIONES ---------------------------------------------
CREATE TABLE instituciones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       TEXT NOT NULL,
    codigo       TEXT UNIQUE,
    direccion    TEXT,
    creado_en    TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USUARIOS --------------------------------------------------
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institucion_id  UUID REFERENCES instituciones(id) ON DELETE SET NULL,
    nombre_completo TEXT NOT NULL,
    correo          TEXT UNIQUE NOT NULL,
    contrasena_hash TEXT NOT NULL,
    rol             TEXT DEFAULT 'docente'
                    CHECK (rol IN ('admin', 'coordinador', 'docente')),
    activo          BOOLEAN DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ALUMNOS ---------------------------------------------------
-- codigo_alumno es NOT NULL y único (columna heredada que el backend
-- sigue poblando con el valor de matricula). semestre se mantiene en
-- paralelo a semestre_actual por la misma razón.
CREATE TABLE alumnos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institucion_id       UUID REFERENCES instituciones(id) ON DELETE SET NULL,
    codigo_alumno        TEXT UNIQUE NOT NULL,
    matricula            TEXT UNIQUE,
    nombre_completo      TEXT NOT NULL,
    correo               TEXT,
    telefono             TEXT,
    fecha_nacimiento     DATE,
    genero               TEXT,
    nivel_socioeconomico TEXT
                         CHECK (nivel_socioeconomico IN ('bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto')),
    fecha_inscripcion    DATE,
    semestre             INTEGER,
    semestre_actual      INTEGER CHECK (semestre_actual BETWEEN 1 AND 12),
    programa             TEXT,
    estatus              TEXT DEFAULT 'activo'
                         CHECK (estatus IN ('activo', 'baja_temporal', 'baja_definitiva', 'egresado')),
    creado_en            TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HISTORIAL_ACADEMICO ---------------------------------------
CREATE TABLE historial_academico (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id             UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    periodo               TEXT NOT NULL,                 -- p. ej. '2025-1'
    promedio              NUMERIC CHECK (promedio BETWEEN 0 AND 10),
    tasa_asistencia       NUMERIC CHECK (tasa_asistencia BETWEEN 0 AND 100),
    materias_reprobadas   INTEGER DEFAULT 0 CHECK (materias_reprobadas >= 0),
    entregas_pendientes   INTEGER DEFAULT 0 CHECK (entregas_pendientes >= 0),
    puntaje_participacion NUMERIC,
    apoyo_economico       BOOLEAN DEFAULT FALSE,
    distancia_km          NUMERIC,
    creditos_obtenidos    INTEGER NOT NULL DEFAULT 0 CHECK (creditos_obtenidos >= 0),
    creditos_totales      INTEGER NOT NULL DEFAULT 0 CHECK (creditos_totales >= 0),
    observaciones         TEXT,
    registrado_en         TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (creditos_obtenidos <= creditos_totales),
    UNIQUE (alumno_id, periodo)
);

-- 5. PREDICCIONES ----------------------------------------------
CREATE TABLE predicciones (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id               UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    generado_por            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    puntaje_riesgo          NUMERIC NOT NULL,
    nivel_riesgo            TEXT NOT NULL CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
    version_modelo          TEXT DEFAULT 'v1.0',
    factores_principales    JSONB,                        -- columna heredada
    factores_contribuyentes JSONB,                        -- top factores del modelo
    predicho_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en               TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ALERTAS ---------------------------------------------------
CREATE TABLE alertas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id      UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    prediccion_id  UUID REFERENCES predicciones(id) ON DELETE SET NULL,
    asignado_a     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_alerta    TEXT CHECK (tipo_alerta IN ('academic', 'attendance', 'economic', 'general')),
    severidad      TEXT CHECK (severidad IN ('info', 'media', 'alta', 'critica')),
    titulo         TEXT,
    mensaje        TEXT,
    estatus        TEXT DEFAULT 'pendiente'
                   CHECK (estatus IN ('pendiente', 'en_atencion', 'resuelta', 'descartada')),
    resuelto_en    TIMESTAMPTZ,
    creado_en      TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REGISTROS_AUDITORIA ---------------------------------------
CREATE TABLE registros_auditoria (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion       TEXT NOT NULL,               -- CREATE | UPDATE | DELETE | LOGIN | PREDICT
    entidad      TEXT,                        -- alumnos | predicciones | alertas ...
    tipo_entidad TEXT,                        -- columna heredada (= entidad)
    entidad_id   UUID,
    detalle      JSONB,
    metadatos    JSONB,                       -- columna heredada (= detalle)
    direccion_ip VARCHAR(45),
    creado_en    TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES ------------------------------------------------------
CREATE INDEX idx_alumnos_institucion    ON alumnos(institucion_id);
CREATE INDEX idx_alumnos_estatus        ON alumnos(estatus);
CREATE INDEX idx_historial_alumno       ON historial_academico(alumno_id);
CREATE INDEX idx_predicciones_alumno    ON predicciones(alumno_id, predicho_en DESC);
CREATE INDEX idx_predicciones_riesgo    ON predicciones(nivel_riesgo);
CREATE INDEX idx_alertas_alumno         ON alertas(alumno_id);
CREATE INDEX idx_alertas_estatus        ON alertas(estatus);
CREATE INDEX idx_auditoria_usuario      ON registros_auditoria(usuario_id, creado_en DESC);

-- RLS: el frontend no debe hablar directo con Supabase. El backend usa service_role
-- y aplica autorizacion por institucion en Express. Sin politicas publicas,
-- anon/authenticated quedan denegados por defecto en la Data API.
ALTER TABLE instituciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_academico ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_auditoria ENABLE ROW LEVEL SECURITY;

-- Trigger genérico para actualizado_en ------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['instituciones','usuarios','alumnos','historial_academico','predicciones','alertas']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
