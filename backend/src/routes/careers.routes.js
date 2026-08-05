import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listCareers,
  createCareer,
  updateCareer,
  deleteCareer,
} from '../controllers/careers.controller.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/careers:
 *   get:
 *     summary: Listar carreras de la escuela
 *     tags: [Careers]
 */
router.get('/', listCareers);
router.post('/', requireRole('admin', 'coordinador'), createCareer);
router.patch('/:id', requireRole('admin', 'coordinador'), updateCareer);
router.delete('/:id', requireRole('admin', 'coordinador'), deleteCareer);

export default router;
