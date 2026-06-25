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
// Denylist en memoria de refresh tokens revocados (logout). Para varias
// instancias conviene un store compartido (Redis); aquí basta para el MVP.
const revokedRefreshTokens = new Set();

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, institution_id: user.institution_id },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function loginKey(req, email) {
  return `${req.ip}:${String(email || '').trim().toLowerCase()}`;
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
      return res.status(400).json({ error: 'Correo y contrasena son requeridos' });
    }
    if (isLoginBlocked(req, email)) {
      return res.status(429).json({ error: 'Demasiados intentos. Intenta mas tarde' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', String(email).trim().toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
      registerFailedLogin(req, email);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = signAccessToken(user);
    const refresh_token = signRefreshToken(user);

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    req.user = { id: user.id };
    await audit(req, 'LOGIN', 'users', user.id);
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

/**
 * Renueva el access token a partir de un refresh token válido.
 * Body: { refresh_token }
 */
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
      .from('users')
      .select('id, email, role, institution_id, is_active')
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

/**
 * Cierra sesión revocando el refresh token enviado. Body: { refresh_token }
 */
export async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body || {};
    if (refresh_token) revokedRefreshTokens.add(refresh_token);
    await audit(req, 'LOGOUT', 'users', req.user?.id ?? null);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
