import { Worker, Job } from 'bullmq';
import { JOB_QUEUES } from '@pulse/shared';
import { logger } from '../lib/logger.js';
import { getRedisConnection } from './queue.js';
import { syncRepositories } from '../services/github-repos.js';
import { syncAnalyticsData } from '../services/github-sync-data.js';

interface GitHubSyncJob {
  workspaceId: string;
  resource?: string;
  since?: string; // ISO date string — overrides cursor for analytics_data jobs
}

async function processGitHubSync(job: Job<GitHubSyncJob>) {
  const { workspaceId, resource = 'repositories', since } = job.data;
  logger.info({ jobId: job.id, workspaceId, resource, since }, 'Processing GitHub sync job');

  switch (resource) {
    case 'repositories': {
      const { count } = await syncRepositories(workspaceId);
      logger.info({ jobId: job.id, count }, 'GitHub repository sync finished');
      return { count };
    }
    case 'analytics_data': {
      const result = await syncAnalyticsData(workspaceId, since);
      logger.info({ jobId: job.id, ...result }, 'GitHub analytics data sync finished');
      return result;
    }
    default:
      throw new Error(`Unknown GitHub sync resource: ${resource}`);
  }
}

export function startGitHubSyncWorker() {
  const worker = new Worker<GitHubSyncJob>(JOB_QUEUES.GITHUB_SYNC, processGitHubSync, {
    connection: getRedisConnection(),
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'GitHub sync job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'GitHub sync job completed');
  });

  logger.info('GitHub sync worker started');
  return worker;
}
