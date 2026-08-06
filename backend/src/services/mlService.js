import { predictDropoutRisk as stubPredict } from './mlStub.js';

export async function predictDropoutRisk(input) {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return stubPredict(input);

  const payload = {
    gpa: Number(input.promedio ?? 8),
    attendance_rate: Number(input.tasa_asistencia ?? 90),
    failed_subjects: Number(input.materias_reprobadas ?? 0),
    pending_deliverables: Number(input.entregas_pendientes ?? 0),
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
    const err = new Error('La prediccion no se pudo realizar');
    err.status = 503;
    throw err;
  }

  if (!res.ok) {
    const err = new Error('La prediccion no se pudo realizar');
    err.status = 503;
    throw err;
  }

  const data = await res.json();
  return {
    puntaje_riesgo: data.risk_score,
    nivel_riesgo: data.risk_level,
    version_modelo: data.model_version,
    factores_contribuyentes: data.contributing_features,
  };
}
