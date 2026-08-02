import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';
import { useStudent } from '../hooks/useStudents.js';
import { useCreateStudent, useUpdateStudent } from '../hooks/useStudentMutations.js';

const EMPTY = {
  matricula: '',
  nombre_completo: '',
  correo: '',
  fecha_nacimiento: '',
  genero: '',
  nivel_socioeconomico: 'medio',
  fecha_inscripcion: '',
  semestre_actual: 1,
  programa: '',
  estatus: 'activo',
};

export default function StudentForm() {
  const { id } = useParams();           // si existe → modo edición
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: student } = useStudent(isEdit ? id : null);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent(id);
  const mutation = isEdit ? updateStudent : createStudent;

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (student) {
      const next = { ...EMPTY };
      for (const k of Object.keys(EMPTY)) next[k] = student[k] ?? EMPTY[k];
      setForm(next);
    }
  }, [student]);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      semestre_actual: Number(form.semestre_actual),
      fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_inscripcion: form.fecha_inscripcion || null,
      correo: form.correo || null,
      genero: form.genero || null,
    };
    try {
      const saved = await mutation.mutateAsync(payload);
      navigate(`/estudiantes/${saved?.id ?? id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible guardar el estudiante');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to={isEdit ? `/estudiantes/${id}` : '/estudiantes'}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <h1 className="text-2xl font-semibold">
        {isEdit ? 'Editar estudiante' : 'Nuevo estudiante'}
      </h1>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Matrícula">
              <Input required value={form.matricula} onChange={set('matricula')} placeholder="UTD2025001" />
            </Field>
            <Field label="Nombre completo">
              <Input required value={form.nombre_completo} onChange={set('nombre_completo')} />
            </Field>
            <Field label="Correo">
              <Input type="email" value={form.correo} onChange={set('correo')} />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input type="date" value={form.fecha_nacimiento || ''} onChange={set('fecha_nacimiento')} />
            </Field>
            <Field label="Género">
              <Select value={form.genero || ''} onChange={set('genero')}>
                <option value="">Sin especificar</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Nivel socioeconómico">
              <Select value={form.nivel_socioeconomico} onChange={set('nivel_socioeconomico')}>
                <option value="bajo">Bajo</option>
                <option value="medio_bajo">Medio bajo</option>
                <option value="medio">Medio</option>
                <option value="medio_alto">Medio alto</option>
                <option value="alto">Alto</option>
              </Select>
            </Field>
            <Field label="Programa educativo">
              <Input value={form.programa} onChange={set('programa')} placeholder="TSU en Tecnologías de la Información" />
            </Field>
            <Field label="Semestre actual">
              <Input type="number" min={1} max={12} required value={form.semestre_actual} onChange={set('semestre_actual')} />
            </Field>
            <Field label="Fecha de inscripción">
              <Input type="date" value={form.fecha_inscripcion || ''} onChange={set('fecha_inscripcion')} />
            </Field>
            <Field label="Estatus">
              <Select value={form.estatus} onChange={set('estatus')}>
                <option value="activo">Activo</option>
                <option value="baja_temporal">Baja temporal</option>
                <option value="baja_definitiva">Baja definitiva</option>
                <option value="egresado">Egresado</option>
              </Select>
            </Field>

            {error && <p className="sm:col-span-2 text-sm text-risk-high">{error}</p>}

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Link
                to={isEdit ? `/estudiantes/${id}` : '/estudiantes'}
                className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear estudiante'}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
