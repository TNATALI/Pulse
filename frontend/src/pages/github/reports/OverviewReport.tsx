import { useGitHubOverview } from '../../../api/hooks/useGitHubAnalytics';
import { StatCard } from '../../../components/analytics/StatCard';
import { LineChart } from '../../../components/charts/LineChart';
import { BarChart } from '../../../components/charts/BarChart';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ScorecardPanel } from './ScorecardPanel';
import type { GitHubAnalyticsParams } from '@pulse/shared';

interface Props {
  params: GitHubAnalyticsParams;
}

export function OverviewReport({ params }: Props) {
  const { data, isLoading, error } = useGitHubOverview(params);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load overview: {error.message}
      </div>
    );
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Repositories" value={summary.totalRepos} />
        <StatCard
          label="Open PRs"
          value={summary.openPRs}
          subtitle={`${summary.mergedPRs} merged in period`}
        />
        <StatCard
          label="Open Issues"
          value={summary.openIssues}
          subtitle={`${summary.closedIssues} closed in period`}
        />
        <StatCard
          label="Avg Merge Time"
          value={
            summary.avgMergeTimeDays != null ? `${summary.avgMergeTimeDays}d` : '—'
          }
          subtitle={`${summary.activeContributors} active contributors`}
        />
      </div>

      {/* Scorecard security health */}
      <ScorecardPanel />

      {/* Activity charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">PR Activity (weekly)</h3>
          {data.prActivity.length > 0 ? (
            <LineChart
              data={data.prActivity.map((d) => ({ date: d.week, count: d.opened }))}
              xLabel="Week"
              yLabel="PRs"
              dateRange={{ start: params.startDate, end: params.endDate }}
            />
          ) : (
            <p className="text-sm text-gray-400">No PR activity in this period.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Issue Activity (weekly)</h3>
          {data.issueActivity.length > 0 ? (
            <LineChart
              data={data.issueActivity.map((d) => ({ date: d.week, count: d.opened }))}
              xLabel="Week"
              yLabel="Issues"
              dateRange={{ start: params.startDate, end: params.endDate }}
            />
          ) : (
            <p className="text-sm text-gray-400">No issue activity in this period.</p>
          )}
        </div>
      </div>

      {/* Repos by language + top repos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Repos by Language</h3>
          {data.reposByLanguage.length > 0 ? (
            <BarChart
              data={data.reposByLanguage.map((r) => ({ label: r.language, value: r.count }))}
              orientation="horizontal"
              color="#8b5cf6"
              xLabel="Repos"
            />
          ) : (
            <p className="text-sm text-gray-400">No repositories synced yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Most Active Repos</h3>
          <div className="space-y-2">
            {data.topActiveRepos.length > 0 ? (
              data.topActiveRepos.map((r) => (
                <div key={r.repo} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-800 font-mono text-xs truncate max-w-[60%]">
                    {r.repo}
                  </span>
                  <div className="flex gap-3 text-gray-500 shrink-0">
                    <span>{r.prCount} PRs</span>
                    <span>{r.issueCount} issues</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No PR activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
