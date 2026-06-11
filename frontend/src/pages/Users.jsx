import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '../lib/utils.js';

const EMPTY = { full_name: '', email: '', password: '', role: 'docente' };

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data,
  });

  const create = useMutation({
    mutationFn: async (payload) => (await api.post('/users', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (err) => setError(err.response?.data?.error || 'No fue posible crear el usuario'),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }) => (await api.patch(`/users/${id}`, patch)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <button
          onClick={() => { setError(''); setOpen(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <UserPlus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Último acceso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-5 py-6 text-ink/50">Cargando…</td></tr>
              )}
              {data?.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">
                    {u.full_name}
                    {u.id === me?.id && <span className="ml-2 text-xs text-ink/40">(tú)</span>}
                  </td>
                  <td className="px-5 py-3 text-ink/70">{u.email}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={u.role}
                      onChange={(e) => update.mutate({ id: u.id, role: e.target.value })}
                      disabled={u.id === me?.id}
                    >
                      <option value="admin">Admin</option>
                      <option value="coordinador">Coordinador</option>
                      <option value="docente">Docente</option>
                    </Select>
                  </td>
                  <td className="px-5 py-3 text-ink/60">
                    {u.last_login ? new Date(u.last_login).toLocaleString('es-MX') : 'Nunca'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      u.is_active ? 'bg-risk-low/10 text-risk-low' : 'bg-ink/10 text-ink/50'
                    )}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}
                        className="text-xs text-primary hover:underline"
                      >
                        {u.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <form
          onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate(form); }}
          className="space-y-4"
        >
          <Field label="Nombre completo">
            <Input required value={form.full_name} onChange={set('full_name')} />
          </Field>
          <Field label="Correo institucional">
            <Input type="email" required value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Contraseña temporal" hint="Mínimo 8 caracteres">
            <Input type="password" required minLength={8} value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={set('role')}>
              <option value="docente">Docente</option>
              <option value="coordinador">Coordinador</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>

          {error && <p className="text-sm text-risk-high">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {create.isPending ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
