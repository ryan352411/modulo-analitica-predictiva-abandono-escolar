import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, LogOut } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Input } from '../components/ui/Field.jsx';

// Vista previa del prefijo (iniciales) que se usará en las matrículas.
function prefijoDe(nombre = '') {
  const stop = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'para', 'por']);
  const s = String(nombre)
    .trim()
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return s || 'ESC';
}

export default function Onboarding() {
  const { user, completeOnboarding, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', codigo: '', direccion: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/institutions', form);
      completeOnboarding(data.data.id);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible crear la escuela');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <School className="h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold leading-tight">Crea tu escuela</h1>
          <p className="text-sm text-ink/60">
            Hola{user?.full_name ? `, ${user.full_name}` : ''}. Para empezar, registra la escuela
            que vas a administrar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre de la escuela" hint={`Prefijo de matrícula: ${prefijoDe(form.nombre)}`}>
            <Input required maxLength={120} value={form.nombre} onChange={set('nombre')} placeholder="Instituto Tecnológico Central" />
          </Field>
          <Field label="Clave de trabajo">
            <Input required maxLength={20} value={form.codigo} onChange={set('codigo')} />
          </Field>
          <Field label="Dirección" hint="Opcional">
            <Input maxLength={200} value={form.direccion} onChange={set('direccion')} />
          </Field>

          {error && <p className="text-sm text-risk-high">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? 'Creando…' : 'Crear escuela y continuar'}
          </button>
        </form>

        <button
          onClick={logout}
          className="mt-4 mx-auto flex items-center gap-2 text-xs text-ink/50 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
