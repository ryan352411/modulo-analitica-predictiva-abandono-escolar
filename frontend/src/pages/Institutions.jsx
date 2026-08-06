import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { School, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import { prefijoMatricula } from '../lib/utils.js';

const EMPTY = { nombre: '', codigo: '', direccion: '' };

export default function Institutions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => (await api.get('/institutions')).data.data,
  });

  const save = useMutation({
    mutationFn: async ({ id, ...payload }) =>
      id
        ? (await api.patch(`/institutions/${id}`, payload)).data.data
        : (await api.post('/institutions', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institutions'] });
      setOpen(false);
      setForm(EMPTY);
      setEditing(null);
    },
    onError: (err) => setError(err.response?.data?.error || 'No fue posible guardar la escuela'),
  });

  const remove = useMutation({
    mutationFn: async (id) => api.delete(`/institutions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }),
    onError: (err) =>
      window.alert(err.response?.data?.error || 'No fue posible eliminar la escuela'),
  });

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  }

  function openEdit(inst) {
    setEditing(inst);
    setForm({
      nombre: inst.nombre || '',
      codigo: inst.codigo || '',
      direccion: inst.direccion || '',
    });
    setError('');
    setOpen(true);
  }

  function onSubmit(e) {
    e.preventDefault();
    setError('');
    save.mutate({ id: editing?.id, ...form });
  }

  function onDelete(inst) {
    if (
      window.confirm(`¿Eliminar la escuela "${inst.nombre}"? Esta acción no se puede deshacer.`)
    ) {
      remove.mutate(inst.id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <School className="h-6 w-6 text-primary" /> Escuelas
        </h1>
        {data?.length === 0 && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Nueva escuela
          </button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Prefijo</th>
                <th className="px-5 py-3 font-medium">Clave de trabajo</th>
                <th className="px-5 py-3 font-medium">Alumnos</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-ink/50">
                    Cargando…
                  </td>
                </tr>
              )}
              {data?.map((inst) => (
                <tr key={inst.id} className="border-b border-ink/5">
                  <td className="px-5 py-3 font-medium">{inst.nombre}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      {inst.prefijo}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink/60">{inst.codigo || '—'}</td>
                  <td className="px-5 py-3 tabular-nums">{inst.alumnos}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(inst)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => onDelete(inst)}
                        disabled={inst.alumnos > 0}
                        title={inst.alumnos > 0 ? 'Tiene alumnos asociados' : 'Eliminar'}
                        className="inline-flex items-center gap-1 text-xs text-risk-high hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-ink/50">
                    Aún no hay escuelas registradas.
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
        title={editing ? 'Editar escuela' : 'Nueva escuela'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Nombre de la escuela"
            hint={`Prefijo de matrícula: ${prefijoMatricula(form.nombre)}`}
          >
            <Input
              required
              maxLength={120}
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Instituto Tecnológico Central"
            />
          </Field>
          <Field label="Clave de trabajo">
            <Input required maxLength={20} value={form.codigo} onChange={set('codigo')} />
          </Field>
          <Field label="Dirección" hint="Opcional">
            <Input maxLength={200} value={form.direccion} onChange={set('direccion')} />
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
              {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear escuela'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
