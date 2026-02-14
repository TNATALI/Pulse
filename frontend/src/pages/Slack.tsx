import { useSlackAnalytics } from '../api/hooks/useSlackAnalytics';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { LineChart } from '../components/charts/LineChart';
import { BarChart } from '../components/charts/BarChart';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

export function SlackPage() {
  const { data, isLoading, error } = useSlackAnalytics();

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load analytics: {error.message}
      </div>
    );
  }

  if (!data || data.summary.totalMessages === 0) {
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Messages" value={data.summary.totalMessages} />
        <StatCard label="Active Channels" value={data.summary.activeChannels} />
        <StatCard label="Active Users" value={data.summary.activeUsers} />
        <StatCard label="Messages Today" value={data.summary.messagesToday} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Messages per Day (Last 30 Days)</h2>
          <LineChart data={data.messageVolume} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Activity by Hour of Day</h2>
          <BarChart
            data={data.hourlyActivity.map((h) => ({ label: `${h.hour}:00`, value: h.count }))}
            orientation="vertical"
            color="#0ea5e9"
          />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Channels</h2>
          <BarChart
            data={data.topChannels.map((c) => ({ label: `#${c.name}`, value: c.messageCount }))}
            orientation="horizontal"
            color="#8b5cf6"
          />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Contributors</h2>
          <div className="space-y-3">
            {data.topContributors.map((user, i) => (
              <div key={user.userId} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400 w-5 text-right">{i + 1}</span>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-500">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-gray-900 truncate">{user.displayName}</span>
                <span className="text-sm font-medium text-gray-600">
                  {user.messageCount.toLocaleString()}
                </span>
              </div>
            ))}
            {data.topContributors.length === 0 && (
              <p className="text-gray-400 text-sm">No contributors yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Reactions */}
      {data.topReactions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Reactions</h2>
          <div className="flex flex-wrap gap-3">
            {data.topReactions.map((r) => (
              <span
                key={r.emoji}
                className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-sm"
              >
                <span>:{r.emoji}:</span>
                <span className="font-medium text-gray-700">{r.count.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
