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
  "full_name",
  "email",
  "birth_date",
  "gender",
  "socioeconomic_level",
  "enrollment_date",
  "current_semester",
  "program",
  "status",
];

const RECORD_FIELDS = [
  "student_id",
  "period",
  "gpa",
  "attendance_rate",
  "failed_subjects",
  "credits_earned",
  "credits_total",
  "observations",
];

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
      .from("users")
      .select("id, email, full_name, role, institution_id, is_active")
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
  if (payload.current_semester !== undefined) {
    payload.current_semester = numberOrNull(payload.current_semester);
    payload.semester = payload.current_semester;
  }
  if (payload.matricula !== undefined) payload.student_code = payload.matricula;
  return { ...payload, institution_id: institutionId };
}

function buildRecordPayload(body: Record<string, unknown>) {
  const payload = pick(body, RECORD_FIELDS);
  for (const key of ["gpa", "attendance_rate", "failed_subjects", "credits_earned", "credits_total"]) {
    if (payload[key] !== undefined) payload[key] = numberOrNull(payload[key]);
  }
  return payload;
}

async function getScopedStudent(studentId: string, institutionId: string) {
  return await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("institution_id", institutionId)
    .single();
}

function riskLevel(score: number) {
  if (score >= 0.7) return "alto";
  if (score >= 0.4) return "medio";
  return "bajo";
}

function predictDropoutRisk(input: Record<string, unknown>) {
  const gpa = Number(input.gpa ?? 8);
  const attendance = Number(input.attendance_rate ?? 90);
  const failed = Number(input.failed_subjects ?? 0);
  const creditsTotal = Number(input.credits_total ?? 0);
  const creditsEarned = Number(input.credits_earned ?? 0);
  const creditRatio = creditsTotal > 0 ? creditsEarned / creditsTotal : 1;
  const socioPenalty = ({
    bajo: 0.10,
    medio_bajo: 0.06,
    medio: 0.03,
    medio_alto: 0.01,
    alto: 0,
  } as Record<string, number>)[String(input.socioeconomic_level ?? "medio")] ?? 0.03;

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
    risk_score: score,
    risk_level: riskLevel(score),
    model_version: "edge-stub-v1",
    contributing_features,
    top_features: contributing_features,
  };
}

async function audit(user: User | null, req: Request, action: string, entity: string, entityId: string | null, detail: unknown = null) {
  await supabase.from("audit_logs").insert({
    user_id: user?.id ?? null,
    action,
    entity,
    entity_type: entity,
    entity_id: entityId,
    detail,
    metadata: detail,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
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
      .from("users")
      .select("email, role")
      .eq("institution_id", student.institution_id)
      .eq("is_active", true)
      .in("role", ["admin", "coordinador"]);
    if (!recipients?.length) return;

    const pct = (Number(prediction.risk_score) * 100).toFixed(1);
    const subject = `Riesgo alto de abandono: ${student.full_name}`;
    const text =
      `El estudiante ${student.full_name} (${student.matricula ?? "s/matrícula"}) ` +
      `alcanzó un riesgo de ${pct}% (nivel ${prediction.risk_level}). ` +
      `Se recomienda intervención del tutor.`;
    await Promise.all(
      recipients.filter((r: { email?: string }) => r.email).map((r: { email: string }) => sendEmail(r.email, subject, text)),
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
    .from("academic_records")
    .select("*")
    .eq("student_id", student.id)
    .order("period", { ascending: false })
    .limit(1);
  if (!records?.length) return { prediction: null as Record<string, unknown> | null };

  const result = predictDropoutRisk({ ...records[0], socioeconomic_level: student.socioeconomic_level });
  const { data: prediction, error } = await supabase
    .from("predictions")
    .insert({ student_id: student.id, generated_by: userId, ...result })
    .select()
    .single();
  if (error) throw error;

  if (result.risk_level === "alto") {
    await supabase.from("alerts").insert({
      student_id: student.id,
      prediction_id: prediction.id,
      severity: result.risk_score >= 0.85 ? "critica" : "alta",
      alert_type: "academic",
      title: `Riesgo alto de abandono: ${student.full_name}`,
      message: `El modelo estimo un riesgo de ${(result.risk_score * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
      status: "pendiente",
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

    if (req.method === "POST" && path === "/auth/login") {
      const body = await readBody(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) return json({ error: "Correo y contrasena son requeridos" }, 400);

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("is_active", true)
        .single();

      if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
        return json({ error: "Credenciales invalidas" }, 401);
      }

      const token = signAccess(user);
      const refresh_token = signRefresh(user);
      await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);
      await audit({ id: user.id } as User, req, "LOGIN", "users", user.id);
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
        .from("users")
        .select("id, email, role, institution_id, is_active")
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
      await audit(user, req, "LOGOUT", "users", user.id);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET" && path === "/dashboard/summary") {
      const [{ count: totalStudents }, { count: activeAlerts }, { data: predictions }] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "activo").eq("institution_id", user.institution_id),
        supabase.from("alerts").select("id, students!inner(institution_id)", { count: "exact", head: true }).eq("status", "pendiente").eq("students.institution_id", user.institution_id),
        supabase.from("predictions").select("risk_level, risk_score, predicted_at, students!inner(institution_id)").eq("students.institution_id", user.institution_id).order("predicted_at", { ascending: false }).limit(500),
      ]);
      const distribution = { bajo: 0, medio: 0, alto: 0 };
      for (const p of predictions ?? []) distribution[p.risk_level as "bajo" | "medio" | "alto"]++;
      return json({
        data: {
          total_students: totalStudents ?? 0,
          active_alerts: activeAlerts ?? 0,
          risk_distribution: distribution,
          recent_predictions: (predictions ?? []).slice(0, 10).map(({ students: _students, ...p }) => p),
        },
      });
    }

    if (parts[0] === "students") {
      if (req.method === "GET" && parts.length === 1) {
        const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
        const from = (page - 1) * limit;
        let query = supabase.from("students").select("*", { count: "exact" }).eq("institution_id", user.institution_id);
        const status = url.searchParams.get("status");
        const search = sanitizeSearch(url.searchParams.get("search") ?? "");
        if (status) query = query.eq("status", status);
        if (search) query = query.or(`full_name.ilike.%${search}%,matricula.ilike.%${search}%`);
        const { data, count, error } = await query.order("full_name").range(from, from + limit - 1);
        if (error) throw error;
        return json({ data, total: count, page, limit });
      }

      if (req.method === "POST" && parts.length === 1) {
        const denied = requireRole(user, ["admin", "coordinador"]);
        if (denied) return denied;
        const body = await readBody(req);
        const { data, error } = await supabase.from("students").insert(buildStudentPayload(body, user.institution_id)).select().single();
        if (error) throw error;
        await audit(user, req, "CREATE", "students", data.id, body);
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
        const errors: { row: number; error: string }[] = [];
        rows.forEach((raw, idx) => {
          const payload = buildStudentPayload(raw, user.institution_id);
          if (!payload.matricula || !payload.full_name) {
            errors.push({ row: idx + 2, error: "matricula y full_name son obligatorios" });
            return;
          }
          payloads.push(payload);
        });
        if (!payloads.length) return json({ error: "Ninguna fila valida", errors }, 400);

        const { data, error } = await supabase
          .from("students")
          .upsert(payloads, { onConflict: "matricula" })
          .select("id, matricula, full_name");
        if (error) throw error;
        await audit(user, req, "IMPORT", "students", null, { imported: data.length, errors: errors.length });
        return json({ data: { imported: data.length, students: data, errors } }, 201);
      }

      if (req.method === "GET" && parts.length === 3 && parts[2] === "trend") {
        const { error: sErr } = await getScopedStudent(parts[1], user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase
          .from("predictions")
          .select("risk_score, risk_level, model_version, predicted_at")
          .eq("student_id", parts[1])
          .order("predicted_at", { ascending: true });
        if (error) throw error;
        return json({
          data: (data ?? []).map((p) => ({
            predicted_at: p.predicted_at,
            risk_score: Number(p.risk_score),
            risk_percent: Math.round(Number(p.risk_score) * 100),
            risk_level: p.risk_level,
            model_version: p.model_version,
          })),
        });
      }

      const studentId = parts[1];
      if (req.method === "GET" && parts.length === 2) {
        const { data, error } = await supabase
          .from("students")
          .select("*, academic_records(*), predictions(*), alerts(*)")
          .eq("id", studentId)
          .eq("institution_id", user.institution_id)
          .single();
        if (error) return json({ error: "Estudiante no encontrado" }, 404);
        return json({ data });
      }

      if (req.method === "PUT" && parts.length === 2) {
        const denied = requireRole(user, ["admin", "coordinador"]);
        if (denied) return denied;
        const body = await readBody(req);
        const { data, error } = await supabase
          .from("students")
          .update(buildStudentPayload(body, user.institution_id))
          .eq("id", studentId)
          .eq("institution_id", user.institution_id)
          .select()
          .single();
        if (error) return json({ error: "Estudiante no encontrado" }, 404);
        await audit(user, req, "UPDATE", "students", studentId, body);
        return json({ data });
      }

      if (req.method === "DELETE" && parts.length === 2) {
        const denied = requireRole(user, ["admin"]);
        if (denied) return denied;
        const { error } = await supabase.from("students").delete().eq("id", studentId).eq("institution_id", user.institution_id);
        if (error) throw error;
        await audit(user, req, "DELETE", "students", studentId);
        return new Response(null, { status: 204, headers: corsHeaders });
      }
    }

    if (parts[0] === "records") {
      if (req.method === "GET" && parts[1] === "student" && parts[2]) {
        const { error: sErr } = await getScopedStudent(parts[2], user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase.from("academic_records").select("*").eq("student_id", parts[2]).order("period", { ascending: false });
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const payload = buildRecordPayload(body);
        const { error: sErr } = await getScopedStudent(String(payload.student_id), user.institution_id);
        if (sErr) return json({ error: "Estudiante no encontrado" }, 404);
        const { data, error } = await supabase.from("academic_records").insert(payload).select().single();
        if (error) throw error;
        await audit(user, req, "CREATE", "academic_records", data.id, payload);
        return json({ data }, 201);
      }
    }

    if (parts[0] === "predictions" && parts[1] === "batch" && req.method === "POST") {
      const denied = requireRole(user, ["admin", "coordinador"]);
      if (denied) return denied;
      const { data: students, error } = await supabase
        .from("students").select("*")
        .eq("institution_id", user.institution_id).eq("status", "activo");
      if (error) throw error;
      const summary = { total: students.length, generated: 0, skipped: 0, high_risk: 0 };
      for (const student of students) {
        const { prediction } = await runPrediction(student, user.id);
        if (!prediction) summary.skipped++;
        else {
          summary.generated++;
          if (prediction.risk_level === "alto") summary.high_risk++;
        }
      }
      await audit(user, req, "PREDICT_BATCH", "predictions", null, summary);
      return json({ data: summary }, 201);
    }

    if (parts[0] === "predictions" && parts[1] === "high-risk" && req.method === "GET") {
      const { data, error } = await supabase
        .from("predictions")
        .select("*, students!inner(id, full_name, matricula, current_semester, program, institution_id)")
        .eq("students.institution_id", user.institution_id)
        .eq("risk_level", "alto")
        .order("predicted_at", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const latest: Record<string, unknown>[] = [];
      for (const p of data ?? []) {
        if (seen.has(p.student_id)) continue;
        seen.add(p.student_id);
        latest.push(p);
      }
      latest.sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
      return json({ data: latest });
    }

    if (parts[0] === "predictions" && parts[1] === "student" && parts[2]) {
      const studentId = parts[2];
      const { data: student, error: sErr } = await getScopedStudent(studentId, user.institution_id);
      if (sErr) return json({ error: "Estudiante no encontrado" }, 404);

      if (req.method === "GET") {
        const { data, error } = await supabase.from("predictions").select("*").eq("student_id", studentId).order("predicted_at", { ascending: false });
        if (error) throw error;
        return json({ data });
      }

      if (req.method === "POST") {
        const { prediction } = await runPrediction(student, user.id);
        if (!prediction) return json({ error: "El estudiante necesita al menos un registro academico para generar prediccion" }, 400);
        await audit(user, req, "PREDICT", "predictions", String(prediction.id), { risk: prediction.risk_level });
        return json({ data: prediction }, 201);
      }
    }

    if (parts[0] === "alerts") {
      if (req.method === "GET" && parts.length === 1) {
        let query = supabase
          .from("alerts")
          .select("*, students!inner(full_name, matricula, institution_id)")
          .eq("students.institution_id", user.institution_id)
          .order("created_at", { ascending: false });
        const status = url.searchParams.get("status");
        const severity = url.searchParams.get("severity");
        if (status) query = query.eq("status", status);
        if (severity) query = query.eq("severity", severity);
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
        const scoped = await supabase.from("alerts").select("id, students!inner(institution_id)").eq("id", parts[1]).eq("students.institution_id", user.institution_id).single();
        if (scoped.error) return json({ error: "Alerta no encontrada" }, 404);
        const patch: Record<string, unknown> = { status, resolved_at: status === "resuelta" ? new Date().toISOString() : null };
        if (status === "en_atencion") patch.assigned_to = user.id;
        const { data, error } = await supabase.from("alerts").update(patch).eq("id", parts[1]).select().single();
        if (error) throw error;
        await audit(user, req, "UPDATE", "alerts", parts[1], patch);
        return json({ data });
      }
    }

    if (parts[0] === "users") {
      const denied = requireRole(user, ["admin"]);
      if (denied) return denied;
      if (req.method === "GET" && parts.length === 1) {
        const { data, error } = await supabase.from("users").select("id, institution_id, full_name, email, role, is_active, last_login, created_at").eq("institution_id", user.institution_id).order("full_name");
        if (error) throw error;
        return json({ data: data ?? [] });
      }
      if (req.method === "POST" && parts.length === 1) {
        const body = await readBody(req);
        if (!body.full_name || !body.email || !body.password) return json({ error: "Nombre, correo y contrasena son requeridos" }, 400);
        if (!["admin", "coordinador", "docente"].includes(String(body.role ?? "docente"))) return json({ error: "Rol invalido" }, 400);
        if (String(body.password).length < 8) return json({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
        const password_hash = await bcrypt.hash(String(body.password), 12);
        const { data, error } = await supabase.from("users").insert({
          full_name: body.full_name,
          email: String(body.email).trim().toLowerCase(),
          password_hash,
          role: body.role ?? "docente",
          institution_id: user.institution_id,
        }).select("id, institution_id, full_name, email, role, is_active, created_at").single();
        if (error) throw error;
        return json({ data }, 201);
      }
      if (req.method === "PATCH" && parts[1]) {
        const body = await readBody(req);
        const patch: Record<string, unknown> = {};
        if (body.full_name !== undefined) patch.full_name = body.full_name;
        if (body.role !== undefined) {
          if (parts[1] === user.id) return json({ error: "No puedes cambiar tu propio rol" }, 400);
          patch.role = body.role;
        }
        if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
        if (body.password) patch.password_hash = await bcrypt.hash(String(body.password), 12);
        if (parts[1] === user.id && patch.is_active === false) return json({ error: "No puedes desactivar tu propia cuenta" }, 400);
        const { data, error } = await supabase.from("users").update(patch).eq("id", parts[1]).eq("institution_id", user.institution_id).select("id, institution_id, full_name, email, role, is_active").single();
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

      const { data: members } = await supabase.from("users").select("id").eq("institution_id", user.institution_id);
      const memberIds = (members ?? []).map((m: { id: string }) => m.id);
      if (!memberIds.length) return json({ data: [], total: 0, page, limit });

      let query = supabase
        .from("audit_logs")
        .select("id, user_id, action, entity, entity_id, detail, ip_address, created_at", { count: "exact" })
        .in("user_id", memberIds)
        .order("created_at", { ascending: false });
      const usuario = url.searchParams.get("usuario");
      const accion = url.searchParams.get("accion");
      const fi = url.searchParams.get("fecha_inicio");
      const ff = url.searchParams.get("fecha_fin");
      if (usuario) query = query.eq("user_id", usuario);
      if (accion) query = query.eq("action", accion);
      if (fi) query = query.gte("created_at", fi);
      if (ff) query = query.lte("created_at", ff);
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
        columns = ["matricula", "full_name", "email", "program", "current_semester", "socioeconomic_level", "status"];
        const { data, error } = await supabase
          .from("students").select(columns.join(", "))
          .eq("institution_id", user.institution_id).order("full_name");
        if (error) throw error;
        items = data ?? [];
      } else if (type === "predictions") {
        columns = ["matricula", "full_name", "risk_percent", "risk_level", "model_version", "predicted_at"];
        const { data, error } = await supabase
          .from("predictions")
          .select("risk_score, risk_level, model_version, predicted_at, students!inner(matricula, full_name, institution_id)")
          .eq("students.institution_id", user.institution_id)
          .order("predicted_at", { ascending: false }).limit(5000);
        if (error) throw error;
        items = (data ?? []).map((p) => ({
          matricula: p.students.matricula,
          full_name: p.students.full_name,
          risk_percent: Math.round(Number(p.risk_score) * 100),
          risk_level: p.risk_level,
          model_version: p.model_version,
          predicted_at: p.predicted_at,
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
        .from("predictions")
        .select("model_version, predicted_at, students!inner(institution_id)")
        .eq("students.institution_id", user.institution_id)
        .order("predicted_at", { ascending: false }).limit(1).maybeSingle();

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
          last_used_version: lastPrediction?.model_version ?? null,
          last_prediction_at: lastPrediction?.predicted_at ?? null,
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

    return json({ error: "Recurso no encontrado" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
