/**
 * Stub del modelo de Machine Learning (Random Forest / XGBoost).
 * Simula la salida del microservicio Python/FastAPI que se integrará después.
 * Genera un risk_score determinístico a partir de los datos académicos,
 * de modo que los resultados sean consistentes entre llamadas.
 */

const FEATURE_LABELS = {
  promedio_general:     'Promedio general bajo',
  tasa_asistencia:      'Asistencia irregular',
  materias_reprobadas:  'Materias reprobadas',
  avance_creditos:      'Avance de créditos lento',
  nivel_socioeconomico: 'Nivel socioeconómico',
};

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

  // Heurística simple que imita la salida de un Random Forest.
  // Cada variable aporta una contribución concreta al score.
  const contributions = {
    promedio_general:     (10 - gpa) * 0.05,            // hasta 0.5 por promedio
    tasa_asistencia:      ((100 - attendance) / 100) * 0.3, // hasta 0.3 por asistencia
    materias_reprobadas:  Math.min(failed, 5) * 0.05,   // hasta 0.25 por reprobadas
    avance_creditos:      (1 - creditRatio) * 0.1,      // hasta 0.1 por créditos
    nivel_socioeconomico: socioPenalty,
  };

  let score = Object.values(contributions).reduce((a, b) => a + b, 0);
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  // Top 3 factores que más pesan en ESTE alumno, con importancia relativa.
  const total = Object.values(contributions).reduce((a, b) => a + Math.max(b, 0), 0);
  const contributing_features = Object.entries(contributions)
    .map(([feature, value]) => ({ feature, value: Math.max(value, 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(({ feature, value }) => ({
      feature,
      label: FEATURE_LABELS[feature],
      importance: Number((total > 0 ? value / total : 0).toFixed(2)),
    }));

  return {
    risk_score: score,
    risk_level: riskLevel(score),
    model_version: 'stub-v1 (RandomForest simulado)',
    contributing_features,
  };
}
