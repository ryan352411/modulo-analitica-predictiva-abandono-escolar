# Modulo de Analitica Predictiva de Abandono Escolar

Sistema web que predice el riesgo de abandono escolar de estudiantes mediante un backend Express, una SPA React, Supabase/PostgreSQL y un microservicio opcional de Machine Learning.

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | React 18, Vite 8, Tailwind CSS, Recharts, React Router v6, Axios, TanStack Query |
| Backend | Node.js, Express, JWT, Swagger UI |
| Base de datos | Supabase/PostgreSQL, 7 tablas con PK UUID |
| ML | FastAPI + Random Forest con scikit-learn; fallback local si el servicio no esta disponible |
| Despliegue | Docker Compose + Nginx |

## Estructura

```text
database/      schema.sql y seed.sql
backend/       API REST Express
frontend/      SPA React
ml-service/    Microservicio FastAPI para prediccion
```

## Seguridad Aplicada

- El backend valida el JWT y confirma en base de datos que el usuario siga activo en cada request.
- Todas las consultas de estudiantes, registros, predicciones, alertas, usuarios y dashboard quedan filtradas por `institution_id`.
- El cliente no puede enviar ni modificar `institution_id`; el backend lo toma del usuario autenticado.
- Los payloads de escritura usan listas de campos permitidos para reducir mass assignment.
- `database/schema.sql` activa RLS en tablas publicas para negar acceso directo por Data API cuando no hay politicas publicas.
- El login tiene limitacion simple de intentos por IP/correo.

## Puesta En Marcha

### 1. Base de datos

1. Crear un proyecto en Supabase.
2. Ejecutar `database/schema.sql` en SQL Editor.
3. Ejecutar `database/seed.sql` si se quieren datos demo.

Usuario demo:

```text
correo: admin@utdemo.edu.mx
contrasena: Admin123!
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm ci
npm run dev
```

Variables requeridas:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:5173
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

### 4. Microservicio ML

```bash
cd ml-service
python -m venv .venv
pip install -r requirements.txt
python -m app.train
uvicorn app.main:app --reload --port 8000
```

Con `ML_SERVICE_URL=http://localhost:8000` en el `.env` del backend, las predicciones usan el servicio FastAPI. Si no responde, el backend cae al stub local.

### 5. Docker

Crear `.env` en la raiz con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET` y opcionalmente `FRONTEND_URL`.

```bash
docker compose up -d --build
```

El frontend queda en `http://localhost` y Nginx hace proxy de `/api` al backend.

## Endpoints Principales

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesion y devuelve JWT |
| GET | `/api/auth/me` | Devuelve el usuario autenticado |
| GET | `/api/students` | Lista estudiantes de la institucion del usuario |
| GET | `/api/students/:id` | Expediente con registros, predicciones y alertas |
| POST | `/api/records` | Crea registro academico para estudiante autorizado |
| POST | `/api/predictions/student/:id` | Genera prediccion si existe registro academico |
| GET | `/api/alerts` | Lista alertas de la institucion |
| PATCH | `/api/alerts/:id` | Cambia estado de una alerta |
| GET | `/api/dashboard/summary` | KPIs filtrados por institucion |
| GET/POST/PATCH | `/api/users` | Gestion de usuarios, solo admin |

## Verificaciones

```bash
cd backend && npm audit --audit-level=moderate
cd frontend && npm run build
cd frontend && npm audit --audit-level=moderate
cd ml-service && python -m py_compile app/main.py app/train.py
```
