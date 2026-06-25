import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listAuditLogs } from '../controllers/audit.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /api/audit-logs:
 *   get:
 *     summary: Registro de auditoría con filtros (solo admin)
 *     tags: [Audit]
 */
router.get('/', listAuditLogs);

export default router;
