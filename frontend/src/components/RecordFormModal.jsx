import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { Field, Input, Textarea } from './ui/Field.jsx';
import { useCreateRecord } from '../hooks/useStudentMutations.js';

const EMPTY = {
  period: '',
  gpa: '',
  attendance_rate: '',
  failed_subjects: 0,
  credits_earned: 0,
  credits_total: 0,
  observations: '',
};

export default function RecordFormModal({ studentId, open, onClose }) {
  const createRecord = useCreateRecord(studentId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await createRecord.mutateAsync({
        period: form.period,
        gpa: Number(form.gpa),
        attendance_rate: Number(form.attendance_rate),
        failed_subjects: Number(form.failed_subjects),
        credits_earned: Number(form.credits_earned),
        credits_total: Number(form.credits_total),
        observations: form.observations || null,
      });
      setForm(EMPTY);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible guardar el registro');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo registro académico">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Periodo" hint="Formato AAAA-N, p. ej. 2025-2">
          <Input required pattern="\d{4}-\d" value={form.period} onChange={set('period')} placeholder="2025-2" />
        </Field>
        <Field label="Promedio (0–10)">
          <Input type="number" step="0.01" min={0} max={10} required value={form.gpa} onChange={set('gpa')} />
        </Field>
        <Field label="Asistencia (%)">
          <Input type="number" step="0.1" min={0} max={100} required value={form.attendance_rate} onChange={set('attendance_rate')} />
        </Field>
        <Field label="Materias reprobadas">
          <Input type="number" min={0} required value={form.failed_subjects} onChange={set('failed_subjects')} />
        </Field>
        <Field label="Créditos obtenidos">
          <Input type="number" min={0} required value={form.credits_earned} onChange={set('credits_earned')} />
        </Field>
        <Field label="Créditos del periodo">
          <Input type="number" min={0} required value={form.credits_total} onChange={set('credits_total')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observaciones">
            <Textarea value={form.observations} onChange={set('observations')} />
          </Field>
        </div>

        {error && <p className="sm:col-span-2 text-sm text-risk-high">{error}</p>}

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createRecord.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {createRecord.isPending ? 'Guardando…' : 'Guardar registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
