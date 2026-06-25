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
  'full_name',
  'email',
  'birth_date',
  'gender',
  'socioeconomic_level',
  'enrollment_date',
  'current_semester',
  'program',
  'status',
];

function buildStudentPayload(body) {
  const payload = pick(body, STUDENT_FIELDS);
  if (payload.current_semester !== undefined) {
    payload.current_semester = toOptionalNumber(payload.current_semester);
    payload.semester = payload.current_semester;
  }
  if (payload.matricula !== undefined) payload.student_code = payload.matricula;
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
      .from('students')
      .select('*', { count: 'exact' })
      .eq('institution_id', institutionId);

    if (status) query = query.eq('status', status);
    if (search) {
      const term = sanitizeSearch(search);
      if (term) query = query.or(`full_name.ilike.%${term}%,matricula.ilike.%${term}%`);
    }

    const { data, count, error } = await query
      .order('full_name')
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
      .from('students')
      .select('*, academic_records(*), predictions(*), alerts(*)')
      .eq('id', req.params.id)
      .eq('institution_id', institutionId)
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
      institution_id: institutionId,
    };

    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error) throw error;

    await audit(req, 'CREATE', 'students', data.id, payload);
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
      .from('students')
      .update(payload)
      .eq('id', req.params.id)
      .eq('institution_id', institutionId)
      .select()
      .single();

    if (error) throw mapSingleResultNotFound(error, 'Estudiante');
    await audit(req, 'UPDATE', 'students', req.params.id, payload);
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
      .from('students')
      .select('id')
      .eq('id', req.params.id)
      .eq('institution_id', institutionId)
      .single();
    if (sErr || !student) throw mapSingleResultNotFound(sErr ?? {}, 'Estudiante');

    const { data, error } = await supabase
      .from('predictions')
      .select('risk_score, risk_level, model_version, predicted_at')
      .eq('student_id', req.params.id)
      .order('predicted_at', { ascending: true });
    if (error) throw error;

    res.json({
      data: (data ?? []).map((p) => ({
        predicted_at: p.predicted_at,
        risk_score: Number(p.risk_score),
        risk_percent: Math.round(Number(p.risk_score) * 100),
        risk_level: p.risk_level,
        model_version: p.model_version,
      })),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Importación masiva desde CSV. El cuerpo se recibe como texto (text/csv).
 * Columnas esperadas (encabezado): matricula, full_name, email, gender,
 * socioeconomic_level, current_semester, program, status, enrollment_date.
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
      if (!payload.matricula || !payload.full_name) {
        errors.push({ row: idx + 2, error: 'matricula y full_name son obligatorios' });
        return;
      }
      payloads.push({ ...payload, institution_id: institutionId });
    });

    if (!payloads.length) {
      return res.status(400).json({ error: 'Ninguna fila valida', errors });
    }

    // upsert por matricula para que reimportar actualice en lugar de duplicar.
    const { data, error } = await supabase
      .from('students')
      .upsert(payloads, { onConflict: 'matricula' })
      .select('id, matricula, full_name');
    if (error) throw error;

    await audit(req, 'IMPORT', 'students', null, { imported: data.length, errors: errors.length });
    res.status(201).json({ data: { imported: data.length, students: data, errors } });
  } catch (e) {
    next(e);
  }
}

export async function deleteStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('students')
      .delete()
      .eq('id', req.params.id)
      .eq('institution_id', institutionId)
      .select('id')
      .single();

    if (error) throw mapSingleResultNotFound(error, 'Estudiante');
    await audit(req, 'DELETE', 'students', data.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
