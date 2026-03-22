/**
 * GitHub analytics queries.
 *
 * All functions accept a workspaceId + GitHubAnalyticsParams.
 * repoIds (DB UUIDs) are resolved to fullName strings before querying
 * pull_requests / issues / commits which use the varchar `repo` column.
 */

import { sql, eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { repositories } from '../db/schema/repositories.js';
import type {
  GitHubAnalyticsParams,
  GitHubOverviewData,
  GitHubContributorsData,
  GitHubPRHealthData,
  GitHubCodeReviewData,
  GitHubIssuesData,
} from '@pulse/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveRepoNames(
  workspaceId: string,
  repoIds?: string[],
): Promise<string[] | null> {
  if (!repoIds || repoIds.length === 0) return null;
  const rows = await db
    .select({ fullName: repositories.fullName })
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), inArray(repositories.id, repoIds)));
  return rows.map((r) => r.fullName);
}

// Build the repo SQL condition for use inside raw sql templates.
// Returns a fragment that evaluates to TRUE when no filter is applied.
function repoCondition(repoNames: string[] | null): ReturnType<typeof sql> {
  if (repoNames === null) return sql`TRUE`;
  if (repoNames.length === 0) return sql`FALSE`;
  // Use ANY with a parameterised array literal
  return sql`repo = ANY(ARRAY[${sql.join(
    repoNames.map((n) => sql`${n}`),
    sql`, `,
  )}]::text[])`;
}

function issueRepoCondition(repoNames: string[] | null): ReturnType<typeof sql> {
  if (repoNames === null) return sql`TRUE`;
  if (repoNames.length === 0) return sql`FALSE`;
  return sql`repo = ANY(ARRAY[${sql.join(
    repoNames.map((n) => sql`${n}`),
    sql`, `,
  )}]::text[])`;
}

function commitRepoCondition(repoNames: string[] | null): ReturnType<typeof sql> {
  if (repoNames === null) return sql`TRUE`;
  if (repoNames.length === 0) return sql`FALSE`;
  return sql`c.repo_full_name = ANY(ARRAY[${sql.join(
    repoNames.map((n) => sql`${n}`),
    sql`, `,
  )}]::text[])`;
}

// ─── Overview ────────────────────────────────────────────────────────────────

export async function getOverviewData(
  workspaceId: string,
  params: GitHubAnalyticsParams,
): Promise<GitHubOverviewData> {
  const repoNames = await resolveRepoNames(workspaceId, params.repoIds);
  const repoCond = repoCondition(repoNames);
  const { startDate, endDate } = params;

  const [summaryRows, totalRepoRows, prActivityRows, issueActivityRows, langRows, topRepoRows] =
    await Promise.all([
      // Summary: PR + issue counts + active contributors + avg merge time
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM pull_requests
           WHERE workspace_id = ${workspaceId} AND state = 'open' AND ${repoCond}) AS open_prs,
          (SELECT COUNT(*)::int FROM pull_requests
           WHERE workspace_id = ${workspaceId} AND merged_at IS NOT NULL
             AND merged_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
             AND ${repoCond}) AS merged_prs,
          (SELECT COUNT(*)::int FROM issues
           WHERE workspace_id = ${workspaceId} AND state = 'open' AND ${issueRepoCondition(repoNames)}) AS open_issues,
          (SELECT COUNT(*)::int FROM issues
           WHERE workspace_id = ${workspaceId} AND state = 'closed'
             AND closed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
             AND ${issueRepoCondition(repoNames)}) AS closed_issues,
          (SELECT COUNT(DISTINCT author_github_username)::int FROM pull_requests
           WHERE workspace_id = ${workspaceId}
             AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
             AND author_github_username IS NOT NULL
             AND ${repoCond}) AS active_contributors,
          (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (merged_at - created_at)) / 86400)::numeric, 1)
           FROM pull_requests
           WHERE workspace_id = ${workspaceId} AND merged_at IS NOT NULL
             AND merged_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
             AND ${repoCond}) AS avg_merge_time_days
      `),

      // Total repos in workspace (filtered by selected repos if applicable)
      db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM repositories
        WHERE workspace_id = ${workspaceId}
          ${repoNames ? sql`AND full_name = ANY(ARRAY[${sql.join(repoNames.map((n) => sql`${n}`), sql`, `)}]::text[])` : sql``}
      `),

      // PR activity by week
      db.execute(sql`
        SELECT
          to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
          COUNT(*)::int AS opened,
          COUNT(*) FILTER (WHERE merged_at IS NOT NULL)::int AS merged
        FROM pull_requests
        WHERE workspace_id = ${workspaceId}
          AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          AND ${repoCond}
        GROUP BY week
        ORDER BY week
      `),

      // Issue activity by week
      db.execute(sql`
        SELECT
          to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
          COUNT(*)::int AS opened,
          COUNT(*) FILTER (WHERE closed_at IS NOT NULL AND
            closed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::int AS closed
        FROM issues
        WHERE workspace_id = ${workspaceId}
          AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          AND ${issueRepoCondition(repoNames)}
        GROUP BY week
        ORDER BY week
      `),

      // Repos by language
      db.execute(sql`
        SELECT
          COALESCE(language, 'Unknown') AS language,
          COUNT(*)::int AS count
        FROM repositories
        WHERE workspace_id = ${workspaceId}
          ${repoNames ? sql`AND full_name = ANY(ARRAY[${sql.join(repoNames.map((n) => sql`${n}`), sql`, `)}]::text[])` : sql``}
        GROUP BY language
        ORDER BY count DESC
        LIMIT 10
      `),

      // Top repos by PR + issue activity
      db.execute(sql`
        SELECT
          repo,
          COUNT(*)::int AS pr_count,
          0::int AS issue_count
        FROM pull_requests
        WHERE workspace_id = ${workspaceId}
          AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          AND ${repoCond}
        GROUP BY repo
        ORDER BY pr_count DESC
        LIMIT 10
      `),
    ]);

  const s = (summaryRows as unknown as Record<string, unknown>[])[0] ?? {};

  return {
    summary: {
      totalRepos: Number((totalRepoRows as unknown as { total: number }[])[0]?.total ?? 0),
      openPRs: Number(s.open_prs ?? 0),
      mergedPRs: Number(s.merged_prs ?? 0),
      openIssues: Number(s.open_issues ?? 0),
      closedIssues: Number(s.closed_issues ?? 0),
      activeContributors: Number(s.active_contributors ?? 0),
      avgMergeTimeDays: s.avg_merge_time_days != null ? Number(s.avg_merge_time_days) : null,
    },
    prActivity: (prActivityRows as unknown as { week: string; opened: number; merged: number }[]).map(
      (r) => ({ week: r.week, opened: Number(r.opened), merged: Number(r.merged) }),
    ),
    issueActivity: (
      issueActivityRows as unknown as { week: string; opened: number; closed: number }[]
    ).map((r) => ({ week: r.week, opened: Number(r.opened), closed: Number(r.closed) })),
    reposByLanguage: (langRows as unknown as { language: string; count: number }[]).map((r) => ({
      language: r.language,
      count: Number(r.count),
    })),
    topActiveRepos: (
      topRepoRows as unknown as { repo: string; pr_count: number; issue_count: number }[]
    ).map((r) => ({
      repo: r.repo,
      prCount: Number(r.pr_count),
      issueCount: Number(r.issue_count),
    })),
  };
}

// ─── Contributors ─────────────────────────────────────────────────────────────

export async function getContributorsData(
  workspaceId: string,
  params: GitHubAnalyticsParams,
): Promise<GitHubContributorsData> {
  const repoNames = await resolveRepoNames(workspaceId, params.repoIds);
  const repoCond = repoCondition(repoNames);
  const { startDate, endDate, contributor } = params;
  const contribFilter = contributor
    ? sql`AND author_github_username = ${contributor}`
    : sql``;

  const [statsRows, reviewRows, commitRows, commitActivityRows] = await Promise.all([
    // PR stats per contributor
    db.execute(sql`
      SELECT
        author_github_username AS login,
        COUNT(*)::int AS prs_authored,
        COUNT(*) FILTER (WHERE merged_at IS NOT NULL)::int AS prs_merged
      FROM pull_requests
      WHERE workspace_id = ${workspaceId}
        AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND author_github_username IS NOT NULL
        AND ${repoCond}
        ${contribFilter}
      GROUP BY author_github_username
      ORDER BY prs_authored DESC
      LIMIT 30
    `),

    // Reviews per contributor (unnest reviewers jsonb array)
    db.execute(sql`
      SELECT reviewer AS login, COUNT(*)::int AS prs_reviewed
      FROM pull_requests pr,
           jsonb_array_elements_text(pr.reviewers) AS reviewer
      WHERE pr.workspace_id = ${workspaceId}
        AND pr.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${repoCond}
        ${contributor ? sql`AND reviewer = ${contributor}` : sql``}
      GROUP BY reviewer
      ORDER BY prs_reviewed DESC
    `),

    // Commit counts per contributor
    db.execute(sql`
      SELECT author_login AS login, COUNT(*)::int AS commits
      FROM commits c
      WHERE c.workspace_id = ${workspaceId}
        AND c.committed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${commitRepoCondition(repoNames)}
        ${contributor ? sql`AND c.author_login = ${contributor}` : sql``}
        AND c.author_login IS NOT NULL
      GROUP BY author_login
      ORDER BY commits DESC
    `),

    // Commit activity by week + contributor (top 10 contributors for chart)
    db.execute(sql`
      SELECT
        to_char(date_trunc('week', committed_at), 'YYYY-MM-DD') AS week,
        author_login AS login,
        COUNT(*)::int AS commits
      FROM commits c
      WHERE c.workspace_id = ${workspaceId}
        AND c.committed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${commitRepoCondition(repoNames)}
        AND c.author_login IS NOT NULL
        ${contributor ? sql`AND c.author_login = ${contributor}` : sql``}
        AND c.author_login IN (
          SELECT author_login FROM commits
          WHERE workspace_id = ${workspaceId}
            AND committed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
            AND ${commitRepoCondition(repoNames)}
            AND author_login IS NOT NULL
          GROUP BY author_login
          ORDER BY COUNT(*) DESC
          LIMIT 10
        )
      GROUP BY week, author_login
      ORDER BY week, commits DESC
    `),
  ]);

  // Merge PR stats + review counts + commit counts into per-contributor objects
  const statsMap = new Map<
    string,
    { prsAuthored: number; prsMerged: number; prsReviewed: number; commits: number }
  >();

  for (const r of statsRows as unknown as {
    login: string;
    prs_authored: number;
    prs_merged: number;
  }[]) {
    statsMap.set(r.login, {
      prsAuthored: Number(r.prs_authored),
      prsMerged: Number(r.prs_merged),
      prsReviewed: 0,
      commits: 0,
    });
  }

  for (const r of reviewRows as unknown as { login: string; prs_reviewed: number }[]) {
    const entry = statsMap.get(r.login) ?? {
      prsAuthored: 0,
      prsMerged: 0,
      prsReviewed: 0,
      commits: 0,
    };
    entry.prsReviewed = Number(r.prs_reviewed);
    statsMap.set(r.login, entry);
  }

  for (const r of commitRows as unknown as { login: string; commits: number }[]) {
    const entry = statsMap.get(r.login) ?? {
      prsAuthored: 0,
      prsMerged: 0,
      prsReviewed: 0,
      commits: 0,
    };
    entry.commits = Number(r.commits);
    statsMap.set(r.login, entry);
  }

  const contributors = Array.from(statsMap.entries())
    .map(([login, s]) => ({
      login,
      prsAuthored: s.prsAuthored,
      prsMerged: s.prsMerged,
      prsReviewed: s.prsReviewed,
      issuesOpened: 0, // populated below
      commits: s.commits,
      mergeRate: s.prsAuthored > 0 ? Math.round((s.prsMerged / s.prsAuthored) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.prsAuthored - a.prsAuthored);

  return {
    contributors,
    commitActivity: (
      commitActivityRows as unknown as { week: string; login: string; commits: number }[]
    ).map((r) => ({ week: r.week, login: r.login, commits: Number(r.commits) })),
  };
}

// ─── PR Health ────────────────────────────────────────────────────────────────

export async function getPRHealthData(
  workspaceId: string,
  params: GitHubAnalyticsParams,
): Promise<GitHubPRHealthData> {
  const repoNames = await resolveRepoNames(workspaceId, params.repoIds);
  const repoCond = repoCondition(repoNames);
  const { startDate, endDate } = params;

  const [summaryRows, stalePRRows, cycleRows, mergeRateRows] = await Promise.all([
    // Summary
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE state = 'open')::int AS open_prs,
        COUNT(*) FILTER (WHERE state = 'open' AND created_at < NOW() - interval '7 days')::int AS stale_prs,
        ROUND(AVG(EXTRACT(EPOCH FROM (merged_at - created_at)) / 86400)
          FILTER (WHERE merged_at IS NOT NULL
            AND merged_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::numeric, 1)
          AS avg_cycle_time_days,
        ROUND(
          COUNT(*) FILTER (WHERE merged_at IS NOT NULL
            AND merged_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::numeric /
          NULLIF(COUNT(*) FILTER (
            WHERE (merged_at IS NOT NULL OR closed_at IS NOT NULL)
              AND COALESCE(merged_at, closed_at) BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          ), 0),
        2) AS merge_rate
      FROM pull_requests
      WHERE workspace_id = ${workspaceId} AND ${repoCond}
    `),

    // Stale PR list (open > 7 days, limit 20)
    db.execute(sql`
      SELECT
        repo,
        number,
        title,
        author_github_username AS author,
        EXTRACT(DAY FROM NOW() - created_at)::int AS age_days
      FROM pull_requests
      WHERE workspace_id = ${workspaceId}
        AND state = 'open'
        AND created_at < NOW() - interval '7 days'
        AND ${repoCond}
      ORDER BY age_days DESC
      LIMIT 20
    `),

    // Cycle time trend by week
    db.execute(sql`
      SELECT
        to_char(date_trunc('week', merged_at), 'YYYY-MM-DD') AS week,
        ROUND(AVG(EXTRACT(EPOCH FROM (merged_at - created_at)) / 86400)::numeric, 1) AS avg_days
      FROM pull_requests
      WHERE workspace_id = ${workspaceId}
        AND merged_at IS NOT NULL
        AND merged_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${repoCond}
      GROUP BY week
      ORDER BY week
    `),

    // Merge rate by repo
    db.execute(sql`
      SELECT
        repo,
        COUNT(*) FILTER (WHERE merged_at IS NOT NULL)::int AS merged,
        COUNT(*)::int AS total,
        ROUND(
          COUNT(*) FILTER (WHERE merged_at IS NOT NULL)::numeric /
          NULLIF(COUNT(*), 0),
        2) AS merge_rate
      FROM pull_requests
      WHERE workspace_id = ${workspaceId}
        AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${repoCond}
      GROUP BY repo
      ORDER BY total DESC
      LIMIT 15
    `),
  ]);

  const s = (summaryRows as unknown as Record<string, unknown>[])[0] ?? {};

  return {
    summary: {
      openPRs: Number(s.open_prs ?? 0),
      stalePRs: Number(s.stale_prs ?? 0),
      avgCycleTimeDays: s.avg_cycle_time_days != null ? Number(s.avg_cycle_time_days) : null,
      mergeRate: s.merge_rate != null ? Number(s.merge_rate) : 0,
    },
    stalePRList: (
      stalePRRows as unknown as {
        repo: string;
        number: number;
        title: string;
        author: string | null;
        age_days: number;
      }[]
    ).map((r) => ({
      repo: r.repo,
      number: Number(r.number),
      title: r.title,
      author: r.author,
      ageDays: Number(r.age_days),
      htmlUrl: `https://github.com/${r.repo}/pull/${r.number}`,
    })),
    cycleTimeTrend: (cycleRows as unknown as { week: string; avg_days: number }[]).map((r) => ({
      week: r.week,
      avgDays: Number(r.avg_days),
    })),
    mergeRateByRepo: (
      mergeRateRows as unknown as {
        repo: string;
        merged: number;
        total: number;
        merge_rate: number;
      }[]
    ).map((r) => ({
      repo: r.repo,
      merged: Number(r.merged),
      total: Number(r.total),
      mergeRate: Number(r.merge_rate),
    })),
  };
}

// ─── Code Review ─────────────────────────────────────────────────────────────

export async function getCodeReviewData(
  workspaceId: string,
  params: GitHubAnalyticsParams,
): Promise<GitHubCodeReviewData> {
  const repoNames = await resolveRepoNames(workspaceId, params.repoIds);
  const repoCond = repoCondition(repoNames);
  const { startDate, endDate } = params;

  const [matrixRows, reviewerRows, balanceRows] = await Promise.all([
    // Reviewer × author matrix (unnest reviewers JSONB)
    db.execute(sql`
      SELECT
        reviewer AS reviewer,
        pr.author_github_username AS author,
        COUNT(*)::int AS count
      FROM pull_requests pr,
           jsonb_array_elements_text(pr.reviewers) AS reviewer
      WHERE pr.workspace_id = ${workspaceId}
        AND pr.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND pr.author_github_username IS NOT NULL
        AND reviewer != pr.author_github_username
        AND ${repoCond}
      GROUP BY reviewer, pr.author_github_username
      ORDER BY count DESC
      LIMIT 100
    `),

    // Top reviewers with repo breadth
    db.execute(sql`
      SELECT
        reviewer AS login,
        COUNT(*)::int AS review_count,
        COUNT(DISTINCT pr.repo)::int AS repos_reviewed
      FROM pull_requests pr,
           jsonb_array_elements_text(pr.reviewers) AS reviewer
      WHERE pr.workspace_id = ${workspaceId}
        AND pr.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${repoCond}
      GROUP BY reviewer
      ORDER BY review_count DESC
      LIMIT 20
    `),

    // Contributor balance: authored vs reviewed
    db.execute(sql`
      WITH authored AS (
        SELECT author_github_username AS login, COUNT(*)::int AS prs_authored
        FROM pull_requests
        WHERE workspace_id = ${workspaceId}
          AND created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          AND author_github_username IS NOT NULL
          AND ${repoCond}
        GROUP BY author_github_username
      ),
      reviewed AS (
        SELECT reviewer AS login, COUNT(*)::int AS prs_reviewed
        FROM pull_requests pr,
             jsonb_array_elements_text(pr.reviewers) AS reviewer
        WHERE pr.workspace_id = ${workspaceId}
          AND pr.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
          AND ${repoCond}
        GROUP BY reviewer
      )
      SELECT
        COALESCE(a.login, r.login) AS login,
        COALESCE(a.prs_authored, 0) AS prs_authored,
        COALESCE(r.prs_reviewed, 0) AS prs_reviewed
      FROM authored a
      FULL OUTER JOIN reviewed r ON a.login = r.login
      ORDER BY prs_authored DESC
      LIMIT 30
    `),
  ]);

  return {
    reviewerAuthorMatrix: (
      matrixRows as unknown as { reviewer: string; author: string; count: number }[]
    ).map((r) => ({ reviewer: r.reviewer, author: r.author, count: Number(r.count) })),
    topReviewers: (
      reviewerRows as unknown as {
        login: string;
        review_count: number;
        repos_reviewed: number;
      }[]
    ).map((r) => ({
      login: r.login,
      reviewCount: Number(r.review_count),
      reposReviewed: Number(r.repos_reviewed),
    })),
    contributorBalance: (
      balanceRows as unknown as {
        login: string;
        prs_authored: number;
        prs_reviewed: number;
      }[]
    ).map((r) => ({
      login: r.login,
      prsAuthored: Number(r.prs_authored),
      prsReviewed: Number(r.prs_reviewed),
    })),
  };
}

// ─── Issues ──────────────────────────────────────────────────────────────────

export async function getIssuesData(
  workspaceId: string,
  params: GitHubAnalyticsParams,
): Promise<GitHubIssuesData> {
  const repoNames = await resolveRepoNames(workspaceId, params.repoIds);
  const issueCond = issueRepoCondition(repoNames);
  const { startDate, endDate, contributor } = params;
  const authorFilter = contributor
    ? sql`AND i.author_github_username = ${contributor}`
    : sql``;

  const [summaryRows, velocityRows, labelRows, oldestRows, byRepoRows] = await Promise.all([
    // Summary
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE state = 'open')::int AS open_issues,
        COUNT(*) FILTER (WHERE state = 'closed'
          AND closed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::int AS closed_issues,
        ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400)
          FILTER (WHERE closed_at IS NOT NULL
            AND closed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::numeric, 1)
          AS avg_close_time_days
      FROM issues i
      WHERE workspace_id = ${workspaceId} AND ${issueCond} ${authorFilter}
    `),

    // Weekly velocity
    db.execute(sql`
      SELECT
        to_char(date_trunc('week', i.created_at), 'YYYY-MM-DD') AS week,
        COUNT(*)::int AS opened,
        COUNT(*) FILTER (WHERE i.closed_at IS NOT NULL
          AND i.closed_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day')::int AS closed
      FROM issues i
      WHERE i.workspace_id = ${workspaceId}
        AND i.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${issueCond}
        ${authorFilter}
      GROUP BY week
      ORDER BY week
    `),

    // Label breakdown (unnest JSONB labels array)
    db.execute(sql`
      SELECT label AS label, COUNT(*)::int AS count
      FROM issues i,
           jsonb_array_elements_text(i.labels) AS label
      WHERE i.workspace_id = ${workspaceId}
        AND i.created_at BETWEEN ${startDate}::date AND ${endDate}::date + interval '1 day'
        AND ${issueCond}
        ${authorFilter}
      GROUP BY label
      ORDER BY count DESC
      LIMIT 20
    `),

    // Oldest open issues
    db.execute(sql`
      SELECT
        repo,
        number,
        title,
        author_github_username AS author,
        EXTRACT(DAY FROM NOW() - created_at)::int AS age_days,
        labels
      FROM issues i
      WHERE i.workspace_id = ${workspaceId}
        AND state = 'open'
        AND ${issueCond}
        ${authorFilter}
      ORDER BY created_at ASC
      LIMIT 15
    `),

    // Issues by repo
    db.execute(sql`
      SELECT
        repo,
        COUNT(*) FILTER (WHERE state = 'open')::int AS open,
        COUNT(*) FILTER (WHERE state = 'closed')::int AS closed,
        COUNT(*)::int AS total
      FROM issues i
      WHERE i.workspace_id = ${workspaceId}
        AND ${issueCond}
        ${authorFilter}
      GROUP BY repo
      ORDER BY total DESC
      LIMIT 15
    `),
  ]);

  const s = (summaryRows as unknown as Record<string, unknown>[])[0] ?? {};

  return {
    summary: {
      openIssues: Number(s.open_issues ?? 0),
      closedIssues: Number(s.closed_issues ?? 0),
      avgCloseTimeDays: s.avg_close_time_days != null ? Number(s.avg_close_time_days) : null,
    },
    velocity: (velocityRows as unknown as { week: string; opened: number; closed: number }[]).map(
      (r) => ({ week: r.week, opened: Number(r.opened), closed: Number(r.closed) }),
    ),
    labelBreakdown: (labelRows as unknown as { label: string; count: number }[]).map((r) => ({
      label: r.label,
      count: Number(r.count),
    })),
    oldestOpenIssues: (
      oldestRows as unknown as {
        repo: string;
        number: number;
        title: string;
        author: string | null;
        age_days: number;
        labels: string[];
      }[]
    ).map((r) => ({
      repo: r.repo,
      number: Number(r.number),
      title: r.title,
      author: r.author,
      ageDays: Number(r.age_days),
      labels: r.labels ?? [],
    })),
    byRepo: (
      byRepoRows as unknown as { repo: string; open: number; closed: number }[]
    ).map((r) => ({ repo: r.repo, open: Number(r.open), closed: Number(r.closed) })),
  };
}
