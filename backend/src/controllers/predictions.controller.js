import { supabase } from '../config/supabase.js';
import { predictDropoutRisk } from '../services/mlService.js';
import { notifyHighRisk } from '../services/notifications.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const HIGH_RISK_LEVELS = ['alto', 'critico'];

async function getScopedStudent(studentId, institutionId) {
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .eq('id', studentId)
    .eq('institucion_id', institutionId)
    .single();

  if (error || !data) {
    const err = new Error('Estudiante no encontrado');
    err.status = 404;
    throw err;
  }
  return data;
}

async function runPrediction(student) {
  const { data: records, error: rErr } = await supabase
    .from('historial_academico')
    .select('*')
    .eq('alumno_id', student.id)
    .order('periodo', { ascending: false })
    .limit(1);

  if (rErr) throw rErr;
  if (!records?.length) return { prediction: null, reason: 'sin_registro_academico' };

  const latest = records[0];
  const result = await predictDropoutRisk({ ...latest });

  const { data: prediction, error: pErr } = await supabase
    .from('predicciones')
    .insert({ alumno_id: student.id, ...result })
    .select()
    .single();
  if (pErr) throw pErr;

  if (HIGH_RISK_LEVELS.includes(result.nivel_riesgo)) {
    const { error: aErr } = await supabase.from('alertas').insert({
      alumno_id: student.id,
      prediccion_id: prediction.id,
      tipo_alerta: 'academic',
      severidad: result.puntaje_riesgo >= 0.85 ? 'critica' : 'alta',
      estatus: 'pendiente',
      titulo: `Riesgo alto de abandono: ${student.nombre_completo}`,
      mensaje: `El modelo estimo un riesgo de ${(result.puntaje_riesgo * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
    });
    if (aErr) throw aErr;
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

    await audit(req, 'PREDICT', 'predicciones', prediction.id, { risk: prediction.nivel_riesgo });
    res.status(201).json({ data: prediction });
  } catch (e) {
    if (e.status === 503) {
      return res.status(503).json({ error: e.message });
    }
    next(e);
  }
}

export async function generateBatch(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data: students, error } = await supabase
      .from('alumnos')
      .select('*')
      .eq('institucion_id', institutionId)
      .eq('estatus', 'activo');
    if (error) throw error;

    const summary = { total: students.length, generated: 0, skipped: 0, high_risk: 0 };
    for (const student of students) {
      const { prediction } = await runPrediction(student);
      if (!prediction) summary.skipped++;
      else {
        summary.generated++;
        if (HIGH_RISK_LEVELS.includes(prediction.nivel_riesgo)) summary.high_risk++;
      }
    }

    await audit(req, 'PREDICT_BATCH', 'predicciones', null, summary);
    res.status(201).json({ data: summary });
  } catch (e) {
    next(e);
  }
}

export async function listHighRisk(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('predicciones')
      .select(
        '*, alumnos!inner(id, nombre_completo, matricula, semestre_actual, programa, institucion_id)',
      )
      .eq('alumnos.institucion_id', institutionId)
      .in('nivel_riesgo', HIGH_RISK_LEVELS)
      .order('predicho_en', { ascending: false });
    if (error) throw error;

    const seen = new Set();
    const latestPerStudent = [];
    for (const p of data ?? []) {
      if (seen.has(p.alumno_id)) continue;
      seen.add(p.alumno_id);
      latestPerStudent.push(p);
    }

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
      .from('predicciones')
      .select('*')
      .eq('alumno_id', req.params.studentId)
      .order('predicho_en', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
