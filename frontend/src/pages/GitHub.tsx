import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useGitHubRepos,
  useGitHubSyncStatus,
  useTriggerGitHubDataSync,
} from '../api/hooks/useGitHubAnalytics';
import { Toast } from '../components/common/Toast';
import { OverviewReport } from './github/reports/OverviewReport';
import { ContributorsReport } from './github/reports/ContributorsReport';
import { PRHealthReport } from './github/reports/PRHealthReport';
import { CodeReviewReport } from './github/reports/CodeReviewReport';
import { IssuesReport } from './github/reports/IssuesReport';
import type { GitHubAnalyticsParams, GitHubRepository } from '@pulse/shared';

// ─── Report registry ──────────────────────────────────────────────────────────
// To add a new report: import your component and push an entry to this array.
// Nothing else needs to change.

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<ReportComponentProps>;
}

interface ReportComponentProps {
  params: GitHubAnalyticsParams;
  onSelectContributor?: (login: string) => void;
}

const GITHUB_REPORTS: ReportConfig[] = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Repository activity at a glance',
    component: OverviewReport,
  },
  {
    id: 'contributors',
    title: 'Contributors',
    description: 'Commit and PR activity per person',
    component: ContributorsReport as React.ComponentType<ReportComponentProps>,
  },
  {
    id: 'pr-health',
    title: 'PR Health',
    description: 'Pull request lifecycle and merge metrics',
    component: PRHealthReport,
  },
  {
    id: 'code-review',
    title: 'Code Review',
    description: 'Who reviews whom and review coverage',
    component: CodeReviewReport,
  },
  {
    id: 'issues',
    title: 'Issues',
    description: 'Backlog health and issue velocity',
    component: IssuesReport,
  },
];

// ─── Date helpers ──────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultStart() {
  return fmt(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
}
function defaultEnd() {
  return fmt(new Date());
}

// ─── Repo selector ────────────────────────────────────────────────────────────

function RepoSelector({
  repos,
  selected,
  onChange,
}: {
  repos: GitHubRepository[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selected);
  const label =
    selected.length === 0
      ? 'All repositories'
      : selected.length === 1
        ? repos.find((r) => r.id === selected[0])?.name ?? '1 repo'
        : `${selected.length} repos`;

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        <span className="max-w-[180px] truncate">{label}</span>
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-72 overflow-y-auto">
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${selected.length === 0 ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
            >
              All repositories
            </button>
            <div className="border-t border-gray-100 my-1" />
            {repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => toggle(repo.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    selectedSet.has(repo.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedSet.has(repo.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="truncate block text-gray-800">{repo.fullName}</span>
                  {repo.language && (
                    <span className="text-xs text-gray-400">{repo.language}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sync status badge ────────────────────────────────────────────────────────

function SyncStatusBadge({ status, lastSyncAt }: { status: string; lastSyncAt: string | null }) {
  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-600">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Syncing…
      </span>
    );
  }
  if (status === 'error') {
    return <span className="text-xs text-red-600">Sync error</span>;
  }
  if (lastSyncAt) {
    const d = new Date(lastSyncAt);
    return (
      <span className="text-xs text-gray-400">
        Last synced {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  return <span className="text-xs text-gray-400">Never synced</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GitHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ── Filters ──
  const [selectedRepos, setSelectedRepos] = useState<string[]>(() =>
    (searchParams.get('repos') ?? '').split(',').filter(Boolean),
  );
  const [startDate, setStartDate] = useState(
    () => searchParams.get('startDate') ?? defaultStart(),
  );
  const [endDate, setEndDate] = useState(
    () => searchParams.get('endDate') ?? defaultEnd(),
  );
  const [contributor, setContributor] = useState<string | undefined>(
    () => searchParams.get('contributor') ?? undefined,
  );
  const [activeReport, setActiveReport] = useState(
    () => searchParams.get('report') ?? GITHUB_REPORTS[0].id,
  );

  // ── URL sync ──
  useEffect(() => {
    const p: Record<string, string> = { report: activeReport, startDate, endDate };
    if (selectedRepos.length > 0) p.repos = selectedRepos.join(',');
    if (contributor) p.contributor = contributor;
    setSearchParams(p, { replace: true });
  }, [activeReport, selectedRepos, startDate, endDate, contributor, setSearchParams]);

  // ── Data ──
  const { data: repos } = useGitHubRepos();
  const { data: syncStatus } = useGitHubSyncStatus();
  const dataSyncMutation = useTriggerGitHubDataSync();

  const analyticsParams = useMemo<GitHubAnalyticsParams>(
    () => ({
      repoIds: selectedRepos.length > 0 ? selectedRepos : undefined,
      startDate,
      endDate,
      contributor,
    }),
    [selectedRepos, startDate, endDate, contributor],
  );

  const handleSync = useCallback(() => {
    dataSyncMutation.mutate(undefined, {
      onSuccess: () => setToast({ message: 'Analytics sync started — this may take a few minutes.', type: 'info' }),
      onError: (err) => setToast({ message: `Sync failed: ${err.message}`, type: 'error' }),
    });
  }, [dataSyncMutation]);

  const handleSelectContributor = useCallback((login: string) => {
    setContributor((prev) => (prev === login ? undefined : login));
  }, []);

  const hasRepos = repos && repos.length > 0;
  const isSyncing =
    syncStatus?.repos.status === 'syncing' || syncStatus?.analytics.status === 'syncing';

  // ── No repos connected ──
  if (repos && !hasRepos) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">GitHub Analytics</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <p className="mb-2">No repositories synced yet.</p>
          <p className="text-sm">
            Configure your GitHub App in{' '}
            <a href="/settings" className="text-blue-600 hover:underline">
              Settings
            </a>{' '}
            and sync your repositories first.
          </p>
        </div>
      </div>
    );
  }

  // ── Active report ──
  const reportConfig = GITHUB_REPORTS.find((r) => r.id === activeReport) ?? GITHUB_REPORTS[0];
  const ReportComponent = reportConfig.component;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">GitHub Analytics</h1>
        <div className="flex items-center gap-3">
          {syncStatus && (
            <SyncStatusBadge
              status={syncStatus.analytics.status}
              lastSyncAt={syncStatus.analytics.lastSyncAt}
            />
          )}
          <button
            onClick={handleSync}
            disabled={dataSyncMutation.isPending || isSyncing}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dataSyncMutation.isPending || isSyncing ? 'Syncing…' : 'Sync Analytics Data'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white rounded-lg border border-gray-200 px-4 py-3">
        {/* Repo selector */}
        {repos && (
          <RepoSelector repos={repos} selected={selectedRepos} onChange={setSelectedRepos} />
        )}

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <label className="text-xs text-gray-500">to</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Contributor filter */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={contributor ?? ''}
            onChange={(e) => setContributor(e.target.value || undefined)}
            placeholder="Filter by GitHub login"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-48"
          />
          {contributor && (
            <button
              onClick={() => setContributor(undefined)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {GITHUB_REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            title={report.description}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeReport === report.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {report.title}
          </button>
        ))}
      </div>

      {/* Active report */}
      <ReportComponent
        params={analyticsParams}
        onSelectContributor={handleSelectContributor}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
