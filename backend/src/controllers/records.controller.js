import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { pick, requireInstitution, toOptionalNumber } from '../utils/request.js';

const RECORD_FIELDS = [
  'student_id',
  'period',
  'gpa',
  'attendance_rate',
  'failed_subjects',
  'credits_earned',
  'credits_total',
  'observations',
];

async function assertStudentInInstitution(studentId, institutionId) {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('institution_id', institutionId)
    .single();

  if (error || !data) {
    const err = new Error('Estudiante no encontrado');
    err.status = 404;
    throw err;
  }
}

function buildRecordPayload(body) {
  const payload = pick(body, RECORD_FIELDS);
  for (const key of ['gpa', 'attendance_rate', 'failed_subjects', 'credits_earned', 'credits_total']) {
    if (payload[key] !== undefined) payload[key] = toOptionalNumber(payload[key]);
  }
  return payload;
}

export async function listByStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    await assertStudentInInstitution(req.params.studentId, institutionId);

    const { data, error } = await supabase
      .from('academic_records')
      .select('*')
      .eq('student_id', req.params.studentId)
      .order('period', { ascending: false });

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
    await assertStudentInInstitution(payload.student_id, institutionId);

    const { data, error } = await supabase
      .from('academic_records')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    await audit(req, 'CREATE', 'academic_records', data.id, payload);
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
}
