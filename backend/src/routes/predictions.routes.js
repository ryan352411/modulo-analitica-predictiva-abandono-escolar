import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generatePrediction, listByStudent } from '../controllers/predictions.controller.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/predictions/student/{studentId}:
 *   post:
 *     summary: Generar predicción de riesgo de abandono (stub ML)
 *     tags: [Predictions]
 */
router.post('/student/:studentId', generatePrediction);
router.get('/student/:studentId', listByStudent);

export default router;
