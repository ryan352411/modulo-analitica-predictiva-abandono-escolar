import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { csvToObjects } from '../utils/csv.js';
import {
  mapSingleResultNotFound,
  pick,
  requireInstitution,
  sanitizeSearch,
  toOptionalNumber,
} from '../utils/request.js';

const STUDENT_FIELDS = [
  'matricula',
  'nombre_completo',
  'correo',
  'fecha_nacimiento',
  'genero',
  'nivel_socioeconomico',
  'fecha_inscripcion',
  'semestre_actual',
  'programa',
  'estatus',
];

function buildStudentPayload(body) {
  const payload = pick(body, STUDENT_FIELDS);
  if (payload.semestre_actual !== undefined) {
    payload.semestre_actual = toOptionalNumber(payload.semestre_actual);
    payload.semestre = payload.semestre_actual;
  }
  if (payload.matricula !== undefined) payload.codigo_alumno = payload.matricula;
  return payload;
}

export async function listStudents(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { status, search, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const from = (pageNumber - 1) * limitNumber;

    let query = supabase
      .from('alumnos')
      .select('*', { count: 'exact' })
      .eq('institucion_id', institutionId);

    if (status) query = query.eq('estatus', status);
    if (search) {
      const term = sanitizeSearch(search);
      if (term) query = query.or(`nombre_completo.ilike.%${term}%,matricula.ilike.%${term}%`);
    }

    const { data, count, error } = await query
      .order('nombre_completo')
      .range(from, from + limitNumber - 1);

    if (error) throw error;
    res.json({ data, total: count, page: pageNumber, limit: limitNumber });
  } catch (e) {
    next(e);
  }
}

export async function getStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('alumnos')
      .select('*, historial_academico(*), predicciones(*), alertas(*)')
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .single();

    if (error) throw mapSingleResultNotFound(error, 'Estudiante');
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function createStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const payload = {
      ...buildStudentPayload(req.body),
      institucion_id: institutionId,
    };

    // Validación de datos incompletos -> 422 (Unprocessable Entity)
    const camposFaltantes = [];
    if (!payload.nombre_completo) camposFaltantes.push('nombre_completo');
    if (!payload.matricula) camposFaltantes.push('matricula');
    if (camposFaltantes.length) {
      return res.status(422).json({
        error: 'Datos incompletos para crear el estudiante',
        campos_faltantes: camposFaltantes,
      });
    }

    const { data, error } = await supabase.from('alumnos').insert(payload).select().single();
    if (error) throw error;

    await audit(req, 'CREATE', 'alumnos', data.id, payload);
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const payload = buildStudentPayload(req.body);

    const { data, error } = await supabase
      .from('alumnos')
      .update(payload)
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .select()
      .single();

    if (error) throw mapSingleResultNotFound(error, 'Estudiante');
    await audit(req, 'UPDATE', 'alumnos', req.params.id, payload);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function getStudentTrend(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    // Verifica pertenencia a la institución antes de exponer datos.
    const { data: student, error: sErr } = await supabase
      .from('alumnos')
      .select('id')
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .single();
    if (sErr || !student) throw mapSingleResultNotFound(sErr ?? {}, 'Estudiante');

    const { data, error } = await supabase
      .from('predicciones')
      .select('puntaje_riesgo, nivel_riesgo, version_modelo, predicho_en')
      .eq('alumno_id', req.params.id)
      .order('predicho_en', { ascending: true });
    if (error) throw error;

    res.json({
      data: (data ?? []).map((p) => ({
        predicho_en: p.predicho_en,
        puntaje_riesgo: Number(p.puntaje_riesgo),
        risk_percent: Math.round(Number(p.puntaje_riesgo) * 100),
        nivel_riesgo: p.nivel_riesgo,
        version_modelo: p.version_modelo,
      })),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Importación masiva desde CSV. El cuerpo se recibe como texto (text/csv).
 * Columnas esperadas (encabezado): matricula, nombre_completo, correo, genero,
 * nivel_socioeconomico, semestre_actual, programa, estatus, fecha_inscripcion.
 */
export async function importStudents(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const csv = typeof req.body === 'string' ? req.body : '';
    if (!csv.trim()) {
      return res.status(400).json({ error: 'Envia el CSV como cuerpo con Content-Type text/csv' });
    }

    const rows = csvToObjects(csv);
    if (!rows.length) {
      return res.status(400).json({ error: 'El CSV no contiene filas de datos' });
    }
    if (rows.length > 1000) {
      return res.status(400).json({ error: 'Maximo 1000 estudiantes por importacion' });
    }

    const payloads = [];
    const errors = [];
    rows.forEach((raw, idx) => {
      const payload = buildStudentPayload(raw);
      if (!payload.matricula || !payload.nombre_completo) {
        errors.push({ row: idx + 2, error: 'matricula y nombre_completo son obligatorios' });
        return;
      }
      payloads.push({ ...payload, institucion_id: institutionId });
    });

    if (!payloads.length) {
      return res.status(400).json({ error: 'Ninguna fila valida', errors });
    }

    // upsert por matricula para que reimportar actualice en lugar de duplicar.
    const { data, error } = await supabase
      .from('alumnos')
      .upsert(payloads, { onConflict: 'matricula' })
      .select('id, matricula, nombre_completo');
    if (error) throw error;

    await audit(req, 'IMPORT', 'alumnos', null, { imported: data.length, errors: errors.length });
    res.status(201).json({ data: { imported: data.length, students: data, errors } });
  } catch (e) {
    next(e);
  }
}

export async function deleteStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('alumnos')
      .delete()
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .select('id')
      .single();

    if (error) throw mapSingleResultNotFound(error, 'Estudiante');
    await audit(req, 'DELETE', 'alumnos', data.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
