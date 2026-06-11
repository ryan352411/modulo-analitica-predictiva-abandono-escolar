import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { cn } from '../lib/utils.js';

const severityStyle = {
  info: 'bg-primary-light text-primary',
  media: 'bg-risk-mid/10 text-risk-mid',
  alta: 'bg-risk-high/10 text-risk-high',
  critica: 'bg-risk-high text-white',
};

export default function Alerts() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await api.get('/alerts')).data.data,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/alerts/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Alertas</h1>

      {isLoading && <p className="text-ink/60">Cargando alertas…</p>}

      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id}>
            <CardBody className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', severityStyle[a.severity])}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-ink/50">
                    {new Date(a.created_at).toLocaleString('es-MX')}
                  </span>
                </div>
                <p className="font-medium">{a.title}</p>
                {a.message && <p className="text-sm text-ink/70">{a.message}</p>}
                {a.students && (
                  <Link to={`/estudiantes/${a.student_id}`} className="text-sm text-primary hover:underline">
                    Ver expediente de {a.students.full_name} ({a.students.matricula})
                  </Link>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs capitalize text-ink/60">{a.status.replace('_', ' ')}</span>
                {a.status === 'pendiente' && (
                  <button
                    onClick={() => update.mutate({ id: a.id, status: 'en_atencion' })}
                    className="rounded-md border border-primary px-3 py-1 text-xs text-primary hover:bg-primary-light"
                  >
                    Tomar en atención
                  </button>
                )}
                {a.status === 'en_atencion' && (
                  <button
                    onClick={() => update.mutate({ id: a.id, status: 'resuelta' })}
                    className="rounded-md bg-risk-low px-3 py-1 text-xs text-white hover:opacity-90"
                  >
                    Marcar resuelta
                  </button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
        {data?.length === 0 && (
          <p className="text-sm text-ink/50">
            No hay alertas. Se generarán automáticamente cuando una predicción resulte en riesgo alto.
          </p>
        )}
      </div>
    </div>
  );
}
