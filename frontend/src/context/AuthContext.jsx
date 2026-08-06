import { createContext, useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      sessionStorage.clear();
      return null;
    }
  });

  function persistSession(data) {
    queryClient.clear();
    sessionStorage.setItem('token', data.token);
    if (data.refresh_token) sessionStorage.setItem('refresh_token', data.refresh_token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    persistSession(data);
  }

  async function register(full_name, email, password) {
    const { data } = await api.post('/auth/register', { full_name, email, password });
    return persistSession(data);
  }

  async function loginWithGoogle(credential) {
    const { data } = await api.post('/auth/google', { credential });
    return persistSession(data);
  }

  function completeOnboarding(institutionId) {
    setUser((u) => {
      const next = { ...u, institution_id: institutionId };
      sessionStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }

  async function logout() {
    const refresh_token = sessionStorage.getItem('refresh_token');
    try {
      await api.post('/auth/logout', { refresh_token });
    } catch {}
    sessionStorage.clear();
    setUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{ user, login, register, loginWithGoogle, completeOnboarding, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
