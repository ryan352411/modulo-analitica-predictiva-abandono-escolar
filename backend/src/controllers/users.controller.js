import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { requireInstitution } from '../utils/request.js';

const ALLOWED_ROLES = new Set(['admin', 'coordinador', 'docente']);

export async function listUsers(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('users')
      .select('id, institution_id, full_name, email, role, is_active, created_at')
      .eq('institution_id', institutionId)
      .order('full_name');

    if (error) throw error;
    res.json({ data: (data ?? []).map((item) => ({ ...item, last_login: null })) });
  } catch (e) {
    next(e);
  }
}

export async function createUser(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { full_name, email, password, role = 'docente' } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'Rol invalido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name,
        email: normalizedEmail,
        password_hash,
        role,
        institution_id: institutionId,
      })
      .select('id, institution_id, full_name, email, role, is_active, created_at')
      .single();

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    if (error) throw error;

    await audit(req, 'CREATE', 'users', data.id, { email: normalizedEmail, role });
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
}

export async function updateUser(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const patch = {};
    const { full_name, role, is_active, password } = req.body;

    if (full_name !== undefined) patch.full_name = full_name;
    if (role !== undefined) {
      if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: 'Rol invalido' });
      if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
      }
      patch.role = role;
    }
    if (is_active !== undefined) patch.is_active = Boolean(is_active);
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
      }
      patch.password_hash = await bcrypt.hash(password, 12);
    }

    if (req.params.id === req.user.id && patch.is_active === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.params.id)
      .eq('institution_id', institutionId)
      .select('id, institution_id, full_name, email, role, is_active')
      .single();

    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error) throw error;

    await audit(req, 'UPDATE', 'users', req.params.id, {
      ...patch,
      password_hash: undefined,
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
