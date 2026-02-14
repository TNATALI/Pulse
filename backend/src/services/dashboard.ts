import type { DashboardSummary } from '@pulse/shared';
import { db } from '../db/connection.js';

export async function getDashboardSummary(_workspaceId: string): Promise<DashboardSummary> {
  // TODO: implement actual queries
  return {
    messageCount: 0,
    activeChannels: 0,
    activeUsers: 0,
    openIssues: 0,
    openPRs: 0,
    avgPRMergeTimeHours: 0,
  };
}
