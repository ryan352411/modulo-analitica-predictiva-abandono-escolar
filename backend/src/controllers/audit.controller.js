import { supabase } from '../config/supabase.js';
import { requireInstitution } from '../utils/request.js';

/**
 * Lista los logs de auditoría de la institución del usuario (solo admin).
 * Filtros: usuario (user_id), accion (action), fecha_inicio, fecha_fin.
 * Los audit_logs no tienen institution_id, así que se acotan a los usuarios
 * de la institución del solicitante.
 */
export async function listAuditLogs(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { usuario, accion, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const from = (pageNumber - 1) * limitNumber;

    // Usuarios que pertenecen a la institución del solicitante.
    const { data: members, error: mErr } = await supabase
      .from('users')
      .select('id')
      .eq('institution_id', institutionId);
    if (mErr) throw mErr;
    const memberIds = (members ?? []).map((m) => m.id);
    if (!memberIds.length) return res.json({ data: [], total: 0, page: pageNumber, limit: limitNumber });

    let query = supabase
      .from('audit_logs')
      .select('id, user_id, action, entity, entity_id, detail, ip_address, created_at', { count: 'exact' })
      .in('user_id', memberIds)
      .order('created_at', { ascending: false });

    if (usuario) query = query.eq('user_id', usuario);
    if (accion) query = query.eq('action', accion);
    if (fecha_inicio) query = query.gte('created_at', fecha_inicio);
    if (fecha_fin) query = query.lte('created_at', fecha_fin);

    const { data, count, error } = await query.range(from, from + limitNumber - 1);
    if (error) throw error;

    res.json({ data, total: count, page: pageNumber, limit: limitNumber });
  } catch (e) {
    next(e);
  }
}
