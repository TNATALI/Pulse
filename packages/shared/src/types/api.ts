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
  'github_app_id',
  'github_app_private_key',
  'github_app_installation_id',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const SENSITIVE_SETTING_KEYS: readonly SettingKey[] = [
  'slack_bot_token',
  'slack_signing_secret',
  'github_token',
  'github_app_private_key',
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

// Slack Analytics (legacy — kept for backward compat)
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

// Filter params for the analytics workbench
export interface SlackAnalyticsParams {
  channelIds?: string[];
  userId?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
}

// Enhanced analytics response (superset of SlackAnalytics)
export interface SlackAnalyticsResponse {
  summary: {
    totalMessages: number;
    activeChannels: number;
    activeUsers: number;
    threadedMessages: number;
    broadcastMessages: number;
    threadRatio: number;
  };
  messageVolume: { date: string; count: number }[];
  topChannels: { channelId: string; name: string; messageCount: number }[];
  topContributors: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    messageCount: number;
    threadCount: number;
    reactionsReceived: number;
  }[];
  hourlyActivity: { hour: number; count: number }[];
  topReactions: { emoji: string; count: number }[];
  mentionPairs: {
    fromUserId: string;
    fromDisplayName: string;
    toUserId: string;
    toDisplayName: string;
    count: number;
  }[];
}

// User deep-dive
export interface UserAnalytics {
  user: { userId: string; displayName: string; avatarUrl: string | null };
  totalMessages: number;
  threadReplies: number;
  reactionsReceived: number;
  reactionsGiven: number;
  mentionedByCount: number;
  mentionsOthersCount: number;
  topChannels: { channelId: string; name: string; messageCount: number }[];
  dailyActivity: { date: string; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
}

// Channel picker
export interface ChannelListItem {
  id: string;
  name: string;
  memberCount: number;
  messageCount: number;
}

// Dashboard insights
export interface DashboardInsights {
  summary: {
    totalMessages: number;
    activeChannels: number;
    activeUsers: number;
    threadRatio: number;
  };
  weekOverWeek: {
    messagesThisWeek: number;
    messagesLastWeek: number;
    changePercent: number;
    activeUsersThisWeek: number;
    activeUsersLastWeek: number;
    usersChangePercent: number;
  };
  decliningChannels: {
    channelId: string;
    name: string;
    currentCount: number;
    previousCount: number;
    changePercent: number;
  }[];
  risingChannels: {
    channelId: string;
    name: string;
    currentCount: number;
    previousCount: number;
    changePercent: number;
  }[];
  quietUsers: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    currentCount: number;
    previousCount: number;
  }[];
  topThreadStarters: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    threadCount: number;
  }[];
  recentActivity: { date: string; count: number }[];
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

// GitHub
export interface GitHubRepository {
  id: string;
  workspaceId: string;
  githubId: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  topics: string[];
  htmlUrl: string;
  pushedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubSyncReposResponse {
  jobId: string;
  message: string;
}

export interface GitHubVerifyResponse {
  ok: boolean;
  appId?: number;
  installationId?: number;
  account?: string | null;
  error?: string;
}

// ─── GitHub Analytics ────────────────────────────────────────────────────────

export interface GitHubAnalyticsParams {
  repoIds?: string[]; // DB UUIDs from the repositories table
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  contributor?: string; // GitHub login
}

export interface GitHubOverviewData {
  summary: {
    totalRepos: number;
    openPRs: number;
    mergedPRs: number;
    openIssues: number;
    closedIssues: number;
    activeContributors: number;
    avgMergeTimeDays: number | null;
  };
  prActivity: { week: string; opened: number; merged: number }[];
  issueActivity: { week: string; opened: number; closed: number }[];
  reposByLanguage: { language: string; count: number }[];
  topActiveRepos: { repo: string; prCount: number; issueCount: number }[];
}

export interface GitHubContributorStat {
  login: string;
  prsAuthored: number;
  prsMerged: number;
  prsReviewed: number;
  issuesOpened: number;
  commits: number;
  mergeRate: number;
}

export interface GitHubContributorsData {
  contributors: GitHubContributorStat[];
  commitActivity: { week: string; login: string; commits: number }[];
}

export interface GitHubPRHealthData {
  summary: {
    openPRs: number;
    stalePRs: number;
    avgCycleTimeDays: number | null;
    mergeRate: number;
  };
  cycleTimeTrend: { week: string; avgDays: number }[];
  stalePRList: {
    repo: string;
    number: number;
    title: string;
    author: string | null;
    ageDays: number;
    htmlUrl: string;
  }[];
  mergeRateByRepo: { repo: string; merged: number; total: number; mergeRate: number }[];
}

export interface GitHubCodeReviewData {
  reviewerAuthorMatrix: { reviewer: string; author: string; count: number }[];
  topReviewers: { login: string; reviewCount: number; reposReviewed: number }[];
  contributorBalance: { login: string; prsAuthored: number; prsReviewed: number }[];
}

export interface GitHubIssuesData {
  summary: {
    openIssues: number;
    closedIssues: number;
    avgCloseTimeDays: number | null;
  };
  velocity: { week: string; opened: number; closed: number }[];
  labelBreakdown: { label: string; count: number }[];
  oldestOpenIssues: {
    repo: string;
    number: number;
    title: string;
    author: string | null;
    ageDays: number;
    labels: string[];
  }[];
  byRepo: { repo: string; open: number; closed: number }[];
}

export interface GitHubDataSyncResponse {
  jobId: string;
  message: string;
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

export interface ScorecardCheckResult {
  name: string;
  score: number;
  reason: string;
  details: string[] | null;
}

/** One point on the trend line — one Scorecard run per day */
export interface ScorecardTrendPoint {
  runDate: string;        // "2026-03-23"
  commitSha: string;
  score: number | null;   // official from api.scorecard.dev, or DB-cached SARIF avg; null if not yet fetched
  isOfficial: boolean;    // true = exact score from api.scorecard.dev
  totalIssues: number;    // sum of results_count across all 3 SARIFs for this run
  analysisIds: number[];  // GitHub code-scanning analysis IDs for this run
  repoFullName: string;
}

export interface ScorecardHistoryResponse {
  repoFullName: string;
  points: ScorecardTrendPoint[];
}

export interface ScorecardDetailResponse {
  runDate: string;
  commitSha: string;
  repoFullName: string;
  overallScore: number | null;
  scorecardVersion: string | null;
  checks: ScorecardCheckResult[];
}

export interface GitHubSyncStatus {
  repos: { status: string; lastSyncAt: string | null; error?: string | null };
  analytics: { status: string; lastSyncAt: string | null; error?: string | null };
}
