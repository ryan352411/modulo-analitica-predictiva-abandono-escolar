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
  entregas_pendientes:  'Entregas pendientes',
};

function riskLevel(score) {
  if (score >= 0.85) return 'critico';
  if (score >= 0.7) return 'alto';
  if (score >= 0.4) return 'medio';
  return 'bajo';
}

/**
 * @param {object} input — { promedio, tasa_asistencia, materias_reprobadas, entregas_pendientes }
 * @returns {{ puntaje_riesgo:number, nivel_riesgo:string, version_modelo:string, factores_contribuyentes:Array }}
 */
export function predictDropoutRisk(input = {}) {
  const gpa = Number(input.promedio ?? 8);
  const attendance = Number(input.tasa_asistencia ?? 90);
  const failed = Number(input.materias_reprobadas ?? 0);
  const pendingDeliverables = Number(input.entregas_pendientes ?? 0);

  // Heurística simple que imita la salida de un Random Forest.
  // Cada variable aporta una contribución concreta al score.
  const contributions = {
    promedio_general:     (10 - gpa) * 0.05,            // hasta 0.5 por promedio
    tasa_asistencia:      ((100 - attendance) / 100) * 0.3, // hasta 0.3 por asistencia
    materias_reprobadas:  Math.min(failed, 5) * 0.05,   // hasta 0.25 por reprobadas
    entregas_pendientes:  Math.min(pendingDeliverables, 6) * 0.05, // hasta 0.3 por entregas
  };

  let score = Object.values(contributions).reduce((a, b) => a + b, 0);
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  // Top 3 factores que más pesan en ESTE alumno, con importancia relativa.
  const total = Object.values(contributions).reduce((a, b) => a + Math.max(b, 0), 0);
  const factores_contribuyentes = Object.entries(contributions)
    .map(([feature, value]) => ({ feature, value: Math.max(value, 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(({ feature, value }) => ({
      feature,
      label: FEATURE_LABELS[feature],
      importance: Number((total > 0 ? value / total : 0).toFixed(2)),
    }));

  return {
    puntaje_riesgo: score,
    nivel_riesgo: riskLevel(score),
    version_modelo: 'stub-v1 (RandomForest simulado)',
    factores_contribuyentes,
  };
}
