import { api } from './api.js';

export async function downloadReport(type, format) {
  const res = await api.get('/reports/export', {
    params: { type, format },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${type}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
