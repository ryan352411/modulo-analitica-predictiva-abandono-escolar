import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import jwt from "npm:jsonwebtoken@9.0.2";

type User = {
  id: string;
  email: string;
  full_name?: string;
  role: "admin" | "coordinador" | "docente";
  institution_id: string;
  is_active?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys);
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("JWT_SECRET") ||
    "";
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const secretKey = getSecretKey();
// Secreto dedicado para firmar/verificar JWT. Configúralo en los secrets de la
// Edge Function (idealmente igual al JWT_SECRET del backend Express). Si no está
// definido, cae a la llave de servicio para no romper sesiones existentes; en
// ese caso conviene configurar JWT_SECRET cuanto antes por seguridad.
const jwtSecret = Deno.env.get("JWT_SECRET") || secretKey;
if (!Deno.env.get("JWT_SECRET")) {
  console.warn("[auth] JWT_SECRET no configurado; usando la llave de servicio como fallback. Configura JWT_SECRET en los secrets de la función.");
}
const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});

const STUDENT_FIELDS = [
  "matricula",
  "nombre_completo",
  "correo",
  "fecha_nacimiento",
  "genero",
  "nivel_socioeconomico",
  "fecha_inscripcion",
  "semestre_actual",
  "programa",
  "estatus",
];

const RECORD_FIELDS = [
  "alumno_id",
  "periodo",
  "promedio",
  "tasa_asistencia",
  "materias_reprobadas",
  "creditos_obtenidos",
  "creditos_totales",
  "observaciones",
];

const NIVELES = ["bajo", "medio_bajo", "medio", "medio_alto", "alto"];
const NIVEL_LABEL: Record<string, string> = {
  bajo: "Bajo",
  medio_bajo: "Medio bajo",
  medio: "Medio",
  medio_alto: "Medio alto",
  alto: "Alto",
};
const SOCIO_SCHEMA = {
  type: "object",
  properties: {
    nivel: { type: "string", enum: NIVELES },
    justificacion: { type: "string" },
    puntaje: { type: "integer" },
  },
  required: ["nivel", "justificacion"],
};

function pick(input: Record<string, unknown>, fields: string[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (input[field] !== undefined) payload[field] = input[field];
  }
  return payload;
}

function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function sanitizeSearch(value = "") {
  return String(value).trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ");
}

async function readBody(req: Request) {
  if (!req.body) return {};
  return await req.json().catch(() => ({}));
}

async function authUser(req: Request): Promise<User | Response> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "Token requerido" }, 401);

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email:correo, full_name:nombre_completo, role:rol, institution_id:institucion_id, is_active:activo")
      .eq("id", decoded.id)
      .single();

    if (error || !data?.is_active) {
      return json({ error: "Token invalido o usuario inactivo" }, 401);
    }
    return data as User;
  } catch {
    return json({ error: "Token invalido o expirado" }, 401);
  }
}

function requireRole(user: User, roles: User["role"][]) {
  if (!roles.includes(user.role)) {
    return json({ error: "Permisos insuficientes" }, 403);
  }
  return null;
}

function buildStudentPayload(body: Record<string, unknown>, institutionId: string) {
  const payload = pick(body, STUDENT_FIELDS);
  if (payload.semestre_actual !== undefined) {
    payload.semestre_actual = numberOrNull(payload.semestre_actual);
    payload.semestre = payload.semestre_actual;
  }
  if (payload.matricula !== undefined) payload.codigo_alumno = payload.matricula;
  return { ...payload, institucion_id: institutionId };
}

function buildRecordPayload(body: Record<string, unknown>) {
  const payload = pick(body, RECORD_FIELDS);
  for (const key of ["promedio", "tasa_asistencia", "materias_reprobadas", "creditos_obtenidos", "creditos_totales"]) {
    if (payload[key] !== undefined) payload[key] = numberOrNull(payload[key]);
  }
  return payload;
}

async function getScopedStudent(studentId: string, institutionId: string) {
  return await supabase
    .from("alumnos")
    .select("*")
    .eq("id", studentId)
    .eq("institucion_id", institutionId)
    .single();
}

function riskLevel(score: number) {
  if (score >= 0.7) return "alto";
  if (score >= 0.4) return "medio";
  return "bajo";
}

function predictDropoutRisk(input: Record<string, unknown>) {
  const gpa = Number(input.promedio ?? 8);
  const attendance = Number(input.tasa_asistencia ?? 90);
  const failed = Number(input.materias_reprobadas ?? 0);
  const creditsTotal = Number(input.creditos_totales ?? 0);
  const creditsEarned = Number(input.creditos_obtenidos ?? 0);
  const creditRatio = creditsTotal > 0 ? creditsEarned / creditsTotal : 1;
  const socioPenalty = ({
    bajo: 0.10,
    medio_bajo: 0.06,
    medio: 0.03,
    medio_alto: 0.01,
    alto: 0,
  } as Record<string, number>)[String(input.nivel_socioeconomico ?? "medio")] ?? 0.03;

  const contributions: Record<string, number> = {
    promedio_general: (10 - gpa) * 0.05,
    tasa_asistencia: ((100 - attendance) / 100) * 0.3,
    materias_reprobadas: Math.min(failed, 5) * 0.05,
    avance_creditos: (1 - creditRatio) * 0.1,
    nivel_socioeconomico: socioPenalty,
  };
  const labels: Record<string, string> = {
    promedio_general: "Promedio general bajo",
    tasa_asistencia: "Asistencia irregular",
    materias_reprobadas: "Materias reprobadas",
    avance_creditos: "Avance de créditos lento",
    nivel_socioeconomico: "Nivel socioeconómico",
  };

  let score = Object.values(contributions).reduce((a, b) => a + b, 0);
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  const total = Object.values(contributions).reduce((a, b) => a + Math.max(b, 0), 0);
  const contributing_features = Object.entries(contributions)
    .map(([feature, value]) => ({ feature, value: Math.max(value, 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(({ feature, value }) => ({
      feature,
      label: labels[feature],
      importance: Number((total > 0 ? value / total : 0).toFixed(2)),
    }));

  return {
    puntaje_riesgo: score,
    nivel_riesgo: riskLevel(score),
    version_modelo: "edge-stub-v1",
    factores_contribuyentes: contributing_features,
    factores_principales: contributing_features,
  };
}

async function audit(user: User | null, req: Request, action: string, entity: string, entityId: string | null, detail: unknown = null) {
  await supabase.from("registros_auditoria").insert({
    usuario_id: user?.id ?? null,
    accion: action,
    entidad: entity,
    tipo_entidad: entity,
    entidad_id: entityId,
    detalle: detail,
    metadatos: detail,
    direccion_ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
  });
}

// ---- Tokens (access + refresh) -------------------------------------------
const REFRESH_EXPIRES_IN = Deno.env.get("JWT_REFRESH_EXPIRES_IN") || "7d";
const revokedRefreshTokens = new Set<string>();

function signAccess(u: { id: string; email: string; role: string; institution_id: string }) {
  return jwt.sign(
    { id: u.id, email: u.email, role: u.role, institution_id: u.institution_id },
    jwtSecret,
    { expiresIn: "8h" },
  );
}
function signRefresh(u: { id: string }) {
  return jwt.sign({ id: u.id, type: "refresh", jti: crypto.randomUUID() }, jwtSecret, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

// ---- Notificaciones (SendGrid / Twilio vía HTTP) -------------------------
function emailEnabled() {
  return Boolean(Deno.env.get("SENDGRID_API_KEY") && Deno.env.get("SENDGRID_FROM_EMAIL"));
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!emailEnabled()) {
    console.info(`[notificaciones:email:fallback] Para: ${to} | ${subject} — ${text}`);
    return;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: Deno.env.get("SENDGRID_FROM_EMAIL") },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`SendGrid respondió ${res.status}`);
  } catch (e) {
    console.warn(`[notificaciones:email] fallo enviando a ${to}: ${(e as Error).message}`);
  }
}

async function notifyHighRisk(student: Record<string, unknown>, prediction: Record<string, unknown>) {
  try {
    const { data: recipients } = await supabase
      .from("usuarios")
      .select("correo, rol")
      .eq("institucion_id", student.institucion_id)
      .eq("activo", true)
      .in("rol", ["admin", "coordinador"]);
    if (!recipients?.length) return;

    const pct = (Number(prediction.puntaje_riesgo) * 100).toFixed(1);
    const subject = `Riesgo alto de abandono: ${student.nombre_completo}`;
    const text =
      `El estudiante ${student.nombre_completo} (${student.matricula ?? "s/matrícula"}) ` +
      `alcanzó un riesgo de ${pct}% (nivel ${prediction.nivel_riesgo}). ` +
      `Se recomienda intervención del tutor.`;
    await Promise.all(
      recipients.filter((r: { correo?: string }) => r.correo).map((r: { correo: string }) => sendEmail(r.correo, subject, text)),
    );
  } catch (e) {
    console.error("[notificaciones:notifyHighRisk]", (e as Error).message);
  }
}

// ---- CSV ------------------------------------------------------------------
function csvToObjects(text: string): Record<string, string>[] {
  const src = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") pushField();
    else if (c === "\n") { pushField(); pushRow(); }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  const clean = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (!clean.length) return [];
  const headers = clean[0].map((h) => h.trim());
  return clean.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? "").trim(); });
    return obj;
  });
}

function objectsToCsv(items: Record<string, unknown>[], columns: string[]): string {
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(escape).join(",");
  const lines = items.map((item) => columns.map((col) => escape(item[col])).join(","));
  return [header, ...lines].join("\n");
}

// ---- Predicción reutilizable ---------------------------------------------
async function runPrediction(student: Record<string, unknown>, userId: string) {
  const { data: records } = await supabase
    .from("historial_academico")
    .select("*")
    .eq("alumno_id", student.id)
    .order("periodo", { ascending: false })
    .limit(1);
  if (!records?.length) return { prediction: null as Record<string, unknown> | null };

  const result = predictDropoutRisk({ ...records[0], nivel_socioeconomico: student.nivel_socioeconomico });
  const { data: prediction, error } = await supabase
    .from("predicciones")
    .insert({ alumno_id: student.id, generado_por: userId, ...result })
    .select()
    .single();
  if (error) throw error;

  if (result.nivel_riesgo === "alto") {
    await supabase.from("alertas").insert({
      alumno_id: student.id,
      prediccion_id: prediction.id,
      severidad: result.puntaje_riesgo >= 0.85 ? "critica" : "alta",
      tipo_alerta: "academic",
      titulo: `Riesgo alto de abandono: ${student.nombre_completo}`,
      mensaje: `El modelo estimo un riesgo de ${(result.puntaje_riesgo * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
      estatus: "pendiente",
    });
    await notifyHighRisk(student, prediction);
  }
  return { prediction };
}

async function mlFetch(path: string, options: RequestInit = {}, timeout = 8000) {
  const url = Deno.env.get("ML_SERVICE_URL");
  if (!url) return null;
  const res = await fetch(`${url}${path}`, { ...options, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`ML service respondió ${res.status}`);
  return res.json();
}

// ---- Gemini (Google Generative Language API) ------------------------------
function geminiEnabled() {
  return Boolean(Deno.env.get("GEMINI_API_KEY"));
}

async function geminiGenerate(
  prompt: string,
  opts: { temperature?: number; responseSchema?: unknown; timeout?: number } = {},
): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
  const generationConfig: Record<string, unknown> = { temperature: opts.temperature ?? 0.4 };
  if (opts.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = opts.responseSchema;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(opts.timeout ?? 20000),
    },
  );
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch { /* ignore */ }
    throw new Error(`Gemini respondió ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini devolvió una respuesta vacía");
  return text.trim();
}

// ---- OpenAPI (para el apartado "API REST" del frontend) -------------------
const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "API — Módulo de Analítica Predictiva de Abandono Escolar",
    version: "1.0.0",
    description:
      "API REST del sistema de predicción de abandono escolar (Edge Function de Supabase). " +
      "Incluye asistente de IA (Gemini) para estimar nivel socioeconómico y sugerir intervenciones.",
  },
  servers: [{ url: "/functions/v1/api" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": { post: { tags: ["Auth"], summary: "Iniciar sesión", security: [] } },
    "/auth/refresh": { post: { tags: ["Auth"], summary: "Renovar token de acceso", security: [] } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Usuario autenticado" } },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Cerrar sesión" } },
    "/dashboard/summary": { get: { tags: ["Dashboard"], summary: "Resumen del tablero" } },
    "/students": {
      get: { tags: ["Students"], summary: "Listar estudiantes (paginado y filtros)" },
      post: { tags: ["Students"], summary: "Crear estudiante" },
    },
    "/students/import": { post: { tags: ["Students"], summary: "Importar estudiantes desde CSV" } },
    "/students/{id}": {
      get: { tags: ["Students"], summary: "Detalle de estudiante" },
      put: { tags: ["Students"], summary: "Actualizar estudiante" },
      delete: { tags: ["Students"], summary: "Eliminar estudiante" },
    },
    "/students/{id}/trend": { get: { tags: ["Students"], summary: "Evolución de riesgo" } },
    "/records": { post: { tags: ["Records"], summary: "Capturar registro académico" } },
    "/records/student/{id}": { get: { tags: ["Records"], summary: "Historial académico del estudiante" } },
    "/predictions/student/{id}": {
      get: { tags: ["Predictions"], summary: "Predicciones del estudiante" },
      post: { tags: ["Predictions"], summary: "Generar predicción" },
    },
    "/predictions/batch": { post: { tags: ["Predictions"], summary: "Predicción por lotes" } },
    "/predictions/high-risk": { get: { tags: ["Predictions"], summary: "Estudiantes de riesgo alto" } },
    "/alerts": { get: { tags: ["Alerts"], summary: "Listar alertas" } },
    "/alerts/{id}": { patch: { tags: ["Alerts"], summary: "Actualizar estatus de alerta" } },
    "/users": {
      get: { tags: ["Users"], summary: "Listar usuarios" },
      post: { tags: ["Users"], summary: "Crear usuario" },
    },
    "/users/{id}": { patch: { tags: ["Users"], summary: "Actualizar usuario" } },
    "/audit-logs": { get: { tags: ["Audit"], summary: "Bitácora de auditoría" } },
    "/reports/export": { get: { tags: ["Reports"], summary: "Exportar reporte CSV" } },
    "/model/info": { get: { tags: ["Model"], summary: "Información del modelo" } },
    "/model/retrain": { post: { tags: ["Model"], summary: "Reentrenar modelo" } },
    "/ai/socioeconomic": {
      post: {
        tags: ["IA"],
        summary: "Estimar nivel socioeconómico con IA (Gemini) a partir de un cuestionario",
      },
    },
    "/ai/intervention": {
      post: {
        tags: ["IA"],
        summary: "Recomendar intervención para un estudiante en riesgo con IA (Gemini)",
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!secretKey || !supabaseUrl) return json({ error: "Servidor sin configuracion Supabase" }, 500);
  if (!jwtSecret) return json({ error: "Servidor sin JWT_SECRET configurado" }, 500);

  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/functions\/v1\/api/, "")
    .replace(/^\/api/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && path === "/health") {
      return json({ status: "ok", service: "abandono-escolar-edge-api" });
    }

    if (req.method === "GET" && (path === "/docs.json" || path === "/docs")) {
      return json(OPENAPI_SPEC);
    }

    if (req.method === "POST" && path === "/auth/login") {
      const body = await readBody(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) return json({ error: "Correo y contrasena son requeridos" }, 400);

      const { data: user, error } = await supabase
        .from("usuarios")
        .select("id, email:correo, password_hash:contrasena_hash, full_name:nombre_completo, role:rol, institution_id:institucion_id")
        .eq("correo", email)
        .eq("activo", true)
        .single();

      if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
        return json({ error: "Credenciales invalidas" }, 401);
      }

      const token = signAccess(user);
      const refresh_token = signRefresh(user);
      await supabase.from("usuarios").update({ ultimo_acceso: new Date().toISOString() }).eq("id", user.id);
      await audit({ id: user.id } as User, req, "LOGIN", "usuarios", user.id);
      return json({
        token,
        refresh_token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          institution_id: user.institution_id,
        },
      });
    }

    if (req.method === "POST" && path === "/auth/refresh") {
      const body = await readBody(req);
      const refresh_token = String(body.refresh_token ?? "");
      if (!refresh_token) return json({ error: "refresh_token requerido" }, 400);
      if (revokedRefreshTokens.has(refresh_token)) return json({ error: "Refresh token revocado" }, 401);
      let decoded: { id?: string; type?: string };
      try {
        decoded = jwt.verify(refresh_token, jwtSecret) as { id?: string; type?: string };
      } catch {
        return json({ error: "Refresh token invalido o expirado" }, 401);
      }
      if (decoded.type !== "refresh") return json({ error: "Token no es de tipo refresh" }, 401);
      const { data: u, error } = await supabase
        .from("usuarios")
        .select("id, email:correo, role:rol, institution_id:institucion_id, is_active:activo")
        .eq("id", decoded.id)
        .single();
      if (error || !u?.is_active) return json({ error: "Usuario invalido o inactivo" }, 401);
      return json({ token: signAccess(u) });
    }

    const auth = await authUser(req);
    if (auth instanceof Response) return auth;
    const user = auth;

    if (req.method === "GET" && path === "/auth/me") {
      return json({ user });
    }

    if (req.method === "POST" && path === "/auth/logout") {
      const body = await readBody(req);
      if (body.refresh_token) revokedRefreshTokens.add(String(body.refresh_token));
      await audit(user, req, "LOGOUT", "usuarios", user.id);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET" && path === "/dashboard/summary") {
      const [{ count: totalStudents }, { count: activeAlerts }, { data: predictions }] = await Promise.all([
        supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("estatus", "activo").eq("institucion_id", user.institution_id),
        supabase.from("alertas").select("id, alumnos!inner(institucion_id)", { count: "exact", head: true }).eq("estatus", "pendiente").eq("alumnos.institucion_id", user.institution_id),
        supabase.from("predicciones").select("nivel_riesgo, puntaje_riesgo, predicho_en, alumnos!inner(institucion_id)").eq("alumnos.institucion_id", user.institution_id).order("predicho_en", { ascending: false }).limit(500),
      ]);
      const distribution = { bajo: 0, medio: 0, alto: 0 };
      for (const p of predictions ?? []) distribution[p.nivel_riesgo as "bajo" | "medio" | "alto"]++;
      return json({
        data: {
          total_students: totalStudents ?? 0,
          active_alerts: activeAlerts ?? 0,
          risk_distribution: distribution,
          recent_predictions: (predictions ?? []).slice(0, 10).map(({ alumnos: _alumnos, ...p }) => p),
        },
      });
    }

    if (parts[0] === "students") {
      if (req.method === "GET" && parts.length === 1) {
        const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
        const from = (page - 1) * limit;
        let query = supabase.from("alumnos").select("*", { count: "exact" }).eq("institucion_id", user.institution_id);
        const status = url.searchParams.get("status");
        const search = sanitizeSearch(url.searchParams.get("search") ?? "");
        if (status) query = query.eq("estatus", status);
        if (search) query = query.or(`nombre_completo.ilike.%${search}%,matricula.ilike.%${search}%`);
        const { data, count, error } = await query.order("nombre_completo").range(from, from + limit - 1);
        if (error) throw error;
        return json({ data, total: count, page, limit });
      }

      if (req.method === "POST" && parts.length === 1) {
        const denied = requireRole(user, ["admin", "coordinador"]);
        if (denied) return denied;
        const body = await readBody(req);
        const { data, error } = await supabase.from("alumnos").insert(buildStudentPayload(body, user.institution_id)).select().single();
        if (error) throw error;
        await audit(user, req, "CREATE", "alumnos", data.id, body);
        return json({ data }, 201);
      }

      if (req.method === "POST" && parts[1] === "import") {
        const denied = requireRole(user, ["admin", "coordinador"]);
        if (denied) return denied;
        const csv = await req.text();
        if (!csv.trim()) return json({ error: "Envia el CSV como cuerpo con Content-Type text/csv" }, 400);
        const rows = csvToObjects(csv);
        if (!rows.length) return json({ error: "El CSV no contiene filas de datos" }, 400);
        if (rows.length > 1000) return json({ error: "Maximo 1000 estudiantes por importacion" }, 400);

        const payloads: Record<string, unknown>[] = [];
        const errors: { row?: number; matricula?: string; error: string }[] = [];
        rows.forEach((raw, idx) => {
          const payload = buildStudentPayload(raw, user.institution_id);
          if (!payload.matricula || !payload.nombre_completo) {
            errors.push({ row: idx + 2, error: "matricula y nombre_completo son obligatorios" });
            return;
          }
          payloads.push(payload);
        });
        if (!payloads.length) return json({ error: "Ninguna fila valida", errors }, 400);

        // Rechaza matriculas que ya pertenecen a OTRA institucion: el upsert por
        // onConflict: 'matricula' sobrescribiria ese registro ajeno (matricula es
        // unica global). Solo se importan las que no colisionan con otra escuela.
        const matriculas = payloads.map((p) => p.matricula);
        const { data: existentes, error: existErr } = await supabase
          .from("alumnos")
          .select("matricula, institucion_id")
          .in("matricula", matriculas);
        if (existErr) throw existErr;
        const ajenas = new Set(
          (existentes ?? [])
            .filter((e: { institucion_id?: string }) => e.institucion_id !== user.institution_id)
            .map((e: { matricula?: string }) => e.matricula),
        );
        const safePayloads = payloads.filter((p) => {
          if (ajenas.has(p.matricula)) {
            errors.push({ matricula: String(p.matricula), error: "La matricula pertenece a otra institucion" });
            return false;
          }
          return true;
        });
        if (!safePayloads.length) return json({ error: "Ninguna fila valida", errors }, 409);

        const { data, error } = await supabase
          .from("alumnos")
          .upsert(safePayloads, { onConflict: "matricula" })
          .select("id, matricula, nombre_completo");
        if (error) throw error;
        await audit(user, req, "IMPORT", "alumnos", null, { imported: data.length, errors: errors.length });
        return json({ data: { imported: data.length, students: data, errors } }, 201);
      }

      if (req.method === "GET" && parts.length === 3 && parts[2] === "trend") {
        const { error: sErr } = await getScopedStudent(parts[1], user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase
          .from("predicciones")
          .select("puntaje_riesgo, nivel_riesgo, version_modelo, predicho_en")
          .eq("alumno_id", parts[1])
          .order("predicho_en", { ascending: true });
        if (error) throw error;
        return json({
          data: (data ?? []).map((p) => ({
            predicho_en: p.predicho_en,
            puntaje_riesgo: Number(p.puntaje_riesgo),
            risk_percent: Math.round(Number(p.puntaje_riesgo) * 100),
            nivel_riesgo: p.nivel_riesgo,
            version_modelo: p.version_modelo,
          })),
        });
      }

      const studentId = parts[1];
      if (req.method === "GET" && parts.length === 2) {
        const { data, error } = await supabase
          .from("alumnos")
          .select("*, historial_academico(*), predicciones(*), alertas(*)")
          .eq("id", studentId)
          .eq("institucion_id", user.institution_id)
          .single();
        if (error) return json({ error: "Estudiante no encontrado" }, 404);
        return json({ data });
      }

      if (req.method === "PUT" && parts.length === 2) {
        const denied = requireRole(user, ["admin", "coordinador"]);
        if (denied) return denied;
        const body = await readBody(req);
        const { data, error } = await supabase
          .from("alumnos")
          .update(buildStudentPayload(body, user.institution_id))
          .eq("id", studentId)
          .eq("institucion_id", user.institution_id)
          .select()
          .single();
        if (error) return json({ error: "Estudiante no encontrado" }, 404);
        await audit(user, req, "UPDATE", "alumnos", studentId, body);
        return json({ data });
      }

      if (req.method === "DELETE" && parts.length === 2) {
        const denied = requireRole(user, ["admin"]);
        if (denied) return denied;
        const { error } = await supabase.from("alumnos").delete().eq("id", studentId).eq("institucion_id", user.institution_id);
        if (error) throw error;
        await audit(user, req, "DELETE", "alumnos", studentId);
        return new Response(null, { status: 204, headers: corsHeaders });
      }
    }

    if (parts[0] === "records") {
      if (req.method === "GET" && parts[1] === "student" && parts[2]) {
        const { error: sErr } = await getScopedStudent(parts[2], user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase.from("historial_academico").select("*").eq("alumno_id", parts[2]).order("periodo", { ascending: false });
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const payload = buildRecordPayload(body);
        const { error: sErr } = await getScopedStudent(String(payload.alumno_id), user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase.from("historial_academico").insert(payload).select().single();
        if (error) throw error;
        await audit(user, req, "CREATE", "historial_academico", data.id, payload);
        return json({ data }, 201);
      }
    }

    if (parts[0] === "predictions" && parts[1] === "batch" && req.method === "POST") {
      const denied = requireRole(user, ["admin", "coordinador"]);
      if (denied) return denied;
      const { data: students, error } = await supabase
        .from("alumnos").select("*")
        .eq("institucion_id", user.institution_id).eq("estatus", "activo");
      if (error) throw error;
      const summary = { total: students.length, generated: 0, skipped: 0, high_risk: 0 };
      for (const student of students) {
        const { prediction } = await runPrediction(student, user.id);
        if (!prediction) summary.skipped++;
        else {
          summary.generated++;
          if (prediction.nivel_riesgo === "alto") summary.high_risk++;
        }
      }
      await audit(user, req, "PREDICT_BATCH", "predicciones", null, summary);
      return json({ data: summary }, 201);
    }

    if (parts[0] === "predictions" && parts[1] === "high-risk" && req.method === "GET") {
      const { data, error } = await supabase
        .from("predicciones")
        .select("*, alumnos!inner(id, nombre_completo, matricula, semestre_actual, programa, institucion_id)")
        .eq("alumnos.institucion_id", user.institution_id)
        .eq("nivel_riesgo", "alto")
        .order("predicho_en", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const latest: Record<string, unknown>[] = [];
      for (const p of data ?? []) {
        if (seen.has(p.alumno_id)) continue;
        seen.add(p.alumno_id);
        latest.push(p);
      }
      latest.sort((a, b) => Number(b.puntaje_riesgo) - Number(a.puntaje_riesgo));
      return json({ data: latest });
    }

    if (parts[0] === "predictions" && parts[1] === "student" && parts[2]) {
      const studentId = parts[2];
      const { data: student, error: sErr } = await getScopedStudent(studentId, user.institution_id);
      if (sErr) return json({ error: "Estudiante no encontrado" }, 404);

      if (req.method === "GET") {
        const { data, error } = await supabase.from("predicciones").select("*").eq("alumno_id", studentId).order("predicho_en", { ascending: false });
        if (error) throw error;
        return json({ data });
      }

      if (req.method === "POST") {
        const { prediction } = await runPrediction(student, user.id);
        if (!prediction) return json({ error: "El estudiante necesita al menos un registro academico para generar prediccion" }, 400);
        await audit(user, req, "PREDICT", "predicciones", String(prediction.id), { risk: prediction.nivel_riesgo });
        return json({ data: prediction }, 201);
      }
    }

    if (parts[0] === "alerts") {
      if (req.method === "GET" && parts.length === 1) {
        let query = supabase
          .from("alertas")
          .select("*, alumnos!inner(nombre_completo, matricula, institucion_id)")
          .eq("alumnos.institucion_id", user.institution_id)
          .order("creado_en", { ascending: false });
        const status = url.searchParams.get("status");
        const severity = url.searchParams.get("severity");
        if (status) query = query.eq("estatus", status);
        if (severity) query = query.eq("severidad", severity);
        const { data, error } = await query;
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "PATCH" && parts[1]) {
        const body = await readBody(req);
        const status = String(body.status ?? "");
        if (!["pendiente", "en_atencion", "resuelta", "descartada"].includes(status)) {
          return json({ error: "Estatus de alerta invalido" }, 400);
        }
        const scoped = await supabase.from("alertas").select("id, alumnos!inner(institucion_id)").eq("id", parts[1]).eq("alumnos.institucion_id", user.institution_id).single();
        if (scoped.error) return json({ error: "Alerta no encontrada" }, 404);
        const patch: Record<string, unknown> = { estatus: status, resuelto_en: status === "resuelta" ? new Date().toISOString() : null };
        if (status === "en_atencion") patch.asignado_a = user.id;
        const { data, error } = await supabase.from("alertas").update(patch).eq("id", parts[1]).select().single();
        if (error) throw error;
        await audit(user, req, "UPDATE", "alertas", parts[1], patch);
        return json({ data });
      }
    }

    if (parts[0] === "users") {
      const denied = requireRole(user, ["admin"]);
      if (denied) return denied;
      if (req.method === "GET" && parts.length === 1) {
        const { data, error } = await supabase.from("usuarios").select("id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo, last_login:ultimo_acceso, created_at:creado_en").eq("institucion_id", user.institution_id).order("nombre_completo");
        if (error) throw error;
        return json({ data: data ?? [] });
      }
      if (req.method === "POST" && parts.length === 1) {
        const body = await readBody(req);
        if (!body.full_name || !body.email || !body.password) return json({ error: "Nombre, correo y contrasena son requeridos" }, 400);
        if (!["admin", "coordinador", "docente"].includes(String(body.role ?? "docente"))) return json({ error: "Rol invalido" }, 400);
        if (String(body.password).length < 8) return json({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
        const password_hash = await bcrypt.hash(String(body.password), 12);
        const { data, error } = await supabase.from("usuarios").insert({
          nombre_completo: body.full_name,
          correo: String(body.email).trim().toLowerCase(),
          contrasena_hash: password_hash,
          rol: body.role ?? "docente",
          institucion_id: user.institution_id,
        }).select("id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo, created_at:creado_en").single();
        if (error) throw error;
        return json({ data }, 201);
      }
      if (req.method === "PATCH" && parts[1]) {
        const body = await readBody(req);
        const patch: Record<string, unknown> = {};
        if (body.full_name !== undefined) patch.nombre_completo = body.full_name;
        if (body.role !== undefined) {
          if (parts[1] === user.id) return json({ error: "No puedes cambiar tu propio rol" }, 400);
          patch.rol = body.role;
        }
        if (body.is_active !== undefined) patch.activo = Boolean(body.is_active);
        if (body.password) patch.contrasena_hash = await bcrypt.hash(String(body.password), 12);
        if (parts[1] === user.id && patch.activo === false) return json({ error: "No puedes desactivar tu propia cuenta" }, 400);
        const { data, error } = await supabase.from("usuarios").update(patch).eq("id", parts[1]).eq("institucion_id", user.institution_id).select("id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo").single();
        if (error) return json({ error: "Usuario no encontrado" }, 404);
        return json({ data });
      }
    }

    if (parts[0] === "audit-logs" && req.method === "GET") {
      const denied = requireRole(user, ["admin"]);
      if (denied) return denied;
      const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
      const from = (page - 1) * limit;

      const { data: members } = await supabase.from("usuarios").select("id").eq("institucion_id", user.institution_id);
      const memberIds = (members ?? []).map((m: { id: string }) => m.id);
      if (!memberIds.length) return json({ data: [], total: 0, page, limit });

      let query = supabase
        .from("registros_auditoria")
        .select("id, usuario_id, accion, entidad, entidad_id, detalle, direccion_ip, creado_en", { count: "exact" })
        .in("usuario_id", memberIds)
        .order("creado_en", { ascending: false });
      const usuario = url.searchParams.get("usuario");
      const accion = url.searchParams.get("accion");
      const fi = url.searchParams.get("fecha_inicio");
      const ff = url.searchParams.get("fecha_fin");
      if (usuario) query = query.eq("usuario_id", usuario);
      if (accion) query = query.eq("accion", accion);
      if (fi) query = query.gte("creado_en", fi);
      if (ff) query = query.lte("creado_en", ff);
      const { data, count, error } = await query.range(from, from + limit - 1);
      if (error) throw error;
      return json({ data, total: count, page, limit });
    }

    if (parts[0] === "reports" && parts[1] === "export" && req.method === "GET") {
      const denied = requireRole(user, ["admin", "coordinador"]);
      if (denied) return denied;
      const type = url.searchParams.get("type") ?? "students";
      const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
      if (format !== "csv") {
        return json({ error: "La Edge Function solo exporta CSV. Usa el backend Express para XLSX/PDF." }, 400);
      }

      let items: Record<string, unknown>[] = [];
      let columns: string[] = [];
      if (type === "students") {
        columns = ["matricula", "nombre_completo", "correo", "programa", "semestre_actual", "nivel_socioeconomico", "estatus"];
        const { data, error } = await supabase
          .from("alumnos").select(columns.join(", "))
          .eq("institucion_id", user.institution_id).order("nombre_completo");
        if (error) throw error;
        items = data ?? [];
      } else if (type === "predictions") {
        columns = ["matricula", "nombre_completo", "porcentaje_riesgo", "nivel_riesgo", "version_modelo", "predicho_en"];
        const { data, error } = await supabase
          .from("predicciones")
          .select("puntaje_riesgo, nivel_riesgo, version_modelo, predicho_en, alumnos!inner(matricula, nombre_completo, institucion_id)")
          .eq("alumnos.institucion_id", user.institution_id)
          .order("predicho_en", { ascending: false }).limit(5000);
        if (error) throw error;
        items = (data ?? []).map((p) => ({
          matricula: p.alumnos.matricula,
          nombre_completo: p.alumnos.nombre_completo,
          porcentaje_riesgo: Math.round(Number(p.puntaje_riesgo) * 100),
          nivel_riesgo: p.nivel_riesgo,
          version_modelo: p.version_modelo,
          predicho_en: p.predicho_en,
        }));
      } else {
        return json({ error: "type invalido. Opciones: students, predictions" }, 400);
      }

      await audit(user, req, "EXPORT", type, null, { format, rows: items.length });
      return new Response(objectsToCsv(items, columns), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reporte_${type}.csv"`,
        },
      });
    }

    if (parts[0] === "model" && req.method === "GET" && parts[1] === "info") {
      const denied = requireRole(user, ["admin"]);
      if (denied) return denied;
      const { data: lastPrediction } = await supabase
        .from("predicciones")
        .select("version_modelo, predicho_en, alumnos!inner(institucion_id)")
        .eq("alumnos.institucion_id", user.institution_id)
        .order("predicho_en", { ascending: false }).limit(1).maybeSingle();

      let service: Record<string, unknown> = { mode: "edge-stub", available: false };
      if (Deno.env.get("ML_SERVICE_URL")) {
        try {
          const info = await mlFetch("/model-info");
          service = { mode: "ml-service", available: true, ...(info ?? {}) };
        } catch (e) {
          service = { mode: "ml-service", available: false, error: (e as Error).message };
        }
      }
      return json({
        data: {
          service,
          last_used_version: lastPrediction?.version_modelo ?? null,
          last_prediction_at: lastPrediction?.predicho_en ?? null,
        },
      });
    }

    if (parts[0] === "model" && req.method === "POST" && parts[1] === "retrain") {
      const denied = requireRole(user, ["admin"]);
      if (denied) return denied;
      if (!Deno.env.get("ML_SERVICE_URL")) {
        return json({ error: "Reentrenamiento no disponible: configura ML_SERVICE_URL" }, 503);
      }
      const result = await mlFetch("/retrain", { method: "POST" }, 120000);
      await audit(user, req, "RETRAIN", "model", null, result);
      return json({ data: result });
    }

    if (parts[0] === "ai" && req.method === "POST" && parts[1] === "socioeconomic") {
      if (!geminiEnabled()) {
        return json({ error: "Asistente de IA no disponible: configura GEMINI_API_KEY" }, 503);
      }
      const body = await readBody(req);
      const respuestas = body?.respuestas;
      if (!respuestas || typeof respuestas !== "object" || !Object.keys(respuestas).length) {
        return json({ error: 'Envía las respuestas del cuestionario en "respuestas"' }, 400);
      }
      const lista = Object.entries(respuestas).map(([k, v]) => `- ${k}: ${v}`).join("\n");
      const prompt =
        "Eres un asistente que clasifica el nivel socioeconómico de un estudiante en México " +
        "con base en indicadores tipo AMAI (escolaridad del jefe de familia, ingreso del hogar, " +
        "características de la vivienda, bienes y servicios). A partir de las siguientes respuestas " +
        "de un cuestionario, determina el nivel socioeconómico más adecuado.\n\n" +
        `Respuestas del cuestionario:\n${lista}\n\n` +
        "Devuelve un JSON con:\n" +
        "- \"nivel\": uno de bajo, medio_bajo, medio, medio_alto, alto.\n" +
        "- \"justificacion\": explicación breve (1-2 frases) en español, dirigida al usuario.\n" +
        "- \"puntaje\": un entero de 0 a 100 (0 = más bajo, 100 = más alto).";
      const raw = await geminiGenerate(prompt, { temperature: 0.2, responseSchema: SOCIO_SCHEMA });
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      const nivel = NIVELES.includes(parsed?.nivel as string) ? (parsed.nivel as string) : "medio";
      await audit(user, req, "AI_SOCIOECONOMIC", "ai", null, { nivel });
      return json({
        data: {
          nivel,
          nivel_label: NIVEL_LABEL[nivel],
          justificacion: (parsed?.justificacion as string) || "",
          puntaje: typeof parsed?.puntaje === "number" ? parsed.puntaje : null,
        },
      });
    }

    if (parts[0] === "ai" && req.method === "POST" && parts[1] === "intervention") {
      if (!geminiEnabled()) {
        return json({ error: "Asistente de IA no disponible: configura GEMINI_API_KEY" }, 503);
      }
      const body = await readBody(req);
      let studentId = body?.student_id as string | undefined;
      if (!studentId && body?.alert_id) {
        const { data: alerta } = await supabase
          .from("alertas")
          .select("alumno_id, alumnos!inner(institucion_id)")
          .eq("id", body.alert_id)
          .eq("alumnos.institucion_id", user.institution_id)
          .maybeSingle();
        studentId = alerta?.alumno_id as string | undefined;
      }
      if (!studentId) return json({ error: "Envía student_id o alert_id" }, 400);

      const { data: student, error } = await supabase
        .from("alumnos")
        .select(
          "*, historial_academico(*), predicciones(puntaje_riesgo, nivel_riesgo, factores_contribuyentes, predicho_en)",
        )
        .eq("id", studentId)
        .eq("institucion_id", user.institution_id)
        .single();
      if (error || !student) return json({ error: "Estudiante no encontrado" }, 404);

      const historial = [...((student.historial_academico as Record<string, unknown>[]) ?? [])]
        .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
        .slice(-4);
      const prediccion = [...((student.predicciones as Record<string, unknown>[]) ?? [])].sort(
        (a, b) => new Date(b.predicho_en as string).getTime() - new Date(a.predicho_en as string).getTime(),
      )[0];
      const factores = ((prediccion?.factores_contribuyentes as { label?: string; importance?: number }[]) ?? [])
        .map((f) => `${f.label} (${Math.round((f.importance ?? 0) * 100)}%)`)
        .join(", ");
      const historialTexto = historial.length
        ? historial
            .map(
              (r) =>
                `Periodo ${r.periodo}: promedio ${r.promedio}, asistencia ${r.tasa_asistencia}%, ` +
                `reprobadas ${r.materias_reprobadas}, entregas pendientes ${r.entregas_pendientes ?? "N/D"}`,
            )
            .join("\n")
        : "Sin registros académicos capturados.";

      const prompt =
        "Eres un orientador educativo experto en prevención del abandono escolar en México. " +
        "Con base en el perfil del estudiante, recomienda un plan de intervención concreto y accionable " +
        "para el tutor o coordinador. Responde en español, en formato Markdown, con secciones breves: " +
        "1) Diagnóstico rápido, 2) Acciones recomendadas (lista priorizada de 3 a 5 acciones), " +
        "3) Canalización o apoyos sugeridos, 4) Seguimiento propuesto. Sé específico y empático; " +
        "no inventes datos que no aparezcan en el perfil.\n\n" +
        "Perfil del estudiante:\n" +
        `- Nombre: ${student.nombre_completo}\n` +
        `- Programa: ${student.programa ?? "N/D"}\n` +
        `- Semestre: ${student.semestre_actual ?? "N/D"}\n` +
        `- Nivel socioeconómico: ${NIVEL_LABEL[student.nivel_socioeconomico as string] ?? student.nivel_socioeconomico ?? "N/D"}\n` +
        `- Estatus: ${student.estatus ?? "N/D"}\n` +
        (prediccion
          ? `- Riesgo de abandono: ${(Number(prediccion.puntaje_riesgo) * 100).toFixed(1)}% (nivel ${prediccion.nivel_riesgo})\n` +
            `- Factores principales: ${factores || "N/D"}\n`
          : "- Sin predicción de riesgo registrada.\n") +
        `\nHistorial académico reciente:\n${historialTexto}`;

      const recomendacion = await geminiGenerate(prompt, { temperature: 0.5, timeout: 25000 });
      await audit(user, req, "AI_INTERVENTION", "alumnos", studentId, null);
      return json({
        data: { student_id: studentId, student_name: student.nombre_completo, recomendacion },
      });
    }

    return json({ error: "Recurso no encontrado" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
