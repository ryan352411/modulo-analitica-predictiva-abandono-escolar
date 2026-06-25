import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase.js';
import { audit } from '../middleware/auditLog.js';
import { objectsToCsv } from '../utils/csv.js';
import { requireInstitution } from '../utils/request.js';

const DATASETS = {
  students: {
    title: 'Reporte de estudiantes',
    columns: ['matricula', 'full_name', 'email', 'program', 'current_semester', 'socioeconomic_level', 'status'],
    async fetch(institutionId) {
      const { data, error } = await supabase
        .from('students')
        .select('matricula, full_name, email, program, current_semester, socioeconomic_level, status')
        .eq('institution_id', institutionId)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  },
  predictions: {
    title: 'Reporte de predicciones',
    columns: ['matricula', 'full_name', 'risk_percent', 'risk_level', 'model_version', 'predicted_at'],
    async fetch(institutionId) {
      const { data, error } = await supabase
        .from('predictions')
        .select('risk_score, risk_level, model_version, predicted_at, students!inner(matricula, full_name, institution_id)')
        .eq('students.institution_id', institutionId)
        .order('predicted_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        matricula: p.students.matricula,
        full_name: p.students.full_name,
        risk_percent: Math.round(Number(p.risk_score) * 100),
        risk_level: p.risk_level,
        model_version: p.model_version,
        predicted_at: p.predicted_at,
      }));
    },
  },
};

function sendCsv(res, type, dataset, items) {
  const csv = objectsToCsv(items, dataset.columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${type}.csv"`);
  res.send(csv);
}

async function sendXlsx(res, type, dataset, items) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Reporte');
  ws.columns = dataset.columns.map((c) => ({ header: c, key: c, width: 22 }));
  ws.getRow(1).font = { bold: true };
  items.forEach((item) => ws.addRow(item));
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${type}.xlsx"`);
  res.send(Buffer.from(buffer));
}

function sendPdf(res, type, dataset, items) {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${type}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(dataset.title, { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#666')
    .text(`Generado: ${new Date().toLocaleString('es-MX')} · ${items.length} registros`);
  doc.moveDown(0.8).fillColor('#000');

  const cols = dataset.columns;
  const startX = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usable / cols.length;
  let y = doc.y;

  const drawRow = (values, { bold = false } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    cols.forEach((_, i) => {
      doc.text(String(values[i] ?? ''), startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
    });
    y += 16;
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  };

  drawRow(cols, { bold: true });
  doc.moveTo(startX, y - 2).lineTo(startX + usable, y - 2).stroke('#ccc');
  items.forEach((item) => drawRow(cols.map((c) => item[c])));

  doc.end();
}

/**
 * Exporta un reporte. Query: type=students|predictions, format=csv|xlsx|pdf.
 */
export async function exportReport(req, res, next) {
  try {
    const institutionId = requireInstitution(req);
    const type = String(req.query.type || 'students');
    const format = String(req.query.format || 'csv').toLowerCase();

    const dataset = DATASETS[type];
    if (!dataset) {
      return res.status(400).json({ error: `type invalido. Opciones: ${Object.keys(DATASETS).join(', ')}` });
    }
    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format invalido. Opciones: csv, xlsx, pdf' });
    }

    const items = await dataset.fetch(institutionId);
    await audit(req, 'EXPORT', type, null, { format, rows: items.length });

    if (format === 'csv') return sendCsv(res, type, dataset, items);
    if (format === 'xlsx') return sendXlsx(res, type, dataset, items);
    return sendPdf(res, type, dataset, items);
  } catch (e) {
    next(e);
  }
}
