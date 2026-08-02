import { predictDropoutRisk as stubPredict } from './mlStub.js';

/**
 * Punto único de predicción.
 * - Si ML_SERVICE_URL NO está configurada, usa el stub local.
 * - Si está configurada pero el microservicio está detenido o falla,
 *   se responde 503 (Service Unavailable), sin fallback silencioso.
 */
export async function predictDropoutRisk(input) {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return stubPredict(input);

  // El microservicio FastAPI espera los campos en inglés, pero el registro
  // académico viene en español. Se mapea la entrada al contrato de FastAPI
  // para que la predicción use los datos reales del alumno.
  const payload = {
    gpa: Number(input.promedio ?? 8),
    attendance_rate: Number(input.tasa_asistencia ?? 90),
    failed_subjects: Number(input.materias_reprobadas ?? 0),
    credits_earned: Number(input.creditos_obtenidos ?? 0),
    credits_total: Number(input.creditos_totales ?? 0),
    socioeconomic_level: input.nivel_socioeconomico ?? 'medio',
  };

  let res;
  try {
    res = await fetch(`${url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    // Microservicio detenido / inaccesible / timeout
    const err = new Error('La prediccion no se pudo realizar');
    err.status = 503;
    throw err;
  }

  if (!res.ok) {
    const err = new Error('La prediccion no se pudo realizar');
    err.status = 503;
    throw err;
  }

  // La respuesta de FastAPI viene en inglés; se mapea al esquema en español
  // que espera la tabla `predicciones` (mismo shape que el stub local).
  const data = await res.json();
  return {
    puntaje_riesgo: data.risk_score,
    nivel_riesgo: data.risk_level,
    version_modelo: data.model_version,
    factores_contribuyentes: data.contributing_features,
  };
}
