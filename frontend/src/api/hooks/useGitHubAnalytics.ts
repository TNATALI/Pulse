import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  GitHubRepository,
  GitHubAnalyticsParams,
  GitHubOverviewData,
  GitHubContributorsData,
  GitHubPRHealthData,
  GitHubCodeReviewData,
  GitHubIssuesData,
  GitHubSyncStatus,
  GitHubDataSyncResponse,
  GitHubVerifyResponse,
} from '@pulse/shared';

// ─── Params → query string ────────────────────────────────────────────────────

function buildQuery(params: GitHubAnalyticsParams): string {
  const q = new URLSearchParams();
  if (params.repoIds && params.repoIds.length > 0) q.set('repoIds', params.repoIds.join(','));
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.contributor) q.set('contributor', params.contributor);
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ─── Repos & auth ─────────────────────────────────────────────────────────────

export function useGitHubRepos() {
  return useQuery<GitHubRepository[]>({
    queryKey: ['github', 'repos'],
    queryFn: () => api.get<GitHubRepository[]>('/api/github/repos'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGitHubSyncStatus() {
  return useQuery<GitHubSyncStatus>({
    queryKey: ['github', 'sync-status'],
    queryFn: () => api.get<GitHubSyncStatus>('/api/github/sync/status'),
    refetchInterval: (query) => {
      const data = query.state.data;
      const isSyncing =
        data?.repos.status === 'syncing' || data?.analytics.status === 'syncing';
      return isSyncing ? 3000 : false;
    },
  });
}

export function useVerifyGitHubApp() {
  return useMutation({
    mutationFn: () => api.get<GitHubVerifyResponse>('/api/github/auth/status'),
  });
}

// ─── Sync mutations ───────────────────────────────────────────────────────────

export function useTriggerGitHubRepoSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<GitHubDataSyncResponse>('/api/github/repos/sync', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'sync-status'] });
    },
  });
}

export function useTriggerGitHubDataSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<GitHubDataSyncResponse>('/api/github/data/sync', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'sync-status'] });
      // Invalidate all analytics caches so fresh data loads after sync
      queryClient.invalidateQueries({ queryKey: ['github', 'analytics'] });
    },
  });
}

// ─── Analytics queries ────────────────────────────────────────────────────────

export function useGitHubOverview(params: GitHubAnalyticsParams, enabled = true) {
  return useQuery<GitHubOverviewData>({
    queryKey: ['github', 'analytics', 'overview', params],
    queryFn: () =>
      api.get<GitHubOverviewData>(`/api/github/analytics/overview${buildQuery(params)}`),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGitHubContributors(params: GitHubAnalyticsParams, enabled = true) {
  return useQuery<GitHubContributorsData>({
    queryKey: ['github', 'analytics', 'contributors', params],
    queryFn: () =>
      api.get<GitHubContributorsData>(`/api/github/analytics/contributors${buildQuery(params)}`),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGitHubPRHealth(params: GitHubAnalyticsParams, enabled = true) {
  return useQuery<GitHubPRHealthData>({
    queryKey: ['github', 'analytics', 'pr-health', params],
    queryFn: () =>
      api.get<GitHubPRHealthData>(`/api/github/analytics/pr-health${buildQuery(params)}`),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGitHubCodeReview(params: GitHubAnalyticsParams, enabled = true) {
  return useQuery<GitHubCodeReviewData>({
    queryKey: ['github', 'analytics', 'code-review', params],
    queryFn: () =>
      api.get<GitHubCodeReviewData>(`/api/github/analytics/code-review${buildQuery(params)}`),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGitHubIssues(params: GitHubAnalyticsParams, enabled = true) {
  return useQuery<GitHubIssuesData>({
    queryKey: ['github', 'analytics', 'issues', params],
    queryFn: () =>
      api.get<GitHubIssuesData>(`/api/github/analytics/issues${buildQuery(params)}`),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
