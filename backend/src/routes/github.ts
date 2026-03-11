import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import { repositories } from '../db/schema/repositories.js';
import { syncState } from '../db/schema/sync-state.js';
import { githubSyncQueue } from '../workers/queue.js';
import { loadGitHubAppCredentials, createInstallationOctokit } from '../services/github-auth.js';
import {
  getOverviewData,
  getContributorsData,
  getPRHealthData,
  getCodeReviewData,
  getIssuesData,
} from '../services/github-analytics.js';
import type {
  GitHubRepository,
  GitHubSyncReposResponse,
  GitHubAnalyticsParams,
  GitHubDataSyncResponse,
  GitHubSyncStatus,
} from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

function parseAnalyticsParams(query: Record<string, unknown>): GitHubAnalyticsParams {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const repoIds =
    typeof query.repoIds === 'string'
      ? query.repoIds.split(',').filter(Boolean)
      : Array.isArray(query.repoIds)
        ? (query.repoIds as string[])
        : undefined;

  return {
    repoIds: repoIds && repoIds.length > 0 ? repoIds : undefined,
    startDate: typeof query.startDate === 'string' ? query.startDate : thirtyDaysAgo,
    endDate: typeof query.endDate === 'string' ? query.endDate : today,
    contributor: typeof query.contributor === 'string' ? query.contributor : undefined,
  };
}

export async function githubRoutes(app: FastifyInstance) {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  app.get('/auth/status', async (_request, reply) => {
    const workspaceId = await getDefaultWorkspaceId();
    try {
      const creds = await loadGitHubAppCredentials(workspaceId);
      const octokit = createInstallationOctokit(creds);
      const { data } = await octokit.rest.apps.getInstallation({
        installation_id: creds.installationId,
      });
      return {
        ok: true,
        appId: creds.appId,
        installationId: creds.installationId,
        account: data.account && 'login' in data.account ? data.account.login : null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ ok: false, error: message });
    }
  });

  // ─── Repositories ──────────────────────────────────────────────────────────

  app.get('/repos', async (): Promise<GitHubRepository[]> => {
    const workspaceId = await getDefaultWorkspaceId();
    const rows = await db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, workspaceId))
      .orderBy(repositories.fullName);

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      githubId: r.githubId,
      fullName: r.fullName,
      name: r.name,
      owner: r.owner,
      description: r.description,
      private: r.private,
      fork: r.fork,
      defaultBranch: r.defaultBranch,
      language: r.language,
      stargazersCount: r.stargazersCount,
      forksCount: r.forksCount,
      openIssuesCount: r.openIssuesCount,
      topics: r.topics,
      htmlUrl: r.htmlUrl,
      pushedAt: r.pushedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

  app.post('/repos/sync', async (_request, reply) => {
    const workspaceId = await getDefaultWorkspaceId();
    try {
      await loadGitHubAppCredentials(workspaceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub App credentials not configured';
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message });
    }
    const job = await githubSyncQueue.add('sync-repos', {
      workspaceId,
      resource: 'repositories',
    });
    return reply.status(202).send({
      jobId: job.id ?? 'unknown',
      message: 'Repository sync enqueued',
    } satisfies GitHubSyncReposResponse);
  });

  // ─── Analytics data sync ───────────────────────────────────────────────────

  app.post('/data/sync', async (request, reply) => {
    const workspaceId = await getDefaultWorkspaceId();
    try {
      await loadGitHubAppCredentials(workspaceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub App credentials not configured';
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message });
    }
    // Optional `since` ISO date string — overrides the cursor so the user can
    // re-sync a specific window (e.g. "sync everything from 2024-01-01 onwards").
    // When omitted, the worker uses the stored cursor or defaults to 90 days ago.
    const body = request.body as Record<string, unknown> | null | undefined;
    const since = typeof body?.since === 'string' ? body.since : undefined;

    const job = await githubSyncQueue.add('sync-analytics', {
      workspaceId,
      resource: 'analytics_data',
      since,
    });
    return reply.status(202).send({
      jobId: job.id ?? 'unknown',
      message: 'Analytics data sync enqueued (PRs, issues, commits)',
    } satisfies GitHubDataSyncResponse);
  });

  // ─── Sync status ───────────────────────────────────────────────────────────

  app.get('/sync/status', async (): Promise<GitHubSyncStatus> => {
    const workspaceId = await getDefaultWorkspaceId();
    const rows = await db
      .select()
      .from(syncState)
      .where(and(eq(syncState.workspaceId, workspaceId), eq(syncState.provider, 'github')));

    const repoSync = rows.find((r) => r.resource === 'repositories');
    const analyticsSync = rows.find((r) => r.resource === 'analytics');

    return {
      repos: {
        status: repoSync?.status ?? 'idle',
        lastSyncAt: repoSync?.lastSyncAt?.toISOString() ?? null,
        error: repoSync?.error ?? null,
      },
      analytics: {
        status: analyticsSync?.status ?? 'idle',
        lastSyncAt: analyticsSync?.lastSyncAt?.toISOString() ?? null,
        error: analyticsSync?.error ?? null,
      },
    };
  });

  // ─── Analytics endpoints ───────────────────────────────────────────────────

  app.get('/analytics/overview', async (request) => {
    const workspaceId = await getDefaultWorkspaceId();
    const params = parseAnalyticsParams(request.query as Record<string, unknown>);
    return getOverviewData(workspaceId, params);
  });

  app.get('/analytics/contributors', async (request) => {
    const workspaceId = await getDefaultWorkspaceId();
    const params = parseAnalyticsParams(request.query as Record<string, unknown>);
    return getContributorsData(workspaceId, params);
  });

  app.get('/analytics/pr-health', async (request) => {
    const workspaceId = await getDefaultWorkspaceId();
    const params = parseAnalyticsParams(request.query as Record<string, unknown>);
    return getPRHealthData(workspaceId, params);
  });

  app.get('/analytics/code-review', async (request) => {
    const workspaceId = await getDefaultWorkspaceId();
    const params = parseAnalyticsParams(request.query as Record<string, unknown>);
    return getCodeReviewData(workspaceId, params);
  });

  app.get('/analytics/issues', async (request) => {
    const workspaceId = await getDefaultWorkspaceId();
    const params = parseAnalyticsParams(request.query as Record<string, unknown>);
    return getIssuesData(workspaceId, params);
  });
}
