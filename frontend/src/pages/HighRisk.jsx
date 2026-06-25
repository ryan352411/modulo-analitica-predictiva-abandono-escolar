import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { useHighRisk } from '../hooks/useStudents.js';

export default function HighRisk() {
  const { data, isLoading } = useHighRisk();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 text-risk-high" /> Estudiantes en riesgo alto
      </h1>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Matrícula</th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Riesgo</th>
                <th className="px-5 py-3 font-medium">Nivel</th>
                <th className="px-5 py-3 font-medium">Última predicción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-5 py-6 text-ink/50">Cargando…</td></tr>}
              {data?.map((p) => (
                <tr key={p.id} className="border-b border-ink/5 hover:bg-primary-light/40">
                  <td className="px-5 py-3 tabular-nums">{p.students?.matricula}</td>
                  <td className="px-5 py-3">
                    <Link to={`/estudiantes/${p.student_id}`} className="font-medium text-primary hover:underline">
                      {p.students?.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 tabular-nums font-semibold">{(Number(p.risk_score) * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3"><RiskBadge level={p.risk_level} /></td>
                  <td className="px-5 py-3 text-ink/60">{new Date(p.predicted_at).toLocaleString('es-MX')}</td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-ink/50">Sin estudiantes en riesgo alto. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
