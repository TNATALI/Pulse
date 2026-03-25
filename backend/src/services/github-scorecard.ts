/**
 * OpenSSF Scorecard integration.
 *
 * Two operations:
 *  1. getScorecardHistory  — fetches the analyses list from GitHub Code Scanning
 *     API, groups runs by date, returns a trend-line array. The latest point
 *     is enriched with the official score from api.scorecard.dev; historical
 *     points use a proxy derived from results_count.
 *
 *  2. getScorecardDetail   — on-demand SARIF fetch for a specific run. Results
 *     are cached in the scorecard_snapshots DB table so subsequent requests for
 *     the same date are instant.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { repositories } from '../db/schema/repositories.js';
import { scorecardSnapshots } from '../db/schema/scorecard-snapshots.js';
import { getInstallationOctokit } from './github-auth.js';
import { logger } from '../lib/logger.js';
import type {
  ScorecardHistoryResponse,
  ScorecardDetailResponse,
  ScorecardTrendPoint,
  ScorecardCheckResult,
} from '@pulse/shared';

// ─── Types from GitHub API ────────────────────────────────────────────────────

interface AnalysisEntry {
  id: number;
  ref: string;
  commit_sha: string;
  created_at: string;
  results_count: number;
  tool: { name: string; version: string | null };
}

interface SarifRun {
  tool: { driver: { name: string; version?: string; rules?: SarifRule[] } };
  results?: SarifResult[];
}

interface SarifRule {
  id: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: unknown[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "score is 6: some reason text" → { score: 6, reason: "some reason text" } */
function parseScoreMessage(text: string): { score: number; reason: string } {
  const match = text.match(/score is (\d+(?:\.\d+)?):\s*(.*)/is);
  if (match) {
    return { score: parseFloat(match[1]), reason: match[2].split('\n')[0].trim() };
  }
  return { score: 0, reason: text.split('\n')[0].trim() };
}

/**
 * Group analyses into runs: analyses whose timestamps fall within a 10-minute
 * window of each other belong to the same Scorecard run (GitHub uploads 3
 * SARIF files per run in quick succession).
 */
function groupIntoRuns(analyses: AnalysisEntry[]): Map<string, AnalysisEntry[]> {
  // Sort oldest-first so we scan chronologically.
  const sorted = [...analyses].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const runs = new Map<string, AnalysisEntry[]>();

  for (const a of sorted) {
    const date = a.created_at.slice(0, 10); // YYYY-MM-DD
    const existing = runs.get(date) ?? [];

    if (existing.length === 0) {
      runs.set(date, [a]);
      continue;
    }

    const lastTs = new Date(existing[existing.length - 1].created_at).getTime();
    const thisTs = new Date(a.created_at).getTime();
    const diffMin = (thisTs - lastTs) / 60000;

    if (diffMin <= 10) {
      // Same run
      existing.push(a);
    } else {
      // New run on the same calendar date — keep only the latest run per date
      runs.set(date, [a]);
    }
  }

  return runs;
}

/** Fetch and parse all SARIFs for the given analysis IDs; return merged check list. */
async function fetchAndParseChecks(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
  analysisIds: number[],
): Promise<{ checks: ScorecardCheckResult[]; version: string | null }> {
  const allRules = new Map<string, string>(); // ruleId → display name
  const allResults = new Map<string, { score: number; reason: string }>(); // ruleId → parsed
  let version: string | null = null;

  // Get an installation token for native fetch (avoids Octokit content-type ambiguity
  // with application/sarif+json which can cause the response body to be mishandled).
  const { token } = (await (octokit.auth as (opts: { type: string }) => Promise<{ token: string }>)(
    { type: 'installation' },
  ));

  for (const analysisId of analysisIds) {
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/code-scanning/analyses/${analysisId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/sarif+json' } },
      );

      if (!resp.ok) {
        logger.warn({ analysisId, status: resp.status }, 'SARIF fetch returned non-OK status');
        continue;
      }

      const sarif = (await resp.json()) as { runs?: SarifRun[] };
      const run = sarif?.runs?.[0];
      if (!run) continue;

      // semanticVersion is what Scorecard actually sets (not "version")
      version ??= (run.tool?.driver as { semanticVersion?: string })?.semanticVersion ?? null;

      // Collect all rule names
      for (const rule of run.tool?.driver?.rules ?? []) {
        allRules.set(rule.id, rule.shortDescription?.text ?? rule.id);
      }

      // Collect all results (findings = failing checks)
      for (const result of run.results ?? []) {
        if (!allResults.has(result.ruleId)) {
          allResults.set(result.ruleId, parseScoreMessage(result.message.text));
        }
      }
    } catch (err) {
      logger.warn({ analysisId, err }, 'Failed to fetch Scorecard SARIF');
    }
  }

  const checks: ScorecardCheckResult[] = [];

  for (const [ruleId, displayName] of allRules) {
    const found = allResults.get(ruleId);
    if (found) {
      checks.push({ name: displayName, score: found.score, reason: found.reason, details: null });
    } else {
      // Not in any result → passing perfectly
      checks.push({ name: displayName, score: 10, reason: 'passed', details: null });
    }
  }

  // Sort: failing first, then by score ascending
  checks.sort((a, b) => a.score - b.score);

  return { checks, version };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getScorecardHistory(workspaceId: string): Promise<ScorecardHistoryResponse> {
  const octokit = await getInstallationOctokit(workspaceId);

  // Find a repo that has Scorecard analyses — try each synced repo in order.
  const repos = await db
    .select({ owner: repositories.owner, name: repositories.name, fullName: repositories.fullName })
    .from(repositories)
    .where(eq(repositories.workspaceId, workspaceId))
    .orderBy(repositories.fullName);

  let owner = '';
  let repo = '';
  let repoFullName = '';
  let analyses: AnalysisEntry[] = [];

  for (const r of repos) {
    try {
      const { data } = await octokit.request(
        'GET /repos/{owner}/{repo}/code-scanning/analyses',
        { owner: r.owner, repo: r.name, tool_name: 'Scorecard', per_page: 100 },
      );
      if (data.length > 0) {
        owner = r.owner;
        repo = r.name;
        repoFullName = r.fullName;
        analyses = data as AnalysisEntry[];
        break;
      }
    } catch {
      // 404 / 403 — this repo doesn't have Scorecard, try next
    }
  }

  if (!repoFullName) {
    return { repoFullName: '', points: [] };
  }

  // Fetch official latest score from api.scorecard.dev (public, no auth)
  let officialScore: number | null = null;
  try {
    const resp = await fetch(
      `https://api.scorecard.dev/projects/github.com/${repoFullName}`,
      { headers: { Accept: 'application/json' } },
    );
    if (resp.ok) {
      const json = (await resp.json()) as { score?: number };
      officialScore = json.score ?? null;
    }
  } catch {
    logger.warn({ repoFullName }, 'Could not fetch official Scorecard score');
  }

  // Group analyses into daily runs
  const runsByDate = groupIntoRuns(analyses);

  // Load any previously-computed scores from the DB cache in one query.
  // These come from detail fetches (SARIF-derived averages) and are accurate.
  const cachedRows = await db
    .select({ runDate: scorecardSnapshots.runDate, overallScore: scorecardSnapshots.overallScore })
    .from(scorecardSnapshots)
    .where(
      and(
        eq(scorecardSnapshots.workspaceId, workspaceId),
        eq(scorecardSnapshots.repoFullName, repoFullName),
      ),
    );

  const cachedScores = new Map<string, number>(
    cachedRows
      .filter((r) => r.overallScore != null)
      .map((r) => [r.runDate, r.overallScore as number]),
  );

  // Build trend points (newest first)
  const datesSorted = [...runsByDate.keys()].sort((a, b) => b.localeCompare(a));
  const points: ScorecardTrendPoint[] = [];

  for (const runDate of datesSorted) {
    const group = runsByDate.get(runDate)!;
    const totalIssues = group.reduce((s, a) => s + a.results_count, 0);
    const analysisIds = group.map((a) => a.id);
    const commitSha = group[group.length - 1].commit_sha;
    const isLatest = points.length === 0;

    // Priority: official api.scorecard.dev (latest only) → DB-cached SARIF average → null
    const score =
      isLatest && officialScore !== null
        ? officialScore
        : (cachedScores.get(runDate) ?? null);

    points.push({
      runDate,
      commitSha,
      score,
      isOfficial: isLatest && officialScore !== null,
      totalIssues,
      analysisIds,
      repoFullName,
    });
  }

  return { repoFullName, points };
}

export async function getScorecardDetail(
  workspaceId: string,
  repoFullName: string,
  runDate: string,
  analysisIds: number[],
): Promise<ScorecardDetailResponse> {
  // Check DB cache first
  const cached = await db
    .select()
    .from(scorecardSnapshots)
    .where(
      and(
        eq(scorecardSnapshots.workspaceId, workspaceId),
        eq(scorecardSnapshots.repoFullName, repoFullName),
        eq(scorecardSnapshots.runDate, runDate),
      ),
    )
    .limit(1);

  if (cached.length > 0 && cached[0].checks.length > 0) {
    const row = cached[0];
    return {
      runDate: row.runDate,
      commitSha: row.commitSha,
      repoFullName: row.repoFullName,
      overallScore: row.overallScore,
      scorecardVersion: row.scorecardVersion,
      checks: row.checks,
    };
  }

  // Cache miss — fetch SARIFs
  const [ownerPart, repoPart] = repoFullName.split('/');
  const octokit = await getInstallationOctokit(workspaceId);

  const { checks, version } = await fetchAndParseChecks(
    octokit,
    ownerPart,
    repoPart,
    analysisIds,
  );

  // Calculate overall score as average of all check scores
  const overallScore =
    checks.length > 0
      ? parseFloat((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(1))
      : null;

  const now = new Date();
  const commitSha = ''; // populated from trend data on frontend; stored as-is

  // Upsert into DB
  await db
    .insert(scorecardSnapshots)
    .values({
      workspaceId,
      repoFullName,
      runDate,
      commitSha,
      overallScore,
      scorecardVersion: version,
      checks,
      analysisIds,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        scorecardSnapshots.workspaceId,
        scorecardSnapshots.repoFullName,
        scorecardSnapshots.runDate,
      ],
      set: { checks, overallScore, scorecardVersion: version, analysisIds, updatedAt: now },
    });

  return {
    runDate,
    commitSha,
    repoFullName,
    overallScore,
    scorecardVersion: version,
    checks,
  };
}
