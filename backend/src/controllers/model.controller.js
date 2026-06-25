import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const ML_URL = () => process.env.ML_SERVICE_URL;

async function mlFetch(path, options = {}, timeout = 8000) {
  const url = ML_URL();
  if (!url) return null;
  const res = await fetch(`${url}${path}`, {
    ...options,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`ML service respondió ${res.status}`);
  return res.json();
}

/**
 * Información del modelo activo: estado del microservicio + métricas/versión.
 * Si ML_SERVICE_URL no está configurada, reporta el modo stub local.
 */
export async function getModelInfo(req, res, next) {
  try {
    const institutionId = requireInstitution(req);

    // Última versión de modelo realmente usada en esta institución.
    const { data: lastPrediction } = await supabase
      .from('predictions')
      .select('model_version, predicted_at, students!inner(institution_id)')
      .eq('students.institution_id', institutionId)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let service = { mode: 'stub-local', available: false };
    if (ML_URL()) {
      try {
        const info = await mlFetch('/model-info');
        service = { mode: 'ml-service', available: true, ...(info ?? {}) };
      } catch (e) {
        service = { mode: 'ml-service', available: false, error: e.message };
      }
    }

    res.json({
      data: {
        service,
        last_used_version: lastPrediction?.model_version ?? null,
        last_prediction_at: lastPrediction?.predicted_at ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Dispara el reentrenamiento en el microservicio ML. Requiere ML_SERVICE_URL.
 */
export async function retrainModel(req, res, next) {
  try {
    if (!ML_URL()) {
      return res.status(503).json({
        error: 'Reentrenamiento no disponible: configura ML_SERVICE_URL (modo stub local activo)',
      });
    }

    const result = await mlFetch('/retrain', { method: 'POST' }, 120000);
    await audit(req, 'RETRAIN', 'model', null, result);
    res.json({ data: result });
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return res.status(504).json({ error: 'El reentrenamiento excedió el tiempo de espera' });
    }
    next(e);
  }
}
