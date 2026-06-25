import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  generatePrediction,
  generateBatch,
  listHighRisk,
  listByStudent,
} from '../controllers/predictions.controller.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/predictions/student/{studentId}:
 *   post:
 *     summary: Generar predicción de riesgo de abandono
 *     tags: [Predictions]
 */
router.post('/student/:studentId', generatePrediction);
router.get('/student/:studentId', listByStudent);

/**
 * @openapi
 * /api/predictions/batch:
 *   post:
 *     summary: Generar predicciones para todos los estudiantes activos (lote)
 *     tags: [Predictions]
 */
router.post('/batch', requireRole('admin', 'coordinador'), generateBatch);

/**
 * @openapi
 * /api/predictions/high-risk:
 *   get:
 *     summary: Estudiantes con riesgo alto ordenados por score
 *     tags: [Predictions]
 */
router.get('/high-risk', listHighRisk);

export default router;
