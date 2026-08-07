import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Users, Bell, Activity } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { useDashboardSummary } from '../hooks/useDashboard.js';
import { cn, riskHex } from '../lib/utils.js';

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
        <KpiCard
          icon={Users}
          label="Estudiantes activos"
          value={data.total_students}
          tone="primary"
        />
        <KpiCard icon={Bell} label="Alertas pendientes" value={data.active_alerts} tone="amber" />
        <KpiCard
          icon={Activity}
          label="Predicciones totales"
          value={data.total_predictions}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Distribución de riesgo" subtitle="Últimas 500 predicciones" />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.level} fill={riskHex[entry.level]} />
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
                    {new Date(p.predicho_en).toLocaleString('es-MX')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{(p.puntaje_riesgo * 100).toFixed(1)}%</span>
                    <RiskBadge level={p.nivel_riesgo} />
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

      <Card>
        <CardHeader
          title="Tendencia de riesgo"
          subtitle="Promedio mensual de las últimas predicciones"
        />
        <CardBody className="h-72">
          {data.risk_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.risk_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`, 'Riesgo promedio']} />
                <Line
                  type="monotone"
                  dataKey="avg_percent"
                  name="Riesgo promedio"
                  stroke="#3E5C9A"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-ink/50">
              Aún no hay suficientes predicciones para mostrar la tendencia.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

const KPI_TONES = {
  primary: 'bg-primary-light text-primary',
  accent: 'bg-accent-light text-accent',
  amber: 'bg-risk-mid/10 text-risk-mid',
};

function KpiCard({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={cn('rounded-lg p-3', KPI_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm text-ink/60">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}
