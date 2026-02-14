import { logger } from '../lib/logger.js';

export class GitHubService {
  async syncIssues(_workspaceId: string, _repo: string): Promise<void> {
    logger.info('GitHub issue sync not yet implemented');
  }

  async syncPullRequests(_workspaceId: string, _repo: string): Promise<void> {
    logger.info('GitHub PR sync not yet implemented');
  }
}

export const githubService = new GitHubService();
