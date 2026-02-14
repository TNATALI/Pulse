import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { getSlackAnalytics } from '../services/slack-analytics.js';
import { verifySlackToken } from '../services/slack-verify.js';
import { decrypt } from '../services/encryption.js';
import { db } from '../db/connection.js';
import { settings } from '../db/schema/settings.js';
import { workspaces } from '../db/schema/workspaces.js';
import { slackSyncQueue } from '../workers/queue.js';
import type { SlackSyncRequest, SlackSyncResponse, SlackVerifyResponse } from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

async function getDecryptedSetting(workspaceId: string, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)));
  if (rows.length === 0) return null;
  return decrypt(rows[0].encryptedValue);
}

export async function slackRoutes(app: FastifyInstance) {
  app.get('/analytics', async () => {
    return getSlackAnalytics();
  });

  app.post('/verify-token', async (_request, reply) => {
    const workspaceId = await getDefaultWorkspaceId();
    const token = await getDecryptedSetting(workspaceId, 'slack_bot_token');

    if (!token) {
      return reply.status(400).send({
        ok: false,
        error: 'No Slack bot token configured. Please save a token first.',
      } satisfies SlackVerifyResponse);
    }

    const result = await verifySlackToken(token);
    return result;
  });

  app.post('/sync', async (request, reply) => {
    const { startDate, endDate } = request.body as SlackSyncRequest;

    if (!startDate || !endDate) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'startDate and endDate are required',
      });
    }

    const workspaceId = await getDefaultWorkspaceId();
    const token = await getDecryptedSetting(workspaceId, 'slack_bot_token');

    if (!token) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'No Slack bot token configured',
      });
    }

    const job = await slackSyncQueue.add('slack-sync', {
      workspaceId,
      startDate,
      endDate,
    });

    return reply.status(202).send({
      jobId: job.id ?? 'unknown',
      message: 'Slack sync job enqueued',
    } satisfies SlackSyncResponse);
  });
}
