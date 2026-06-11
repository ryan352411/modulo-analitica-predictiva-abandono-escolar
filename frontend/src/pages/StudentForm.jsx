import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';
import { useStudent } from '../hooks/useStudents.js';
import { useCreateStudent, useUpdateStudent } from '../hooks/useStudentMutations.js';

const EMPTY = {
  matricula: '',
  full_name: '',
  email: '',
  birth_date: '',
  gender: '',
  socioeconomic_level: 'medio',
  enrollment_date: '',
  current_semester: 1,
  program: '',
  status: 'activo',
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
      current_semester: Number(form.current_semester),
      birth_date: form.birth_date || null,
      enrollment_date: form.enrollment_date || null,
      email: form.email || null,
      gender: form.gender || null,
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
              <Input required value={form.full_name} onChange={set('full_name')} />
            </Field>
            <Field label="Correo">
              <Input type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input type="date" value={form.birth_date || ''} onChange={set('birth_date')} />
            </Field>
            <Field label="Género">
              <Select value={form.gender || ''} onChange={set('gender')}>
                <option value="">Sin especificar</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Nivel socioeconómico">
              <Select value={form.socioeconomic_level} onChange={set('socioeconomic_level')}>
                <option value="bajo">Bajo</option>
                <option value="medio_bajo">Medio bajo</option>
                <option value="medio">Medio</option>
                <option value="medio_alto">Medio alto</option>
                <option value="alto">Alto</option>
              </Select>
            </Field>
            <Field label="Programa educativo">
              <Input value={form.program} onChange={set('program')} placeholder="TSU en Tecnologías de la Información" />
            </Field>
            <Field label="Semestre actual">
              <Input type="number" min={1} max={12} required value={form.current_semester} onChange={set('current_semester')} />
            </Field>
            <Field label="Fecha de inscripción">
              <Input type="date" value={form.enrollment_date || ''} onChange={set('enrollment_date')} />
            </Field>
            <Field label="Estatus">
              <Select value={form.status} onChange={set('status')}>
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
