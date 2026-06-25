import { supabase } from '../config/supabase.js';
import { predictDropoutRisk } from '../services/mlService.js';
import { notifyHighRisk } from '../services/notifications.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

async function getScopedStudent(studentId, institutionId) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('institution_id', institutionId)
    .single();

  if (error || !data) {
    const err = new Error('Estudiante no encontrado');
    err.status = 404;
    throw err;
  }
  return data;
}

/**
 * Genera y persiste una predicción para un estudiante a partir de su último
 * registro académico. Crea alerta + notificación si el riesgo es alto.
 * @returns {{ prediction:object|null, reason?:string }}
 */
async function runPrediction(student) {
  const { data: records, error: rErr } = await supabase
    .from('academic_records')
    .select('*')
    .eq('student_id', student.id)
    .order('period', { ascending: false })
    .limit(1);

  if (rErr) throw rErr;
  if (!records?.length) return { prediction: null, reason: 'sin_registro_academico' };

  const latest = records[0];
  const result = await predictDropoutRisk({
    ...latest,
    socioeconomic_level: student.socioeconomic_level,
  });

  const { data: prediction, error: pErr } = await supabase
    .from('predictions')
    .insert({ student_id: student.id, ...result })
    .select()
    .single();
  if (pErr) throw pErr;

  if (result.risk_level === 'alto') {
    await supabase.from('alerts').insert({
      student_id: student.id,
      prediction_id: prediction.id,
      severity: result.risk_score >= 0.85 ? 'critica' : 'alta',
      title: `Riesgo alto de abandono: ${student.full_name}`,
      message: `El modelo estimo un riesgo de ${(result.risk_score * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
    });
    await notifyHighRisk(supabase, { student, prediction });
  }

  return { prediction };
}

export async function generatePrediction(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const student = await getScopedStudent(req.params.studentId, institutionId);
    const { prediction, reason } = await runPrediction(student);

    if (!prediction) {
      return res.status(400).json({
        error: 'El estudiante necesita al menos un registro academico para generar prediccion',
      });
    }

    await audit(req, 'PREDICT', 'predictions', prediction.id, { risk: prediction.risk_level });
    res.status(201).json({ data: prediction });
  } catch (e) {
    next(e);
  }
}

/**
 * Genera predicciones para todos los estudiantes activos de la institución
 * que tengan al menos un registro académico. Solo admin/coordinador.
 */
export async function generateBatch(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('status', 'activo');
    if (error) throw error;

    const summary = { total: students.length, generated: 0, skipped: 0, high_risk: 0 };
    for (const student of students) {
      const { prediction } = await runPrediction(student);
      if (!prediction) summary.skipped++;
      else {
        summary.generated++;
        if (prediction.risk_level === 'alto') summary.high_risk++;
      }
    }

    await audit(req, 'PREDICT_BATCH', 'predictions', null, summary);
    res.status(201).json({ data: summary });
  } catch (e) {
    next(e);
  }
}

/**
 * Lista los estudiantes de la institución cuya predicción más reciente es de
 * riesgo alto, ordenados por score descendente.
 */
export async function listHighRisk(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('predictions')
      .select('*, students!inner(id, full_name, matricula, current_semester, program, institution_id)')
      .eq('students.institution_id', institutionId)
      .eq('risk_level', 'alto')
      .order('predicted_at', { ascending: false });
    if (error) throw error;

    // Conserva solo la predicción más reciente por estudiante.
    const seen = new Set();
    const latestPerStudent = [];
    for (const p of data ?? []) {
      if (seen.has(p.student_id)) continue;
      seen.add(p.student_id);
      latestPerStudent.push(p);
    }
    latestPerStudent.sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

    res.json({ data: latestPerStudent });
  } catch (e) {
    next(e);
  }
}

export async function listByStudent(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    await getScopedStudent(req.params.studentId, institutionId);

    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('student_id', req.params.studentId)
      .order('predicted_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
