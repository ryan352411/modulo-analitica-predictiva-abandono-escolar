import { supabase } from '../config/supabase.js';
import { requireInstitution } from '../utils/request.js';

export async function getSummary(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const [{ count: totalStudents }, { count: activeAlerts }, { data: predictions }] =
      await Promise.all([
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
          .select('nivel_riesgo, puntaje_riesgo, predicho_en, alumnos!inner(institucion_id)')
          .eq('alumnos.institucion_id', institutionId)
          .order('predicho_en', { ascending: false })
          .limit(500),
      ]);

    const distribution = { bajo: 0, medio: 0, alto: 0 };
    for (const p of predictions ?? []) distribution[p.nivel_riesgo]++;

    res.json({
      data: {
        total_students: totalStudents ?? 0,
        active_alerts: activeAlerts ?? 0,
        risk_distribution: distribution,
        recent_predictions: (predictions ?? []).slice(0, 10).map(({ alumnos, ...p }) => p),
      },
    });
  } catch (e) {
    next(e);
  }
}
