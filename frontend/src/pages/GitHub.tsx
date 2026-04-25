import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// ─── PDF download ─────────────────────────────────────────────────────────────

async function downloadAllReportsPDF(container: HTMLElement, dateRange: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const sections = Array.from(
    container.querySelectorAll<HTMLElement>('[data-report-section]'),
  );

  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  let isFirst = true;

  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    if (canvas.width === 0 || canvas.height === 0) continue;

    const imgH = (canvas.height * contentW) / canvas.width;

    if (!isFirst) pdf.addPage();
    isFirst = false;

    let y = margin;
    let remaining = imgH;

    while (remaining > 0) {
      const sliceH = Math.min(remaining, pageH - margin * 2);
      const srcYRatio = (imgH - remaining) / imgH;
      const srcHRatio = sliceH / imgH;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.round(canvas.height * srcHRatio);
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, -canvas.height * srcYRatio);

      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, contentW, sliceH);
      remaining -= sliceH;

      if (remaining > 0) {
        pdf.addPage();
        y = margin;
      }
    }
  }

  pdf.save(`github-report-${dateRange}.pdf`);
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
  const [filter, setFilter] = useState('');

  const selectedSet = new Set(selected);
  const label =
    selected.length === 0
      ? 'All repositories'
      : selected.length === 1
        ? repos.find((r) => r.id === selected[0])?.fullName ?? '1 repo'
        : `${selected.length} repos`;

  const filtered = filter.trim()
    ? repos.filter(
        (r) =>
          r.fullName.toLowerCase().includes(filter.toLowerCase()) ||
          (r.language ?? '').toLowerCase().includes(filter.toLowerCase()),
      )
    : repos;

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const handleOpen = () => {
    setFilter('');
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
          </svg>
          <span className="max-w-xs truncate">{label}</span>
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-120 rounded-lg border border-gray-200 bg-white shadow-lg">
            {/* Search input */}
            <div className="px-3 pt-2 pb-1">
              <input
                autoFocus
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter repositories…"
                className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {/* All repositories option — only show when no filter active */}
              {!filter && (
                <>
                  <button
                    onClick={() => { onChange([]); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${selected.length === 0 ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    All repositories
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                </>
              )}

              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">No repositories match.</p>
              )}

              {filtered.map((repo) => (
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
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-gray-800">{repo.fullName}</span>
                    {repo.language && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {repo.language}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadReport = useCallback(async () => {
    if (!printContainerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await downloadAllReportsPDF(
        printContainerRef.current,
        `${startDate}_${endDate}`,
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [startDate, endDate]);

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
    <div className="relative">
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

        {/* Download Report */}
        <button
          onClick={handleDownloadReport}
          disabled={isGeneratingPdf}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPdf ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download Report
            </>
          )}
        </button>
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

      {/* Hidden all-reports print container — captured for PDF download */}
      <div
        ref={printContainerRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '1200px',
          background: '#ffffff',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {GITHUB_REPORTS.map(({ id, title, description, component: Component }, idx) => (
          <div
            key={id}
            data-report-section={id}
            style={{
              padding: '32px',
              background: '#ffffff',
              borderTop: idx > 0 ? '8px solid #f3f4f6' : undefined,
            }}
          >
            <div
              style={{
                borderBottom: '2px solid #111827',
                paddingBottom: '12px',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>
                {title}
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{description}</p>
            </div>
            <Component params={analyticsParams} onSelectContributor={() => {}} />
          </div>
        ))}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
