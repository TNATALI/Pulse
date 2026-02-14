export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const SYNC_PROVIDERS = ['slack', 'github'] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export const ISSUE_STATES = ['open', 'closed'] as const;
export const PR_STATES = ['open', 'closed', 'merged'] as const;

export const JOB_QUEUES = {
  SLACK_SYNC: 'slack-sync',
  GITHUB_SYNC: 'github-sync',
  REPORT: 'report',
} as const;

export const CACHE_TTL = {
  DASHBOARD: 60,
  CHANNELS: 300,
  USERS: 300,
} as const;
