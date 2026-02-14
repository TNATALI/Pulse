import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { SlackAnalytics } from '@pulse/shared';

export function useSlackAnalytics() {
  return useQuery({
    queryKey: ['slack', 'analytics'],
    queryFn: () => api.get<SlackAnalytics>('/api/slack/analytics'),
  });
}
