import { supabase } from '../config/supabase.js';
import { requireInstitution } from '../utils/request.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export async function getSummary(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const [
      { count: totalStudents },
      { count: activeAlerts },
      { count: totalPredictions },
      { data: predictions },
    ] = await Promise.all([
      supabase
        .from('alumnos')
        .select('id', { count: 'exact', head: true })
        .eq('estatus', 'activo')
        .eq('institucion_id', institutionId),
      supabase
        .from('alertas')
        .select('id, alumnos!inner(institucion_id)', { count: 'exact', head: true })
        .eq('estatus', 'pendiente')
        .eq('alumnos.institucion_id', institutionId),
      supabase
        .from('predicciones')
        .select('id, alumnos!inner(institucion_id)', { count: 'exact', head: true })
        .eq('alumnos.institucion_id', institutionId),
      supabase
        .from('predicciones')
        .select('nivel_riesgo, puntaje_riesgo, predicho_en, alumnos!inner(institucion_id)')
        .eq('alumnos.institucion_id', institutionId)
        .order('predicho_en', { ascending: false })
        .limit(500),
    ]);

    const distribution = { bajo: 0, medio: 0, alto: 0, critico: 0 };
    for (const p of predictions ?? []) distribution[p.nivel_riesgo]++;

    // Tendencia: promedio de riesgo por mes, en orden cronológico.
    const buckets = new Map();
    for (const p of predictions ?? []) {
      const key = String(p.predicho_en).slice(0, 7); // YYYY-MM
      const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
      bucket.sum += Number(p.puntaje_riesgo);
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    const risk_trend = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { sum, count }]) => {
        const [year, month] = key.split('-');
        return {
          month: key,
          label: `${MESES[Number(month) - 1]} ${year}`,
          avg_percent: Math.round((sum / count) * 100),
        };
      });

    res.json({
      data: {
        total_students: totalStudents ?? 0,
        total_predictions: totalPredictions ?? 0,
        active_alerts: activeAlerts ?? 0,
        risk_distribution: distribution,
        risk_trend,
        recent_predictions: (predictions ?? []).slice(0, 10).map(({ alumnos, ...p }) => p),
      },
    });
  } catch (e) {
    next(e);
  }
}
