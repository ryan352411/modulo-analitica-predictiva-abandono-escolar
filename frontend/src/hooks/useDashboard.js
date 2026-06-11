import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await api.get('/dashboard/summary')).data.data,
  });
}
