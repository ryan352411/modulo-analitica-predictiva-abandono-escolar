import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listAlerts, updateAlert } from '../controllers/alerts.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', listAlerts);
router.patch('/:id', updateAlert);

export default router;
