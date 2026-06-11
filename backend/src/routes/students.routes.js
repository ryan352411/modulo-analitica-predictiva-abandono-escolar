import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listStudents, getStudent, createStudent, updateStudent, deleteStudent,
} from '../controllers/students.controller.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/students:
 *   get:
 *     summary: Listar estudiantes con paginación y filtros
 *     tags: [Students]
 */
router.get('/', listStudents);
router.get('/:id', getStudent);
router.post('/', requireRole('admin', 'coordinador'), createStudent);
router.put('/:id', requireRole('admin', 'coordinador'), updateStudent);
router.delete('/:id', requireRole('admin'), deleteStudent);

export default router;
