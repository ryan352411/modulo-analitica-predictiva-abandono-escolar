import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, School, Users, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import EducationArt from '../components/EducationArt.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleLogo({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtn = useRef(null);

  function goAfterLogin(user) {
    navigate(user && !user.institution_id ? '/onboarding' : '/');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    async function handleCredential(response) {
      setError('');
      try {
        const user = await loginWithGoogle(response.credential);
        goAfterLogin(user);
      } catch (err) {
        setError(err.response?.data?.error || 'No fue posible iniciar sesión con Google');
      }
    }

    function init() {
      if (!window.google || !googleBtn.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(googleBtn.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
        locale: 'es',
      });
    }

    if (window.google) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            Ayudamos a que más estudiantes terminen su carrera
          </h2>
          <p className="mb-6 max-w-md text-sm text-white/75">
            Detecta a tiempo a los alumnos que necesitan apoyo y actúa antes de que abandonen la
            escuela.
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
            <h1 className="text-center text-lg font-semibold leading-tight">
              Analítica Predictiva de Abandono Escolar
            </h1>
            <p className="text-center text-sm text-ink/50">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Correo institucional</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-risk-high">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>

          {GOOGLE_CLIENT_ID ? (
            <div className="mt-5 flex justify-center" ref={googleBtn} />
          ) : (
            <button
              type="button"
              onClick={() => setError('El inicio de sesión con Google aún no está configurado.')}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-ink/20 bg-white py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              <GoogleLogo /> Iniciar sesión con Google
            </button>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-ink/40">
            <span className="h-px flex-1 bg-ink/10" />
            ¿Aún no tienes cuenta?
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <Link
            to="/registro"
            className="flex w-full items-center justify-center rounded-md border border-primary py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}
