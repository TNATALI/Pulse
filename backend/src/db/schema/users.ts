import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    slackUserId: varchar('slack_user_id', { length: 64 }),
    githubUsername: varchar('github_username', { length: 255 }),
    avatarUrl: varchar('avatar_url', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_workspace_slack_idx').on(table.workspaceId, table.slackUserId),
    uniqueIndex('users_workspace_github_idx').on(table.workspaceId, table.githubUsername),
    index('users_workspace_idx').on(table.workspaceId),
  ],
);
