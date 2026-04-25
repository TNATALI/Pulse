import { useGitHubOverview } from '../../../api/hooks/useGitHubAnalytics';
import { AchievementCard } from '../../../components/analytics/AchievementCard';
import { StatCard } from '../../../components/analytics/StatCard';
import { LineChart } from '../../../components/charts/LineChart';
import { BarChart } from '../../../components/charts/BarChart';
import { ResolutionTrendChart } from '../../../components/charts/ResolutionTrendChart';
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
      {/* Achievement cards — lead with what was accomplished */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AchievementCard
          label="PRs Merged"
          value={summary.mergedPRs}
          subtitle="merged in selected period"
        />
        <AchievementCard
          label="Issues Resolved"
          value={summary.closedIssues}
          subtitle="closed in selected period"
        />
        <AchievementCard
          label="Active Contributors"
          value={summary.activeContributors}
          subtitle="unique contributors in period"
        />
      </div>

      {/* Inventory cards — current state context */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Open Issues"
          value={summary.openIssues}
          subtitle="open across all repositories"
        />
        <StatCard
          label="Open PRs"
          value={summary.openPRs}
          subtitle="currently awaiting review or merge"
        />
        <StatCard
          label="Repositories"
          value={summary.totalRepos}
          subtitle="tracked in this workspace"
        />
      </div>

      {/* Security health */}
      <ScorecardPanel />

      {/* PR activity + merge velocity */}
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
          <h3 className="text-base font-medium text-gray-900 mb-1">Merge Velocity</h3>
          <p className="text-xs text-gray-400 mb-3">
            Weekly avg days to merge — downward trend means faster delivery
          </p>
          <ResolutionTrendChart data={data.mergeTimeTrend} />
        </div>
      </div>

      {/* Issue activity + most active repos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Repos by language */}
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
    </div>
  );
}
