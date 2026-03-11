import { useGitHubCodeReview } from '../../../api/hooks/useGitHubAnalytics';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import type { GitHubAnalyticsParams } from '@pulse/shared';

interface Props {
  params: GitHubAnalyticsParams;
}

export function CodeReviewReport({ params }: Props) {
  const { data, isLoading, error } = useGitHubCodeReview(params);

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load code review data: {error.message}
      </div>
    );
  if (!data) return null;

  const { reviewerAuthorMatrix, topReviewers, contributorBalance } = data;

  // Build compact matrix: unique reviewers × unique authors
  const reviewers = [...new Set(reviewerAuthorMatrix.map((r) => r.reviewer))];
  const authors = [...new Set(reviewerAuthorMatrix.map((r) => r.author))];
  const maxCount = Math.max(...reviewerAuthorMatrix.map((r) => r.count), 1);

  // Map for fast lookup
  const matrixMap = new Map(
    reviewerAuthorMatrix.map((r) => [`${r.reviewer}::${r.author}`, r.count]),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top reviewers */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Top Reviewers</h3>
          {topReviewers.length === 0 ? (
            <p className="text-sm text-gray-400">No review data yet.</p>
          ) : (
            <div className="space-y-3">
              {topReviewers.map((r, i) => (
                <div key={r.login} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
                    {r.login.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 block">{r.login}</span>
                    <span className="text-xs text-gray-400">
                      {r.reposReviewed} repo{r.reposReviewed !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {r.reviewCount} reviews
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contributor balance */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-base font-medium text-gray-900 mb-4">Review Balance</h3>
          <p className="text-xs text-gray-500 mb-3">PRs authored vs PRs reviewed per contributor</p>
          {contributorBalance.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {contributorBalance.slice(0, 15).map((c) => {
                const maxVal = Math.max(c.prsAuthored, c.prsReviewed, 1);
                return (
                  <div key={c.login}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{c.login}</span>
                      <span className="text-xs text-gray-400">
                        {c.prsAuthored} authored · {c.prsReviewed} reviewed
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div
                        className="bg-blue-400 rounded-l h-full"
                        style={{ width: `${(c.prsAuthored / maxVal) * 50}%` }}
                        title={`${c.prsAuthored} authored`}
                      />
                      <div
                        className="bg-green-400 rounded-r h-full"
                        style={{ width: `${(c.prsReviewed / maxVal) * 50}%` }}
                        title={`${c.prsReviewed} reviewed`}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-blue-400 rounded" /> Authored
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-green-400 rounded" /> Reviewed
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviewer × Author matrix */}
      {reviewerAuthorMatrix.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 overflow-x-auto">
          <h3 className="text-base font-medium text-gray-900 mb-1">Reviewer × Author Matrix</h3>
          <p className="text-xs text-gray-500 mb-4">
            How many PRs each reviewer reviewed per author — darker = more reviews
          </p>
          <table className="text-xs">
            <thead>
              <tr>
                <th className="text-left pr-3 pb-2 text-gray-500 font-medium">Reviewer ↓ / Author →</th>
                {authors.slice(0, 12).map((a) => (
                  <th key={a} className="px-2 pb-2 text-gray-500 font-medium whitespace-nowrap">
                    {a.length > 10 ? a.slice(0, 9) + '…' : a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewers.slice(0, 15).map((rev) => (
                <tr key={rev}>
                  <td className="pr-3 py-1 font-medium text-gray-700 whitespace-nowrap">{rev}</td>
                  {authors.slice(0, 12).map((auth) => {
                    const count = matrixMap.get(`${rev}::${auth}`) ?? 0;
                    const intensity = Math.round((count / maxCount) * 5);
                    const bg = [
                      'bg-gray-50 text-gray-300',
                      'bg-blue-100 text-blue-700',
                      'bg-blue-200 text-blue-800',
                      'bg-blue-300 text-blue-900',
                      'bg-blue-400 text-white',
                      'bg-blue-600 text-white',
                    ][intensity];
                    return (
                      <td key={auth} className="px-2 py-1 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-7 rounded text-xs font-medium ${bg}`}
                          title={`${rev} reviewed ${count} PRs by ${auth}`}
                        >
                          {count > 0 ? count : ''}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
