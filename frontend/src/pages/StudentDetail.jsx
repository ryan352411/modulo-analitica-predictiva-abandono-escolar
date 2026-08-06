import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Pencil, ClipboardPlus } from 'lucide-react';
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
import { useStudent, useGeneratePrediction } from '../hooks/useStudents.js';

export default function StudentDetail() {
  const { id } = useParams();
  const { data: student, isLoading } = useStudent(id);
  const predict = useGeneratePrediction(id);
  const [recordOpen, setRecordOpen] = useState(false);
  const [predictionError, setPredictionError] = useState('');

  if (isLoading) return <p className="text-ink/60">Cargando expediente…</p>;
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
          <Link
            to={`/estudiantes/${id}/editar`}
            className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
          >
            <Pencil className="h-4 w-4" /> Editar
          </Link>
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
