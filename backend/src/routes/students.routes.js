import { Router } from 'express';
import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listStudents, getStudent, getStudentTrend, createStudent,
  updateStudent, deleteStudent, importStudents,
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
router.get('/:id/trend', getStudentTrend);
router.post('/', requireRole('admin', 'coordinador'), createStudent);
router.post(
  '/import',
  requireRole('admin', 'coordinador'),
  express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }),
  importStudents
);
router.put('/:id', requireRole('admin', 'coordinador'), updateStudent);
router.delete('/:id', requireRole('admin'), deleteStudent);

export default router;
