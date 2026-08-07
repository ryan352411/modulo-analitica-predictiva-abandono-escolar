import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Pencil, ClipboardPlus, Trash2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import RecordFormModal from '../components/RecordFormModal.jsx';
import { useStudent, useGeneratePrediction, useStudentTrend } from '../hooks/useStudents.js';
import { useDeleteStudent } from '../hooks/useStudentMutations.js';
import { useAuth } from '../context/AuthContext.jsx';
import { mensajeError } from '../lib/utils.js';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: student, isLoading, error } = useStudent(id);
  const { data: trend } = useStudentTrend(id);
  const predict = useGeneratePrediction(id);
  const deleteStudent = useDeleteStudent();
  const [recordOpen, setRecordOpen] = useState(false);
  const [predictionError, setPredictionError] = useState('');

  const isAdmin = user?.role === 'admin';
  const canManage = user?.role === 'admin' || user?.role === 'coordinador';

  function onDelete() {
    const ok = window.confirm(
      `¿Eliminar a ${student.nombre_completo}?\n\nEl borrado es físico y en cascada: se eliminarán también su historial académico, sus predicciones y sus alertas. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    deleteStudent.mutate(id, {
      onSuccess: () => navigate('/estudiantes'),
      onError: (err) => window.alert(mensajeError(err, 'No fue posible eliminar al estudiante')),
    });
  }

  if (isLoading) return <p className="text-ink/60">Cargando expediente…</p>;
  if (error) {
    const noEncontrado = error.response?.status === 404;
    return (
      <p className="text-risk-high">
        {noEncontrado
          ? 'Estudiante no encontrado.'
          : mensajeError(error, 'No fue posible cargar el expediente.')}
      </p>
    );
  }
  if (!student) return <p className="text-risk-high">Estudiante no encontrado.</p>;

  const records = [...(student.historial_academico ?? [])].sort((a, b) =>
    a.periodo.localeCompare(b.periodo),
  );
  const predictions = [...(student.predicciones ?? [])].sort(
    (a, b) => new Date(b.predicho_en) - new Date(a.predicho_en),
  );
  const latest = predictions[0];

  return (
    <div className="space-y-6">
      <Link
        to="/estudiantes"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a estudiantes
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{student.nombre_completo}</h1>
          <p className="text-ink/60 text-sm">
            {student.matricula} · {student.programa} · Semestre {student.semestre_actual}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {latest && <RiskBadge level={latest.nivel_riesgo} />}
          {canManage && (
            <Link
              to={`/estudiantes/${id}/editar`}
              className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          )}
          <button
            onClick={() => setRecordOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary-light"
          >
            <ClipboardPlus className="h-4 w-4" /> Capturar registro
          </button>
          <button
            onClick={() => {
              setPredictionError('');
              predict.mutate(undefined, {
                onError: (err) => {
                  setPredictionError(
                    err.response?.data?.error || 'No fue posible generar la prediccion',
                  );
                },
              });
            }}
            disabled={predict.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {predict.isPending ? 'Calculando…' : 'Generar predicción'}
          </button>
          {isAdmin && (
            <button
              onClick={onDelete}
              disabled={deleteStudent.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-risk-high px-4 py-2 text-sm text-risk-high hover:bg-risk-high/5 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> {deleteStudent.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>
      {predictionError && <p className="text-sm text-risk-high">{predictionError}</p>}

      <RecordFormModal studentId={id} open={recordOpen} onClose={() => setRecordOpen(false)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Trayectoria académica" subtitle="Promedio por periodo" />
          <CardBody className="h-64">
            {records.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={records}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="periodo" fontSize={12} />
                  <YAxis domain={[0, 10]} fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="promedio"
                    name="Promedio"
                    stroke="#1E5AA8"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-ink/50">
                Sin registros académicos. Captura el primero para habilitar la gráfica.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Última predicción"
            subtitle={
              latest ? new Date(latest.predicho_en).toLocaleString('es-MX') : 'Sin predicciones'
            }
          />
          <CardBody>
            {latest ? (
              <div className="space-y-4">
                <p className="text-4xl font-semibold tabular-nums">
                  {(latest.puntaje_riesgo * 100).toFixed(1)}%
                  <span className="ml-2 align-middle">
                    <RiskBadge level={latest.nivel_riesgo} />
                  </span>
                </p>
                <div>
                  <p className="text-sm font-medium mb-2">Factores principales</p>
                  <ul className="space-y-1.5">
                    {(latest.factores_contribuyentes ?? []).map((f) => (
                      <li key={f.feature} className="flex items-center justify-between text-sm">
                        <span className="text-ink/70">{f.label}</span>
                        <span className="tabular-nums text-ink/50">
                          {(f.importance * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-ink/40">Modelo: {latest.version_modelo}</p>
              </div>
            ) : (
              <p className="text-sm text-ink/50">
                Genera la primera predicción con el botón superior.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historial académico" subtitle="Registros capturados por periodo" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Periodo</th>
                <th className="px-5 py-3 font-medium">Promedio</th>
                <th className="px-5 py-3 font-medium">Asistencia</th>
                <th className="px-5 py-3 font-medium">Reprobadas</th>
                <th className="px-5 py-3 font-medium">Entregas pend.</th>
                <th className="px-5 py-3 font-medium">Créditos</th>
                <th className="px-5 py-3 font-medium">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 tabular-nums">{r.periodo}</td>
                  <td className="px-5 py-3 tabular-nums">{r.promedio}</td>
                  <td className="px-5 py-3 tabular-nums">{r.tasa_asistencia}%</td>
                  <td className="px-5 py-3 tabular-nums">{r.materias_reprobadas}</td>
                  <td className="px-5 py-3 tabular-nums">{r.entregas_pendientes}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {r.creditos_obtenidos}/{r.creditos_totales}
                  </td>
                  <td className="px-5 py-3 text-ink/60">{r.observaciones || '—'}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-ink/50">
                    Sin registros académicos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Evolución del riesgo" subtitle="Porcentaje de riesgo por predicción" />
        <CardBody className="h-64">
          {trend && trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="predicho_en"
                  fontSize={12}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('es-MX')}
                />
                <YAxis domain={[0, 100]} fontSize={12} unit="%" />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleString('es-MX')}
                  formatter={(value) => [`${value}%`, 'Riesgo']}
                />
                <Line
                  type="monotone"
                  dataKey="risk_percent"
                  name="Riesgo"
                  stroke="#D14545"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-ink/50">
              Aún no hay predicciones para graficar la evolución del riesgo.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Historial de predicciones" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Riesgo</th>
                <th className="px-5 py-3 font-medium">Nivel</th>
                <th className="px-5 py-3 font-medium">Modelo</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.id} className="border-b border-ink/5">
                  <td className="px-5 py-3">{new Date(p.predicho_en).toLocaleString('es-MX')}</td>
                  <td className="px-5 py-3 tabular-nums">{(p.puntaje_riesgo * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3">
                    <RiskBadge level={p.nivel_riesgo} />
                  </td>
                  <td className="px-5 py-3 text-ink/60">{p.version_modelo}</td>
                </tr>
              ))}
              {predictions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-ink/50">
                    Sin predicciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
