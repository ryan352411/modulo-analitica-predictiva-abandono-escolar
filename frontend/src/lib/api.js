import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Adjunta el JWT a cada petición
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey) config.headers.apikey = publishableKey;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Cola de peticiones mientras se renueva el token, para no lanzar N refresh a la vez.
let refreshing = null;

async function renewAccessToken() {
  const refresh_token = sessionStorage.getItem('refresh_token');
  if (!refresh_token) throw new Error('sin refresh token');
  // Instancia limpia para evitar el interceptor de respuesta (recursión).
  const { data } = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    { refresh_token },
    { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined } }
  );
  sessionStorage.setItem('token', data.token);
  return data.token;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const isAuthCall = original?.url?.includes('/auth/');

    if (status === 401 && !original?._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing = refreshing || renewAccessToken();
        const newToken = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshing = null;
        sessionStorage.clear();
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    if (status === 401 && window.location.pathname !== '/login') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
