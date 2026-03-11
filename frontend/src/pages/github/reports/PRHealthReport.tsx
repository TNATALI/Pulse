import { useGitHubPRHealth } from '../../../api/hooks/useGitHubAnalytics';
import { StatCard } from '../../../components/analytics/StatCard';
import { BarChart } from '../../../components/charts/BarChart';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import type { GitHubAnalyticsParams } from '@pulse/shared';

interface Props {
  params: GitHubAnalyticsParams;
}

export function PRHealthReport({ params }: Props) {
  const { data, isLoading, error } = useGitHubPRHealth(params);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load PR health: {error.message}
      </div>
    );
  if (!data) return null;

  const { summary } = data;
  const mergeRatePct = Math.round(summary.mergeRate * 100);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open PRs" value={summary.openPRs} />
        <StatCard
          label="Stale PRs"
          value={summary.stalePRs}
          subtitle="open > 7 days"
        />
        <StatCard
          label="Avg Cycle Time"
          value={summary.avgCycleTimeDays != null ? `${summary.avgCycleTimeDays}d` : '—'}
          subtitle="open → merged"
        />
        <StatCard label="Merge Rate" value={`${mergeRatePct}%`} subtitle="in period" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cycle time trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Cycle Time Trend (days)</h3>
          {data.cycleTimeTrend.length > 0 ? (
            <BarChart
              data={data.cycleTimeTrend.map((d) => ({ label: d.week.slice(5), value: d.avgDays }))}
              orientation="vertical"
              color="#f59e0b"
              xLabel="Week"
              yLabel="Avg days"
            />
          ) : (
            <p className="text-sm text-gray-400">No merged PRs in this period.</p>
          )}
        </div>

        {/* Merge rate by repo */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Merge Rate by Repo</h3>
          {data.mergeRateByRepo.length > 0 ? (
            <div className="space-y-2">
              {data.mergeRateByRepo.map((r) => {
                const pct = Math.round(r.mergeRate * 100);
                const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={r.repo}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-700 truncate max-w-[60%]">
                        {r.repo}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {r.merged}/{r.total} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No PR data yet.</p>
          )}
        </div>
      </div>

      {/* Stale PR list */}
      {data.stalePRList.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">
            Stale Open PRs ({data.stalePRList.length})
          </h3>
          <div className="space-y-2">
            {data.stalePRList.map((pr) => (
              <div
                key={`${pr.repo}#${pr.number}`}
                className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {pr.title}
                  </a>
                  <span className="text-xs text-gray-400">
                    {pr.repo}#{pr.number}
                    {pr.author && ` · ${pr.author}`}
                  </span>
                </div>
                <span
                  className={`ml-4 shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                    pr.ageDays > 30
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {pr.ageDays}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
