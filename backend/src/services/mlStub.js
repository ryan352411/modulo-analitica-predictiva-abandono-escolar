/**
 * Stub del modelo de Machine Learning (Random Forest / XGBoost).
 * Simula la salida del microservicio Python/FastAPI que se integrará después.
 * Genera un risk_score determinístico a partir de los datos académicos,
 * de modo que los resultados sean consistentes entre llamadas.
 */

const FEATURE_POOL = [
  { feature: 'promedio_general',     label: 'Promedio general bajo' },
  { feature: 'tasa_asistencia',      label: 'Asistencia irregular' },
  { feature: 'materias_reprobadas',  label: 'Materias reprobadas' },
  { feature: 'nivel_socioeconomico', label: 'Nivel socioeconómico' },
  { feature: 'avance_creditos',      label: 'Avance de créditos lento' },
];

function riskLevel(score) {
  if (score >= 0.7) return 'alto';
  if (score >= 0.4) return 'medio';
  return 'bajo';
}

/**
 * @param {object} input — { gpa, attendance_rate, failed_subjects, credits_earned, credits_total, socioeconomic_level }
 * @returns {{ risk_score:number, risk_level:string, model_version:string, contributing_features:Array }}
 */
export function predictDropoutRisk(input = {}) {
  const gpa = Number(input.gpa ?? 8);
  const attendance = Number(input.attendance_rate ?? 90);
  const failed = Number(input.failed_subjects ?? 0);
  const creditRatio =
    input.credits_total > 0 ? input.credits_earned / input.credits_total : 1;
  const socioPenalty =
    { bajo: 0.10, medio_bajo: 0.06, medio: 0.03, medio_alto: 0.01, alto: 0 }[
      input.socioeconomic_level
    ] ?? 0.03;

  // Heurística simple que imita la salida de un Random Forest
  let score =
    (10 - gpa) * 0.05 +            // hasta 0.5 por promedio
    ((100 - attendance) / 100) * 0.3 + // hasta 0.3 por asistencia
    Math.min(failed, 5) * 0.05 +   // hasta 0.25 por reprobadas
    (1 - creditRatio) * 0.1 +      // hasta 0.1 por créditos
    socioPenalty;

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  // Top 3 factores con pesos simulados
  const contributing_features = FEATURE_POOL.slice(0, 3).map((f, i) => ({
    ...f,
    importance: Number((0.35 - i * 0.08).toFixed(2)),
  }));

  return {
    risk_score: score,
    risk_level: riskLevel(score),
    model_version: 'stub-v1 (RandomForest simulado)',
    contributing_features,
  };
}
