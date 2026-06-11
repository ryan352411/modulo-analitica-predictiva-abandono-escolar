import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listByStudent, createRecord } from '../controllers/records.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/student/:studentId', listByStudent);
router.post('/', requireRole('admin', 'coordinador', 'docente'), createRecord);

export default router;
