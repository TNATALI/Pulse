import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { workspaces } from '../db/schema/workspaces.js';
import type { ChannelListItem } from '@pulse/shared';

async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(workspaces)
    .values({ name: 'Default' })
    .returning({ id: workspaces.id });
  return created.id;
}

export async function getChannelList(): Promise<ChannelListItem[]> {
  const workspaceId = await getDefaultWorkspaceId();

  const result = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.member_count,
      COUNT(m.id)::int AS message_count
    FROM channels c
    LEFT JOIN messages m ON m.channel_id = c.id
    WHERE c.workspace_id = ${workspaceId}
    GROUP BY c.id, c.name, c.member_count
    ORDER BY message_count DESC
  `);

  return (
    result as unknown as { id: string; name: string; member_count: number; message_count: number }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    memberCount: r.member_count,
    messageCount: r.message_count,
  }));
}
