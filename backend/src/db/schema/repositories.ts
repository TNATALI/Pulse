import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // GitHub's numeric repo ID — stable across renames
    githubId: integer('github_id').notNull(),
    // "owner/repo-name" e.g. "acme-corp/api"
    fullName: varchar('full_name', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    owner: varchar('owner', { length: 255 }).notNull(),
    description: text('description'),
    private: boolean('private').notNull().default(false),
    fork: boolean('fork').notNull().default(false),
    defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
    language: varchar('language', { length: 100 }),
    stargazersCount: integer('stargazers_count').notNull().default(0),
    forksCount: integer('forks_count').notNull().default(0),
    openIssuesCount: integer('open_issues_count').notNull().default(0),
    topics: jsonb('topics').$type<string[]>().notNull().default([]),
    htmlUrl: varchar('html_url', { length: 1024 }).notNull(),
    // When the repo last received a push — useful for staleness detection
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('repos_workspace_github_idx').on(table.workspaceId, table.githubId),
    index('repos_workspace_idx').on(table.workspaceId),
    index('repos_owner_idx').on(table.workspaceId, table.owner),
  ],
);
