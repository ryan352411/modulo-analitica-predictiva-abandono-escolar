import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const ALLOWED_STATUS = new Set(['pendiente', 'en_atencion', 'resuelta', 'descartada']);

async function assertAlertInInstitution(alertId, institutionId) {
  const { data, error } = await supabase
    .from('alertas')
    .select('id, alumnos!inner(id, institucion_id)')
    .eq('id', alertId)
    .eq('alumnos.institucion_id', institutionId)
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
      .from('alertas')
      .select('*, alumnos!inner(nombre_completo, matricula, institucion_id)')
      .eq('alumnos.institucion_id', institutionId)
      .order('creado_en', { ascending: false });

    if (status) query = query.eq('estatus', status);
    if (severity) query = query.eq('severidad', severity);

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

    const patch = { estatus: status };
    if (status === 'en_atencion') patch.asignado_a = req.user.id;
    if (status === 'resuelta') patch.resuelto_en = new Date().toISOString();
    if (status !== 'resuelta') patch.resuelto_en = null;

    const { data, error } = await supabase
      .from('alertas')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    await audit(req, 'UPDATE', 'alertas', req.params.id, patch);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
