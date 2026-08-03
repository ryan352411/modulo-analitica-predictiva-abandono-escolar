-- Alinea el esquema desplegado con el modelo de 4 variables y 4 niveles de riesgo.
--
-- Cambios:
--   1. historial_academico: nueva feature del modelo `entregas_pendientes`.
--   2. predicciones: extiende el nivel de riesgo para incluir 'critico'
--      (clasificacion de 4 niveles: bajo | medio | alto | critico).
--
-- Migracion aditiva y no destructiva: no elimina creditos_obtenidos/creditos_totales
-- (otras partes del codigo las siguen poblando). Idempotente: puede re-ejecutarse.
--
-- NOTA de nomenclatura: el proyecto Supabase se creo originalmente con nombres en
-- ingles y luego se renombraron TABLAS/COLUMNAS al espanol, pero los CONSTRAINTS
-- conservan su nombre en ingles (p. ej. el CHECK de nivel_riesgo se llama
-- `predictions_risk_level_check`). Por eso aqui se usan esos nombres reales.

-- 1. Nueva feature: entregas pendientes ------------------------------
ALTER TABLE public.historial_academico
  ADD COLUMN IF NOT EXISTS entregas_pendientes INTEGER DEFAULT 0;

-- Rellena registros existentes con 0 (por si la columna existiera sin default).
UPDATE public.historial_academico
SET entregas_pendientes = 0
WHERE entregas_pendientes IS NULL;

-- Nombre de constraint alineado con la convencion en ingles del proyecto.
ALTER TABLE public.historial_academico
  DROP CONSTRAINT IF EXISTS academic_records_pending_deliverables_check;
ALTER TABLE public.historial_academico
  DROP CONSTRAINT IF EXISTS historial_academico_entregas_pendientes_check;
ALTER TABLE public.historial_academico
  ADD CONSTRAINT academic_records_pending_deliverables_check
  CHECK (entregas_pendientes >= 0);

-- 2. Cuarto nivel de riesgo: 'critico' -------------------------------
-- El CHECK real desplegado es `predictions_risk_level_check`; se dropea tambien
-- la variante en espanol por si algun entorno la tuviera.
ALTER TABLE public.predicciones
  DROP CONSTRAINT IF EXISTS predictions_risk_level_check;
ALTER TABLE public.predicciones
  DROP CONSTRAINT IF EXISTS predicciones_nivel_riesgo_check;
ALTER TABLE public.predicciones
  ADD CONSTRAINT predictions_risk_level_check
  CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico'));
