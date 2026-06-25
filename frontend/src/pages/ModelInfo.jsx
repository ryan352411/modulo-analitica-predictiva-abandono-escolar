import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';

export default function ModelInfo() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['model-info'],
    queryFn: async () => (await api.get('/model/info')).data.data,
  });

  const retrain = useMutation({
    mutationFn: async () => (await api.post('/model/retrain')).data.data,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['model-info'] });
      setNotice(`Reentrenamiento completado. ${res.metrics ? `AUC ${res.metrics.auc_roc}` : ''}`);
    },
    onError: (err) => setNotice(err.response?.data?.error || 'No fue posible reentrenar.'),
  });

  const service = data?.service;
  const metrics = service?.metrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" /> Modelo de IA
        </h1>
        <button
          onClick={() => { setNotice(''); retrain.mutate(); }}
          disabled={retrain.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${retrain.isPending ? 'animate-spin' : ''}`} />
          {retrain.isPending ? 'Reentrenando…' : 'Reentrenar'}
        </button>
      </div>

      {notice && <div className="rounded-md bg-primary-light/60 px-4 py-2 text-sm text-ink/80">{notice}</div>}

      {isLoading ? (
        <p className="text-ink/60">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Estado del servicio" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Modo" value={service?.mode} />
              <Row label="Disponible" value={service?.available ? 'Sí' : 'No'} />
              <Row label="Entrenado" value={service?.trained === false ? 'No' : 'Sí'} />
              <Row label="Versión usada" value={data?.last_used_version ?? '—'} />
              <Row
                label="Última predicción"
                value={data?.last_prediction_at ? new Date(data.last_prediction_at).toLocaleString('es-MX') : '—'}
              />
              {service?.error && <p className="text-risk-high text-xs">{service.error}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Métricas de entrenamiento" subtitle="Sobre conjunto de prueba" />
            <CardBody className="space-y-2 text-sm">
              {metrics ? (
                <>
                  <Row label="AUC-ROC" value={metrics.auc_roc} />
                  <Row label="Accuracy" value={metrics.accuracy} />
                  <Row label="F1" value={metrics.f1} />
                  <Row label="Recall" value={metrics.recall} />
                  <Row label="Muestras (train/test)" value={`${metrics.n_train ?? '—'} / ${metrics.n_test ?? '—'}`} />
                </>
              ) : (
                <p className="text-ink/50">
                  Sin métricas. Configura <code>ML_SERVICE_URL</code> y entrena el modelo para verlas.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/60">{label}</span>
      <span className="font-medium tabular-nums">{String(value)}</span>
    </div>
  );
}
