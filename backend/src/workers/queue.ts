import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { JOB_QUEUES } from '@pulse/shared';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const slackSyncQueue = new Queue(JOB_QUEUES.SLACK_SYNC, {
  connection: { lazyConnect: true },
});

export const githubSyncQueue = new Queue(JOB_QUEUES.GITHUB_SYNC, {
  connection: { lazyConnect: true },
});

export const reportQueue = new Queue(JOB_QUEUES.REPORT, {
  connection: { lazyConnect: true },
});
