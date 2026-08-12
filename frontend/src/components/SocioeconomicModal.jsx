import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import { useSocioeconomicEstimate } from '../hooks/useAI.js';
import { mensajeError } from '../lib/utils.js';

// Cuestionario tipo AMAI simplificado para estimar el nivel socioeconómico.
const PREGUNTAS = [
  {
    label: 'Escolaridad de quien más aporta al gasto del hogar',
    options: [
      'Sin estudios',
      'Primaria',
      'Secundaria',
      'Preparatoria o carrera técnica',
      'Licenciatura',
      'Posgrado',
    ],
  },
  {
    label: 'Personas que aportan ingreso en el hogar',
    options: ['Ninguna', '1', '2', '3 o más'],
  },
  {
    label: 'Número de dormitorios (habitaciones para dormir) en la vivienda',
    options: ['1', '2', '3', '4 o más'],
  },
  {
    label: 'Número de baños completos con regadera',
    options: ['0', '1', '2 o más'],
  },
  {
    label: 'Automóviles propios en el hogar',
    options: ['0', '1', '2 o más'],
  },
  {
    label: '¿Cuentan con internet fijo en casa?',
    options: ['Sí', 'No'],
  },
  {
    label: 'Tipo de vivienda',
    options: ['Propia', 'Rentada', 'Prestada o de un familiar'],
  },
];

export default function SocioeconomicModal({ open, onClose, onApply }) {
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);
  const estimate = useSocioeconomicEstimate();

  function set(label) {
    return (e) => setRespuestas((r) => ({ ...r, [label]: e.target.value }));
  }

  function reset() {
    setRespuestas({});
    setResultado(null);
    estimate.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function evaluar(e) {
    e.preventDefault();
    setResultado(null);
    try {
      const data = await estimate.mutateAsync(respuestas);
      setResultado(data);
    } catch {
      /* el error se muestra desde estimate.error */
    }
  }

  const completas = PREGUNTAS.every((p) => respuestas[p.label]);

  return (
    <Modal open={open} title="Estimar mi nivel socioeconómico" onClose={handleClose}>
      {!resultado ? (
        <form onSubmit={evaluar} className="space-y-4">
          <p className="text-sm text-ink/60">
            Responde estas preguntas y la IA (Gemini) estimará tu nivel socioeconómico. Es solo una
            aproximación; podrás revisar el resultado antes de aplicarlo.
          </p>
          {PREGUNTAS.map((p) => (
            <div key={p.label}>
              <label className="mb-1 block text-sm font-medium">{p.label}</label>
              <select
                required
                value={respuestas[p.label] || ''}
                onChange={set(p.label)}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecciona…</option>
                {p.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {estimate.isError && (
            <p className="text-sm text-risk-high">
              {mensajeError(estimate.error, 'No fue posible estimar el nivel socioeconómico.')}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!completas || estimate.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {estimate.isPending ? 'Evaluando…' : 'Evaluar con IA'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-primary-light p-4">
            <p className="text-sm text-ink/60">Nivel socioeconómico estimado</p>
            <p className="text-2xl font-semibold text-primary">{resultado.nivel_label}</p>
          </div>
          {resultado.justificacion && (
            <p className="text-sm text-ink/70">{resultado.justificacion}</p>
          )}
          <p className="text-xs text-ink/40">
            Estimación generada por IA a partir de tus respuestas. Verifícala antes de guardar.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
            >
              Volver a responder
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(resultado.nivel);
                handleClose();
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Usar este nivel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
