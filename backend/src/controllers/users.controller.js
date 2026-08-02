import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { requireInstitution } from '../utils/request.js';

const ALLOWED_ROLES = new Set(['admin', 'coordinador', 'docente']);

export async function listUsers(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo, last_login:ultimo_acceso, created_at:creado_en')
      .eq('institucion_id', institutionId)
      .order('nombre_completo');

    if (error) throw error;
    res.json({ data: data ?? [] });
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
      .from('usuarios')
      .insert({
        nombre_completo: full_name,
        correo: normalizedEmail,
        contrasena_hash: password_hash,
        rol: role,
        institucion_id: institutionId,
      })
      .select('id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo, created_at:creado_en')
      .single();

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    if (error) throw error;

    await audit(req, 'CREATE', 'usuarios', data.id, { email: normalizedEmail, role });
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

    if (full_name !== undefined) patch.nombre_completo = full_name;
    if (role !== undefined) {
      if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: 'Rol invalido' });
      if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
      }
      patch.rol = role;
    }
    if (is_active !== undefined) patch.activo = Boolean(is_active);
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
      }
      patch.contrasena_hash = await bcrypt.hash(password, 12);
    }

    if (req.params.id === req.user.id && patch.activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update(patch)
      .eq('id', req.params.id)
      .eq('institucion_id', institutionId)
      .select('id, institution_id:institucion_id, full_name:nombre_completo, email:correo, role:rol, is_active:activo')
      .single();

    if (error?.code === 'PGRST116') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error) throw error;

    invalidateUserCache(req.params.id);
    await audit(req, 'UPDATE', 'usuarios', req.params.id, {
      ...patch,
      contrasena_hash: undefined,
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
}
