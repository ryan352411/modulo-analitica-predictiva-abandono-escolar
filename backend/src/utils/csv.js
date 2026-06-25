/**
 * Utilidades CSV mínimas (sin dependencias).
 * Soporta comillas dobles, comas y saltos de línea escapados dentro de comillas.
 */

export function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') pushField();
    else if (c === '\n') { pushField(); pushRow(); }
    else field += c;
  }
  // Última celda/fila si el archivo no termina en salto de línea
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }

  // Descarta filas totalmente vacías
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Convierte CSV con encabezados en arreglo de objetos. */
export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? '').trim(); });
    return obj;
  });
}

/** Serializa un arreglo de objetos a CSV usando las columnas indicadas. */
export function objectsToCsv(items = [], columns = []) {
  const escape = (value) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(escape).join(',');
  const lines = items.map((item) => columns.map((col) => escape(item[col])).join(','));
  return [header, ...lines].join('\n');
}
