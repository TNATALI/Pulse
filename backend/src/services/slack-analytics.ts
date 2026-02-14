import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import type { SlackAnalyticsParams, SlackAnalyticsResponse } from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

function buildWhereClause(
  workspaceId: string,
  params: SlackAnalyticsParams,
  messageAlias = 'm',
  channelAlias = 'c',
) {
  const conditions = [sql`${sql.raw(channelAlias)}.workspace_id = ${workspaceId}`];

  if (params.startDate) {
    conditions.push(sql`${sql.raw(messageAlias)}.created_at >= ${params.startDate}::timestamptz`);
  }
  if (params.endDate) {
    conditions.push(sql`${sql.raw(messageAlias)}.created_at <= ${params.endDate}::timestamptz`);
  }
  if (params.channelIds && params.channelIds.length > 0) {
    const pgArray = `{${params.channelIds.join(',')}}`;
    conditions.push(sql`${sql.raw(messageAlias)}.channel_id = ANY(${pgArray}::uuid[])`);
  }
  if (params.userId) {
    conditions.push(sql`${sql.raw(messageAlias)}.user_id = ${params.userId}::uuid`);
  }

  return sql.join(conditions, sql` AND `);
}

export async function getSlackAnalytics(params: SlackAnalyticsParams = {}): Promise<SlackAnalyticsResponse> {
  const workspaceId = await getDefaultWorkspaceId();

  // Apply default date range: last 30 days if no dates specified
  const effectiveParams = { ...params };
  if (!effectiveParams.startDate && !effectiveParams.endDate) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    effectiveParams.startDate = thirtyDaysAgo.toISOString().slice(0, 10);
    effectiveParams.endDate = now.toISOString().slice(0, 10);
  }

  const where = buildWhereClause(workspaceId, effectiveParams);

  const [
    summaryResult,
    volumeResult,
    channelsResult,
    contributorsResult,
    hourlyResult,
    reactionsResult,
    mentionPairsResult,
  ] = await Promise.all([
    // 1. Summary with thread counts
    db.execute(sql`
      SELECT
        COUNT(m.id)::int AS total_messages,
        COUNT(DISTINCT m.channel_id)::int AS active_channels,
        COUNT(DISTINCT m.user_id)::int AS active_users,
        COUNT(CASE WHEN m.thread_ts IS NOT NULL THEN 1 END)::int AS threaded_messages,
        COUNT(CASE WHEN m.thread_ts IS NULL THEN 1 END)::int AS broadcast_messages
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE ${where}
    `),

    // 2. Message volume by day
    db.execute(sql`
      SELECT
        DATE(m.created_at)::text AS date,
        COUNT(m.id)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE ${where}
      GROUP BY DATE(m.created_at)
      ORDER BY DATE(m.created_at) ASC
    `),

    // 3. Top channels
    db.execute(sql`
      SELECT
        c.id AS channel_id,
        c.name,
        COUNT(m.id)::int AS message_count
      FROM channels c
      JOIN messages m ON m.channel_id = c.id
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY message_count DESC
      LIMIT 10
    `),

    // 4. Top contributors with thread count and reactions received
    db.execute(sql`
      SELECT
        u.id AS user_id,
        u.display_name,
        u.avatar_url,
        COUNT(m.id)::int AS message_count,
        COUNT(CASE WHEN m.thread_ts IS NOT NULL THEN 1 END)::int AS thread_count,
        COALESCE(r_sub.reactions_received, 0)::int AS reactions_received
      FROM users u
      JOIN messages m ON m.user_id = u.id
      JOIN channels c ON c.id = m.channel_id
      LEFT JOIN LATERAL (
        SELECT COUNT(r.id)::int AS reactions_received
        FROM reactions r
        JOIN messages m2 ON m2.id = r.message_id
        JOIN channels c2 ON c2.id = m2.channel_id
        WHERE m2.user_id = u.id
          AND c2.workspace_id = ${workspaceId}
      ) r_sub ON true
      WHERE ${where}
      GROUP BY u.id, u.display_name, u.avatar_url, r_sub.reactions_received
      ORDER BY message_count DESC
      LIMIT 10
    `),

    // 5. Hourly activity
    db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM m.created_at)::int AS hour,
        COUNT(m.id)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE ${where}
      GROUP BY EXTRACT(HOUR FROM m.created_at)
      ORDER BY hour ASC
    `),

    // 6. Top reactions
    db.execute(sql`
      SELECT
        r.emoji,
        COUNT(r.id)::int AS count
      FROM reactions r
      JOIN messages m ON m.id = r.message_id
      JOIN channels c ON c.id = m.channel_id
      WHERE ${where}
      GROUP BY r.emoji
      ORDER BY count DESC
      LIMIT 10
    `),

    // 7. Mention pairs
    db.execute(sql`
      SELECT
        u_from.id AS from_user_id,
        u_from.display_name AS from_display_name,
        u_to.id AS to_user_id,
        u_to.display_name AS to_display_name,
        COUNT(mn.id)::int AS count
      FROM mentions mn
      JOIN messages m ON m.id = mn.message_id
      JOIN channels c ON c.id = m.channel_id
      JOIN users u_from ON u_from.id = m.user_id
      JOIN users u_to ON u_to.id = mn.user_id
      WHERE ${where}
        AND m.user_id IS NOT NULL
        AND m.user_id != mn.user_id
      GROUP BY u_from.id, u_from.display_name, u_to.id, u_to.display_name
      ORDER BY count DESC
      LIMIT 20
    `),
  ]);

  // Fill missing hours (0-23) with 0
  const hourlyMap = new Map<number, number>();
  for (const row of hourlyResult as unknown as { hour: number; count: number }[]) {
    hourlyMap.set(row.hour, row.count);
  }
  const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) ?? 0,
  }));

  const summaryRow = (summaryResult as Record<string, number>[])[0] ?? {
    total_messages: 0,
    active_channels: 0,
    active_users: 0,
    threaded_messages: 0,
    broadcast_messages: 0,
  };

  const totalMessages = summaryRow.total_messages ?? 0;
  const threadedMessages = summaryRow.threaded_messages ?? 0;

  return {
    summary: {
      totalMessages,
      activeChannels: summaryRow.active_channels ?? 0,
      activeUsers: summaryRow.active_users ?? 0,
      threadedMessages,
      broadcastMessages: summaryRow.broadcast_messages ?? 0,
      threadRatio: totalMessages > 0 ? Math.round((threadedMessages / totalMessages) * 100) / 100 : 0,
    },
    messageVolume: (volumeResult as unknown as { date: string; count: number }[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
    topChannels: (channelsResult as unknown as { channel_id: string; name: string; message_count: number }[]).map(
      (r) => ({
        channelId: r.channel_id,
        name: r.name,
        messageCount: r.message_count,
      }),
    ),
    topContributors: (
      contributorsResult as unknown as {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        message_count: number;
        thread_count: number;
        reactions_received: number;
      }[]
    ).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      messageCount: r.message_count,
      threadCount: r.thread_count,
      reactionsReceived: r.reactions_received,
    })),
    hourlyActivity,
    topReactions: (reactionsResult as unknown as { emoji: string; count: number }[]).map((r) => ({
      emoji: r.emoji,
      count: r.count,
    })),
    mentionPairs: (
      mentionPairsResult as unknown as {
        from_user_id: string;
        from_display_name: string;
        to_user_id: string;
        to_display_name: string;
        count: number;
      }[]
    ).map((r) => ({
      fromUserId: r.from_user_id,
      fromDisplayName: r.from_display_name,
      toUserId: r.to_user_id,
      toDisplayName: r.to_display_name,
      count: r.count,
    })),
  };
}
