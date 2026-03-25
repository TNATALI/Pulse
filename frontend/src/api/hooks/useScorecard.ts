import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ScorecardHistoryResponse, ScorecardDetailResponse } from '@pulse/shared';

export function useGitHubScorecardHistory() {
  return useQuery<ScorecardHistoryResponse>({
    queryKey: ['github', 'scorecard', 'history'],
    queryFn: () => api.get<ScorecardHistoryResponse>('/api/github/scorecard/history'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGitHubScorecardDetail(
  repoFullName: string,
  runDate: string,
  analysisIds: number[],
  enabled: boolean,
) {
  return useQuery<ScorecardDetailResponse>({
    queryKey: ['github', 'scorecard', 'detail', repoFullName, runDate],
    queryFn: () =>
      api.get<ScorecardDetailResponse>(
        `/api/github/scorecard/detail?repoFullName=${encodeURIComponent(repoFullName)}&runDate=${runDate}&analysisIds=${analysisIds.join(',')}`,
      ),
    enabled: enabled && !!repoFullName && !!runDate && analysisIds.length > 0,
    staleTime: 30 * 60 * 1000, // historical data never changes
  });
}
