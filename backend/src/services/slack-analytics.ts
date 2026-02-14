import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import type { SlackAnalytics } from '@pulse/shared';

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

export async function getSlackAnalytics(): Promise<SlackAnalytics> {
  const workspaceId = await getDefaultWorkspaceId();

  const [summaryResult, volumeResult, channelsResult, contributorsResult, hourlyResult, reactionsResult] =
    await Promise.all([
      // 1. Summary
      db.execute(sql`
        SELECT
          COUNT(m.id)::int AS total_messages,
          COUNT(DISTINCT m.channel_id)::int AS active_channels,
          COUNT(DISTINCT m.user_id)::int AS active_users,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE THEN 1 END)::int AS messages_today
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.workspace_id = ${workspaceId}
      `),

      // 2. Message volume (last 30 days)
      db.execute(sql`
        SELECT
          DATE(m.created_at)::text AS date,
          COUNT(m.id)::int AS count
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.workspace_id = ${workspaceId}
          AND m.created_at >= CURRENT_DATE - INTERVAL '30 days'
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
        WHERE c.workspace_id = ${workspaceId}
        GROUP BY c.id, c.name
        ORDER BY message_count DESC
        LIMIT 10
      `),

      // 4. Top contributors
      db.execute(sql`
        SELECT
          u.id AS user_id,
          u.display_name,
          u.avatar_url,
          COUNT(m.id)::int AS message_count
        FROM users u
        JOIN messages m ON m.user_id = u.id
        JOIN channels c ON c.id = m.channel_id
        WHERE c.workspace_id = ${workspaceId}
        GROUP BY u.id, u.display_name, u.avatar_url
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
        WHERE c.workspace_id = ${workspaceId}
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
        WHERE c.workspace_id = ${workspaceId}
        GROUP BY r.emoji
        ORDER BY count DESC
        LIMIT 10
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
    messages_today: 0,
  };

  return {
    summary: {
      totalMessages: summaryRow.total_messages ?? 0,
      activeChannels: summaryRow.active_channels ?? 0,
      activeUsers: summaryRow.active_users ?? 0,
      messagesToday: summaryRow.messages_today ?? 0,
    },
    messageVolume: (volumeResult as unknown as { date: string; count: number }[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
    topChannels: (channelsResult as unknown as { channel_id: string; name: string; message_count: number }[]).map((r) => ({
      channelId: r.channel_id,
      name: r.name,
      messageCount: r.message_count,
    })),
    topContributors: (
      contributorsResult as unknown as { user_id: string; display_name: string; avatar_url: string | null; message_count: number }[]
    ).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      messageCount: r.message_count,
    })),
    hourlyActivity,
    topReactions: (reactionsResult as unknown as { emoji: string; count: number }[]).map((r) => ({
      emoji: r.emoji,
      count: r.count,
    })),
  };
}
