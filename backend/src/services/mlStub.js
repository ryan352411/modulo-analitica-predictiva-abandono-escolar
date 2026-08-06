const FEATURE_LABELS = {
  promedio_general: 'Promedio general bajo',
  tasa_asistencia: 'Asistencia irregular',
  materias_reprobadas: 'Materias reprobadas',
  entregas_pendientes: 'Entregas pendientes',
};

function riskLevel(score) {
  if (score >= 0.85) return 'critico';
  if (score >= 0.7) return 'alto';
  if (score >= 0.4) return 'medio';
  return 'bajo';
}

export function predictDropoutRisk(input = {}) {
  const gpa = Number(input.promedio ?? 8);
  const attendance = Number(input.tasa_asistencia ?? 90);
  const failed = Number(input.materias_reprobadas ?? 0);
  const pendingDeliverables = Number(input.entregas_pendientes ?? 0);

  const contributions = {
    promedio_general: (10 - gpa) * 0.05,
    tasa_asistencia: ((100 - attendance) / 100) * 0.3,
    materias_reprobadas: Math.min(failed, 5) * 0.05,
    entregas_pendientes: Math.min(pendingDeliverables, 6) * 0.05,
  };

  let score = Object.values(contributions).reduce((a, b) => a + b, 0);
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

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
