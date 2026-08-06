import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Careers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'coordinador';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['careers'],
    queryFn: async () => (await api.get('/careers')).data.data,
  });

  const save = useMutation({
    mutationFn: async ({ id, nombre }) =>
      id
        ? (await api.patch(`/careers/${id}`, { nombre })).data.data
        : (await api.post('/careers', { nombre })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers'] });
      qc.invalidateQueries({ queryKey: ['programs'] });
      setOpen(false);
      setNombre('');
      setEditing(null);
    },
    onError: (err) => setError(err.response?.data?.error || 'No fue posible guardar la carrera'),
  });

  const remove = useMutation({
    mutationFn: async (id) => api.delete(`/careers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers'] });
      qc.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err) =>
      window.alert(err.response?.data?.error || 'No fue posible eliminar la carrera'),
  });

  function openCreate() {
    setEditing(null);
    setNombre('');
    setError('');
    setOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setNombre(c.nombre);
    setError('');
    setOpen(true);
  }

  function onSubmit(e) {
    e.preventDefault();
    setError('');
    save.mutate({ id: editing?.id, nombre });
  }

  function onDelete(c) {
    if (window.confirm(`¿Eliminar la carrera "${c.nombre}"?`)) remove.mutate(c.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Carreras
        </h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Nueva carrera
          </button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Carrera</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-ink/50">
                    Cargando…
                  </td>
                </tr>
              )}
              {data?.map((c) => (
                <tr key={c.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">{c.nombre}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(c)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => onDelete(c)}
                            className="inline-flex items-center gap-1 text-xs text-risk-high hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-ink/50">
                    Aún no hay carreras. Agrega la primera.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar carrera' : 'Nueva carrera'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nombre de la carrera">
            <Input
              required
              maxLength={120}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingeniería en Sistemas"
            />
          </Field>

          {error && <p className="text-sm text-risk-high">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear carrera'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
