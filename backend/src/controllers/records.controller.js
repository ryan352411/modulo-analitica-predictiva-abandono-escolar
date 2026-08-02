import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { pick, requireInstitution, toOptionalNumber } from '../utils/request.js';

const RECORD_FIELDS = [
  'alumno_id',
  'periodo',
  'promedio',
  'tasa_asistencia',
  'materias_reprobadas',
  'creditos_obtenidos',
  'creditos_totales',
  'observaciones',
];

async function assertStudentInInstitution(studentId, institutionId) {
  const { data, error } = await supabase
    .from('alumnos')
    .select('id')
    .eq('id', studentId)
    .eq('institucion_id', institutionId)
    .single();

  if (error || !data) {
    const err = new Error('Estudiante no encontrado');
    err.status = 404;
    throw err;
  }
}

function buildRecordPayload(body) {
  const payload = pick(body, RECORD_FIELDS);
  for (const key of ['promedio', 'tasa_asistencia', 'materias_reprobadas', 'creditos_obtenidos', 'creditos_totales']) {
    if (payload[key] !== undefined) payload[key] = toOptionalNumber(payload[key]);
  }
  return payload;
}

export async function listByStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    await assertStudentInInstitution(req.params.studentId, institutionId);

    const { data, error } = await supabase
      .from('historial_academico')
      .select('*')
      .eq('alumno_id', req.params.studentId)
      .order('periodo', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function createRecord(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const payload = buildRecordPayload(req.body);
    await assertStudentInInstitution(payload.alumno_id, institutionId);

    const { data, error } = await supabase
      .from('historial_academico')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    await audit(req, 'CREATE', 'historial_academico', data.id, payload);
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
}
