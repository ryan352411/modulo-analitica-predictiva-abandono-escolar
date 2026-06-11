import { predictDropoutRisk as stubPredict } from './mlStub.js';

/**
 * Punto único de predicción.
 * Si ML_SERVICE_URL está configurada, llama al microservicio FastAPI;
 * si no responde o no está configurada, usa el stub local.
 */
export async function predictDropoutRisk(input) {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return stubPredict(input);

  try {
    const res = await fetch(`${url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`ML service respondió ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`ML service no disponible (${e.message}); usando stub.`);
    return stubPredict(input);
  }
}
