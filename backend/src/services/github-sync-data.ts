/**
 * Syncs analytical data (pull requests, issues, commits) from GitHub into the
 * local database. Called by the BullMQ worker when resource = 'analytics_data'.
 *
 * Strategy:
 *   - On first sync: fetch data from the last 90 days.
 *   - On subsequent syncs: fetch from the last successful sync time (cursor).
 *   - PRs: paginate until updated_at < since (no API-level filter available).
 *   - Issues and commits: use GitHub's `since` query param for efficiency.
 */

import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { repositories } from '../db/schema/repositories.js';
import { pullRequests } from '../db/schema/pull-requests.js';
import { issues } from '../db/schema/issues.js';
import { commits } from '../db/schema/commits.js';
import { syncState } from '../db/schema/sync-state.js';
import { getInstallationOctokit } from './github-auth.js';
import { logger } from '../lib/logger.js';
import type { Octokit } from '@octokit/rest';

const retryPolicy = retry(handleAll, {
  maxAttempts: 4,
  backoff: new ExponentialBackoff(),
});

// ─── Sync state helpers ───────────────────────────────────────────────────────

async function getSyncCursor(workspaceId: string): Promise<string | null> {
  const rows = await db
    .select({ lastSyncAt: syncState.lastSyncAt })
    .from(syncState)
    .where(
      and(
        eq(syncState.workspaceId, workspaceId),
        eq(syncState.provider, 'github'),
        eq(syncState.resource, 'analytics'),
      ),
    );
  return rows[0]?.lastSyncAt?.toISOString() ?? null;
}

async function upsertSyncState(workspaceId: string, status: string, error?: string) {
  const now = new Date();
  await db
    .insert(syncState)
    .values({
      workspaceId,
      provider: 'github',
      resource: 'analytics',
      status,
      lastSyncAt: status === 'idle' ? now : undefined,
      error: error ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [syncState.workspaceId, syncState.provider, syncState.resource],
      set: {
        status,
        lastSyncAt: status === 'idle' ? now : undefined,
        error: error ?? null,
        updatedAt: now,
      },
    });
}

// ─── Pull Requests ────────────────────────────────────────────────────────────

async function syncRepoPRs(
  octokit: Octokit,
  workspaceId: string,
  owner: string,
  repo: string,
  since: string,
): Promise<number> {
  const fullName = `${owner}/${repo}`;
  let page = 1;
  let count = 0;
  const sinceDate = new Date(since);

  while (true) {
    const response = await retryPolicy.execute(() =>
      octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page,
      }),
    );

    const prs = response.data;
    if (prs.length === 0) break;

    for (const pr of prs) {
      // Stop when we reach PRs older than our sync window
      if (new Date(pr.updated_at) < sinceDate) {
        return count;
      }

      const reviewerLogins = (pr.requested_reviewers ?? [])
        .map((r: { login?: string }) => r.login)
        .filter(Boolean) as string[];

      const now = new Date();
      await db
        .insert(pullRequests)
        .values({
          workspaceId,
          githubId: pr.id,
          repo: fullName,
          number: pr.number,
          title: pr.title,
          state: pr.merged_at ? 'merged' : pr.state,
          authorGithubUsername: pr.user?.login ?? null,
          additions: 0,
          deletions: 0,
          reviewers: reviewerLogins,
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
        })
        .onConflictDoUpdate({
          target: [pullRequests.workspaceId, pullRequests.githubId],
          set: {
            title: pr.title,
            state: pr.merged_at ? 'merged' : pr.state,
            reviewers: reviewerLogins,
            updatedAt: new Date(pr.updated_at),
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
          },
        });

      count++;
    }

    if (prs.length < 100) break;
    page++;
  }

  return count;
}

// ─── Issues ──────────────────────────────────────────────────────────────────

async function upsertIssueItems(
  workspaceId: string,
  fullName: string,
  items: Awaited<ReturnType<Octokit['rest']['issues']['listForRepo']>>['data'],
): Promise<number> {
  let count = 0;
  for (const item of items) {
    if (item.pull_request) continue; // issues API returns PRs too

    const labelNames = item.labels
      .map((l: string | { name?: string }) => (typeof l === 'string' ? l : l.name ?? ''))
      .filter(Boolean) as string[];

    const now = new Date();
    await db
      .insert(issues)
      .values({
        workspaceId,
        githubId: item.id,
        repo: fullName,
        number: item.number,
        title: item.title,
        state: item.state,
        authorGithubUsername: item.user?.login ?? null,
        assigneeGithubUsername: item.assignee?.login ?? null,
        labels: labelNames,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        closedAt: item.closed_at ? new Date(item.closed_at) : null,
      })
      .onConflictDoUpdate({
        target: [issues.workspaceId, issues.githubId],
        set: {
          title: item.title,
          state: item.state,
          assigneeGithubUsername: item.assignee?.login ?? null,
          labels: labelNames,
          updatedAt: new Date(item.updated_at),
          closedAt: item.closed_at ? new Date(item.closed_at) : null,
        },
      });

    count++;
  }
  return count;
}

async function syncRepoIssues(
  octokit: Octokit,
  workspaceId: string,
  owner: string,
  repo: string,
  since: string,
): Promise<number> {
  const fullName = `${owner}/${repo}`;
  let count = 0;

  // ── Pass 1: all open issues, no `since` filter ────────────────────────────
  // Fetching open issues without a date filter guarantees we capture every
  // open issue regardless of how long ago it was last updated. Open issues
  // typically number in the hundreds, well under GitHub's 1 000-item
  // offset-pagination limit that causes a 422 on page 11+.
  let page = 1;
  while (true) {
    const response = await retryPolicy.execute(() =>
      octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        page,
      }),
    );
    const items = response.data;
    if (items.length === 0) break;
    count += await upsertIssueItems(workspaceId, fullName, items);
    if (items.length < 100) break;
    page++;
  }

  // ── Pass 2: recently closed issues, with `since` filter ──────────────────
  // Uses the cursor so incremental syncs only fetch newly-closed issues.
  // Closed issues across all time can be thousands; `since` keeps this safe.
  page = 1;
  while (true) {
    const response = await retryPolicy.execute(() =>
      octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        since,
        per_page: 100,
        page,
      }),
    );
    const items = response.data;
    if (items.length === 0) break;
    count += await upsertIssueItems(workspaceId, fullName, items);
    if (items.length < 100) break;
    page++;
  }

  return count;
}

// ─── Commits ─────────────────────────────────────────────────────────────────

async function syncRepoCommits(
  octokit: Octokit,
  workspaceId: string,
  owner: string,
  repo: string,
  since: string,
): Promise<number> {
  const fullName = `${owner}/${repo}`;
  let page = 1;
  let count = 0;

  while (true) {
    const response = await retryPolicy.execute(() =>
      octokit.rest.repos.listCommits({
        owner,
        repo,
        since,
        per_page: 100,
        page,
      }),
    );

    const commitList = response.data;
    if (commitList.length === 0) break;

    for (const c of commitList) {
      const committedAt = c.commit.author?.date
        ? new Date(c.commit.author.date)
        : new Date();

      const now = new Date();
      await db
        .insert(commits)
        .values({
          workspaceId,
          repoFullName: fullName,
          sha: c.sha,
          authorLogin: c.author?.login ?? null,
          authorName: c.commit.author?.name ?? null,
          message: c.commit.message.split('\n')[0].slice(0, 500), // first line only
          committedAt,
          createdAt: now,
        })
        .onConflictDoNothing();

      count++;
    }

    if (commitList.length < 100) break;
    page++;
  }

  return count;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function syncAnalyticsData(
  workspaceId: string,
  sinceOverride?: string,
): Promise<{ prs: number; issues: number; commits: number; skippedRepos: string[] }> {
  logger.info({ workspaceId, sinceOverride }, 'Starting GitHub analytics data sync');
  await upsertSyncState(workspaceId, 'syncing');

  try {
    const octokit = await getInstallationOctokit(workspaceId);

    // Priority: explicit override → cursor from last sync → default 90 days ago
    const cursor = sinceOverride ?? (await getSyncCursor(workspaceId));
    const since =
      cursor ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    logger.info({ workspaceId, since }, 'Fetching GitHub data since');

    const repos = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId));

    let totalPRs = 0;
    let totalIssues = 0;
    let totalCommits = 0;
    const skippedRepos: string[] = [];

    for (const repo of repos) {
      const [owner, repoName] = repo.fullName.split('/');
      if (!owner || !repoName) continue;

      logger.info({ repo: repo.fullName }, 'Syncing analytics data for repo');

      try {
        const [prs, iss, cms] = await Promise.all([
          syncRepoPRs(octokit, workspaceId, owner, repoName, since),
          syncRepoIssues(octokit, workspaceId, owner, repoName, since),
          syncRepoCommits(octokit, workspaceId, owner, repoName, since),
        ]);

        totalPRs += prs;
        totalIssues += iss;
        totalCommits += cms;

        logger.info(
          { repo: repo.fullName, prs, issues: iss, commits: cms },
          'Repo analytics sync complete',
        );
      } catch (repoErr) {
        const errMsg = repoErr instanceof Error ? repoErr.message : String(repoErr);
        logger.warn(
          { repo: repo.fullName, error: errMsg },
          'Skipping repo due to sync error',
        );
        skippedRepos.push(`${repo.fullName}: ${errMsg}`);
      }
    }

    const skippedSummary = skippedRepos.length > 0 ? skippedRepos.join(' | ') : null;
    await upsertSyncState(workspaceId, 'idle', skippedSummary ?? undefined);
    logger.info(
      { workspaceId, totalPRs, totalIssues, totalCommits, skipped: skippedRepos.length },
      'GitHub analytics sync complete',
    );
    return { prs: totalPRs, issues: totalIssues, commits: totalCommits, skippedRepos };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ workspaceId, err }, 'GitHub analytics sync failed');
    await upsertSyncState(workspaceId, 'error', message);
    throw err;
  }
}
