import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import type { DashboardInsights } from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  const workspaceId = await getDefaultWorkspaceId();

  const [
    summaryResult,
    wowResult,
    decliningResult,
    risingResult,
    quietResult,
    threadStartersResult,
    recentResult,
  ] = await Promise.all([
    // Overall summary
    db.execute(sql`
      SELECT
        COUNT(m.id)::int AS total_messages,
        COUNT(DISTINCT m.channel_id)::int AS active_channels,
        COUNT(DISTINCT m.user_id)::int AS active_users,
        CASE WHEN COUNT(m.id) > 0
          THEN ROUND(COUNT(CASE WHEN m.thread_ts IS NOT NULL THEN 1 END)::numeric / COUNT(m.id)::numeric, 2)::float
          ELSE 0
        END AS thread_ratio
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId}
    `),

    // Week-over-week comparison
    db.execute(sql`
      SELECT
        COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS messages_this_week,
        COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '14 days' AND m.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS messages_last_week,
        COUNT(DISTINCT CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN m.user_id END)::int AS active_users_this_week,
        COUNT(DISTINCT CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '14 days' AND m.created_at < CURRENT_DATE - INTERVAL '7 days' THEN m.user_id END)::int AS active_users_last_week
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId}
        AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
    `),

    // Declining channels (>= 30% drop)
    db.execute(sql`
      WITH channel_weeks AS (
        SELECT
          c.id AS channel_id,
          c.name,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS current_count,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '14 days' AND m.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS previous_count
        FROM channels c
        JOIN messages m ON m.channel_id = c.id
        WHERE c.workspace_id = ${workspaceId}
          AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY c.id, c.name
      )
      SELECT channel_id, name, current_count, previous_count,
        ROUND(((current_count - previous_count)::numeric / GREATEST(previous_count, 1)::numeric) * 100)::int AS change_percent
      FROM channel_weeks
      WHERE previous_count > 0
        AND current_count < previous_count
        AND ((previous_count - current_count)::numeric / previous_count::numeric) >= 0.3
      ORDER BY change_percent ASC
      LIMIT 5
    `),

    // Rising channels (>= 30% growth)
    db.execute(sql`
      WITH channel_weeks AS (
        SELECT
          c.id AS channel_id,
          c.name,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS current_count,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '14 days' AND m.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS previous_count
        FROM channels c
        JOIN messages m ON m.channel_id = c.id
        WHERE c.workspace_id = ${workspaceId}
          AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY c.id, c.name
      )
      SELECT channel_id, name, current_count, previous_count,
        ROUND(((current_count - previous_count)::numeric / GREATEST(previous_count, 1)::numeric) * 100)::int AS change_percent
      FROM channel_weeks
      WHERE current_count > previous_count
        AND ((current_count - previous_count)::numeric / GREATEST(previous_count, 1)::numeric) >= 0.3
      ORDER BY change_percent DESC
      LIMIT 5
    `),

    // Quiet users (activity dropped >= 50%)
    db.execute(sql`
      WITH user_weeks AS (
        SELECT
          u.id AS user_id,
          u.display_name,
          u.avatar_url,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS current_count,
          COUNT(CASE WHEN m.created_at >= CURRENT_DATE - INTERVAL '14 days' AND m.created_at < CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::int AS previous_count
        FROM users u
        JOIN messages m ON m.user_id = u.id
        JOIN channels c ON c.id = m.channel_id
        WHERE c.workspace_id = ${workspaceId}
          AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY u.id, u.display_name, u.avatar_url
      )
      SELECT user_id, display_name, avatar_url, current_count, previous_count
      FROM user_weeks
      WHERE previous_count > 0
        AND ((previous_count - current_count)::numeric / previous_count::numeric) >= 0.5
      ORDER BY (previous_count - current_count) DESC
      LIMIT 5
    `),

    // Top thread starters
    db.execute(sql`
      SELECT
        u.id AS user_id,
        u.display_name,
        u.avatar_url,
        COUNT(DISTINCT m.thread_ts)::int AS thread_count
      FROM users u
      JOIN messages m ON m.user_id = u.id
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId}
        AND m.thread_ts IS NOT NULL
        AND m.slack_ts = m.thread_ts
        AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY u.id, u.display_name, u.avatar_url
      ORDER BY thread_count DESC
      LIMIT 5
    `),

    // Recent 14-day activity
    db.execute(sql`
      SELECT
        DATE(m.created_at)::text AS date,
        COUNT(m.id)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.workspace_id = ${workspaceId}
        AND m.created_at >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY DATE(m.created_at)
      ORDER BY DATE(m.created_at) ASC
    `),
  ]);

  const summary = (summaryResult as Record<string, number>[])[0] ?? {
    total_messages: 0,
    active_channels: 0,
    active_users: 0,
    thread_ratio: 0,
  };

  const wow = (wowResult as Record<string, number>[])[0] ?? {
    messages_this_week: 0,
    messages_last_week: 0,
    active_users_this_week: 0,
    active_users_last_week: 0,
  };

  const messagesThisWeek = wow.messages_this_week ?? 0;
  const messagesLastWeek = wow.messages_last_week ?? 0;
  const activeUsersThisWeek = wow.active_users_this_week ?? 0;
  const activeUsersLastWeek = wow.active_users_last_week ?? 0;

  return {
    summary: {
      totalMessages: summary.total_messages ?? 0,
      activeChannels: summary.active_channels ?? 0,
      activeUsers: summary.active_users ?? 0,
      threadRatio: summary.thread_ratio ?? 0,
    },
    weekOverWeek: {
      messagesThisWeek,
      messagesLastWeek,
      changePercent:
        messagesLastWeek > 0
          ? Math.round(((messagesThisWeek - messagesLastWeek) / messagesLastWeek) * 100)
          : 0,
      activeUsersThisWeek,
      activeUsersLastWeek,
      usersChangePercent:
        activeUsersLastWeek > 0
          ? Math.round(((activeUsersThisWeek - activeUsersLastWeek) / activeUsersLastWeek) * 100)
          : 0,
    },
    decliningChannels: (
      decliningResult as unknown as {
        channel_id: string;
        name: string;
        current_count: number;
        previous_count: number;
        change_percent: number;
      }[]
    ).map((r) => ({
      channelId: r.channel_id,
      name: r.name,
      currentCount: r.current_count,
      previousCount: r.previous_count,
      changePercent: r.change_percent,
    })),
    risingChannels: (
      risingResult as unknown as {
        channel_id: string;
        name: string;
        current_count: number;
        previous_count: number;
        change_percent: number;
      }[]
    ).map((r) => ({
      channelId: r.channel_id,
      name: r.name,
      currentCount: r.current_count,
      previousCount: r.previous_count,
      changePercent: r.change_percent,
    })),
    quietUsers: (
      quietResult as unknown as {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        current_count: number;
        previous_count: number;
      }[]
    ).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      currentCount: r.current_count,
      previousCount: r.previous_count,
    })),
    topThreadStarters: (
      threadStartersResult as unknown as {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        thread_count: number;
      }[]
    ).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      threadCount: r.thread_count,
    })),
    recentActivity: (recentResult as unknown as { date: string; count: number }[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
  };
}
