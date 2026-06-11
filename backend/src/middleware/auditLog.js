import { supabase } from '../config/supabase.js';

/** Registra una acción en audit_logs. Uso: await audit(req, 'CREATE', 'students', id, {...}) */
export async function audit(req, action, entity, entityId = null, detail = null) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id ?? null,
      action,
      entity,
      entity_id: entityId,
      detail,
      ip_address: req.ip,
    });
  } catch (e) {
    console.error('Fallo al registrar auditoría:', e.message);
  }
}
