import { supabase } from '../config/supabase.js';
import { generateJson, generateContent, geminiEnabled } from '../services/geminiService.js';
import { requireInstitution } from '../utils/request.js';
import { audit } from '../middleware/auditLog.js';

const NIVELES = ['bajo', 'medio_bajo', 'medio', 'medio_alto', 'alto'];

const NIVEL_LABEL = {
  bajo: 'Bajo',
  medio_bajo: 'Medio bajo',
  medio: 'Medio',
  medio_alto: 'Medio alto',
  alto: 'Alto',
};

const SOCIO_SCHEMA = {
  type: 'object',
  properties: {
    nivel: { type: 'string', enum: NIVELES },
    justificacion: { type: 'string' },
    puntaje: { type: 'integer' },
  },
  required: ['nivel', 'justificacion'],
};

/**
 * POST /api/ai/socioeconomic
 * Evalúa el nivel socioeconómico a partir de las respuestas de un cuestionario.
 * body: { respuestas: { [pregunta]: valor } }
 */
export async function evaluateSocioeconomic(req, res, next) {
  try {
    if (!geminiEnabled()) {
      return res
        .status(503)
        .json({ error: 'Asistente de IA no disponible: configura GEMINI_API_KEY' });
    }

    const respuestas = req.body?.respuestas;
    if (!respuestas || typeof respuestas !== 'object' || Object.keys(respuestas).length === 0) {
      return res.status(400).json({ error: 'Envía las respuestas del cuestionario en "respuestas"' });
    }

    const lista = Object.entries(respuestas)
      .map(([pregunta, valor]) => `- ${pregunta}: ${valor}`)
      .join('\n');

    const prompt =
      'Eres un asistente que clasifica el nivel socioeconómico de un estudiante en México ' +
      'con base en indicadores tipo AMAI (escolaridad del jefe de familia, ingreso del hogar, ' +
      'características de la vivienda, bienes y servicios). A partir de las siguientes respuestas ' +
      'de un cuestionario, determina el nivel socioeconómico más adecuado.\n\n' +
      `Respuestas del cuestionario:\n${lista}\n\n` +
      'Devuelve un JSON con:\n' +
      '- "nivel": uno de bajo, medio_bajo, medio, medio_alto, alto.\n' +
      '- "justificacion": explicación breve (1-2 frases) en español, dirigida al usuario.\n' +
      '- "puntaje": un entero de 0 a 100 que represente el nivel (0 = más bajo, 100 = más alto).';

    const result = await generateJson(prompt, SOCIO_SCHEMA, { temperature: 0.2 });
    const nivel = NIVELES.includes(result?.nivel) ? result.nivel : 'medio';

    await audit(req, 'AI_SOCIOECONOMIC', 'ai', null, { nivel });

    res.json({
      data: {
        nivel,
        nivel_label: NIVEL_LABEL[nivel],
        justificacion: result?.justificacion || '',
        puntaje: typeof result?.puntaje === 'number' ? result.puntaje : null,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/ai/intervention
 * Recomienda una intervención para un estudiante en riesgo usando Gemini.
 * body: { student_id }  (o alert_id para tomar el estudiante de la alerta)
 */
export async function recommendIntervention(req, res, next) {
  try {
    if (!geminiEnabled()) {
      return res
        .status(503)
        .json({ error: 'Asistente de IA no disponible: configura GEMINI_API_KEY' });
    }

    const institutionId = requireInstitution(req);
    let studentId = req.body?.student_id;

    // Permite pasar alert_id: se resuelve al alumno de esa alerta.
    if (!studentId && req.body?.alert_id) {
      const { data: alerta } = await supabase
        .from('alertas')
        .select('alumno_id, alumnos!inner(institucion_id)')
        .eq('id', req.body.alert_id)
        .eq('alumnos.institucion_id', institutionId)
        .maybeSingle();
      studentId = alerta?.alumno_id;
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Envía student_id o alert_id' });
    }

    const { data: student, error } = await supabase
      .from('alumnos')
      .select(
        '*, historial_academico(*), predicciones(puntaje_riesgo, nivel_riesgo, factores_contribuyentes, predicho_en)',
      )
      .eq('id', studentId)
      .eq('institucion_id', institutionId)
      .single();

    if (error || !student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const historial = [...(student.historial_academico ?? [])]
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
      .slice(-4);
    const prediccion = [...(student.predicciones ?? [])].sort(
      (a, b) => new Date(b.predicho_en) - new Date(a.predicho_en),
    )[0];

    const factores = (prediccion?.factores_contribuyentes ?? [])
      .map((f) => `${f.label} (${Math.round((f.importance ?? 0) * 100)}%)`)
      .join(', ');

    const historialTexto = historial.length
      ? historial
          .map(
            (r) =>
              `Periodo ${r.periodo}: promedio ${r.promedio}, asistencia ${r.tasa_asistencia}%, ` +
              `reprobadas ${r.materias_reprobadas}, entregas pendientes ${r.entregas_pendientes ?? 'N/D'}`,
          )
          .join('\n')
      : 'Sin registros académicos capturados.';

    const prompt =
      'Eres un orientador educativo experto en prevención del abandono escolar en México. ' +
      'Con base en el perfil del estudiante, recomienda un plan de intervención concreto y accionable ' +
      'para el tutor o coordinador. Responde en español, en formato Markdown, con secciones breves: ' +
      '1) Diagnóstico rápido, 2) Acciones recomendadas (lista priorizada de 3 a 5 acciones), ' +
      '3) Canalización o apoyos sugeridos, 4) Seguimiento propuesto. Sé específico y empático; ' +
      'no inventes datos que no aparezcan en el perfil.\n\n' +
      `Perfil del estudiante:\n` +
      `- Nombre: ${student.nombre_completo}\n` +
      `- Programa: ${student.programa ?? 'N/D'}\n` +
      `- Semestre: ${student.semestre_actual ?? 'N/D'}\n` +
      `- Nivel socioeconómico: ${NIVEL_LABEL[student.nivel_socioeconomico] ?? student.nivel_socioeconomico ?? 'N/D'}\n` +
      `- Estatus: ${student.estatus ?? 'N/D'}\n` +
      (prediccion
        ? `- Riesgo de abandono: ${(Number(prediccion.puntaje_riesgo) * 100).toFixed(1)}% (nivel ${prediccion.nivel_riesgo})\n` +
          `- Factores principales: ${factores || 'N/D'}\n`
        : '- Sin predicción de riesgo registrada.\n') +
      `\nHistorial académico reciente:\n${historialTexto}`;

    const recomendacion = await generateContent(prompt, { temperature: 0.5, timeout: 25000 });

    await audit(req, 'AI_INTERVENTION', 'alumnos', studentId, null);

    res.json({
      data: {
        student_id: studentId,
        student_name: student.nombre_completo,
        recomendacion,
      },
    });
  } catch (e) {
    next(e);
  }
}
