// Script de un solo uso: vacía TODAS las tablas de la base Supabase.
// Usa la API REST (PostgREST) con la service key — sin dependencias npm.
// Orden de borrado: hijos antes que padres para respetar las FK.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carga manual del .env (evita depender de paquetes no instalados).
function loadEnv() {
  for (const p of ['../../.env', '../.env', '.env']) {
    const full = resolve(__dirname, p);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el entorno.');
  process.exit(1);
}

// Orden: primero las tablas que referencian a otras.
const TABLAS = [
  'alertas',
  'predicciones',
  'historial_academico',
  'registros_auditoria',
  'alumnos',
  'usuarios',
  'instituciones',
];

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  Prefer: 'count=exact',
};

// Devuelve el nº de filas a partir del header Content-Range (formato "0-9/42").
const filasDe = (res) => {
  const cr = res.headers.get('content-range');
  return cr ? cr.split('/').pop() : '?';
};

let hadError = false;
for (const tabla of TABLAS) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?id=neq.${ZERO_UUID}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    hadError = true;
    console.error(`✗ ${tabla}: HTTP ${res.status} ${await res.text()}`);
    continue;
  }
  console.log(`✓ ${tabla}: ${filasDe(res)} filas borradas`);
}

if (hadError) {
  console.error('\nTerminó con errores. Revisa arriba.');
  process.exit(1);
}
console.log('\nBase de datos vaciada por completo.');
