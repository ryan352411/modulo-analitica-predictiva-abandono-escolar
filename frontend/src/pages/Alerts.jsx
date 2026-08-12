import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import InterventionModal from '../components/InterventionModal.jsx';
import { cn, ESTATUS_ALERTA, SEVERIDAD_ALERTA, mensajeError } from '../lib/utils.js';

const severityStyle = {
  info: 'bg-primary-light text-primary',
  media: 'bg-risk-mid/10 text-risk-mid',
  alta: 'bg-risk-high/10 text-risk-high',
  critica: 'bg-risk-high text-white',
};

export default function Alerts() {
  const qc = useQueryClient();
  const [estatus, setEstatus] = useState('');
  const [severidad, setSeveridad] = useState('');
  const [intervencion, setIntervencion] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', { estatus, severidad }],
    queryFn: async () =>
      (
        await api.get('/alerts', {
          params: { status: estatus || undefined, severity: severidad || undefined },
        })
      ).data.data,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/alerts/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Alertas</h1>
        <div className="flex items-center gap-2">
          <select
            value={estatus}
            onChange={(e) => setEstatus(e.target.value)}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos los estatus</option>
            {ESTATUS_ALERTA.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value)}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas las severidades</option>
            {SEVERIDAD_ALERTA.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-risk-high">
          {mensajeError(error, 'No fue posible cargar las alertas.')}
        </p>
      )}

      {isLoading && <p className="text-ink/60">Cargando alertas…</p>}

      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id}>
            <CardBody className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      severityStyle[a.severidad],
                    )}
                  >
                    {a.severidad}
                  </span>
                  <span className="text-xs text-ink/50">
                    {new Date(a.creado_en).toLocaleString('es-MX')}
                  </span>
                </div>
                <p className="font-medium">{a.titulo}</p>
                {a.mensaje && <p className="text-sm text-ink/70">{a.mensaje}</p>}
                {a.alumnos && (
                  <Link
                    to={`/estudiantes/${a.alumno_id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver expediente de {a.alumnos.nombre_completo} ({a.alumnos.matricula})
                  </Link>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs capitalize text-ink/60">
                  {a.estatus?.replace('_', ' ')}
                </span>
                {a.alumno_id && (
                  <button
                    onClick={() => setIntervencion(a)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Sugerir intervención (IA)
                  </button>
                )}
                {a.estatus === 'pendiente' && (
                  <button
                    onClick={() => update.mutate({ id: a.id, status: 'en_atencion' })}
                    className="rounded-md border border-primary px-3 py-1 text-xs text-primary hover:bg-primary-light"
                  >
                    Tomar en atención
                  </button>
                )}
                {a.estatus === 'en_atencion' && (
                  <button
                    onClick={() => update.mutate({ id: a.id, status: 'resuelta' })}
                    className="rounded-md bg-risk-low px-3 py-1 text-xs text-white hover:opacity-90"
                  >
                    Marcar resuelta
                  </button>
                )}
                {(a.estatus === 'pendiente' || a.estatus === 'en_atencion') && (
                  <button
                    onClick={() => update.mutate({ id: a.id, status: 'descartada' })}
                    className="rounded-md border border-ink/20 px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
        {data?.length === 0 && (
          <p className="text-sm text-ink/50">
            No hay alertas. Se generarán automáticamente cuando una predicción resulte en riesgo
            alto.
          </p>
        )}
      </div>

      <InterventionModal
        open={Boolean(intervencion)}
        alert={intervencion}
        onClose={() => setIntervencion(null)}
      />
    </div>
  );
}
