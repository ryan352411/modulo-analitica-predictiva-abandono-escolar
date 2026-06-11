import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import jwt from "npm:jsonwebtoken@9.0.2";

type User = {
  id: string;
  email: string;
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
    const decoded = jwt.verify(token, secretKey) as { id?: string };
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, institution_id, is_active")
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

  let score = (10 - gpa) * 0.05 +
    ((100 - attendance) / 100) * 0.3 +
    Math.min(failed, 5) * 0.05 +
    (1 - creditRatio) * 0.1 +
    socioPenalty;

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));
  const contributing_features = [
    { feature: "promedio_general", label: "Promedio general bajo", importance: 0.35 },
    { feature: "tasa_asistencia", label: "Asistencia irregular", importance: 0.27 },
    { feature: "materias_reprobadas", label: "Materias reprobadas", importance: 0.19 },
  ];

  return {
    risk_score: score,
    risk_level: riskLevel(score),
    model_version: "edge-stub-v1",
    contributing_features,
    top_features: contributing_features,
  };
}

async function audit(user: User | null, req: Request, action: string, entity: string, entityId: string | null, detail = null) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!secretKey || !supabaseUrl) return json({ error: "Servidor sin configuracion Supabase" }, 500);

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

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, institution_id: user.institution_id },
        secretKey,
        { expiresIn: "8h" },
      );
      await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);
      await audit({ id: user.id } as User, req, "LOGIN", "users", user.id);
      return json({
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          institution_id: user.institution_id,
        },
      });
    }

    const auth = await authUser(req);
    if (auth instanceof Response) return auth;
    const user = auth;

    if (req.method === "GET" && path === "/auth/me") {
      return json({ user });
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
        const { data: records, error: rErr } = await supabase.from("academic_records").select("*").eq("student_id", studentId).order("period", { ascending: false }).limit(1);
        if (rErr) throw rErr;
        if (!records?.length) return json({ error: "El estudiante necesita al menos un registro academico para generar prediccion" }, 400);
        const result = predictDropoutRisk({ ...records[0], socioeconomic_level: student.socioeconomic_level });
        const { data: prediction, error: pErr } = await supabase.from("predictions").insert({ student_id: studentId, generated_by: user.id, ...result }).select().single();
        if (pErr) throw pErr;
        if (result.risk_level === "alto") {
          await supabase.from("alerts").insert({
            student_id: studentId,
            prediction_id: prediction.id,
            severity: result.risk_score >= 0.85 ? "critica" : "alta",
            alert_type: "academic",
            title: `Riesgo alto de abandono: ${student.full_name}`,
            message: `El modelo estimo un riesgo de ${(result.risk_score * 100).toFixed(1)}%. Se recomienda intervencion del tutor.`,
            status: "pendiente",
          });
        }
        await audit(user, req, "PREDICT", "predictions", prediction.id, { risk: result.risk_level });
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
        const { data, error } = await supabase.from("users").select("id, institution_id, full_name, email, role, is_active, created_at").eq("institution_id", user.institution_id).order("full_name");
        if (error) throw error;
        return json({ data: (data ?? []).map((item) => ({ ...item, last_login: null })) });
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

    return json({ error: "Recurso no encontrado" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
