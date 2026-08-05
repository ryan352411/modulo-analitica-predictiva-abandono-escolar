# Despliegue en Render

Este proyecto incluye un blueprint (`render.yaml`) que crea 3 servicios en Render:

| Servicio      | Tipo         | Qué es                          | URL (predicha)                     |
|---------------|--------------|---------------------------------|------------------------------------|
| `abandono-ml` | Web (Docker) | Microservicio ML (FastAPI)      | https://abandono-ml.onrender.com   |
| `abandono-api`| Web (Docker) | API backend (Express)           | https://abandono-api.onrender.com  |
| `abandono-web`| Static Site  | Frontend (Vite/React)           | https://abandono-web.onrender.com  |

## Pasos

1. En https://dashboard.render.com → **New** → **Blueprint**.
2. Conecta el repo `ryan352411/modulo-analitica-predictiva-abandono-escolar`.
3. Render leerá `render.yaml`. Te pedirá los valores marcados como secretos:
   - **SUPABASE_SERVICE_KEY** → pega la *service key* de Supabase (la del `.env` local, empieza con `sb_secret_...`). **Nunca la subas al repo.**
4. **Apply** y espera a que los 3 servicios queden en verde (el primer build del ML tarda porque entrena el modelo).

## Después del primer deploy — verifica las URLs

Las URLs `onrender.com` del `render.yaml` son **predichas**. Si Render les puso un sufijo
(porque el nombre ya estaba tomado), corrige estas variables con las URLs reales y
vuelve a desplegar el servicio afectado:

- `abandono-api` → **FRONTEND_URL** = URL real de `abandono-web`
- `abandono-api` → **ML_SERVICE_URL** = URL real de `abandono-ml`
- `abandono-web` → **VITE_API_URL** = URL real de `abandono-api` + `/api`
  (el frontend hornea esta variable en el build → tras cambiarla, **Clear cache & deploy**).

## Notas

- La base de datos sigue siendo **Supabase** (no se despliega en Render).
- El plan **free** duerme los servicios web tras inactividad; la primera petición tras
  dormir tarda ~30–50 s en despertar.
- **Login con Google:** para que funcione en la nueva URL, agrega
  `https://abandono-web.onrender.com` a los *Authorized JavaScript origins* del cliente
  OAuth en Google Cloud Console. El registro con correo/contraseña no lo requiere.
