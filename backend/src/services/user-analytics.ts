import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import type { UserAnalytics, SlackAnalyticsParams } from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

export async function getUserAnalytics(
  userId: string,
  params: Omit<SlackAnalyticsParams, 'userId'> = {},
): Promise<UserAnalytics | null> {
  const workspaceId = await getDefaultWorkspaceId();

  // Build date filter conditions
  const dateConditions: ReturnType<typeof sql>[] = [];
  if (params.startDate) {
    dateConditions.push(sql`m.created_at >= ${params.startDate}::timestamptz`);
  }
  if (params.endDate) {
    dateConditions.push(sql`m.created_at <= ${params.endDate}::timestamptz`);
  }
  if (params.channelIds && params.channelIds.length > 0) {
    const pgArray = `{${params.channelIds.join(',')}}`;
    dateConditions.push(sql`m.channel_id = ANY(${pgArray}::uuid[])`);
  }

  const dateWhere =
    dateConditions.length > 0 ? sql` AND ${sql.join(dateConditions, sql` AND `)}` : sql``;

  // Get user info
  const userResult = await db.execute(sql`
    SELECT id AS user_id, display_name, avatar_url
    FROM users
    WHERE id = ${userId}::uuid AND workspace_id = ${workspaceId}
  `);

  const userRow = (userResult as unknown as { user_id: string; display_name: string; avatar_url: string | null }[])[0];
  if (!userRow) return null;

  const [statsResult, topChannelsResult, dailyResult, hourlyResult] = await Promise.all([
    // Combined stats
    db.execute(sql`
      SELECT
        COUNT(m.id)::int AS total_messages,
        COUNT(CASE WHEN m.thread_ts IS NOT NULL THEN 1 END)::int AS thread_replies,
        COALESCE((
          SELECT COUNT(r.id)::int FROM reactions r
          JOIN messages m2 ON m2.id = r.message_id
          JOIN channels c2 ON c2.id = m2.channel_id
          WHERE m2.user_id = ${userId}::uuid AND c2.workspace_id = ${workspaceId}
        ), 0)::int AS reactions_received,
        COALESCE((
          SELECT COUNT(r.id)::int FROM reactions r
          JOIN messages m2 ON m2.id = r.message_id
          JOIN channels c2 ON c2.id = m2.channel_id
          WHERE r.user_id = ${userId}::uuid AND c2.workspace_id = ${workspaceId}
        ), 0)::int AS reactions_given,
        COALESCE((
          SELECT COUNT(mn.id)::int FROM mentions mn
          JOIN messages m2 ON m2.id = mn.message_id
          JOIN channels c2 ON c2.id = m2.channel_id
          WHERE mn.user_id = ${userId}::uuid AND m2.user_id != ${userId}::uuid AND c2.workspace_id = ${workspaceId}
        ), 0)::int AS mentioned_by_count,
        COALESCE((
          SELECT COUNT(mn.id)::int FROM mentions mn
          JOIN messages m2 ON m2.id = mn.message_id
          JOIN channels c2 ON c2.id = m2.channel_id
          WHERE m2.user_id = ${userId}::uuid AND mn.user_id != ${userId}::uuid AND c2.workspace_id = ${workspaceId}
        ), 0)::int AS mentions_others_count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId} AND m.user_id = ${userId}::uuid ${dateWhere}
    `),

    // Top channels for user
    db.execute(sql`
      SELECT
        c.id AS channel_id,
        c.name,
        COUNT(m.id)::int AS message_count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId} AND m.user_id = ${userId}::uuid ${dateWhere}
      GROUP BY c.id, c.name
      ORDER BY message_count DESC
      LIMIT 10
    `),

    // Daily activity
    db.execute(sql`
      SELECT
        DATE(m.created_at)::text AS date,
        COUNT(m.id)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId} AND m.user_id = ${userId}::uuid ${dateWhere}
      GROUP BY DATE(m.created_at)
      ORDER BY DATE(m.created_at) ASC
    `),

    // Hourly activity
    db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM m.created_at)::int AS hour,
        COUNT(m.id)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId} AND m.user_id = ${userId}::uuid ${dateWhere}
      GROUP BY EXTRACT(HOUR FROM m.created_at)
      ORDER BY hour ASC
    `),
  ]);

  const stats = (statsResult as Record<string, number>[])[0] ?? {};

  // Fill missing hours
  const hourlyMap = new Map<number, number>();
  for (const row of hourlyResult as unknown as { hour: number; count: number }[]) {
    hourlyMap.set(row.hour, row.count);
  }
  const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) ?? 0,
  }));

  return {
    user: {
      userId: userRow.user_id,
      displayName: userRow.display_name,
      avatarUrl: userRow.avatar_url,
    },
    totalMessages: stats.total_messages ?? 0,
    threadReplies: stats.thread_replies ?? 0,
    reactionsReceived: stats.reactions_received ?? 0,
    reactionsGiven: stats.reactions_given ?? 0,
    mentionedByCount: stats.mentioned_by_count ?? 0,
    mentionsOthersCount: stats.mentions_others_count ?? 0,
    topChannels: (
      topChannelsResult as unknown as { channel_id: string; name: string; message_count: number }[]
    ).map((r) => ({
      channelId: r.channel_id,
      name: r.name,
      messageCount: r.message_count,
    })),
    dailyActivity: (dailyResult as unknown as { date: string; count: number }[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
    hourlyActivity,
  };
}
