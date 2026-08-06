import { supabase } from '../config/supabase.js';
import { requireInstitution } from '../utils/request.js';

export async function listAuditLogs(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { usuario, accion, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const from = (pageNumber - 1) * limitNumber;

    const { data: members, error: mErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('institucion_id', institutionId);
    if (mErr) throw mErr;
    const memberIds = (members ?? []).map((m) => m.id);
    if (!memberIds.length)
      return res.json({ data: [], total: 0, page: pageNumber, limit: limitNumber });

    let query = supabase
      .from('registros_auditoria')
      .select('id, usuario_id, accion, entidad, entidad_id, detalle, direccion_ip, creado_en', {
        count: 'exact',
      })
      .in('usuario_id', memberIds)
      .order('creado_en', { ascending: false });

    if (usuario) query = query.eq('usuario_id', usuario);
    if (accion) query = query.eq('accion', accion);
    if (fecha_inicio) query = query.gte('creado_en', fecha_inicio);
    if (fecha_fin) query = query.lte('creado_en', fecha_fin);

    const { data, count, error } = await query.range(from, from + limitNumber - 1);
    if (error) throw error;

    res.json({ data, total: count, page: pageNumber, limit: limitNumber });
  } catch (e) {
    next(e);
  }
}
