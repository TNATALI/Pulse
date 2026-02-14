import { logger } from '../lib/logger.js';

export class SlackService {
  async syncChannels(_workspaceId: string): Promise<void> {
    logger.info('Slack channel sync not yet implemented');
  }

  async syncMessages(_workspaceId: string, _channelId: string): Promise<void> {
    logger.info('Slack message sync not yet implemented');
  }
}

export const slackService = new SlackService();
