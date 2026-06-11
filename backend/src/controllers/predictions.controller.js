import { supabase } from '../config/supabase.js';
import { predictDropoutRisk } from '../services/mlService.js';
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

export async function generatePrediction(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const studentId = req.params.studentId;
    const student = await getScopedStudent(studentId, institutionId);

    const { data: records, error: rErr } = await supabase
      .from('academic_records')
      .select('*')
      .eq('student_id', studentId)
      .order('period', { ascending: false })
      .limit(1);

    if (rErr) throw rErr;
    if (!records?.length) {
      return res.status(400).json({
        error: 'El estudiante necesita al menos un registro academico para generar prediccion',
      });
    }

    const latest = records[0];
    const result = await predictDropoutRisk({
      ...latest,
      socioeconomic_level: student.socioeconomic_level,
    });

    const { data: prediction, error: pErr } = await supabase
      .from('predictions')
      .insert({ student_id: studentId, ...result })
      .select()
      .single();
    if (pErr) throw pErr;

    if (result.risk_level === 'alto') {
      await supabase.from('alerts').insert({
        student_id: studentId,
        prediction_id: prediction.id,
        severity: result.risk_score >= 0.85 ? 'critica' : 'alta',
        title: `Riesgo alto de abandono: ${student.full_name}`,
        message: `El modelo estimo un riesgo de ${(result.risk_score * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
      });
    }

    await audit(req, 'PREDICT', 'predictions', prediction.id, { risk: result.risk_level });
    res.status(201).json({ data: prediction });
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
