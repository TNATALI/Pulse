import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { repositories } from '../db/schema/repositories.js';
import { syncState } from '../db/schema/sync-state.js';
import { workspaces } from '../db/schema/workspaces.js';
import { getInstallationOctokit } from './github-auth.js';
import { logger } from '../lib/logger.js';

// Mirror the Slack sync retry strategy: up to 4 attempts with exponential back-off.
// Handles transient GitHub API errors (502, 503, rate limit spikes).
const retryPolicy = retry(handleAll, {
  maxAttempts: 4,
  backoff: new ExponentialBackoff(),
});

async function updateSyncState(workspaceId: string, status: string, error?: string) {
  const now = new Date();
  await db
    .insert(syncState)
    .values({
      workspaceId,
      provider: 'github',
      resource: 'repositories',
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

/**
 * Sync all repositories accessible to the GitHub App installation.
 *
 * Steps:
 *   1. Authenticate as the installation (JWT → access token, handled by github-auth).
 *   2. Paginate GET /installation/repositories (100 per page).
 *   3. Upsert each repo into the `repositories` table keyed on (workspace_id, github_id).
 *   4. Update the workspace's github_org field from the installation owner (first non-fork owner seen).
 *   5. Mark sync_state idle on success, error on failure.
 */
export async function syncRepositories(workspaceId: string): Promise<{ count: number }> {
  logger.info({ workspaceId }, 'Starting GitHub repository sync');
  await updateSyncState(workspaceId, 'syncing');

  try {
    const octokit = await getInstallationOctokit(workspaceId);

    let page = 1;
    let totalSynced = 0;
    let orgName: string | null = null;

    while (true) {
      const response = await retryPolicy.execute(() =>
        octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: 100,
          page,
        }),
      );

      const repos = response.data.repositories;
      if (repos.length === 0) break;

      for (const repo of repos) {
        const now = new Date();
        await db
          .insert(repositories)
          .values({
            workspaceId,
            githubId: repo.id,
            fullName: repo.full_name,
            name: repo.name,
            owner: repo.owner?.login ?? '',
            description: repo.description ?? null,
            private: repo.private,
            fork: repo.fork,
            defaultBranch: repo.default_branch ?? 'main',
            language: repo.language ?? null,
            stargazersCount: repo.stargazers_count ?? 0,
            forksCount: repo.forks_count ?? 0,
            openIssuesCount: repo.open_issues_count ?? 0,
            topics: repo.topics ?? [],
            htmlUrl: repo.html_url,
            pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [repositories.workspaceId, repositories.githubId],
            set: {
              fullName: repo.full_name,
              name: repo.name,
              owner: repo.owner?.login ?? '',
              description: repo.description ?? null,
              private: repo.private,
              fork: repo.fork,
              defaultBranch: repo.default_branch ?? 'main',
              language: repo.language ?? null,
              stargazersCount: repo.stargazers_count ?? 0,
              forksCount: repo.forks_count ?? 0,
              openIssuesCount: repo.open_issues_count ?? 0,
              topics: repo.topics ?? [],
              htmlUrl: repo.html_url,
              pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
              updatedAt: now,
            },
          });

        totalSynced++;

        // Capture the first organisation name we see (skip personal forks)
        if (!orgName && !repo.fork && repo.owner?.type === 'Organization') {
          orgName = repo.owner.login;
        }
      }

      logger.info({ workspaceId, page, count: repos.length }, 'Synced repo page');

      // GitHub returns fewer repos than per_page on the last page
      if (repos.length < 100) break;
      page++;
    }

    // Persist the organisation name on the workspace if discovered
    if (orgName) {
      await db
        .update(workspaces)
        .set({ githubOrg: orgName, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    }

    await updateSyncState(workspaceId, 'idle');
    logger.info({ workspaceId, totalSynced }, 'GitHub repository sync complete');
    return { count: totalSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ workspaceId, err }, 'GitHub repository sync failed');
    await updateSyncState(workspaceId, 'error', message);
    throw err;
  }
}
