import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listUsers, createUser, updateUser } from '../controllers/users.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Listar usuarios (solo admin)
 *     tags: [Users]
 */
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);

export default router;
