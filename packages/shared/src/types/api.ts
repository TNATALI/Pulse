export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

export interface Workspace {
  id: string;
  name: string;
  slackTeamId: string | null;
  githubOrg: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  workspaceId: string;
  displayName: string;
  email: string | null;
  slackUserId: string | null;
  githubUsername: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  slackChannelId: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string | null;
  slackTs: string;
  threadTs: string | null;
  text: string;
  hasGithubLink: boolean;
  githubUrls: string[];
  createdAt: string;
}

export interface Issue {
  id: string;
  workspaceId: string;
  githubId: number;
  repo: string;
  number: number;
  title: string;
  state: string;
  authorGithubUsername: string | null;
  assigneeGithubUsername: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface PullRequest {
  id: string;
  workspaceId: string;
  githubId: number;
  repo: string;
  number: number;
  title: string;
  state: string;
  authorGithubUsername: string | null;
  additions: number;
  deletions: number;
  reviewers: string[];
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export interface DashboardSummary {
  messageCount: number;
  activeChannels: number;
  activeUsers: number;
  openIssues: number;
  openPRs: number;
  avgPRMergeTimeHours: number;
}

export interface SyncStatus {
  provider: 'slack' | 'github';
  resource: string;
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  error: string | null;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// Settings
export const SETTING_KEYS = [
  'slack_bot_token',
  'slack_signing_secret',
  'github_token',
  'github_org',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const SENSITIVE_SETTING_KEYS: readonly SettingKey[] = [
  'slack_bot_token',
  'slack_signing_secret',
  'github_token',
] as const;

export interface SettingResponse {
  key: SettingKey;
  value: string | null;
  isSet: boolean;
}

export interface SettingInput {
  key: SettingKey;
  value: string;
}

export interface GetSettingsResponse {
  settings: SettingResponse[];
}

export interface UpdateSettingsRequest {
  settings: SettingInput[];
}

export interface UpdateSettingsResponse {
  settings: SettingResponse[];
}

export interface DeleteSettingResponse {
  success: true;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Slack Analytics
export interface SlackAnalytics {
  summary: {
    totalMessages: number;
    activeChannels: number;
    activeUsers: number;
    messagesToday: number;
  };
  messageVolume: { date: string; count: number }[];
  topChannels: { channelId: string; name: string; messageCount: number }[];
  topContributors: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    messageCount: number;
  }[];
  hourlyActivity: { hour: number; count: number }[];
  topReactions: { emoji: string; count: number }[];
}

// Slack Sync
export interface SlackVerifyResponse {
  ok: boolean;
  teamName?: string;
  teamId?: string;
  botUserId?: string;
  error?: string;
}

export interface SlackSyncRequest {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export interface SlackSyncResponse {
  jobId: string;
  message: string;
}
