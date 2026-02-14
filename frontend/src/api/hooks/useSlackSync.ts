import { useMutation } from '@tanstack/react-query';
import { api } from '../client';
import type { SlackVerifyResponse, SlackSyncRequest, SlackSyncResponse } from '@pulse/shared';

export function useVerifySlackToken() {
  return useMutation({
    mutationFn: () => api.post<SlackVerifyResponse>('/api/slack/verify-token', {}),
  });
}

export function useTriggerSlackSync() {
  return useMutation({
    mutationFn: (data: SlackSyncRequest) =>
      api.post<SlackSyncResponse>('/api/slack/sync', data),
  });
}
