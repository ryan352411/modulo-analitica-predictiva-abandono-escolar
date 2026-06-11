import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

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

function registerFailedLogin(req, email) {
  const key = loginKey(req, email);
  const now = Date.now();
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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        institution_id: user.institution_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    req.user = { id: user.id };
    await audit(req, 'LOGIN', 'users', user.id);
    clearFailedLogins(req, email);

    res.json({
      token,
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

export async function me(req, res) {
  res.json({ user: req.user });
}
