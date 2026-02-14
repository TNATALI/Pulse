import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSlackAnalytics, useChannelList, useUserAnalytics } from '../api/hooks/useSlackAnalytics';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { LineChart } from '../components/charts/LineChart';
import { BarChart } from '../components/charts/BarChart';
import { StatCard } from '../components/analytics/StatCard';
import { FilterBar } from '../components/filters/FilterBar';
import { MentionTable } from '../components/analytics/MentionTable';
import { UserDetailPanel } from '../components/analytics/UserDetailPanel';
import type { SlackAnalyticsParams } from '@pulse/shared';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFilters(): SlackAnalyticsParams {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

export function SlackPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL or defaults
  const [filters, setFilters] = useState<SlackAnalyticsParams>(() => {
    const defaults = defaultFilters();
    const channelIdsParam = searchParams.get('channelIds');
    return {
      startDate: searchParams.get('startDate') ?? defaults.startDate,
      endDate: searchParams.get('endDate') ?? defaults.endDate,
      channelIds: channelIdsParam ? channelIdsParam.split(',').filter(Boolean) : undefined,
      userId: searchParams.get('userId') ?? undefined,
    };
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    searchParams.get('userId') ?? null,
  );

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.channelIds && filters.channelIds.length > 0) {
      params.channelIds = filters.channelIds.join(',');
    }
    if (selectedUserId) params.userId = selectedUserId;
    setSearchParams(params, { replace: true });
  }, [filters, selectedUserId, setSearchParams]);

  // Data fetching — analytics uses filters + selectedUserId for full reactivity
  const analyticsParams = useMemo<SlackAnalyticsParams>(
    () => ({
      ...filters,
      userId: selectedUserId ?? filters.userId,
    }),
    [filters, selectedUserId],
  );
  const { data, isLoading, error } = useSlackAnalytics(analyticsParams);
  const { data: channels, isLoading: channelsLoading } = useChannelList();
  const { data: userDetail } = useUserAnalytics(selectedUserId, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    channelIds: filters.channelIds,
  });

  const handleFilterChange = useCallback((newFilters: SlackAnalyticsParams) => {
    setFilters(newFilters);
    // Keep selectedUserId in sync with the filter bar's user selection
    if (newFilters.userId) {
      setSelectedUserId(newFilters.userId);
    } else {
      setSelectedUserId(null);
    }
  }, []);

  const handleChannelClick = useCallback(
    (channelId: string) => {
      const current = new Set(filters.channelIds ?? []);
      if (current.has(channelId)) {
        current.delete(channelId);
      } else {
        current.add(channelId);
      }
      setFilters({
        ...filters,
        channelIds: current.size > 0 ? Array.from(current) : undefined,
      });
    },
    [filters],
  );

  const handleUserSelect = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleClearUser = useCallback(() => {
    setSelectedUserId(null);
    setFilters((prev) => ({ ...prev, userId: undefined }));
  }, []);

  // Build contributor list for filter bar from the *unfiltered-by-user* data
  // We use the current data's contributors since they're from the current analytics
  const contributors = useMemo(
    () =>
      (data?.topContributors ?? []).map((c) => ({
        userId: c.userId,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
      })),
    [data?.topContributors],
  );

  // Date range for LineChart x-axis
  const chartDateRange = useMemo(() => {
    if (filters.startDate && filters.endDate) {
      return { start: filters.startDate, end: filters.endDate };
    }
    return undefined;
  }, [filters.startDate, filters.endDate]);

  // Determine if Slack has been synced at all (channels exist)
  const hasSlackData = channels && channels.length > 0;
  const hasResults = data && data.summary.totalMessages > 0;

  if (isLoading && channelsLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load analytics: {error.message}
      </div>
    );
  }

  // No Slack workspace connected at all
  if (!channelsLoading && !hasSlackData) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Slack Analytics</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Connect your Slack workspace in Settings to view analytics.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Slack Analytics</h1>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        channels={channels ?? []}
        contributors={contributors}
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Summary cards — always show, with zeros if no results */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Messages" value={data?.summary.totalMessages ?? 0} />
            <StatCard
              label="Thread Ratio"
              value={`${Math.round((data?.summary.threadRatio ?? 0) * 100)}%`}
              subtitle={`${data?.summary.threadedMessages ?? 0} threaded`}
            />
            <StatCard label="Active Users" value={data?.summary.activeUsers ?? 0} />
            <StatCard label="Active Channels" value={data?.summary.activeChannels ?? 0} />
          </div>

          {!hasResults && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 text-center text-gray-500">
              No activity found for the selected filters. Try expanding the date range or removing channel/user filters.
            </div>
          )}

          {/* Charts row 1: Volume + Hourly */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Message Volume</h2>
              <LineChart
                data={data?.messageVolume ?? []}
                xLabel="Date"
                yLabel="Messages"
                dateRange={chartDateRange}
              />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Activity by Hour</h2>
              <BarChart
                data={(data?.hourlyActivity ?? []).map((h) => ({
                  label: `${h.hour}:00`,
                  value: h.count,
                }))}
                orientation="vertical"
                color="#0ea5e9"
                xLabel="Hour of Day"
                yLabel="Messages"
                tickInterval={3}
              />
            </div>
          </div>

          {/* Charts row 2: Channels + Contributors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Top Channels</h2>
              <div className="space-y-2">
                {(data?.topChannels ?? []).map((ch) => {
                  const isSelected = filters.channelIds?.includes(ch.channelId);
                  return (
                    <button
                      key={ch.channelId}
                      onClick={() => handleChannelClick(ch.channelId)}
                      className={`w-full flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-gray-50 text-left ${
                        isSelected ? 'bg-indigo-50 border border-indigo-200' : ''
                      }`}
                      title={`#${ch.name}: ${ch.messageCount.toLocaleString()} messages — click to filter`}
                    >
                      <span className="text-gray-800">#{ch.name}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded bg-violet-500"
                          style={{
                            width: `${Math.max(4, (ch.messageCount / (data!.topChannels[0]?.messageCount || 1)) * 120)}px`,
                          }}
                        />
                        <span className="text-gray-500 w-10 text-right">{ch.messageCount}</span>
                      </div>
                    </button>
                  );
                })}
                {(data?.topChannels ?? []).length === 0 && (
                  <p className="text-gray-400 text-sm">No channel data</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Top Contributors</h2>
              <div className="space-y-3">
                {(data?.topContributors ?? []).map((user, i) => (
                  <button
                    key={user.userId}
                    onClick={() => handleUserSelect(user.userId)}
                    className={`w-full flex items-center gap-3 p-1.5 rounded hover:bg-gray-50 text-left ${
                      selectedUserId === user.userId ? 'bg-indigo-50 border border-indigo-200' : ''
                    }`}
                    title={`${user.displayName}: ${user.messageCount.toLocaleString()} messages, ${user.threadCount} threads, ${user.reactionsReceived} reactions — click to view details`}
                  >
                    <span className="text-sm font-medium text-gray-400 w-5 text-right">{i + 1}</span>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-500">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 truncate block">{user.displayName}</span>
                      <span className="text-xs text-gray-400">
                        {user.threadCount} threads &middot; {user.reactionsReceived} reactions
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {user.messageCount.toLocaleString()}
                    </span>
                  </button>
                ))}
                {(data?.topContributors ?? []).length === 0 && (
                  <p className="text-gray-400 text-sm">No contributors yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Charts row 3: Mentions + Reactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Mention Network</h2>
              <MentionTable data={data?.mentionPairs ?? []} onUserSelect={handleUserSelect} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Top Reactions</h2>
              {(data?.topReactions ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {data!.topReactions.map((r) => (
                    <span
                      key={r.emoji}
                      className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-sm"
                      title={`${r.emoji}: used ${r.count.toLocaleString()} times`}
                    >
                      <span>:{r.emoji}:</span>
                      <span className="font-medium text-gray-700">{r.count.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No reaction data</p>
              )}
            </div>
          </div>

          {/* User Detail Panel */}
          {selectedUserId && userDetail && (
            <div className="mb-6">
              <UserDetailPanel data={userDetail} onClose={handleClearUser} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
