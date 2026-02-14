import { Worker, Job } from 'bullmq';
import { JOB_QUEUES } from '@pulse/shared';
import { logger } from '../lib/logger.js';
import { getRedisConnection } from './queue.js';

interface SlackSyncJob {
  workspaceId: string;
  channelId?: string;
}

export function startSlackSyncWorker() {
  const worker = new Worker<SlackSyncJob>(
    JOB_QUEUES.SLACK_SYNC,
    async (job: Job<SlackSyncJob>) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing Slack sync job');
      // TODO: implement sync logic
    },
    { connection: getRedisConnection() },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Slack sync job failed');
  });

  return worker;
}
