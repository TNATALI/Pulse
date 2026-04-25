import { useGitHubIssues } from '../../../api/hooks/useGitHubAnalytics';
import { StatCard } from '../../../components/analytics/StatCard';
import { BarChart } from '../../../components/charts/BarChart';
import { ResolutionTrendChart } from '../../../components/charts/ResolutionTrendChart';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { IssueTypesPanel } from './IssueTypesPanel';
import { LabelsPanel } from './LabelsPanel';
import type { GitHubAnalyticsParams } from '@pulse/shared';

interface Props {
  params: GitHubAnalyticsParams;
}

export function IssuesReport({ params }: Props) {
  const { data, isLoading, error } = useGitHubIssues(params);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load issues data: {error.message}
      </div>
    );
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Issues Resolved"
          value={summary.closedIssues}
          subtitle={`${summary.openIssues} opened & still open this period`}
        />
        <StatCard
          label="Active Contributors"
          value={summary.activeContributors}
          subtitle="raised issues this period"
        />
        <StatCard
          label="Issue Velocity"
          value={data.velocity.reduce((s, w) => s + w.opened, 0)}
          subtitle="total opened in period"
        />
      </div>

      {/* Issue Types + Labels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IssueTypesPanel typeBreakdown={data.typeBreakdown} />
        <LabelsPanel labelBreakdown={data.labelBreakdown} />
      </div>

      {/* Resolution speed + weekly velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-1">Resolution Speed</h3>
          <p className="text-xs text-gray-400 mb-3">
            Weekly avg days to close — downward trend means faster resolution
          </p>
          <ResolutionTrendChart data={data.closeTimeTrend} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Issue Velocity (weekly)</h3>
          {data.velocity.length > 0 ? (
            <BarChart
              data={data.velocity.map((d) => ({
                label: `${d.week.slice(5)}-${d.week.slice(0, 4)}`,
                value: d.opened,
              }))}
              orientation="vertical"
              color="#3b82f6"
              xLabel="Week"
              yLabel="Opened"
            />
          ) : (
            <p className="text-sm text-gray-400">No issue activity in this period.</p>
          )}
        </div>
      </div>

      {/* Issues by repo */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-4">Issues by Repo</h3>
        {data.byRepo.length === 0 ? (
          <p className="text-sm text-gray-400">No issue data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.byRepo.map((r) => {
              const total = r.open + r.closed;
              const closedPct = total > 0 ? (r.closed / total) * 100 : 0;
              return (
                <div key={r.repo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-700 truncate max-w-[55%]">
                      {r.repo}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {r.closed} resolved · {r.open} open
                    </span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="bg-green-400 h-full"
                      style={{ width: `${closedPct}%` }}
                      title={`${r.closed} resolved`}
                    />
                    <div
                      className="bg-orange-300 h-full"
                      style={{ width: `${100 - closedPct}%` }}
                      title={`${r.open} open`}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 bg-green-400 rounded" /> Resolved
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 bg-orange-300 rounded" /> Open
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Oldest open issues */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-4">Priority Queue</h3>
        {data.oldestOpenIssues.length === 0 ? (
          <p className="text-sm text-gray-400">No open issues.</p>
        ) : (
          <div className="space-y-2">
            {data.oldestOpenIssues.map((issue) => (
              <div
                key={`${issue.repo}#${issue.number}`}
                className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://github.com/${issue.repo}/issues/${issue.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {issue.title}
                  </a>
                  <span className="text-xs text-gray-400">
                    {issue.repo}#{issue.number}
                    {issue.author && ` · ${issue.author}`}
                  </span>
                  {issue.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {issue.labels.slice(0, 3).map((l) => (
                        <span key={l} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={`ml-3 shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                    issue.ageDays > 90
                      ? 'bg-red-100 text-red-700'
                      : issue.ageDays > 30
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {issue.ageDays}d
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
