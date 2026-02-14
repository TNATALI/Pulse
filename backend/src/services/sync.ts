import { logger } from '../lib/logger.js';

export async function triggerSync(workspaceId: string, provider: 'slack' | 'github'): Promise<void> {
  logger.info({ workspaceId, provider }, 'Sync trigger not yet implemented');
}

export async function getSyncStatuses(workspaceId: string) {
  logger.info({ workspaceId }, 'Get sync statuses not yet implemented');
  return [];
}
