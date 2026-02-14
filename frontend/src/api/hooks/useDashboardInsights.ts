import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardInsights } from '@pulse/shared';

export function useDashboardInsights() {
  return useQuery({
    queryKey: ['dashboard', 'insights'],
    queryFn: () => api.get<DashboardInsights>('/api/dashboard/insights'),
  });
}
