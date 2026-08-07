import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const PALABRAS_VACIAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'para', 'por',
]);

export function prefijoMatricula(nombre = '') {
  const iniciales = String(nombre)
    .trim()
    .split(/\s+/)
    .filter((w) => w && !PALABRAS_VACIAS.has(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return iniciales || 'ESC';
}

export const riskColor = {
  bajo: 'text-risk-low bg-risk-low/10',
  medio: 'text-risk-mid bg-risk-mid/10',
  alto: 'text-risk-high bg-risk-high/10',
  critico: 'text-risk-critical bg-risk-critical/10',
};

export const riskLabel = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' };

// Hex de cada nivel, para las gráficas de Recharts (no aceptan clases de Tailwind).
export const riskHex = {
  bajo: '#3E9E6E',
  medio: '#E0A13B',
  alto: '#D2604F',
  critico: '#8E2F2F',
};

export const ESTATUS_ALUMNO = [
  { value: 'activo', label: 'Activo' },
  { value: 'baja_temporal', label: 'Baja temporal' },
  { value: 'baja_definitiva', label: 'Baja definitiva' },
  { value: 'egresado', label: 'Egresado' },
];

export const ESTATUS_ALERTA = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_atencion', label: 'En atención' },
  { value: 'resuelta', label: 'Resuelta' },
  { value: 'descartada', label: 'Descartada' },
];

export const SEVERIDAD_ALERTA = [
  { value: 'info', label: 'Informativa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

// Mensaje legible a partir de un error de Axios, para los estados de error de las consultas.
export function mensajeError(error, porDefecto = 'No fue posible cargar la información') {
  if (!error) return null;
  if (error.response?.status === 403) return 'No tienes permisos para consultar esta sección';
  return error.response?.data?.error || error.message || porDefecto;
}
