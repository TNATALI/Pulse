import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardSummary, HealthResponse } from '@pulse/shared';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthResponse>('/health'),
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary'),
  });
}
