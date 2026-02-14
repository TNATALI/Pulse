import { useDashboardInsights } from '../api/hooks/useDashboardInsights';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { LineChart } from '../components/charts/LineChart';
import { InsightCard } from '../components/dashboard/InsightCard';

function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-gray-400">--</span>;
  return (
    <span className={`font-semibold ${value > 0 ? 'text-green-600' : 'text-red-600'}`}>
      {value > 0 ? '\u2191' : '\u2193'}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Dashboard() {
  const { data, isLoading, error } = useDashboardInsights();

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load dashboard: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No data available yet. Sync your Slack workspace in Settings.
        </div>
      </div>
    );
  }

  const threadHealthLabel =
    data.summary.threadRatio >= 0.3
      ? 'Healthy'
      : data.summary.threadRatio >= 0.15
        ? 'Fair'
        : 'Needs attention';
  const threadHealthColor =
    data.summary.threadRatio >= 0.3
      ? 'text-green-600'
      : data.summary.threadRatio >= 0.15
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      {/* Week-over-week banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Week over Week
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Messages</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data.weekOverWeek.messagesThisWeek.toLocaleString()}
            </p>
            <ChangeIndicator value={data.weekOverWeek.changePercent} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Users</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data.weekOverWeek.activeUsersThisWeek.toLocaleString()}
            </p>
            <ChangeIndicator value={data.weekOverWeek.usersChangePercent} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Thread Ratio</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.round(data.summary.threadRatio * 100)}%
            </p>
            <span className={`text-sm font-medium ${threadHealthColor}`}>{threadHealthLabel}</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Messages</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data.summary.totalMessages.toLocaleString()}
            </p>
            <span className="text-sm text-gray-400">
              {data.summary.activeChannels} channels
            </span>
          </div>
        </div>
      </div>

      {/* Activity trend + Communication health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Activity Trend (14 days)</h2>
          <LineChart data={data.recentActivity} color="#6366f1" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Communication Health</h2>
          <div className="flex flex-col items-center justify-center h-48">
            <div className="text-5xl font-bold text-gray-900">
              {Math.round(data.summary.threadRatio * 100)}%
            </div>
            <p className="text-sm text-gray-500 mt-2">Thread Ratio</p>
            <div className={`mt-2 text-sm font-semibold ${threadHealthColor}`}>
              {threadHealthLabel}
            </div>
            <p className="text-xs text-gray-400 mt-1">30%+ is healthy for team communication</p>
          </div>
        </div>
      </div>

      {/* Attention needed */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Attention Needed</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <InsightCard
          title="Channels Going Quiet"
          items={data.decliningChannels.map((ch) => ({
            label: `#${ch.name}`,
            value: `${ch.currentCount} msgs`,
            trend: ch.changePercent,
            linkTo: `/slack?channelIds=${ch.channelId}`,
          }))}
          emptyMessage="No declining channels this week"
        />
        <InsightCard
          title="Channels Growing"
          items={data.risingChannels.map((ch) => ({
            label: `#${ch.name}`,
            value: `${ch.currentCount} msgs`,
            trend: ch.changePercent,
            linkTo: `/slack?channelIds=${ch.channelId}`,
          }))}
          emptyMessage="No rising channels this week"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <InsightCard
          title="Quiet Team Members"
          items={data.quietUsers.map((u) => ({
            label: u.displayName,
            value: `${u.currentCount} msgs (was ${u.previousCount})`,
            linkTo: `/slack?userId=${u.userId}`,
          }))}
          emptyMessage="No significant activity drops"
        />
        <InsightCard
          title="Engagement Leaders"
          items={data.topThreadStarters.map((u) => ({
            label: u.displayName,
            value: `${u.threadCount} threads`,
            linkTo: `/slack?userId=${u.userId}`,
          }))}
          emptyMessage="No thread data yet"
        />
      </div>
    </div>
  );
}
