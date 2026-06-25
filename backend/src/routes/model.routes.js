import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getModelInfo, retrainModel } from '../controllers/model.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /api/model/info:
 *   get:
 *     summary: Versión activa, métricas y estado del microservicio ML (admin)
 *     tags: [Model]
 */
router.get('/info', getModelInfo);

/**
 * @openapi
 * /api/model/retrain:
 *   post:
 *     summary: Disparar reentrenamiento del modelo (admin)
 *     tags: [Model]
 */
router.post('/retrain', retrainModel);

export default router;
