-- Datos de prueba minimos
INSERT INTO instituciones (id, nombre, codigo)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Universidad Tecnologica Demo', 'UTD-001');

-- Contrasena demo: Admin123!
INSERT INTO usuarios (institucion_id, nombre_completo, correo, contrasena_hash, rol)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Administrador Demo',
  'admin@utdemo.edu.mx',
  '$2a$12$9Z7G.jA4BwFkHZiTJPx2wukyYxgPfDrL.eubHxR/5nVp8fNoKu26a',
  'admin'
);

-- codigo_alumno es NOT NULL; se llena con el mismo valor que matricula.
INSERT INTO alumnos (institucion_id, codigo_alumno, matricula, nombre_completo, correo, semestre_actual, semestre, programa, fecha_inscripcion, nivel_socioeconomico)
VALUES
('a0000000-0000-0000-0000-000000000001', 'UTD2023001', 'UTD2023001', 'Maria Fernanda Lopez', 'maria.lopez@utdemo.edu.mx', 5, 5, 'TSU en Tecnologias de la Informacion', '2023-09-01', 'medio'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023002', 'UTD2023002', 'Carlos Ramirez Soto', 'carlos.ramirez@utdemo.edu.mx', 5, 5, 'TSU en Tecnologias de la Informacion', '2023-09-01', 'medio_bajo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024001', 'UTD2024001', 'Ana Sofia Gutierrez', 'ana.gutierrez@utdemo.edu.mx', 3, 3, 'TSU en Mecatronica', '2024-09-01', 'bajo');

-- Historial academico demo (alumno referenciado por codigo_alumno).
-- Valores plausibles que producen distintos niveles de riesgo:
--   Maria  -> perfil sano (riesgo bajo)
--   Carlos -> asistencia baja, reprobadas y varias entregas pendientes (riesgo alto/critico)
--   Ana    -> perfil intermedio (riesgo medio)
INSERT INTO historial_academico (alumno_id, periodo, promedio, tasa_asistencia, materias_reprobadas, entregas_pendientes, creditos_obtenidos, creditos_totales)
VALUES
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023001'), '2025-1', 8.7, 94, 0, 0, 90, 100),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023002'), '2025-1', 6.1, 68, 3, 6, 55, 100),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024001'), '2025-1', 7.4, 84, 1, 2, 38, 60);
