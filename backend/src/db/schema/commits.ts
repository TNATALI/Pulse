import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const commits = pgTable(
  'commits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoFullName: varchar('repo_full_name', { length: 255 }).notNull(),
    sha: varchar('sha', { length: 40 }).notNull(),
    authorLogin: varchar('author_login', { length: 255 }),
    authorName: varchar('author_name', { length: 255 }),
    message: text('message').notNull().default(''),
    committedAt: timestamp('committed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('commits_workspace_sha_idx').on(table.workspaceId, table.sha),
    index('commits_repo_idx').on(table.workspaceId, table.repoFullName),
    index('commits_author_idx').on(table.workspaceId, table.authorLogin),
    index('commits_date_idx').on(table.workspaceId, table.committedAt),
  ],
);
