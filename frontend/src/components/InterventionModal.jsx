import { useEffect } from 'react';
import Modal from './ui/Modal.jsx';
import { useInterventionSuggestion } from '../hooks/useAI.js';
import { mensajeError } from '../lib/utils.js';

// Render mínimo de Markdown: encabezados, listas y párrafos. Suficiente para
// mostrar la recomendación de Gemini sin agregar dependencias.
function renderMarkdown(texto) {
  const lines = String(texto).split('\n');
  const blocks = [];
  let list = [];
  const flushList = (key) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc space-y-1 pl-5 text-sm text-ink/80">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList(idx);
      return;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    const clean = (t) => t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    if (heading) {
      flushList(idx);
      blocks.push(
        <h3 key={idx} className="mt-3 text-sm font-semibold text-ink">
          {clean(heading[1])}
        </h3>,
      );
    } else if (bullet) {
      list.push(clean(bullet[1]));
    } else {
      flushList(idx);
      blocks.push(
        <p key={idx} className="text-sm text-ink/80">
          {clean(line)}
        </p>,
      );
    }
  });
  flushList('end');
  return blocks;
}

export default function InterventionModal({ open, onClose, alert }) {
  const suggest = useInterventionSuggestion();
  const { mutate, reset, data, isPending, isError, error } = suggest;

  useEffect(() => {
    if (open && alert) {
      reset();
      mutate({ studentId: alert.alumno_id, alertId: alert.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alert?.id]);

  return (
    <Modal
      open={open}
      title={`Intervención sugerida${alert?.alumnos ? ` · ${alert.alumnos.nombre_completo}` : ''}`}
      onClose={onClose}
    >
      {isPending && (
        <p className="text-sm text-ink/60">Generando recomendación con IA (Gemini)…</p>
      )}

      {isError && (
        <div className="space-y-3">
          <p className="text-sm text-risk-high">
            {mensajeError(error, 'No fue posible generar la recomendación.')}
          </p>
          <button
            onClick={() => mutate({ studentId: alert.alumno_id, alertId: alert.id })}
            className="rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary-light"
          >
            Reintentar
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <div className="space-y-2">{renderMarkdown(data.recomendacion)}</div>
          <p className="pt-2 text-xs text-ink/40">
            Sugerencia generada por IA. Revísala con criterio profesional antes de aplicarla.
          </p>
        </div>
      )}
    </Modal>
  );
}
