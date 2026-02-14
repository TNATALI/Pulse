import { pgTable, uuid, varchar, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slackChannelId: varchar('slack_channel_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    isPrivate: boolean('is_private').notNull().default(false),
    memberCount: integer('member_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('channels_workspace_slack_idx').on(table.workspaceId, table.slackChannelId),
  ],
);
