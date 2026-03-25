import { useState, useCallback } from 'react';
import { ScorecardTrendChart } from '../../../components/charts/ScorecardTrendChart';
import { useGitHubScorecardHistory, useGitHubScorecardDetail } from '../../../api/hooks/useScorecard';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import type { ScorecardTrendPoint, ScorecardCheckResult } from '@pulse/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

function scoreBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

const BAND_COLORS = {
  high:   { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800' },
  medium: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-800' },
  low:    { bar: 'bg-red-500',    badge: 'bg-red-100   text-red-800'   },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBadge({ score, large = false }: { score: number | null; large?: boolean }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const band = scoreBand(score);
  const { badge } = BAND_COLORS[band];
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${badge} ${
        large ? 'text-lg px-3 py-0.5' : 'text-xs px-2 py-0.5'
      }`}
    >
      {score.toFixed(1)}
    </span>
  );
}

/** Compact row for the side panel — score badge + stacked name/reason + bar */
function CheckRow({ check }: { check: ScorecardCheckResult }) {
  const band = scoreBand(check.score);
  const { bar, badge } = BAND_COLORS[band];
  const pct = (check.score / 10) * 100;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      {/* Score */}
      <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge} w-8 text-center`}>
        {check.score}
      </span>

      {/* Name + reason stacked */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-800 truncate">{check.name}</div>
        <div className="text-xs text-gray-400 truncate" title={check.reason}>
          {check.reason}
        </div>
      </div>

      {/* Bar */}
      <div className="w-16 shrink-0 bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${bar} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Right-column detail — no card wrapper, renders directly into parent grid cell */
function DetailColumn({ point }: { point: ScorecardTrendPoint }) {
  const { data, isLoading, error } = useGitHubScorecardDetail(
    point.repoFullName,
    point.runDate,
    point.analysisIds,
    true,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Check Breakdown
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-mono text-indigo-600">{fmtDate(point.runDate)}</span>
            {point.commitSha && (
              <> · <span className="font-mono">{point.commitSha.slice(0, 7)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBadge score={data?.overallScore ?? point.score} large />
          {point.isOfficial && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
              official
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <LoadingSpinner />
          <span>Loading…</span>
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          Failed to load: {error.message}
        </div>
      )}

      {data && data.checks.length > 0 && (
        <div className="overflow-y-auto flex-1 pr-1">
          {data.checks.map((c: ScorecardCheckResult) => (
            <CheckRow key={c.name} check={c} />
          ))}
        </div>
      )}

      {data && data.checks.length === 0 && (
        <p className="text-xs text-gray-400 py-6 text-center">
          No check details available for this snapshot.
        </p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ScorecardPanel() {
  const { data, isLoading, error } = useGitHubScorecardHistory();
  const [selectedPoint, setSelectedPoint] = useState<ScorecardTrendPoint | null>(null);

  const handleSelect = useCallback((point: ScorecardTrendPoint) => {
    setSelectedPoint(point);
  }, []);

  // Default to first (latest) point; user selection overrides
  const activePoint = selectedPoint ?? data?.points[0] ?? null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-3">
          Security Score (OpenSSF Scorecard)
        </h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load Scorecard data: {error.message}
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-2">
          Security Score (OpenSSF Scorecard)
        </h3>
        <p className="text-sm text-gray-400">
          No Scorecard analyses found. Ensure the OpenSSF Scorecard GitHub Action is enabled and
          the GitHub App has <code>security_events: read</code> permission.
        </p>
      </div>
    );
  }

  const latest = data.points[0];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Shared header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-medium text-gray-900">
          Security Score (OpenSSF Scorecard)
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Latest</span>
          <ScoreBadge score={latest.score} large />
          {latest.isOfficial && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              official
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {data.repoFullName} · Click a point on the chart to inspect that day
      </p>

      {/* Side-by-side: chart left (3/5) | breakdown right (2/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
        {/* Left — trend chart */}
        <div className="lg:col-span-3 lg:border-r lg:border-gray-100 lg:pr-6">
          <ScorecardTrendChart
            points={data.points}
            selectedDate={activePoint?.runDate ?? null}
            onSelect={handleSelect}
          />
        </div>

        {/* Right — check breakdown */}
        <div className="lg:col-span-2 lg:pl-6 mt-4 lg:mt-0">
          {activePoint && <DetailColumn point={activePoint} />}
        </div>
      </div>
    </div>
  );
}
