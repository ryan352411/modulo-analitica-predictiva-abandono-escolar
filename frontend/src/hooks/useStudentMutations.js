import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/students', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUpdateStudent(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put(`/students/${id}`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['students', id] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => api.delete(`/students/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useCreateRecord(studentId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      (await api.post('/records', { ...payload, student_id: studentId })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', studentId] }),
  });
}
