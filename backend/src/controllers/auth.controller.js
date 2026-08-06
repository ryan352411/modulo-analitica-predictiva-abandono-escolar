import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const revokedRefreshTokens = new Set();

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, institution_id: user.institution_id },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN },
  );
}

function loginKey(req, email) {
  return `${req.ip}:${String(email || '')
    .trim()
    .toLowerCase()}`;
}

function isLoginBlocked(req, email) {
  const key = loginKey(req, email);
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function pruneExpiredLogins(now) {
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) loginAttempts.delete(key);
  }
}

function registerFailedLogin(req, email) {
  const key = loginKey(req, email);
  const now = Date.now();
  pruneExpiredLogins(now);
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearFailedLogins(req, email) {
  loginAttempts.delete(loginKey(req, email));
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }
    if (isLoginBlocked(req, email)) {
      return res.status(429).json({ error: 'Demasiados intentos. Intenta mas tarde' });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select(
        'id, email:correo, password_hash:contrasena_hash, full_name:nombre_completo, role:rol, institution_id:institucion_id',
      )
      .eq('correo', String(email).trim().toLowerCase())
      .eq('activo', true)
      .single();

    if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
      registerFailedLogin(req, email);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = signAccessToken(user);
    const refresh_token = signRefreshToken(user);

    await supabase
      .from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id);
    req.user = { id: user.id };
    await audit(req, 'LOGIN', 'usuarios', user.id);
    clearFailedLogins(req, email);

    res.json({
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
  } catch (e) {
    next(e);
  }
}

export async function register(req, res, next) {
  try {
    const { full_name, email, password } = req.body || {};
    const name = String(full_name || '').trim();
    const correo = String(email || '')
      .trim()
      .toLowerCase();

    if (!name || !correo || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const userSelect =
      'id, email:correo, full_name:nombre_completo, role:rol, institution_id:institucion_id';

    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', correo)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('usuarios')
      .insert({
        nombre_completo: name,
        correo,
        contrasena_hash: password_hash,
        rol: 'admin',
        institucion_id: null,
      })
      .select(userSelect)
      .single();
    if (error) throw error;

    const token = signAccessToken(user);
    const refresh_token = signRefreshToken(user);
    req.user = { id: user.id };
    await audit(req, 'CREATE', 'usuarios', user.id, { via: 'signup' });

    res.status(201).json({
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
  } catch (e) {
    next(e);
  }
}

export async function googleLogin(req, res, next) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'El inicio de sesion con Google no esta configurado' });
    }
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Falta el token de Google' });
    }

    let payload;
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );
      if (!resp.ok) throw new Error('token invalido');
      payload = await resp.json();
    } catch {
      return res.status(401).json({ error: 'No se pudo validar la sesion de Google' });
    }

    const audienceOk = payload.aud === clientId;
    const issuerOk =
      payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!audienceOk || !issuerOk || !payload.email || !emailVerified) {
      return res.status(401).json({ error: 'Sesion de Google no valida' });
    }

    const email = String(payload.email).trim().toLowerCase();
    const fullName = payload.name || email;

    const userSelect =
      'id, email:correo, full_name:nombre_completo, role:rol, institution_id:institucion_id, is_active:activo';

    let { data: user } = await supabase
      .from('usuarios')
      .select(userSelect)
      .eq('correo', email)
      .maybeSingle();

    if (user && !user.is_active) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    if (!user) {
      const randomHash = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 12);
      const { data: created, error: cErr } = await supabase
        .from('usuarios')
        .insert({
          nombre_completo: fullName,
          correo: email,
          contrasena_hash: randomHash,
          rol: 'admin',
          institucion_id: null,
        })
        .select(userSelect)
        .single();
      if (cErr) throw cErr;
      user = created;
    }

    const token = signAccessToken(user);
    const refresh_token = signRefreshToken(user);
    await supabase
      .from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id);
    req.user = { id: user.id };
    await audit(req, 'LOGIN', 'usuarios', user.id, { via: 'google' });

    res.json({
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
  } catch (e) {
    next(e);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token requerido' });
    if (revokedRefreshTokens.has(refresh_token)) {
      return res.status(401).json({ error: 'Refresh token revocado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Refresh token invalido o expirado' });
    }
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token no es de tipo refresh' });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, email:correo, role:rol, institution_id:institucion_id, is_active:activo')
      .eq('id', decoded.id)
      .single();
    if (error || !user?.is_active) {
      return res.status(401).json({ error: 'Usuario invalido o inactivo' });
    }

    res.json({ token: signAccessToken(user) });
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body || {};
    if (refresh_token) revokedRefreshTokens.add(refresh_token);
    await audit(req, 'LOGOUT', 'usuarios', req.user?.id ?? null);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
