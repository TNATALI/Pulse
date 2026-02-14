import { pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { issues } from './issues';
import { pullRequests } from './pull-requests';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    githubId: integer('github_id').notNull(),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
    pullRequestId: uuid('pull_request_id').references(() => pullRequests.id, {
      onDelete: 'cascade',
    }),
    authorGithubUsername: varchar('author_github_username', { length: 255 }),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('comments_workspace_github_idx').on(table.workspaceId, table.githubId),
    index('comments_issue_idx').on(table.issueId),
    index('comments_pr_idx').on(table.pullRequestId),
  ],
);
