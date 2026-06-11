import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { useStudents } from '../hooks/useStudents.js';

export default function Students() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStudents({ search, page, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estudiantes</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink/40" />
            <input
              placeholder="Buscar por nombre o matrícula"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-72 rounded-md border border-ink/20 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Link
            to="/estudiantes/nuevo"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Nuevo estudiante
          </Link>
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Matrícula</th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Programa</th>
                <th className="px-5 py-3 font-medium">Semestre</th>
                <th className="px-5 py-3 font-medium">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-6 text-ink/50">Cargando…</td></tr>
              )}
              {data?.data?.map((s) => (
                <tr key={s.id} className="border-b border-ink/5 hover:bg-primary-light/40">
                  <td className="px-5 py-3 tabular-nums">{s.matricula}</td>
                  <td className="px-5 py-3">
                    <Link to={`/estudiantes/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink/70">{s.program}</td>
                  <td className="px-5 py-3">{s.current_semester}</td>
                  <td className="px-5 py-3 capitalize">{s.status?.replace('_', ' ')}</td>
                </tr>
              ))}
              {data?.data?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-ink/50">Sin resultados.</td></tr>
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
