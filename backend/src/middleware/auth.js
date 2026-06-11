import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, institution_id, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user?.is_active) {
      return res.status(401).json({ error: 'Token invalido o usuario inactivo' });
    }

    req.user = {
      id: user.id,
      email: user.email,
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
