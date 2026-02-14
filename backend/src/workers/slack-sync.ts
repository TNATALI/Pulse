import { Worker, Job } from 'bullmq';
import { WebClient } from '@slack/web-api';
import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import { eq, and } from 'drizzle-orm';
import { JOB_QUEUES } from '@pulse/shared';
import { logger } from '../lib/logger.js';
import { getRedisConnection } from './queue.js';
import { db } from '../db/connection.js';
import { decrypt } from '../services/encryption.js';
import { settings } from '../db/schema/settings.js';
import { workspaces } from '../db/schema/workspaces.js';
import { channels } from '../db/schema/channels.js';
import { users } from '../db/schema/users.js';
import { messages } from '../db/schema/messages.js';
import { mentions } from '../db/schema/mentions.js';
import { reactions } from '../db/schema/reactions.js';
import { syncState } from '../db/schema/sync-state.js';

interface SlackSyncJobData {
  workspaceId: string;
  startDate: string;
  endDate: string;
}

const retryPolicy = retry(handleAll, {
  maxAttempts: 4,
  backoff: new ExponentialBackoff(),
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getDecryptedSetting(workspaceId: string, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)));
  if (rows.length === 0) return null;
  return decrypt(rows[0].encryptedValue);
}

async function updateSyncState(
  workspaceId: string,
  status: string,
  error?: string,
) {
  const now = new Date();
  await db
    .insert(syncState)
    .values({
      workspaceId,
      provider: 'slack',
      resource: 'all',
      status,
      lastSyncAt: status === 'idle' ? now : undefined,
      error: error ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [syncState.workspaceId, syncState.provider, syncState.resource],
      set: {
        status,
        lastSyncAt: status === 'idle' ? now : undefined,
        error: error ?? null,
        updatedAt: now,
      },
    });
}

async function syncChannels(
  client: WebClient,
  workspaceId: string,
): Promise<Map<string, string>> {
  const slackIdToDbId = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const result = await retryPolicy.execute(() =>
      client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      }),
    );

    for (const ch of result.channels ?? []) {
      if (!ch.id || !ch.name) continue;

      const [row] = await db
        .insert(channels)
        .values({
          workspaceId,
          slackChannelId: ch.id,
          name: ch.name,
          isPrivate: ch.is_private ?? false,
          memberCount: ch.num_members ?? 0,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [channels.workspaceId, channels.slackChannelId],
          set: {
            name: ch.name,
            isPrivate: ch.is_private ?? false,
            memberCount: ch.num_members ?? 0,
            updatedAt: new Date(),
          },
        })
        .returning({ id: channels.id });

      slackIdToDbId.set(ch.id, row.id);
    }

    cursor = result.response_metadata?.next_cursor || undefined;
    if (cursor) await delay(50);
  } while (cursor);

  return slackIdToDbId;
}

async function syncUsers(
  client: WebClient,
  workspaceId: string,
): Promise<Map<string, string>> {
  const slackIdToDbId = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const result = await retryPolicy.execute(() =>
      client.users.list({ limit: 200, cursor }),
    );

    for (const u of result.members ?? []) {
      if (!u.id || u.is_bot || u.id === 'USLACKBOT') continue;

      const displayName =
        u.profile?.display_name || u.profile?.real_name || u.name || u.id;
      const email = u.profile?.email ?? null;
      const avatarUrl = u.profile?.image_72 ?? null;

      const [row] = await db
        .insert(users)
        .values({
          workspaceId,
          slackUserId: u.id,
          displayName,
          email,
          avatarUrl,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [users.workspaceId, users.slackUserId],
          set: {
            displayName,
            email,
            avatarUrl,
            updatedAt: new Date(),
          },
        })
        .returning({ id: users.id });

      slackIdToDbId.set(u.id, row.id);
    }

    cursor = result.response_metadata?.next_cursor || undefined;
    if (cursor) await delay(50);
  } while (cursor);

  return slackIdToDbId;
}

async function syncMessages(
  client: WebClient,
  workspaceId: string,
  channelMap: Map<string, string>,
  userMap: Map<string, string>,
  startDate: string,
  endDate: string,
) {
  const oldest = (new Date(startDate).getTime() / 1000).toString();
  const latest = (new Date(endDate).getTime() / 1000).toString();
  const mentionRegex = /<@(U[A-Z0-9]+)>/g;

  for (const [slackChannelId, dbChannelId] of channelMap) {
    let cursor: string | undefined;

    do {
      let result;
      try {
        result = await retryPolicy.execute(() =>
          client.conversations.history({
            channel: slackChannelId,
            oldest,
            latest,
            limit: 200,
            cursor,
          }),
        );
      } catch (err) {
        logger.warn({ slackChannelId, err }, 'Failed to fetch history for channel, skipping');
        break;
      }

      for (const msg of result.messages ?? []) {
        if (!msg.ts) continue;
        if (msg.subtype && msg.subtype !== 'thread_broadcast') continue;

        const userId = msg.user ? (userMap.get(msg.user) ?? null) : null;
        const text = msg.text ?? '';
        const githubUrlMatches = text.match(/https?:\/\/github\.com\/[^\s>]+/g) ?? [];

        const [msgRow] = await db
          .insert(messages)
          .values({
            channelId: dbChannelId,
            userId,
            slackTs: msg.ts,
            threadTs: msg.thread_ts ?? null,
            text,
            hasGithubLink: githubUrlMatches.length > 0,
            githubUrls: githubUrlMatches,
            createdAt: new Date(parseFloat(msg.ts) * 1000),
          })
          .onConflictDoUpdate({
            target: [messages.channelId, messages.slackTs],
            set: {
              text,
              hasGithubLink: githubUrlMatches.length > 0,
              githubUrls: githubUrlMatches,
            },
          })
          .returning({ id: messages.id });

        // Extract mentions
        const mentionMatches = [...text.matchAll(mentionRegex)];
        for (const match of mentionMatches) {
          const mentionedDbUserId = userMap.get(match[1]);
          if (!mentionedDbUserId) continue;

          await db
            .insert(mentions)
            .values({
              messageId: msgRow.id,
              userId: mentionedDbUserId,
            })
            .onConflictDoNothing();
        }

        // Sync reactions
        if (msg.reactions) {
          for (const reaction of msg.reactions) {
            if (!reaction.name) continue;
            for (const reactorSlackId of reaction.users ?? []) {
              const reactorDbId = userMap.get(reactorSlackId);
              if (!reactorDbId) continue;

              await db
                .insert(reactions)
                .values({
                  messageId: msgRow.id,
                  userId: reactorDbId,
                  emoji: reaction.name,
                })
                .onConflictDoNothing();
            }
          }
        }
      }

      cursor = result.response_metadata?.next_cursor || undefined;
      if (cursor) await delay(50);
    } while (cursor);

    await delay(50);
  }
}

async function processSlackSync(job: Job<SlackSyncJobData>) {
  const { workspaceId, startDate, endDate } = job.data;
  logger.info({ jobId: job.id, workspaceId, startDate, endDate }, 'Starting Slack sync');

  await updateSyncState(workspaceId, 'syncing');

  try {
    const token = await getDecryptedSetting(workspaceId, 'slack_bot_token');
    if (!token) throw new Error('No Slack bot token configured');

    const client = new WebClient(token);

    // Update workspace info
    const authResult = await retryPolicy.execute(() => client.auth.test());
    if (authResult.team_id) {
      await db
        .update(workspaces)
        .set({ slackTeamId: authResult.team_id, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    }

    logger.info({ jobId: job.id }, 'Syncing channels...');
    const channelMap = await syncChannels(client, workspaceId);
    logger.info({ jobId: job.id, count: channelMap.size }, 'Channels synced');

    logger.info({ jobId: job.id }, 'Syncing users...');
    const userMap = await syncUsers(client, workspaceId);
    logger.info({ jobId: job.id, count: userMap.size }, 'Users synced');

    logger.info({ jobId: job.id }, 'Syncing messages, reactions, mentions...');
    await syncMessages(client, workspaceId, channelMap, userMap, startDate, endDate);
    logger.info({ jobId: job.id }, 'Messages synced');

    await updateSyncState(workspaceId, 'idle');
    logger.info({ jobId: job.id }, 'Slack sync completed successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ jobId: job.id, err }, 'Slack sync failed');
    await updateSyncState(workspaceId, 'error', message);
    throw err;
  }
}

export function startSlackSyncWorker() {
  const worker = new Worker<SlackSyncJobData>(
    JOB_QUEUES.SLACK_SYNC,
    processSlackSync,
    { connection: getRedisConnection() },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Slack sync job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Slack sync job completed');
  });

  logger.info('Slack sync worker started');
  return worker;
}
