import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listInstitutions,
  createInstitution,
  updateInstitution,
  deleteInstitution,
} from '../controllers/institutions.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /api/institutions:
 *   get:
 *     summary: Listar escuelas / instituciones (solo admin)
 *     tags: [Institutions]
 */
router.get('/', listInstitutions);
router.post('/', createInstitution);
router.patch('/:id', updateInstitution);
router.delete('/:id', deleteInstitution);

export default router;
