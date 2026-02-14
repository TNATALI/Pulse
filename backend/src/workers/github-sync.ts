import { Worker, Job } from 'bullmq';
import { JOB_QUEUES } from '@pulse/shared';
import { logger } from '../lib/logger.js';
import { getRedisConnection } from './queue.js';

interface GitHubSyncJob {
  workspaceId: string;
  repo?: string;
}

export function startGitHubSyncWorker() {
  const worker = new Worker<GitHubSyncJob>(
    JOB_QUEUES.GITHUB_SYNC,
    async (job: Job<GitHubSyncJob>) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing GitHub sync job');
      // TODO: implement sync logic
    },
    { connection: getRedisConnection() },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'GitHub sync job failed');
  });

  return worker;
}
