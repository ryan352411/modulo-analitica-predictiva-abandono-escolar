export function pick(source = {}, allowed = []) {
  return allowed.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});
}

export function requireInstitution(req) {
  const institutionId = req.user?.institution_id;
  if (!institutionId) {
    const err = new Error('Usuario sin institucion asignada');
    err.status = 403;
    throw err;
  }
  return institutionId;
}

export function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

export function sanitizeSearch(value = '') {
  return String(value).trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ');
}

export function mapSingleResultNotFound(error, entity = 'Recurso') {
  if (error?.code === 'PGRST116') {
    const err = new Error(`${entity} no encontrado`);
    err.status = 404;
    return err;
  }
  return error;
}
