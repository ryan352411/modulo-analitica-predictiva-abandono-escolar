import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, Download, Sparkles } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Modal from '../components/ui/Modal.jsx';
import { useStudents, useBatchPredictions, useImportStudents } from '../hooks/useStudents.js';
import { downloadReport } from '../lib/download.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ESTATUS_ALUMNO, mensajeError } from '../lib/utils.js';

export default function Students() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'coordinador';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [batchResult, setBatchResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const { data, isLoading, error } = useStudents({
    search,
    status: status || undefined,
    page,
    limit: 20,
  });
  const batch = useBatchPredictions();
  const importer = useImportStudents();

  async function onExport(format) {
    try {
      await downloadReport('students', format);
    } catch {
      setNotice('No fue posible exportar el reporte.');
    }
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importer.mutate(String(reader.result), {
        onSuccess: (res) => setImportResult(res),
        onError: (err) => setNotice(mensajeError(err, 'Error al importar el CSV.')),
      });
    };
    reader.readAsText(file);
  }

  function onBatch() {
    setNotice('');
    batch.mutate(undefined, {
      onSuccess: (s) => setBatchResult(s),
      onError: (err) => setNotice(err.response?.data?.error || 'Error al generar el lote.'),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Estudiantes</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink/40" />
            <input
              placeholder="Buscar por nombre o matrícula"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-md border border-ink/20 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos los estatus</option>
            {ESTATUS_ALUMNO.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {canManage && (
            <>
              <button
                onClick={onBatch}
                disabled={batch.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" /> {batch.isPending ? 'Generando…' : 'Generar lote'}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importer.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-3 py-2 text-sm hover:bg-ink/5 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" /> Importar CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onPickFile}
                className="hidden"
              />
            </>
          )}

          {canManage && (
            <div className="inline-flex items-center rounded-md border border-ink/20 text-sm overflow-hidden">
              <span className="px-2 text-ink/40">
                <Download className="h-4 w-4" />
              </span>
              {['csv', 'xlsx', 'pdf'].map((f) => (
                <button
                  key={f}
                  onClick={() => onExport(f)}
                  className="px-2.5 py-2 hover:bg-ink/5 uppercase text-xs font-medium"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {canManage && (
            <Link
              to="/estudiantes/nuevo"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-md bg-primary-light/60 px-4 py-2 text-sm text-ink/80">{notice}</div>
      )}

      {error && (
        <p className="text-sm text-risk-high">
          {mensajeError(error, 'No fue posible cargar los estudiantes.')}
        </p>
      )}

      <Modal
        open={Boolean(batchResult)}
        onClose={() => setBatchResult(null)}
        title="Resultado de la predicción por lote"
      >
        {batchResult && (
          <div className="space-y-5">
            <p className="text-sm text-ink/70">
              Se procesaron los estudiantes activos de la institución. Este es el resumen:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink/10 p-4">
                <p className="text-2xl font-semibold tabular-nums">{batchResult.total}</p>
                <p className="text-xs text-ink/60">Estudiantes evaluados</p>
              </div>
              <div className="rounded-lg border border-ink/10 p-4">
                <p className="text-2xl font-semibold tabular-nums text-primary">
                  {batchResult.generated}
                </p>
                <p className="text-xs text-ink/60">Predicciones generadas</p>
              </div>
              <div className="rounded-lg border border-risk-high/30 bg-risk-high/5 p-4">
                <p className="text-2xl font-semibold tabular-nums text-risk-high">
                  {batchResult.high_risk}
                </p>
                <p className="text-xs text-ink/60">En riesgo alto o crítico</p>
              </div>
              <div className="rounded-lg border border-ink/10 p-4">
                <p className="text-2xl font-semibold tabular-nums text-ink/50">
                  {batchResult.skipped}
                </p>
                <p className="text-xs text-ink/60">Omitidos (sin registro académico)</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Link
                to="/riesgo-alto"
                onClick={() => setBatchResult(null)}
                className="rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary-light"
              >
                Ver riesgo alto
              </Link>
              <button
                onClick={() => setBatchResult(null)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title="Resultado de la importación"
      >
        {importResult && (
          <div className="space-y-4">
            <p className="text-sm text-ink/70">
              Se importaron <strong>{importResult.imported}</strong> estudiantes
              {importResult.errors?.length
                ? `, con ${importResult.errors.length} fila(s) con error:`
                : ' sin errores.'}
            </p>
            {importResult.errors?.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-ink/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-ink/60">
                      <th className="px-4 py-2 font-medium">Fila</th>
                      <th className="px-4 py-2 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e, i) => (
                      <tr key={i} className="border-b border-ink/5">
                        <td className="px-4 py-2 tabular-nums">{e.row}</td>
                        <td className="px-4 py-2 text-ink/70">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setImportResult(null)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </Modal>

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
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-ink/50">
                    Cargando…
                  </td>
                </tr>
              )}
              {data?.data?.map((s) => (
                <tr key={s.id} className="border-b border-ink/5 hover:bg-primary-light/40">
                  <td className="px-5 py-3 tabular-nums">{s.matricula}</td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/estudiantes/${s.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.nombre_completo}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink/70">{s.programa}</td>
                  <td className="px-5 py-3">{s.semestre_actual}</td>
                  <td className="px-5 py-3 capitalize">{s.estatus?.replace('_', ' ')}</td>
                </tr>
              ))}
              {data?.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-ink/50">
                    Sin resultados.
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
