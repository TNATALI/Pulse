import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.js';

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    githubId: integer('github_id').notNull(),
    repo: varchar('repo', { length: 255 }).notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    state: varchar('state', { length: 20 }).notNull().default('open'),
    authorGithubUsername: varchar('author_github_username', { length: 255 }),
    assigneeGithubUsername: varchar('assignee_github_username', { length: 255 }),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('issues_workspace_github_idx').on(table.workspaceId, table.githubId),
    index('issues_repo_idx').on(table.workspaceId, table.repo),
    index('issues_state_idx').on(table.workspaceId, table.state),
  ],
);
