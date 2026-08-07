import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { mensajeError } from '../lib/utils.js';

const ACTIONS = [
  '',
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'PREDICT',
  'PREDICT_BATCH',
  'IMPORT',
  'EXPORT',
  'RETRAIN',
];

export default function AuditLogs() {
  const [accion, setAccion] = useState('');
  const [usuario, setUsuario] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [page, setPage] = useState(1);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', { accion, usuario, fechaInicio, fechaFin, page }],
    queryFn: async () =>
      (
        await api.get('/audit-logs', {
          params: {
            accion: accion || undefined,
            usuario: usuario || undefined,
            fecha_inicio: fechaInicio || undefined,
            fecha_fin: fechaFin || undefined,
            page,
            limit: 50,
          },
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" /> Auditoría
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={usuario}
            onChange={(e) => {
              setUsuario(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm"
          >
            <option value="">Todos los usuarios</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm"
          />
          <select
            value={accion}
            onChange={(e) => {
              setAccion(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'Todas las acciones'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-risk-high">
          {mensajeError(error, 'No fue posible cargar la auditoría.')}
        </p>
      )}

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Entidad</th>
                <th className="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-ink/50">
                    Cargando…
                  </td>
                </tr>
              )}
              {data?.data?.map((log) => (
                <tr key={log.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 text-ink/70">
                    {new Date(log.creado_en).toLocaleString('es-MX')}
                  </td>
                  <td className="px-5 py-3 font-medium">{log.accion}</td>
                  <td className="px-5 py-3 text-ink/70">{log.entidad ?? '—'}</td>
                  <td className="px-5 py-3 text-ink/50 tabular-nums">{log.direccion_ip ?? '—'}</td>
                </tr>
              ))}
              {data?.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-ink/50">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {data && data.total > data.limit && (
        <div className="flex items-center gap-3 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-ink/20 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-ink/60">
            Página {page} de {Math.ceil(data.total / data.limit)}
          </span>
          <button
            disabled={page >= Math.ceil(data.total / data.limit)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-ink/20 px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
