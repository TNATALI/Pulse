import { Queue } from 'bullmq';
import { config } from '../config.js';
import { JOB_QUEUES } from '@pulse/shared';

export function getRedisConnection() {
  return {
    host: new URL(config.redis.url).hostname || 'localhost',
    port: parseInt(new URL(config.redis.url).port || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

export const slackSyncQueue = new Queue(JOB_QUEUES.SLACK_SYNC, {
  connection: getRedisConnection(),
});

export const githubSyncQueue = new Queue(JOB_QUEUES.GITHUB_SYNC, {
  connection: getRedisConnection(),
});

export const reportQueue = new Queue(JOB_QUEUES.REPORT, {
  connection: getRedisConnection(),
});
