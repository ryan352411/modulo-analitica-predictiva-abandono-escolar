import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useStudents(params = {}) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: async () => (await api.get('/students', { params })).data,
  });
}

export function useStudent(id) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: async () => (await api.get(`/students/${id}`)).data.data,
    enabled: !!id,
  });
}

export function useGeneratePrediction(studentId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post(`/predictions/student/${studentId}`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', studentId] }),
  });
}

export function useBatchPredictions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/predictions/batch')).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['high-risk'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useImportStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (csvText) =>
      (await api.post('/students/import', csvText, {
        headers: { 'Content-Type': 'text/csv' },
      })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useHighRisk() {
  return useQuery({
    queryKey: ['high-risk'],
    queryFn: async () => (await api.get('/predictions/high-risk')).data.data,
  });
}
