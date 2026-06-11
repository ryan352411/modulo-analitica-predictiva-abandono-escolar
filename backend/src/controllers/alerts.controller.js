import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const ALLOWED_STATUS = new Set(['pendiente', 'en_atencion', 'resuelta', 'descartada']);

async function assertAlertInInstitution(alertId, institutionId) {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, students!inner(id, institution_id)')
    .eq('id', alertId)
    .eq('students.institution_id', institutionId)
    .single();

  if (error || !data) {
    const err = new Error('Alerta no encontrada');
    err.status = 404;
    throw err;
  }
}

export async function listAlerts(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { status, severity } = req.query;
    let query = supabase
      .from('alerts')
      .select('*, students!inner(full_name, matricula, institution_id)')
      .eq('students.institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function updateAlert(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    await assertAlertInInstitution(req.params.id, institutionId);

    const { status } = req.body;
    if (!ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: 'Estatus de alerta invalido' });
    }

    const patch = { status };
    if (status === 'en_atencion') patch.assigned_to = req.user.id;
    if (status === 'resuelta') patch.resolved_at = new Date().toISOString();
    if (status !== 'resuelta') patch.resolved_at = null;

    const { data, error } = await supabase
      .from('alerts')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    await audit(req, 'UPDATE', 'alerts', req.params.id, patch);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
