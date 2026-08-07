import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { Field, Input, Select, Textarea } from './ui/Field.jsx';
import { useCreateRecord } from '../hooks/useStudentMutations.js';

const ANIO_ACTUAL = new Date().getFullYear();
const PERIODOS = [`${ANIO_ACTUAL}-1`, `${ANIO_ACTUAL}-2`, `${ANIO_ACTUAL}-3`];

const HOY = new Date().toISOString().slice(0, 10);

const EMPTY = {
  periodo: PERIODOS[0],
  fecha_carga: HOY,
  promedio: '',
  tasa_asistencia: '',
  materias_reprobadas: 0,
  entregas_pendientes: 0,
  creditos_obtenidos: 0,
  creditos_totales: 0,
  observaciones: '',
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
    if (Number(form.creditos_obtenidos) > Number(form.creditos_totales)) {
      setError('Los créditos obtenidos no pueden ser mayores que los créditos del periodo');
      return;
    }
    try {
      await createRecord.mutateAsync({
        periodo: form.periodo,
        registrado_en: form.fecha_carga,
        promedio: Number(form.promedio),
        tasa_asistencia: Number(form.tasa_asistencia),
        materias_reprobadas: Number(form.materias_reprobadas),
        entregas_pendientes: Number(form.entregas_pendientes),
        creditos_obtenidos: Number(form.creditos_obtenidos),
        creditos_totales: Number(form.creditos_totales),
        observaciones: form.observaciones || null,
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
        <Field label="Periodo" hint={`Ciclo ${ANIO_ACTUAL}`}>
          <Select required value={form.periodo} onChange={set('periodo')}>
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de carga" hint="Fecha en que se cargan los registros">
          <Input type="date" required value={form.fecha_carga} onChange={set('fecha_carga')} />
        </Field>
        <Field label="Promedio (0–10)">
          <Input
            type="number"
            step="0.01"
            min={0}
            max={10}
            required
            value={form.promedio}
            onChange={set('promedio')}
          />
        </Field>
        <Field label="Asistencia (%)">
          <Input
            type="number"
            step="0.1"
            min={0}
            max={100}
            required
            value={form.tasa_asistencia}
            onChange={set('tasa_asistencia')}
          />
        </Field>
        <Field label="Materias reprobadas">
          <Input
            type="number"
            min={0}
            max={50}
            required
            value={form.materias_reprobadas}
            onChange={set('materias_reprobadas')}
          />
        </Field>
        <Field label="Entregas pendientes">
          <Input
            type="number"
            min={0}
            max={100}
            required
            value={form.entregas_pendientes}
            onChange={set('entregas_pendientes')}
          />
        </Field>
        <Field label="Créditos obtenidos">
          <Input
            type="number"
            min={0}
            max={500}
            required
            value={form.creditos_obtenidos}
            onChange={set('creditos_obtenidos')}
          />
        </Field>
        <Field label="Créditos del periodo">
          <Input
            type="number"
            min={0}
            max={500}
            required
            value={form.creditos_totales}
            onChange={set('creditos_totales')}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observaciones">
            <Textarea maxLength={500} value={form.observaciones} onChange={set('observaciones')} />
          </Field>
        </div>

        {error && <p className="sm:col-span-2 text-sm text-risk-high">{error}</p>}

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
          >
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
