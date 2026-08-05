import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { pick } from '../utils/request.js';
import { institutionInitials } from './students.controller.js';

const INSTITUTION_FIELDS = ['nombre', 'codigo', 'direccion'];
const SELECT = 'id, nombre, codigo, direccion, creado_en';

// Cada admin solo administra SU escuela (la que creó o le fue asignada).
async function studentCount(institutionId) {
  const { count } = await supabase
    .from('alumnos')
    .select('*', { count: 'exact', head: true })
    .eq('institucion_id', institutionId);
  return count || 0;
}

export async function listInstitutions(req, res, next) {
  try {
    const institutionId = req.user?.institution_id;
    // Admin sin escuela (recién creado con Google): aún no tiene nada que mostrar.
    if (!institutionId) return res.json({ data: [] });

    const { data, error } = await supabase.from('instituciones').select(SELECT).eq('id', institutionId).maybeSingle();
    if (error) throw error;
    if (!data) return res.json({ data: [] });

    res.json({
      data: [{ ...data, prefijo: institutionInitials(data.nombre), alumnos: await studentCount(data.id) }],
    });
  } catch (e) {
    next(e);
  }
}

export async function createInstitution(req, res, next) {
  try {
    // Un admin solo puede tener una escuela: si ya tiene, no crea otra.
    if (req.user?.institution_id) {
      return res.status(409).json({ error: 'Ya tienes una escuela asignada' });
    }

    const payload = pick(req.body, INSTITUTION_FIELDS);
    if (!payload.nombre || !String(payload.nombre).trim()) {
      return res.status(400).json({ error: 'El nombre de la escuela es requerido' });
    }
    if (!payload.codigo || !String(payload.codigo).trim()) {
      return res.status(400).json({ error: 'La clave de trabajo es requerida' });
    }

    const { data, error } = await supabase.from('instituciones').insert(payload).select(SELECT).single();
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una escuela con ese código' });
    }
    if (error) throw error;

    // El admin que la crea queda como dueño (se le asigna la escuela).
    await supabase.from('usuarios').update({ institucion_id: data.id }).eq('id', req.user.id);
    invalidateUserCache(req.user.id);

    await audit(req, 'CREATE', 'instituciones', data.id, payload);
    res.status(201).json({ data: { ...data, prefijo: institutionInitials(data.nombre), alumnos: 0 } });
  } catch (e) {
    next(e);
  }
}

export async function updateInstitution(req, res, next) {
  try {
    // Solo puede editar su propia escuela.
    if (req.params.id !== req.user?.institution_id) {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }
    const payload = pick(req.body, INSTITUTION_FIELDS);
    if (payload.nombre !== undefined && !String(payload.nombre).trim()) {
      return res.status(400).json({ error: 'El nombre de la escuela no puede estar vacío' });
    }
    if (payload.codigo !== undefined && !String(payload.codigo).trim()) {
      return res.status(400).json({ error: 'La clave de trabajo no puede estar vacía' });
    }

    const { data, error } = await supabase
      .from('instituciones')
      .update(payload)
      .eq('id', req.params.id)
      .select(SELECT)
      .single();
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una escuela con ese código' });
    }
    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }
    if (error) throw error;

    await audit(req, 'UPDATE', 'instituciones', req.params.id, payload);
    res.json({ data: { ...data, prefijo: institutionInitials(data.nombre) } });
  } catch (e) {
    next(e);
  }
}

export async function deleteInstitution(req, res, next) {
  try {
    // Solo puede eliminar su propia escuela.
    if (req.params.id !== req.user?.institution_id) {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }
    // No permitir eliminar una escuela con alumnos o usuarios asociados.
    const [{ count: alumnosCount }, { count: usuariosCount }] = await Promise.all([
      supabase.from('alumnos').select('*', { count: 'exact', head: true }).eq('institucion_id', req.params.id),
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('institucion_id', req.params.id),
    ]);
    if ((alumnosCount || 0) > 0 || (usuariosCount || 0) > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar: la escuela tiene alumnos o usuarios asociados',
      });
    }

    const { data, error } = await supabase
      .from('instituciones')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .single();
    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }
    if (error) throw error;

    await audit(req, 'DELETE', 'instituciones', data.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
