-- Datos de prueba: 1 escuela, 1 admin y 30 alumnos con historial variado.
-- Perfiles de riesgo distribuidos (bajo, medio, alto y critico) para el modelo.

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
INSERT INTO alumnos (institucion_id, codigo_alumno, matricula, nombre_completo, correo, genero, fecha_nacimiento, semestre_actual, semestre, programa, fecha_inscripcion, nivel_socioeconomico, estatus)
VALUES
('a0000000-0000-0000-0000-000000000001', 'UTD2023001', 'UTD2023001', 'Maria Fernanda Lopez Garcia', 'maria.lopez@utdemo.edu.mx', 'femenino', '2002-07-24', 9, 9, 'TSU en Contaduria', '2023-09-01', 'bajo', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024002', 'UTD2024002', 'Carlos Ramirez Soto', 'carlos.ramirez@utdemo.edu.mx', 'masculino', '2005-12-23', 5, 5, 'TSU en Tecnologias de la Informacion', '2024-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021003', 'UTD2021003', 'Ana Sofia Gutierrez Cruz', 'ana.gutierrez@utdemo.edu.mx', 'femenino', '2004-10-16', 7, 7, 'Ingenieria en Energia', '2021-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022004', 'UTD2022004', 'Jose Luis Hernandez Diaz', 'jose.hernandez@utdemo.edu.mx', 'masculino', '2000-12-17', 2, 2, 'TSU en Contaduria', '2022-09-01', 'alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024005', 'UTD2024005', 'Valeria Martinez Rios', 'valeria.martinez@utdemo.edu.mx', 'femenino', '2005-09-09', 9, 9, 'Ingenieria en Software', '2024-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022006', 'UTD2022006', 'Diego Sanchez Vega', 'diego.sanchez@utdemo.edu.mx', 'femenino', '2002-01-02', 3, 3, 'TSU en Contaduria', '2022-09-01', 'alto', 'egresado'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022007', 'UTD2022007', 'Ximena Torres Mendoza', 'ximena.torres@utdemo.edu.mx', 'femenino', '2005-08-15', 9, 9, 'Ingenieria en Software', '2022-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024008', 'UTD2024008', 'Luis Angel Flores Castro', 'luis.flores@utdemo.edu.mx', 'masculino', '2003-12-23', 9, 9, 'TSU en Administracion', '2024-09-01', 'medio_alto', 'baja_temporal'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023009', 'UTD2023009', 'Regina Reyes Jimenez', 'regina.reyes@utdemo.edu.mx', 'femenino', '2002-02-07', 7, 7, 'TSU en Mecatronica', '2023-09-01', 'medio_alto', 'baja_temporal'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021010', 'UTD2021010', 'Emiliano Morales Nunez', 'emiliano.morales@utdemo.edu.mx', 'masculino', '2001-02-20', 1, 1, 'Ingenieria en Energia', '2021-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023011', 'UTD2023011', 'Camila Ortiz Herrera', 'camila.ortiz@utdemo.edu.mx', 'femenino', '2005-12-05', 9, 9, 'TSU en Mecatronica', '2023-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024012', 'UTD2024012', 'Santiago Chavez Romero', 'santiago.chavez@utdemo.edu.mx', 'masculino', '2001-10-10', 9, 9, 'Ingenieria en Software', '2024-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021013', 'UTD2021013', 'Fernanda Vazquez Luna', 'fernanda.vazquez@utdemo.edu.mx', 'masculino', '2003-02-02', 6, 6, 'TSU en Contaduria', '2021-09-01', 'medio', 'egresado'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023014', 'UTD2023014', 'Alejandro Guerrero Pena', 'alejandro.guerrero@utdemo.edu.mx', 'femenino', '2003-06-04', 8, 8, 'Ingenieria en Software', '2023-09-01', 'alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024015', 'UTD2024015', 'Daniela Dominguez Rojas', 'daniela.dominguez@utdemo.edu.mx', 'femenino', '2003-10-08', 2, 2, 'Ingenieria en Energia', '2024-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024016', 'UTD2024016', 'Ricardo Aguilar Campos', 'ricardo.aguilar@utdemo.edu.mx', 'masculino', '2003-12-22', 1, 1, 'TSU en Mecatronica', '2024-09-01', 'alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022017', 'UTD2022017', 'Paola Mendez Salas', 'paola.mendez@utdemo.edu.mx', 'femenino', '2002-07-18', 7, 7, 'TSU en Tecnologias de la Informacion', '2022-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024018', 'UTD2024018', 'Miguel Angel Rivera Fuentes', 'miguel.rivera@utdemo.edu.mx', 'femenino', '2003-03-11', 9, 9, 'Ingenieria en Software', '2024-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022019', 'UTD2022019', 'Andrea Cortes Navarro', 'andrea.cortes@utdemo.edu.mx', 'masculino', '2000-08-21', 6, 6, 'Ingenieria en Software', '2022-09-01', 'alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023020', 'UTD2023020', 'Fernando Ibarra Solis', 'fernando.ibarra@utdemo.edu.mx', 'masculino', '2002-09-22', 9, 9, 'TSU en Mecatronica', '2023-09-01', 'bajo', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023021', 'UTD2023021', 'Sofia Cabrera Ponce', 'sofia.cabrera@utdemo.edu.mx', 'femenino', '2005-09-05', 2, 2, 'TSU en Administracion', '2023-09-01', 'bajo', 'egresado'),
('a0000000-0000-0000-0000-000000000001', 'UTD2022022', 'UTD2022022', 'Juan Pablo Delgado Miranda', 'juan.delgado@utdemo.edu.mx', 'masculino', '2004-06-09', 2, 2, 'TSU en Administracion', '2022-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024023', 'UTD2024023', 'Mariana Espinoza Valdez', 'mariana.espinoza@utdemo.edu.mx', 'masculino', '2000-02-08', 1, 1, 'TSU en Administracion', '2024-09-01', 'bajo', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2024024', 'UTD2024024', 'Eduardo Farias Lara', 'eduardo.farias@utdemo.edu.mx', 'masculino', '2003-06-20', 4, 4, 'Ingenieria en Energia', '2024-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023025', 'UTD2023025', 'Gabriela Gallardo Rincon', 'gabriela.gallardo@utdemo.edu.mx', 'femenino', '2002-06-02', 7, 7, 'TSU en Tecnologias de la Informacion', '2023-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023026', 'UTD2023026', 'Roberto Huerta Bravo', 'roberto.huerta@utdemo.edu.mx', 'masculino', '2004-06-07', 9, 9, 'TSU en Tecnologias de la Informacion', '2023-09-01', 'bajo', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2023027', 'UTD2023027', 'Itzel Juarez Meza', 'itzel.juarez@utdemo.edu.mx', 'masculino', '2003-10-05', 6, 6, 'Ingenieria en Software', '2023-09-01', 'medio_alto', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021028', 'UTD2021028', 'Hector Leon Padilla', 'hector.leon@utdemo.edu.mx', 'femenino', '2002-03-08', 1, 1, 'TSU en Tecnologias de la Informacion', '2021-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021029', 'UTD2021029', 'Karla Marquez Cano', 'karla.marquez@utdemo.edu.mx', 'masculino', '2004-01-21', 9, 9, 'TSU en Administracion', '2021-09-01', 'medio', 'activo'),
('a0000000-0000-0000-0000-000000000001', 'UTD2021030', 'UTD2021030', 'Sergio Nava Trejo', 'sergio.nava@utdemo.edu.mx', 'masculino', '2003-01-08', 9, 9, 'TSU en Mecatronica', '2021-09-01', 'medio_alto', 'activo');

-- Historial academico (referencia al alumno por codigo_alumno).
INSERT INTO historial_academico (alumno_id, periodo, promedio, tasa_asistencia, materias_reprobadas, entregas_pendientes, creditos_obtenidos, creditos_totales)
VALUES
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023001'), '2025-1', 7.1, 88, 1, 2, 144, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024002'), '2025-1', 9.0, 96, 0, 1, 95, 100),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021003'), '2025-1', 9.1, 97, 0, 0, 133, 140),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022004'), '2025-1', 8.7, 93, 0, 0, 38, 40),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024005'), '2025-1', 5.4, 60, 4, 9, 81, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022006'), '2025-1', 9.4, 97, 0, 1, 57, 60),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022007'), '2025-1', 6.9, 79, 3, 5, 112, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024008'), '2025-1', 6.2, 72, 3, 3, 112, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023009'), '2025-1', 4.6, 59, 5, 10, 63, 140),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021010'), '2025-1', 9.2, 92, 0, 0, 19, 20),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023011'), '2025-1', 8.1, 88, 1, 1, 144, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024012'), '2025-1', 9.1, 93, 0, 1, 171, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021013'), '2025-1', 9.5, 90, 0, 1, 114, 120),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023014'), '2025-1', 8.7, 98, 0, 0, 152, 160),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024015'), '2025-1', 6.6, 68, 2, 3, 25, 40),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024016'), '2025-1', 8.1, 82, 0, 3, 16, 20),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022017'), '2025-1', 7.4, 84, 1, 2, 112, 140),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024018'), '2025-1', 5.6, 53, 3, 7, 81, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022019'), '2025-1', 6.8, 76, 2, 3, 74, 120),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023020'), '2025-1', 7.3, 89, 0, 3, 144, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023021'), '2025-1', 7.2, 80, 1, 3, 32, 40),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2022022'), '2025-1', 6.3, 66, 3, 5, 25, 40),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024023'), '2025-1', 6.6, 79, 3, 5, 12, 20),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2024024'), '2025-1', 9.2, 91, 0, 1, 76, 80),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023025'), '2025-1', 4.9, 48, 4, 9, 63, 140),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023026'), '2025-1', 6.1, 66, 2, 5, 112, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2023027'), '2025-1', 5.6, 52, 3, 7, 54, 120),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021028'), '2025-1', 7.5, 85, 0, 3, 16, 20),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021029'), '2025-1', 7.9, 85, 0, 3, 144, 180),
((SELECT id FROM alumnos WHERE codigo_alumno = 'UTD2021030'), '2025-1', 8.9, 93, 0, 1, 171, 180);
