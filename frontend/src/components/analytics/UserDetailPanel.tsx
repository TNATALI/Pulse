import type { UserAnalytics } from '@pulse/shared';
import { LineChart } from '../charts/LineChart';
import { BarChart } from '../charts/BarChart';

interface UserDetailPanelProps {
  data: UserAnalytics;
  onClose: () => void;
}

export function UserDetailPanel({ data, onClose }: UserDetailPanelProps) {
  return (
    <div className="bg-white rounded-lg border-2 border-indigo-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {data.user.avatarUrl ? (
            <img src={data.user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg font-medium text-indigo-600">
              {data.user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{data.user.displayName}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stat badges */}
      <div className="flex flex-wrap gap-3 mb-4">
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Messages: <b>{data.totalMessages.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Threads: <b>{data.threadReplies.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Reactions recv'd: <b>{data.reactionsReceived.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Reactions given: <b>{data.reactionsGiven.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Mentioned by: <b>{data.mentionedByCount.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
          Mentions others: <b>{data.mentionsOthersCount.toLocaleString()}</b>
        </span>
      </div>

      {/* Charts 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Daily Activity</h4>
          <LineChart data={data.dailyActivity} color="#6366f1" xLabel="Date" yLabel="Messages" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Top Channels</h4>
          <BarChart
            data={data.topChannels.map((c) => ({ label: `#${c.name}`, value: c.messageCount }))}
            orientation="horizontal"
            color="#8b5cf6"
            xLabel="Messages"
          />
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Hourly Pattern</h4>
          <BarChart
            data={data.hourlyActivity.map((h) => ({ label: `${h.hour}:00`, value: h.count }))}
            orientation="vertical"
            color="#06b6d4"
            xLabel="Hour of Day"
            yLabel="Messages"
            tickInterval={3}
          />
        </div>
      </div>
    </div>
  );
}
