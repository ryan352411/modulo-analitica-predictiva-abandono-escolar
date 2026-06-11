import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSummary } from '../controllers/dashboard.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', getSummary);

export default router;
