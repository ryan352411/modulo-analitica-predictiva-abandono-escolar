import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { exportReport } from '../controllers/reports.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'coordinador'));

/**
 * @openapi
 * /api/reports/export:
 *   get:
 *     summary: Exportar reporte CSV (admin/coordinador)
 *     tags: [Reports]
 */
router.get('/export', exportReport);

export default router;
