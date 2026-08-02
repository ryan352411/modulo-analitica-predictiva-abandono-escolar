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
