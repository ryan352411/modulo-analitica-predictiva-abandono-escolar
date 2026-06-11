import { supabase } from '../config/supabase.js';
import { requireInstitution } from '../utils/request.js';

export async function getSummary(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const [{ count: totalStudents }, { count: activeAlerts }, { data: predictions }] =
      await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'activo')
          .eq('institution_id', institutionId),
        supabase
          .from('alerts')
          .select('id, students!inner(institution_id)', { count: 'exact', head: true })
          .eq('status', 'pendiente')
          .eq('students.institution_id', institutionId),
        supabase
          .from('predictions')
          .select('risk_level, risk_score, predicted_at, students!inner(institution_id)')
          .eq('students.institution_id', institutionId)
          .order('predicted_at', { ascending: false })
          .limit(500),
      ]);

    const distribution = { bajo: 0, medio: 0, alto: 0 };
    for (const p of predictions ?? []) distribution[p.risk_level]++;

    res.json({
      data: {
        total_students: totalStudents ?? 0,
        active_alerts: activeAlerts ?? 0,
        risk_distribution: distribution,
        recent_predictions: (predictions ?? []).slice(0, 10).map(({ students, ...p }) => p),
      },
    });
  } catch (e) {
    next(e);
  }
}
