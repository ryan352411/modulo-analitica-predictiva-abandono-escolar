import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Users, Bell, Activity } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { useDashboardSummary } from '../hooks/useDashboard.js';

const RISK_COLORS = { bajo: '#2E9E6B', medio: '#E5A33D', alto: '#D14545' };

export default function Dashboard() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) return <p className="text-ink/60">Cargando indicadores…</p>;
  if (error) return <p className="text-risk-high">No fue posible cargar el dashboard.</p>;

  const pieData = Object.entries(data.risk_distribution).map(([level, value]) => ({
    name: `Riesgo ${level}`,
    level,
    value,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Users} label="Estudiantes activos" value={data.total_students} />
        <KpiCard icon={Bell} label="Alertas pendientes" value={data.active_alerts} />
        <KpiCard
          icon={Activity}
          label="Predicciones recientes"
          value={data.recent_predictions.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Distribución de riesgo" subtitle="Últimas 500 predicciones" />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {pieData.map((entry) => (
                    <Cell key={entry.level} fill={RISK_COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Predicciones recientes" />
          <CardBody>
            <ul className="divide-y divide-ink/5">
              {data.recent_predictions.map((p, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink/70">
                    {new Date(p.predicted_at).toLocaleString('es-MX')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{(p.risk_score * 100).toFixed(1)}%</span>
                    <RiskBadge level={p.risk_level} />
                  </div>
                </li>
              ))}
              {data.recent_predictions.length === 0 && (
                <li className="py-2 text-sm text-ink/50">
                  Aún no hay predicciones. Genera la primera desde el perfil de un estudiante.
                </li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="rounded-lg bg-primary-light p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-ink/60">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}
