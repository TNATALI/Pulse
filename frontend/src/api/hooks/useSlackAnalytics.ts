import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { SlackAnalyticsParams, SlackAnalyticsResponse, ChannelListItem, UserAnalytics } from '@pulse/shared';

function buildQueryString(params: SlackAnalyticsParams): string {
  const parts: string[] = [];
  if (params.startDate) parts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) parts.push(`endDate=${encodeURIComponent(params.endDate)}`);
  if (params.channelIds && params.channelIds.length > 0) {
    parts.push(`channelIds=${encodeURIComponent(params.channelIds.join(','))}`);
  }
  if (params.userId) parts.push(`userId=${encodeURIComponent(params.userId)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function useSlackAnalytics(params: SlackAnalyticsParams = {}) {
  return useQuery({
    queryKey: ['slack', 'analytics', params],
    queryFn: () =>
      api.get<SlackAnalyticsResponse>(`/api/slack/analytics${buildQueryString(params)}`),
  });
}

export function useChannelList() {
  return useQuery({
    queryKey: ['slack', 'channels'],
    queryFn: () => api.get<ChannelListItem[]>('/api/slack/channels'),
  });
}

export function useUserAnalytics(
  userId: string | null,
  params: Omit<SlackAnalyticsParams, 'userId'> = {},
) {
  return useQuery({
    queryKey: ['slack', 'user', userId, params],
    queryFn: () => api.get<UserAnalytics>(`/api/slack/user/${userId}${buildQueryString(params)}`),
    enabled: !!userId,
  });
}
