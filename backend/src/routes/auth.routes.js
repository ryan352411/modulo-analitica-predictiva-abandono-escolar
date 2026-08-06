import { Router } from 'express';
import {
  login,
  register,
  googleLogin,
  me,
  refresh,
  logout,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión y obtener access + refresh token
 *     tags: [Auth]
 */
router.post('/login', login);
router.post('/register', register);
router.post('/google', googleLogin);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

export default router;
