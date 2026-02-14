import { Worker, Job } from 'bullmq';
import { JOB_QUEUES } from '@pulse/shared';
import { logger } from '../lib/logger.js';
import { getRedisConnection } from './queue.js';

interface ReportJob {
  workspaceId: string;
  reportType: string;
}

export function startReportWorker() {
  const worker = new Worker<ReportJob>(
    JOB_QUEUES.REPORT,
    async (job: Job<ReportJob>) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing report job');
      // TODO: implement report generation
    },
    { connection: getRedisConnection() },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Report job failed');
  });

  return worker;
}
