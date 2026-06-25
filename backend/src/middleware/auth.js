import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

// Caché corto del usuario para evitar una consulta a la BD en CADA request.
// TTL bajo + invalidación explícita en updateUser para que desactivar una
// cuenta o cambiar su rol siga teniendo efecto casi inmediato.
const USER_CACHE_TTL_MS = 30 * 1000;
const userCache = new Map();

export function invalidateUserCache(id) {
  userCache.delete(id);
}

async function loadUser(id) {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, institution_id, is_active')
    .eq('id', id)
    .single();

  if (error || !user) return null;
  userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return user;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(decoded.id);

    if (!user?.is_active) {
      return res.status(401).json({ error: 'Token invalido o usuario inactivo' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      institution_id: user.institution_id,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}
