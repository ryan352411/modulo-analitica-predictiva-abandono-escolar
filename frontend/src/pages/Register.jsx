import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, School, Users, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import EducationArt from '../components/EducationArt.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form.full_name, form.email, form.password);
      navigate(user && !user.institution_id ? '/onboarding' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold">Analítica Predictiva</p>
            <p className="text-sm text-white/70">Abandono Escolar</p>
          </div>
        </div>

        <div className="relative my-8">
          <h2 className="mb-2 max-w-md text-3xl font-bold leading-tight">
            Crea tu cuenta y empieza a cuidar a tus estudiantes
          </h2>
          <p className="mb-6 max-w-md text-sm text-white/75">
            Regístrate para administrar tu escuela, dar seguimiento a los alumnos y recibir alertas
            tempranas.
          </p>

          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <EducationArt className="w-full" />
          </div>
        </div>

        <div className="relative flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
            <Users className="h-3.5 w-3.5" /> Estudiantes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
            <School className="h-3.5 w-3.5" /> Escuelas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
            <Bell className="h-3.5 w-3.5" /> Alertas tempranas
          </span>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center bg-paper p-6 sm:p-10">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex flex-col items-center gap-2">
            <GraduationCap className="h-10 w-10 text-primary" />
            <h1 className="text-center text-lg font-semibold leading-tight">Crea tu cuenta</h1>
            <p className="text-center text-sm text-ink/50">Regístrate para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre completo</label>
              <input
                type="text"
                required
                maxLength={120}
                value={form.full_name}
                onChange={set('full_name')}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Correo institucional</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirm}
                onChange={set('confirm')}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-risk-high">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? 'Creando cuenta…' : 'Registrarse'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink/60">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
