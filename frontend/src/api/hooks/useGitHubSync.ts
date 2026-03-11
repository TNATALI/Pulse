import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type {
  GitHubVerifyResponse,
  GitHubSyncReposResponse,
  GitHubDataSyncResponse,
  GitHubSyncStatus,
} from '@pulse/shared';

export function useVerifyGitHubApp() {
  return useMutation({
    mutationFn: () => api.get<GitHubVerifyResponse>('/api/github/auth/status'),
  });
}

export function useTriggerGitHubRepoSync() {
  return useMutation({
    mutationFn: () => api.post<GitHubSyncReposResponse>('/api/github/repos/sync', {}),
  });
}

export function useTriggerGitHubDataSync() {
  return useMutation({
    mutationFn: (since?: string) =>
      api.post<GitHubDataSyncResponse>('/api/github/data/sync', since ? { since } : {}),
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
