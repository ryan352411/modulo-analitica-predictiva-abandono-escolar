# Revisión funcional — Módulo de Analítica Predictiva de Abandono Escolar

> Auditoría de completitud funcional: cada capacidad de la API contra su contraparte en la interfaz, y estado de cada pantalla.
> **Diagnóstico + implementación.** El diagnóstico (secciones 1–9) se conserva sin cambios; la **sección 0** (abajo) registra qué se corrigió y dónde. Fecha: 2026-08-06.
> Roles del sistema: `admin`, `coordinador`, `docente` (no existe `tutor`).

---

## 0. Estado de implementación (2026-08-06)

Los hallazgos del diagnóstico (secciones 1–9, más abajo, sin modificar) se implementaron en la rama **`fix/revision-funcional`**; la rama `main` quedó intacta como punto de retorno. Se trabajó en 6 bloques + correcciones, con **un commit por bloque**. Verificación: `npm run build` compila sin errores ni advertencias nuevas (solo persiste la advertencia preexistente de tamaño de chunk); `node --check` pasa en los tres controladores backend tocados.

### Estado por hallazgo

| Hallazgo | Sev. | Estado | Dónde quedó |
|---|---|---|---|
| A-01 · Nivel `critico` sin color/etiqueta | Alta | ✅ Resuelto | `Dashboard.jsx` usa `riskHex` (fuente única) en el pie; `utils.js`/`RiskBadge.jsx`/`tailwind.config.js` ya traían `critico` y `risk.critical`. Verificado en Dashboard (pie + lista), StudentDetail y HighRisk. |
| A-02 · Eliminar estudiante inalcanzable | Alta | ✅ Resuelto | `StudentDetail.jsx`: botón **solo admin**, confirmación de borrado físico en cascada, invalida la lista y navega. |
| M-01 · Filtro por estatus en Students | Media | ✅ Resuelto | `Students.jsx` (selector `ESTATUS_ALUMNO`, reinicia a página 1) |
| M-02 · Filtros en Alerts | Media | ✅ Resuelto | `Alerts.jsx` (estatus + severidad) |
| M-03 · Descartar alertas | Media | ✅ Resuelto | `Alerts.jsx` (desde pendiente y en atención) |
| M-04 · Evolución del score | Media | ✅ Resuelto | `useStudents.js` (`useStudentTrend`) + `StudentDetail.jsx` (LineChart + estado vacío) |
| M-05 · Tendencia en Dashboard | Media | ✅ Resuelto | `dashboard.controller.js` (`risk_trend`) + `Dashboard.jsx` (gráfica) — ver salvedad 1 |
| M-06 · Historial académico completo | Media | ✅ Resuelto | `StudentDetail.jsx` (tabla por periodo) |
| M-07 · Guard de rol en el ruteo | Media | ✅ Resuelto | `ProtectedRoute.jsx` (prop `roles` + pantalla "Sin permisos") + `App.jsx` |
| M-08 · Gatear controles con 403 | Media | ✅ Resuelto | `Students.jsx`, `StudentDetail.jsx`, `Careers.jsx` (`canManage`) |
| M-09 · 503 del ML en el lote | Media | ✅ Resuelto | `predictions.controller.js` |
| M-10 · Estado de error en consultas | Media | ✅ Resuelto | 8 pantallas (banner con `mensajeError`) — ver salvedad 4 |
| M-11 · Detalle de filas inválidas del CSV | Media | ✅ Resuelto | `Students.jsx` (modal con fila + motivo) |
| §8 · Restricciones 409/422 + validación créditos | Media | ✅ Resuelto | `records.controller.js` + `RecordFormModal.jsx` — ver salvedad 2 |
| B-01 · KPI "recientes" engañoso | Baja | ✅ Resuelto (vía M-05) | `Dashboard.jsx` usa `total_predictions` (conteo real) |
| B-02 · HighRisk título/orden | Baja | ✅ Resuelto | `HighRisk.jsx` ("alto o crítico", orden por `puntaje_riesgo` desc) |
| B-03 · AuditLogs filtros | Baja | ✅ Resuelto | `AuditLogs.jsx` (usuario + fecha inicio + fecha fin) |
| B-04 · Users editar nombre | Baja | ✅ Resuelto | `Users.jsx` (modal) |
| B-05 · Alerts sin estado de error | Baja | ✅ Resuelto (vía M-10) | `Alerts.jsx` |
| B-06 · Periodos fijos en 2026 | Baja | ✅ Resuelto | `RecordFormModal.jsx` (derivados del año en curso) |
| B-07 · StudentDetail 404 vs otros errores | Baja | ✅ Resuelto | `StudentDetail.jsx` |
| B-08 · Fila vacía en Users | Baja | ⏭️ Omitido a propósito | Autorizado a omitir; Users siempre tiene al menos al admin. |
| B-09 · Google login | — | ➖ Sin código | Solo requiere las variables `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`. |

**Total: 2/2 altas, 11/11 medias y 6/6 bajas accionables resueltas.** B-08 omitida (autorizado), B-09 no requiere código.

### Resumen de cambios por archivo

**Backend**
- `controllers/dashboard.controller.js` — agrega `total_predictions` (conteo real) y `risk_trend` (promedio de riesgo por mes, cronológico) al `data` del summary. *(M-05, B-01)*
- `controllers/predictions.controller.js` — `generateBatch` traduce el error 503 del microservicio igual que la predicción individual. *(M-09)*
- `controllers/records.controller.js` — `createRecord` mapea `23505` (periodo duplicado) → **409** y `23514` (créditos) → **422**. *(§8)*

**Frontend**
- `components/layout/ProtectedRoute.jsx` — acepta `roles` y, si el rol no alcanza, muestra una pantalla explícita "Sin permisos". *(M-07)*
- `App.jsx` — envuelve `/usuarios`, `/escuelas`, `/modelo` y `/auditoria` con `<ProtectedRoute roles={['admin']}>`. *(M-07)*
- `hooks/useStudents.js` — agrega `useStudentTrend(id)`. *(M-04)*
- `pages/Dashboard.jsx` — pie con `riskHex`, KPI `total_predictions`, gráfica de tendencia. *(A-01, M-05, B-01)*
- `pages/StudentDetail.jsx` — botón eliminar (admin) + gateo de "Editar", gráfica de evolución del score, tabla de historial académico, distinción de 404. *(A-02, M-08, M-04, M-06, B-07)*
- `pages/Students.jsx` — filtro por estatus, gateo de "Nuevo"/exportación, banner de error, modal de errores de CSV. *(M-01, M-08, M-10, M-11)*
- `pages/Alerts.jsx` — filtros de estatus/severidad, botón "Descartar", banner de error. *(M-02, M-03, M-10, B-05)*
- `pages/Careers.jsx` — gateo de crear/editar/eliminar por rol, banner de error. *(M-08, M-10)*
- `pages/HighRisk.jsx` — título "alto o crítico", orden por score, banner de error. *(B-02, M-10)*
- `pages/AuditLogs.jsx` — filtros por usuario/fecha, banner de error. *(B-03, M-10)*
- `pages/Users.jsx` — editar nombre completo, banner de error. *(B-04, M-10)*
- `pages/Institutions.jsx` — banner de error. *(M-10)*
- `pages/ModelInfo.jsx` — banner de error. *(M-10)*
- `components/RecordFormModal.jsx` — validación de créditos en cliente, periodos derivados del año actual. *(§8, B-06)*

*(No se tocó: `utils.js` y `tailwind.config.js` ya traían `critico`/`risk.critical` y los ayudantes; no se modificó `ml-service/`, ni nombres de tablas/columnas/rutas, ni se agregó borrado de usuarios, ni se cambió `docente`→`tutor`.)*

### Salvedades (leer)

1. **M-05 (tendencia)** se calcula sobre las **últimas 500 predicciones** (el límite que ya tenía la consulta del summary), agrupadas por mes. Es una tendencia *reciente*, no la historia completa. `total_predictions`, en cambio, **sí** es el conteo real (consulta `count` aparte).
2. **§8 (`23514` → 422)**: el mensaje asume que el CHECK que falla es el de **créditos** (`creditos_obtenidos <= creditos_totales`). Los demás campos con CHECK (promedio, asistencia, reprobadas…) ya se validan por rango en el cliente, así que en la práctica el `23514` que llega al backend es el de créditos. Si se agrega otro CHECK a la tabla, el mensaje podría quedar impreciso.
3. **A-01 en Alerts**: la pantalla de Alertas muestra **severidad** (`critica`), no el nivel de riesgo, y esa severidad ya estaba coloreada por su propio `severityStyle`. El nivel `critico` (badge de `RiskBadge`) se verificó en **Dashboard, StudentDetail y HighRisk**; en Alerts no aplica un badge de nivel de riesgo.
4. **M-10** se implementó como **banner rojo** bajo el encabezado de cada pantalla (usando `mensajeError`), en lugar de reemplazar toda la vista, para no ocultar los filtros/controles ante un error transitorio. Conserva el estilo visual de `Dashboard.jsx:13` (`text-risk-high`).

---

## 1. Resumen

| Métrica | Valor |
|---|---|
| Endpoints de negocio (excl. `/api/health` y `/api/docs`) | **38** |
| Con consumidor activo en el frontend | **32** |
| Endpoints GET huérfanos (sin ningún consumidor) | **5** |
| Endpoints con hook pero sin ningún disparador en la UI | **1** (`DELETE /api/students/:id`) |
| Llamadas del frontend a rutas inexistentes o con verbo distinto | **0** |
| Desajustes en la forma de la respuesta (`data.data`, `data.total`, …) | **0** |

**Huecos por severidad:** **2 altas**, **11 medias**, **9 bajas**.

Titular: el backend está más completo que la interfaz. Los desajustes de contrato (rutas/verbos/formas) son cero — todo lo que el frontend llama existe y con la forma esperada. Los huecos son de **cobertura de UI** (acciones del backend sin botón), **gateo de permisos** (botones visibles para roles que reciben 403) y un **defecto transversal de color/etiqueta del nivel `critico`**, que el backend sí produce y almacena pero la interfaz no sabe dibujar.

---

## 2. Cobertura de endpoints

Leyenda de estado: ✅ consumido · ⚠️ sin consumidor · ❌ construido sin disparador en UI.

| Verbo | Ruta | Roles (backend) | Consumidor en frontend | Estado |
|---|---|---|---|---|
| POST | `/api/auth/login` | público | `context/AuthContext.jsx:30` | ✅ |
| POST | `/api/auth/register` | público | `context/AuthContext.jsx:35` | ✅ |
| POST | `/api/auth/google` | público | `context/AuthContext.jsx:40` ← `pages/Login.jsx:64` | ✅ |
| POST | `/api/auth/refresh` | público | `lib/api.js:20` (interceptor) | ✅ |
| POST | `/api/auth/logout` | autenticado | `context/AuthContext.jsx:55` | ✅ |
| GET | `/api/auth/me` | autenticado | — | ⚠️ huérfano |
| GET | `/api/students` | autenticado | `hooks/useStudents.js:7` | ✅ |
| GET | `/api/students/programs` | autenticado | — | ⚠️ huérfano (la UI usa `/careers`) |
| GET | `/api/students/:id` | autenticado | `hooks/useStudents.js:14` | ✅ |
| GET | `/api/students/:id/trend` | autenticado | — | ⚠️ huérfano |
| POST | `/api/students` | admin, coordinador | `hooks/useStudentMutations.js:7` | ✅ ⚠️ botón sin gateo (§4) |
| POST | `/api/students/import` | admin, coordinador | `hooks/useStudents.js:44` | ✅ |
| PUT | `/api/students/:id` | admin, coordinador | `hooks/useStudentMutations.js:15` | ✅ ⚠️ botón sin gateo (§4) |
| DELETE | `/api/students/:id` | admin | `hooks/useStudentMutations.js:26` (hook sin uso) | ❌ sin disparador en UI |
| GET | `/api/records/student/:studentId` | autenticado | — | ⚠️ huérfano (la UI usa el embed) |
| POST | `/api/records` | admin, coordinador, docente | `hooks/useStudentMutations.js:35` | ✅ |
| POST | `/api/predictions/student/:studentId` | autenticado | `hooks/useStudents.js:22` | ✅ |
| GET | `/api/predictions/student/:studentId` | autenticado | — | ⚠️ huérfano (la UI usa el embed) |
| POST | `/api/predictions/batch` | admin, coordinador | `hooks/useStudents.js:30` ← `pages/Students.jsx:49` | ✅ |
| GET | `/api/predictions/high-risk` | autenticado | `hooks/useStudents.js:62` | ✅ |
| GET | `/api/alerts` | autenticado | `pages/Alerts.jsx:19` | ✅ |
| PATCH | `/api/alerts/:id` | autenticado | `pages/Alerts.jsx:23` | ✅ parcial (falta `descartada`, §4/§hallazgos) |
| GET | `/api/dashboard/summary` | autenticado | `hooks/useDashboard.js:7` | ✅ |
| GET | `/api/users` | admin | `pages/Users.jsx:25` | ✅ |
| POST | `/api/users` | admin | `pages/Users.jsx:29` | ✅ |
| PATCH | `/api/users/:id` | admin | `pages/Users.jsx:39` | ✅ |
| GET | `/api/institutions` | admin | `pages/Institutions.jsx:21` | ✅ |
| POST | `/api/institutions` | admin | `pages/Institutions.jsx:28`, `pages/Onboarding.jsx:25` | ✅ |
| PATCH | `/api/institutions/:id` | admin | `pages/Institutions.jsx:27` | ✅ |
| DELETE | `/api/institutions/:id` | admin | `pages/Institutions.jsx:39` | ✅ |
| GET | `/api/careers` | autenticado | `pages/Careers.jsx:18`, `hooks/useStudents.js:55` | ✅ |
| POST | `/api/careers` | admin, coordinador | `pages/Careers.jsx:25` | ✅ ⚠️ botón sin gateo de rol (§4) |
| PATCH | `/api/careers/:id` | admin, coordinador | `pages/Careers.jsx:24` | ✅ ⚠️ sin gateo de rol (§4) |
| DELETE | `/api/careers/:id` | admin, coordinador | `pages/Careers.jsx:37` | ✅ ⚠️ sin gateo de rol (§4) |
| GET | `/api/model/info` | admin | `pages/ModelInfo.jsx:13` | ✅ |
| POST | `/api/model/retrain` | admin | `pages/ModelInfo.jsx:17` | ✅ |
| GET | `/api/audit-logs` | admin | `pages/AuditLogs.jsx:28` | ✅ |
| GET | `/api/reports/export` | admin, coordinador | `lib/download.js:4` ← `pages/Students.jsx:23` | ✅ ⚠️ botones sin gateo de rol (§4) |

### 2.1 Los cuatro que preguntaste (confirmados) + uno más

| Endpoint | ¿Consumido? | Diagnóstico y recomendación |
|---|---|---|
| `GET /api/auth/me` | No | Intencional/tolerable. La sesión se rehidrata desde `sessionStorage` (`AuthContext.jsx:9-18`). Útil solo si quieres revalidar el usuario al recargar (p. ej. si le cambiaron el rol). **Retirar o conectar** en el arranque; sin urgencia. |
| `GET /api/students/programs` | No | **Superado.** El selector de programa se llena desde `/careers` (`useStudents.js:52-57` → `StudentForm.jsx:135-142`). Este endpoint devuelve los `programa` distintos de `alumnos`, que ya no se usa. **Retirar** (o repuntar la UI si prefieres los programas reales sobre los catálogos de carrera). |
| `GET /api/students/:id/trend` | No | **Conviene conectarlo.** Devuelve la serie temporal del score (`puntaje_riesgo` + `risk_percent`) por fecha (`students.controller.js:218-248`). Es exactamente lo que falta para la "evolución del score" en `StudentDetail` (ver hallazgo M-04). |
| `GET /api/records/student/:studentId` | No | **Superado.** `GET /api/students/:id` ya trae `historial_academico(*)` embebido (`students.controller.js:129`) y el detalle lo usa. **Retirar**, salvo que se quiera paginar/consultar el historial por separado. |
| `GET /api/predictions/student/:studentId` | No (hallazgo nuevo) | **Superado.** `GET /api/students/:id` ya trae `predicciones(*)` embebido y el detalle lo consume. Mismo criterio que el anterior: **retirar** o dejar para uso administrativo vía Swagger. |

No hay **ninguna** llamada del frontend a rutas inexistentes, ni con verbo equivocado, ni con forma de respuesta distinta a la que devuelve el controlador (revisado uno por uno; ver §7 "Lo que está bien").

---

## 3. Controles por pantalla

| Pantalla | Acciones que ofrece | Acciones que faltan / observaciones |
|---|---|---|
| **Login** (`pages/Login.jsx`) | Iniciar sesión con correo (`:152`); botón Google real cuando hay `VITE_GOOGLE_CLIENT_ID`, si no un botón que avisa "no configurado" (`:185-195`); enlace a registro (`:203-208`) | Completa. El botón de Google inactivo es informativo, no un 403. |
| **Register** (`pages/Register.jsx`) | Crear cuenta con nombre/correo/contraseña + confirmación; validación de ≥8 y coincidencia (`:21-28`); enlace a login | Completa. |
| **Onboarding** (`pages/Onboarding.jsx`) | Crear escuela (POST `/institutions`) y continuar; cerrar sesión | Completa y **sí conectada** (ver §6). |
| **Dashboard** (`pages/Dashboard.jsx`) | Total activos, alertas pendientes, "predicciones recientes" (KPI), lista de recientes, **pie** de distribución | **Falta gráfica de tendencia** (M-05). Pie sin color para `critico` (A-01). KPI "recientes" = longitud tope 10 (B-01). |
| **Students** (`pages/Students.jsx`) | Buscar (`:62`), paginar (`:228-248`), crear (`:114`), importar CSV (`:82`), generar lote (`:76`), exportar csv/xlsx/pdf (`:99-112`), entrar al detalle (`:204`) | **Falta filtro por estatus** (M-01). **No hay botón eliminar** (A-02). "Nuevo" y "Exportar" sin gateo de rol (M-08). Editar se hace desde el detalle, no desde la lista. Sin estado de error de la consulta (M-10). |
| **StudentDetail** (`pages/StudentDetail.jsx`) | Editar (`:54`), capturar registro (`:60`), generar predicción (`:66`), gráfica de promedio (`:93-108`), factores principales (`:134-145`), historial de predicciones en tabla (`:157-190`) | **No hay gráfica de evolución del score** (M-04, se resuelve con `/students/:id/trend`). El historial académico solo se muestra como promedio; asistencia/reprobadas/entregas/créditos capturados no se ven (M-06). Botón Editar sin gateo de rol (M-08). |
| **Predicción por lote** (en `Students.jsx`) | Botón "Generar lote" con modal de resumen (`:76-81`, `:127-178`), solo `canManage` | Correcto: visible solo admin/coordinador. |
| **Reportes** (en `Students.jsx`) | Selector csv/xlsx/pdf (`:99-112`) | Funciona, pero **visible a todos los roles** aunque el backend exige admin/coordinador (M-08). |
| **Alerts** (`pages/Alerts.jsx`) | Ver alertas; pendiente→en atención (`:67-74`); en atención→resuelta (`:75-82`); enlace al expediente | **No hay filtros por estatus ni severidad** (M-02). **Falta transición a `descartada`** (M-03). No se puede reabrir/descartar desde otros estados. Sin estado de error (M-10). |
| **HighRisk** (`pages/HighRisk.jsx`) | Listado con % de riesgo, nivel, fecha, enlace al perfil | Ordenado por fecha (no por score); título dice "alto" pero incluye `critico` (B-02). Badge sin color para `critico` (A-01). Sin estado de error (M-10). |
| **ModelInfo** (`pages/ModelInfo.jsx`) | Estado del servicio, versión usada, métricas, botón Reentrenar | Completa. Alcanzable por URL para no-admin (M-07); en ese caso las llamadas dan 403 y la página queda a medias. |
| **AuditLogs** (`pages/AuditLogs.jsx`) | Listado + filtro por acción (`:38-51`) + paginación | Falta filtro por usuario y por rango de fechas que el backend sí soporta (`audit.controller.js:29-32`) (B-03). |
| **Users** (`pages/Users.jsx`) | Listar, crear (modal), cambiar rol inline (`:113-121`), activar/desactivar (`:144-151`), cambiar contraseña (`:138-143`) | **Sin borrado** — correcto, el backend no lo expone (§6 ✔). No se puede editar el nombre tras crear (backend sí lo permite) (B-04). |
| **Institutions** (`pages/Institutions.jsx`) | Listar, crear (solo si no hay escuela), editar, eliminar con confirmación (`:73-79`) y deshabilitado si tiene alumnos (`:137`) | Completa. |
| **Careers** (`pages/Careers.jsx`) | Listar, crear, editar, eliminar con confirmación (`:66-68`) | **Sin gateo de rol**: los botones crear/editar/eliminar se ven para cualquier rol que entre por URL; docente recibe 403 (M-08). |
| **Layout** (`components/layout/AppLayout.jsx`) | Cerrar sesión (`:73-78`); menú filtrado por rol (`:47-51`) | El menú oculta correctamente lo admin-only, pero el ruteo no refuerza el rol (M-07). |

---

## 4. Coherencia de permisos (backend ↔ frontend)

| Acción | Rol exigido (backend) | Condición en frontend | ¿Coinciden? |
|---|---|---|---|
| Crear estudiante (`POST /students`) | admin, coordinador | **Ninguna** — `Students.jsx:114-119` siempre visible | ❌ docente ve "Nuevo" → 403 |
| Editar estudiante (`PUT /students/:id`) | admin, coordinador | **Ninguna** — `StudentDetail.jsx:54-59` siempre visible | ❌ docente ve "Editar" → 403 |
| Eliminar estudiante (`DELETE /students/:id`) | admin | **No hay control** | ⚠️ inalcanzable (A-02) |
| Importar CSV (`POST /students/import`) | admin, coordinador | `canManage` (`Students.jsx:73`) | ✅ |
| Generar lote (`POST /predictions/batch`) | admin, coordinador | `canManage` (`Students.jsx:73`) | ✅ |
| Exportar reporte (`GET /reports/export`) | admin, coordinador | **Ninguna** — `Students.jsx:99-112` siempre visible | ❌ docente ve csv/xlsx/pdf → 403 |
| Generar predicción (`POST /predictions/student/:id`) | autenticado | Botón visible a todos (`StudentDetail.jsx:66`) | ✅ |
| Capturar registro (`POST /records`) | admin, coordinador, docente | Botón visible a todos (`StudentDetail.jsx:60`) | ✅ |
| Cambiar estatus de alerta (`PATCH /alerts/:id`) | autenticado | Botones visibles a todos (`Alerts.jsx:67-82`) | ✅ |
| Crear/editar/borrar carrera (`/careers` POST/PATCH/DELETE) | admin, coordinador | **Ninguna** dentro de la página; solo el enlace del menú está gateado | ❌ docente por URL ve los botones → 403 |
| Usuarios (`/users` GET/POST/PATCH) | admin | Menú `adminOnly`; **ruta sin guard de rol** | ⚠️ oculto en menú, alcanzable por URL (M-07) |
| Escuelas (`/institutions` *) | admin | Menú `adminOnly`; **ruta sin guard de rol** | ⚠️ igual que arriba |
| Modelo (`/model` *) | admin | Menú `adminOnly`; **ruta sin guard de rol** | ⚠️ igual que arriba |
| Auditoría (`/audit-logs`) | admin | Menú `adminOnly`; **ruta sin guard de rol** | ⚠️ igual que arriba |
| Cambiar rol propio | bloqueado (`users.controller.js:78-80`) | `Select` deshabilitado para uno mismo (`Users.jsx:116`) | ✅ |
| Desactivar cuenta propia | bloqueado (`users.controller.js:91-93`) | Botón oculto para uno mismo (`Users.jsx:144`) | ✅ |
| Borrar usuario | **no existe en backend** | No hay control en UI | ✅ (coinciden en no ofrecerlo) |

### ProtectedRoute y ruteo (`components/layout/ProtectedRoute.jsx`, `App.jsx`)

`ProtectedRoute` solo comprueba que exista `user` (`ProtectedRoute.jsx:4-7`); **no valida rol**. En `App.jsx:26-38` todas las rutas internas cuelgan del mismo `AppLayout` sin distinción de rol.

**¿Qué pasa si un docente escribe a mano `/usuarios` o `/auditoria`?**
La página se renderiza (no hay redirección ni bloqueo por rol). La consulta de datos (`GET /users` / `GET /audit-logs`) devuelve **403**. El interceptor de `lib/api.js` **solo actúa ante 401**, así que el 403 pasa de largo: `isLoading` pasa a `false`, `data` queda `undefined` y la tabla se muestra **vacía**, con los botones de acción todavía presentes. No hay mensaje de "acceso denegado" ni redirección. No se filtran datos (el backend los protege), pero la experiencia es una pantalla rota en lugar de un bloqueo claro. → **M-07**.

---

## 5. Estados de la interfaz (cargando / error / vacío / con datos)

| Pantalla | Cargando | Error | Vacío | Nota |
|---|---|---|---|---|
| Dashboard | ✅ `:12` | ✅ `:13` | ✅ `:74-78` | Único que cubre los cuatro. |
| Students | ✅ `:193` | ❌ | ✅ `:216` "Sin resultados" | Sin estado de error de la consulta. |
| StudentDetail | ✅ `:25` | ⚠️ `:26` (muestra "no encontrado" también ante un 500) | ✅ registros/predicciones vacíos | Error de predicción sí se muestra (`:85`). |
| StudentForm | ❌ | ✅ en submit (`:171`) | — | Si `usePrograms` falla, el select queda vacío. |
| Alerts | ✅ `:31` | ❌ | ✅ `:87` | Sin estado de error. |
| HighRisk | ✅ `:29` | ❌ | ✅ `:58` | Sin estado de error. |
| Users | ✅ `:98` | ❌ | ❌ (sin fila "sin usuarios") | Sin estado de error. |
| Institutions | ✅ `:110` | ⚠️ (solo en mutaciones) | ✅ `:147` | Consulta sin estado de error. |
| Careers | ✅ `:94` | ⚠️ (solo en mutaciones) | ✅ `:122` | Consulta sin estado de error. |
| ModelInfo | ✅ `:51` | ❌ (ante 403/500 muestra "Sin métricas") | n/a | Retrain sí muestra error. |
| AuditLogs | ✅ `:66` | ❌ | ✅ `:83` | Sin estado de error. |

**Patrón sistémico:** salvo el Dashboard, **ninguna pantalla maneja el estado de error de la consulta** (react-query expone `error` pero no se usa). Ante 403/500/503 la pantalla queda vacía en silencio. → **M-10**.

### Casos concretos que pediste verificar

1. **Predicción de alumno sin registro académico (400).** ✅ Se maneja bien. `predictions.controller.js:69-73` responde 400 con mensaje claro; `StudentDetail.jsx:66-84` lo captura en `onError` y lo muestra en `:85`. El usuario ve *"El estudiante necesita al menos un registro academico…"*.
2. **Microservicio ML caído (503).**
   - Predicción individual: ✅ se surtea. `mlService.js:22-32` lanza 503; `predictions.controller.js:78-81` lo devuelve como 503 con mensaje; el detalle lo muestra. El usuario ve *"La prediccion no se pudo realizar"*.
   - Predicción por lote: ⚠️ `generateBatch` (`predictions.controller.js:85-110`) **no** mapea el 503; cae en `next(e)` y, como 503 no es 4xx, el `errorHandler` responde *"Error interno del servidor"* (genérico). Se muestra, pero sin claridad. → **M-09**.
   - ModelInfo: ✅ muestra "Disponible: No" y el texto del error (`ModelInfo.jsx:59,70`).
3. **Token expirado (interceptor).** ✅ Correcto y **sin bucle ni pantalla en blanco**. `lib/api.js:36-50`: al primer 401 en llamada no-auth intenta refrescar una sola vez (`_retry`); si el refresh falla, limpia `sessionStorage` y redirige a `/login` con recarga completa; si el reintento vuelve a dar 401, el segundo bloque (`:52-55`) limpia y redirige. La promesa `refreshing` es compartida entre llamadas concurrentes y se limpia en ambos caminos. No hay reintentos infinitos.
4. **Importación de CSV con filas inválidas.** ⚠️ Parcial. El backend devuelve `errors: [{row, error}]` (`students.controller.js:288`), pero `Students.jsx:37-42` **solo muestra el conteo** (*"…N con error"*), no el detalle por fila. Si ninguna fila es válida (400), solo se ve el mensaje de cabecera. → **M-11**.

---

## 6. Detalles que pediste confirmar explícitamente

| Pregunta | Respuesta |
|---|---|
| ¿La eliminación de un estudiante pide confirmación? | **No aplica: no existe control de borrado en la UI.** El hook `useDeleteStudent` (`useStudentMutations.js:23`) no se usa en ninguna página; `DELETE /api/students/:id` (borrado físico en cascada de historial/predicciones/alertas — `schema.sql:68,89,104`) es **inalcanzable**. → **A-02**. (Como referencia, Institutions **sí** confirma con `window.confirm` en `Institutions.jsx:73-79`, y Careers en `Careers.jsx:66`.) |
| ¿Los 4 niveles de riesgo usan el mismo color en todas las vistas? | **No.** `bajo/medio/alto` **sí** son consistentes (mismos hex en `utils.js:24-28` y `Dashboard.jsx:7`: `#2E9E6B / #E5A33D / #D14545`). Pero **`critico` no tiene color ni etiqueta en ninguna parte**: falta en `riskColor`/`riskLabel` (`utils.js:24-30`), en `RISK_COLORS` del Dashboard (`Dashboard.jsx:7`) y en la paleta de Tailwind (`tailwind.config.js:11`, no hay `risk.critical`). → **A-01**. |
| ¿El score se muestra como porcentaje en todos lados? | **Sí.** El backend lo devuelve en 0–1 y la UI multiplica por 100 en todos los puntos: Dashboard (`:69`), StudentDetail (`:128,173`), HighRisk (`:48`), factores (`:140`) y en el reporte del backend (`reports.controller.js:45`). Consistente. |
| ¿Hay pantallas/componentes no enlazados? | **No hay pantallas ni componentes huérfanos.** Todas las páginas están ruteadas (`App.jsx`) y todos los componentes (`Card`, `Field`, `Modal`, `RiskBadge`, `RecordFormModal`, `EducationArt`, `ProtectedRoute`, `AppLayout`) se usan. El único **código muerto** es el hook `useDeleteStudent`. |
| ¿`Onboarding.jsx` está conectado? | **Sí, conectado.** Ruta `/onboarding` (`App.jsx:25`); `AppLayout.jsx:33` redirige ahí si `user && !user.institution_id`; `Login.jsx:41` y `Register.jsx:32` navegan ahí tras autenticarse sin institución. |

---

## 7. Hallazgos ordenados por prioridad

### 🔴 Alta — funcionalidad inalcanzable o error visible al usuario

**A-01 · El nivel de riesgo `critico` se muestra sin color y sin nombre en toda la interfaz.**
- Dónde: `frontend/src/lib/utils.js:24-30` (`riskColor`/`riskLabel` solo `bajo/medio/alto`); `frontend/src/components/ui/RiskBadge.jsx:7-9` (para `critico`, `riskColor[level]` = `undefined` → sin color; `riskLabel[level]` = `undefined` → renderiza "Riesgo " sin nivel); `frontend/src/pages/Dashboard.jsx:7` (`RISK_COLORS` sin `critico` → la porción del pie queda con `fill=undefined`); `frontend/tailwind.config.js:11` (paleta `risk` sin `critical`).
- Qué pasa: el backend genera y almacena `critico` (`schema.sql:92`; `predictions.controller.js:46-58` crea alerta `critica` para score ≥ 0.85). En Dashboard, StudentDetail (última + historial) y HighRisk, un alumno crítico aparece con una insignia gris/transparente que dice solo "Riesgo " y una rebanada de pie sin color. Es el nivel **más grave** y es el que peor se ve.
- Qué falta: definir `critical` en la paleta de Tailwind y agregar `critico` a `riskColor`, `riskLabel` y `RISK_COLORS` (etiqueta "Crítico").

**A-02 · No existe forma de eliminar un estudiante desde la interfaz.**
- Dónde: `frontend/src/hooks/useStudentMutations.js:23-29` (hook `useDeleteStudent` sin ningún consumidor — confirmado por búsqueda); `backend/src/routes/students.routes.js:37` (`DELETE` exige admin).
- Qué pasa: la capacidad existe en backend y hasta hay hook, pero ni `Students.jsx` ni `StudentDetail.jsx` ofrecen botón. La acción es inalcanzable.
- Qué falta: botón "Eliminar" **solo admin** (usar `user.role === 'admin'`), con confirmación explícita advirtiendo que el borrado es **físico y en cascada** (historial, predicciones y alertas). Reutilizar el patrón de `Institutions.jsx:73-79`.

### 🟡 Media — control faltante (con alternativa) o error confuso

**M-01 · Students sin filtro por estatus.** `pages/Students.jsx:18` solo pasa `{ search, page, limit }`. El backend soporta `?status=` (`students.controller.js:107`). Falta un selector (activo / baja_temporal / baja_definitiva / egresado) que alimente el parámetro.

**M-02 · Alerts sin filtros por estatus ni severidad.** `pages/Alerts.jsx:17-20` pide `/alerts` sin parámetros. El backend soporta `?status=` y `?severity=` (`alerts.controller.js:32-33`). Faltan ambos controles.

**M-03 · Alerts no permite "descartada" (ni reabrir).** `pages/Alerts.jsx:67-82` solo ofrece pendiente→en_atencion y en_atencion→resuelta. El backend acepta `descartada` (`alerts.controller.js:5`; `schema.sql:112`). Falta el botón "Descartar" y, opcionalmente, reabrir.

**M-04 · StudentDetail no grafica la evolución del score.** Hay una tabla de historial de predicciones (`:157-190`) pero no una gráfica de score en el tiempo. El endpoint `GET /api/students/:id/trend` (`students.controller.js:218-248`) devuelve justamente `risk_percent` por fecha y **no se usa**. Falta conectar ese endpoint a un `LineChart` (ya se importa recharts en el archivo).

**M-05 · Dashboard sin gráfica de tendencia.** `pages/Dashboard.jsx` solo tiene el pie de distribución y la lista de recientes. Falta la "gráfica de tendencia" pedida. Nota: `GET /api/dashboard/summary` (`dashboard.controller.js`) **no** devuelve serie temporal, así que este hueco requiere también apoyo del backend (o derivarla de `recent_predictions`).

**M-06 · El historial académico solo se ve como promedio.** `StudentDetail.jsx:93-108` grafica `promedio` por periodo, pero asistencia, materias reprobadas, entregas pendientes y créditos —que sí se capturan (`RecordFormModal.jsx`) y viajan en el embed— nunca se muestran de vuelta. Falta una tabla del historial completo.

**M-07 · El ruteo no refuerza el rol (defensa en profundidad + UX).** `ProtectedRoute.jsx:4-7` solo valida sesión; `App.jsx:26-38` no distingue rol. Un docente que escribe `/usuarios`, `/escuelas`, `/modelo` o `/auditoria` llega a la pantalla; las consultas dan 403 y, como el interceptor solo trata 401 (`api.js:36`), quedan tablas vacías con botones visibles y sin aviso. Falta un guard por rol que redirija o muestre "no autorizado".

**M-08 · Controles visibles para roles que siempre reciben 403.** En `Students.jsx` el enlace "Nuevo" (`:114-119`) y los botones de exportación (`:99-112`) están fuera de `canManage`; en `StudentDetail.jsx:54-59` el botón "Editar" no tiene gateo; en `Careers.jsx:76-81,106-117` los botones crear/editar/eliminar no comprueban rol. Un docente los ve y al usarlos recibe 403 (o el aviso "No fue posible exportar"). Falta gatear con `canManage` como ya se hace con "Generar lote"/"Importar CSV".

**M-09 · Predicción por lote no traduce el 503 del ML.** `predictions.controller.js:85-110` no mapea el error 503 (a diferencia de la individual, `:78-81`); el usuario ve "Error interno del servidor" en `Students.jsx:51`. Falta el mismo `if (e.status === 503)` en `generateBatch`.

**M-10 · Falta el estado de error en casi todas las consultas.** Students, Alerts, HighRisk, Users, Institutions, Careers, ModelInfo y AuditLogs desestructuran `{ data, isLoading }` sin usar `error` (ver §5). Ante 403/500/503 la pantalla queda vacía en silencio. Falta un bloque de error como el del Dashboard (`:13`).

**M-11 · La importación de CSV no muestra el detalle de filas inválidas.** `Students.jsx:37-42` solo informa el conteo de errores; el backend devuelve la lista `{row, error}` (`students.controller.js:288`). Falta mostrarla (p. ej. en el modal ya existente).

> Nota de backend relacionada (afecta a la UI): `POST /api/records` (`records.controller.js:66-84`) hace `if (error) throw error` sin mapear códigos de Postgres. Un **periodo duplicado** (viola `UNIQUE (alumno_id, periodo)`, `schema.sql:83`) o **créditos obtenidos > totales** (viola el `CHECK` de `schema.sql:82`) llegan como **500 "Error interno del servidor"** en vez de un 4xx entendible. El `RecordFormModal` tampoco valida créditos en cliente. Lo detallo en §8.

### 🟢 Baja — cosmético o de menor impacto

**B-01 · KPI "Predicciones recientes" engañoso.** `Dashboard.jsx:31` muestra `recent_predictions.length`, que el backend limita a 10 (`dashboard.controller.js:35`). Nunca supera 10 aunque haya cientos. Mejor mostrar un total real o renombrar.

**B-02 · HighRisk: título y orden.** El encabezado dice "riesgo alto" pero incluye `critico` (`predictions.controller.js:7,121`); y el orden es por fecha, no por score (`:122`). Ajustar título ("alto o crítico") y, si se desea, ordenar por `puntaje_riesgo`.

**B-03 · AuditLogs con filtros incompletos.** Solo filtra por acción (`AuditLogs.jsx:38-51`); el backend también soporta `usuario`, `fecha_inicio` y `fecha_fin` (`audit.controller.js:29-32`). Faltan esos controles.

**B-04 · Users no permite editar el nombre.** El backend acepta `full_name` en `PATCH /users/:id` (`users.controller.js:75`), pero la UI solo cambia rol, estado y contraseña. Falta la edición del nombre.

**B-05 · Alerts sin estado de error** (subconjunto de M-10, aislado por ser la pantalla operativa de intervención).

**B-06 · Periodos de captura hardcodeados a 2026.** `RecordFormModal.jsx:6` fija `['2026-1','2026-2','2026-3']`. Quedará obsoleto en 2027. Derivarlos de la fecha o hacerlos configurables.

**B-07 · StudentDetail muestra "Estudiante no encontrado" ante cualquier fallo de carga.** `StudentDetail.jsx:26` no distingue 404 de 500/timeout. Aceptable, pero puede confundir.

**B-08 · Users sin fila de estado vacío** (siempre hay al menos el admin, por eso es baja).

**B-09 · Google login inactivo por configuración.** `Login.jsx:185-195` muestra un botón que avisa "aún no está configurado" cuando falta `VITE_GOOGLE_CLIENT_ID`. Es correcto por diseño; se anota solo para dejar constancia de que **la UI ya está lista** y solo faltan las variables (`GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`).

---

## 8. Formularios: validación cliente vs backend vs base

| Regla | Base (`schema.sql`) | Backend | Cliente | Estado |
|---|---|---|---|---|
| `promedio` 0–10 | `:70` CHECK | `toOptionalNumber` | `min=0 max=10` (`RecordFormModal.jsx:68-77`) | ✅ |
| `tasa_asistencia` 0–100 | `:71` CHECK | idem | `min=0 max=100` (`:79-88`) | ✅ |
| `materias_reprobadas` ≥ 0 | `:72` CHECK | idem | `min=0` (`:90-98`) | ✅ |
| `entregas_pendientes` ≥ 0 | `:73` CHECK | idem | `min=0` (`:100-108`) | ✅ |
| `semestre_actual` 1–12 | `:57` CHECK | — | `min=1 max=12` (`StudentForm.jsx:144-153`) | ✅ |
| `creditos_obtenidos ≤ creditos_totales` | `:82` CHECK | **no valida** | **no valida** | ❌ El insert viola el CHECK → `records.controller.js:78` hace `throw error` sin `status` → **500 genérico**. El modal muestra "Error interno del servidor". Falta validación en cliente y mapeo a 4xx en backend. |
| `periodo` único por alumno | `:83` UNIQUE | **no mapea 23505** | selector limitado a 3 periodos | ❌ Registrar dos veces el mismo periodo → violación UNIQUE → **500 genérico** (no revienta la SPA, pero el mensaje es confuso). Falta mapear a 409 con mensaje claro. |
| Contraseña ≥ 8 (registro) | — | `auth.controller.js:132` | `Register.jsx:21` + `minLength=8` | ✅ (además valida coincidencia) |
| Contraseña ≥ 8 (crear/editar usuario) | — | `users.controller.js:37,85` | `minLength=8` (`Users.jsx:180,224`) | ✅ |
| Campos obligatorios de estudiante | `nombre_completo` NOT NULL | `422` con `campos_faltantes` (`students.controller.js:169-174`) | `required` en nombre, fecha nac., fecha inscr., programa, semestre | ✅ (mensajes legibles vía `err.response.data.error`) |
| Correo con formato | — | regex (`auth.controller.js:129`) | `type="email"` | ✅ |

**Resumen de formularios:** los rangos numéricos están bien cubiertos en cliente y base. Los dos huecos reales son **créditos (obtenidos ≤ totales)** y **periodo único**: ninguno se valida en cliente y el backend los deja escalar a **500** en vez de un 4xx entendible. No revientan la aplicación (el `try/catch` del modal los atrapa), pero el usuario ve "Error interno del servidor".

---

## 9. Lo que está bien (explícito)

- **Contrato API impecable.** Cero llamadas a rutas inexistentes, cero verbos equivocados y cero desajustes de forma: cada `data.data` / `data.total` / `data.page` del frontend coincide con lo que devuelve su controlador (revisado endpoint por endpoint en §2).
- **Aislamiento por institución** aplicado en todos los controladores vía `requireInstitution` — la multitenancy es coherente.
- **Manejo de sesión y refresh** correcto: el interceptor (`api.js`) renueva el token una sola vez, comparte la promesa entre llamadas concurrentes, y ante fallo limpia y redirige a login **sin bucles ni pantalla en blanco**.
- **Predicción sin registro (400)** y **ML caído (503) en predicción individual**: ambos se surten con mensaje entendible al usuario.
- **El score se presenta como porcentaje de forma consistente** en las cinco vistas donde aparece.
- **Colores `bajo/medio/alto` consistentes** entre `utils.js` y el Dashboard (mismos hex).
- **Permisos "no puedes tocarte a ti mismo"** (rol propio y desactivación propia) bien reflejados en Users, con el `Select` deshabilitado y el botón oculto.
- **Borrado de usuarios**: el backend no lo expone y la UI tampoco lo ofrece — coinciden, como debe ser.
- **Institutions**: CRUD completo con confirmación de borrado y botón deshabilitado cuando hay alumnos asociados; refleja fielmente la regla del backend (`institutions.controller.js:130`).
- **Onboarding** correctamente cableado al flujo de alta (login/registro → onboarding si no hay institución → dashboard).
- **Sin pantallas ni componentes huérfanos**; el único código muerto es el hook `useDeleteStudent` (que en realidad *debería* usarse — ver A-02).
- **Predicción por lote y exportación** están gateadas a admin/coordinador con `canManage` (el gateo existe y funciona; solo falta extenderlo a "Nuevo"/"Editar"/export — M-08).
- **Estados vacíos bien cuidados** en la mayoría de listados (Students, Alerts, HighRisk, Institutions, Careers, AuditLogs, y el Dashboard con su mensaje de "aún no hay predicciones").

---

## Apéndice — cosas que no pude determinar solo leyendo el código

- **Forma real de `service.metrics` / `/model-info` y `/retrain` del microservicio ML.** `ModelInfo.jsx` asume `auc_roc`, `accuracy`, `f1`, `recall`, `n_train`, `n_test` y `retrain` → `{ metrics: { auc_roc } }`. Si el FastAPI devuelve otras claves, esas filas se verían como `undefined`. Habría que contrastar con `ml-service/app/main.py`.
- **Comportamiento exacto de Supabase ante violaciones de CHECK/UNIQUE** (código y estructura del error) — asumo `23505`/`23514` estándar de Postgres; conviene confirmarlo en un entorno real para el mapeo propuesto en §8.
- **Si "programas reales" (de `alumnos`) vs "carreras" (catálogo) deben coexistir** es una decisión de producto, no deducible del código; por eso en §2.1 dejo `/students/programs` como "retirar **o** repuntar" en vez de afirmar una sola opción.
