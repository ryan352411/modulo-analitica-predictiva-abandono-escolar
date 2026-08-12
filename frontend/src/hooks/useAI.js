import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useSocioeconomicEstimate() {
  return useMutation({
    mutationFn: async (respuestas) =>
      (await api.post('/ai/socioeconomic', { respuestas })).data.data,
  });
}

export function useInterventionSuggestion() {
  return useMutation({
    mutationFn: async ({ studentId, alertId }) =>
      (
        await api.post('/ai/intervention', {
          student_id: studentId,
          alert_id: alertId,
        })
      ).data.data,
  });
}
