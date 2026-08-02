import { supabase } from '../config/supabase.js';

/** Registra una acción en registros_auditoria. Uso: await audit(req, 'CREATE', 'alumnos', id, {...}) */
export async function audit(req, action, entity, entityId = null, detail = null) {
  try {
    await supabase.from('registros_auditoria').insert({
      usuario_id: req.user?.id ?? null,
      accion: action,
      entidad: entity,
      entidad_id: entityId,
      detalle: detail,
      direccion_ip: req.ip,
    });
  } catch (e) {
    console.error('Fallo al registrar auditoría:', e.message);
  }
}
