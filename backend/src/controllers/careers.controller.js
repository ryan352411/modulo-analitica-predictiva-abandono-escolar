import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const SELECT = 'id, nombre, creado_en';

export async function listCareers(req, res, next) {
  try {
    // Aislada por escuela; admin sin escuela aún no tiene carreras.
    const institutionId = req.user?.institution_id;
    if (!institutionId) return res.json({ data: [] });

    const { data, error } = await supabase
      .from('carreras')
      .select(SELECT)
      .eq('institucion_id', institutionId)
      .order('nombre');
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (e) {
    next(e);
  }
}

export async function createCareer(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const nombre = String(req.body?.nombre ?? '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre de la carrera es requerido' });

    const { data, error } = await supabase
      .from('carreras')
      .insert({ institucion_id: institutionId, nombre })
      .select(SELECT)
      .single();
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una carrera con ese nombre' });
    }
    if (error) throw error;

    await audit(req, 'CREATE', 'carreras', data.id, { nombre });
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
}

export async function updateCareer(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const nombre = String(req.body?.nombre ?? '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre de la carrera es requerido' });

    const { data, error } = await supabase
      .from('carreras')
      .update({ nombre })
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .select(SELECT)
      .single();
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una carrera con ese nombre' });
    }
    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Carrera no encontrada' });
    }
    if (error) throw error;

    await audit(req, 'UPDATE', 'carreras', req.params.id, { nombre });
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function deleteCareer(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('carreras')
      .delete()
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .select('id')
      .single();
    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Carrera no encontrada' });
    }
    if (error) throw error;

    await audit(req, 'DELETE', 'carreras', data.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
