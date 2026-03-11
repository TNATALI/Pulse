import { useGitHubContributors } from '../../../api/hooks/useGitHubAnalytics';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import type { GitHubAnalyticsParams, GitHubContributorStat } from '@pulse/shared';

interface Props {
  params: GitHubAnalyticsParams;
  onSelectContributor: (login: string) => void;
}

function MergeRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

function ContributorRow({
  stat,
  rank,
  onSelect,
  isSelected,
}: {
  stat: GitHubContributorStat;
  rank: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'border border-transparent'
      }`}
    >
      <span className="text-sm text-gray-400 w-5 text-right shrink-0">{rank}</span>
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
        {stat.login.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 block truncate">{stat.login}</span>
        <span className="text-xs text-gray-400">
          {stat.commits} commits &middot; {stat.prsReviewed} reviews
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-sm text-gray-600">
        <div className="text-right">
          <div className="font-medium">{stat.prsAuthored}</div>
          <div className="text-xs text-gray-400">PRs</div>
        </div>
        <div className="text-right">
          <MergeRateBadge rate={stat.mergeRate} />
          <div className="text-xs text-gray-400 mt-0.5">merge rate</div>
        </div>
      </div>
    </button>
  );
}

export function ContributorsReport({ params, onSelectContributor }: Props) {
  const { data, isLoading, error } = useGitHubContributors(params);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load contributors: {error.message}
      </div>
    );
  if (!data) return null;

  const { contributors, commitActivity } = data;

  // Build a simple weekly commit chart per top contributor
  const topLogins = [...new Set(commitActivity.map((c) => c.login))].slice(0, 5);
  const weeks = [...new Set(commitActivity.map((c) => c.week))].sort();

  return (
    <div className="space-y-6">
      {/* Contributor table */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-4">
          Contributor Summary — {contributors.length} contributors
        </h3>
        {contributors.length === 0 ? (
          <p className="text-sm text-gray-400">
            No PR activity found. Sync GitHub analytics data to populate this report.
          </p>
        ) : (
          <div className="space-y-1">
            {contributors.map((stat, i) => (
              <ContributorRow
                key={stat.login}
                stat={stat}
                rank={i + 1}
                isSelected={params.contributor === stat.login}
                onSelect={() => onSelectContributor(stat.login)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Commit activity table (weekly) */}
      {commitActivity.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 overflow-x-auto">
          <h3 className="text-base font-medium text-gray-900 mb-4">Commit Activity by Week</h3>
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Contributor</th>
                {weeks.map((w) => (
                  <th key={w} className="pb-2 px-2 font-medium text-xs whitespace-nowrap">
                    {w.slice(5)} {/* MM-DD */}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topLogins.map((login) => {
                const byWeek = new Map(
                  commitActivity.filter((c) => c.login === login).map((c) => [c.week, c.commits]),
                );
                const maxCommits = Math.max(...Array.from(byWeek.values()), 1);
                return (
                  <tr key={login} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{login}</td>
                    {weeks.map((w) => {
                      const n = byWeek.get(w) ?? 0;
                      const intensity = Math.round((n / maxCommits) * 5);
                      const bg = [
                        'bg-gray-50',
                        'bg-green-100',
                        'bg-green-200',
                        'bg-green-300',
                        'bg-green-400',
                        'bg-green-500',
                      ][intensity];
                      return (
                        <td key={w} className="px-2 py-2 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${bg} ${n > 0 ? 'text-gray-900' : 'text-gray-300'}`}
                            title={`${login}: ${n} commits on week of ${w}`}
                          >
                            {n > 0 ? n : ''}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
