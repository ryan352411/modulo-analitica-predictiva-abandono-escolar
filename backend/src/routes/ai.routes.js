import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { evaluateSocioeconomic, recommendIntervention } from '../controllers/ai.controller.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/ai/socioeconomic:
 *   post:
 *     summary: Estimar el nivel socioeconómico con IA (Gemini) a partir de un cuestionario
 *     tags: [IA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [respuestas]
 *             properties:
 *               respuestas:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Pares pregunta/respuesta del cuestionario socioeconómico.
 *     responses:
 *       200:
 *         description: Nivel socioeconómico estimado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     nivel: { type: string, enum: [bajo, medio_bajo, medio, medio_alto, alto] }
 *                     nivel_label: { type: string }
 *                     justificacion: { type: string }
 *                     puntaje: { type: integer, nullable: true }
 *       503:
 *         description: Gemini no está configurado (falta GEMINI_API_KEY)
 */
router.post('/socioeconomic', evaluateSocioeconomic);

/**
 * @openapi
 * /api/ai/intervention:
 *   post:
 *     summary: Recomendar una intervención para un estudiante en riesgo con IA (Gemini)
 *     tags: [IA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               student_id: { type: string, format: uuid }
 *               alert_id: { type: string, format: uuid, description: Alternativa a student_id }
 *     responses:
 *       200:
 *         description: Recomendación de intervención en Markdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     student_id: { type: string }
 *                     student_name: { type: string }
 *                     recomendacion: { type: string }
 *       404:
 *         description: Estudiante no encontrado
 *       503:
 *         description: Gemini no está configurado (falta GEMINI_API_KEY)
 */
router.post('/intervention', recommendIntervention);

export default router;
