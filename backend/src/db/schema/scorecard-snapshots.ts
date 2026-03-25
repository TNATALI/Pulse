import {
  pgTable,
  uuid,
  varchar,
  doublePrecision,
  date,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export interface ScorecardCheckRow {
  name: string;
  score: number;
  reason: string;
  details: string[] | null;
}

export const scorecardSnapshots = pgTable(
  'scorecard_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoFullName: varchar('repo_full_name', { length: 255 }).notNull(),
    runDate: date('run_date').notNull(),
    commitSha: varchar('commit_sha', { length: 40 }).notNull(),
    overallScore: doublePrecision('overall_score'),
    scorecardVersion: varchar('scorecard_version', { length: 20 }),
    checks: jsonb('checks').$type<ScorecardCheckRow[]>().notNull().default([]),
    analysisIds: jsonb('analysis_ids').$type<number[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('scorecard_workspace_repo_date_idx').on(
      table.workspaceId,
      table.repoFullName,
      table.runDate,
    ),
    index('scorecard_workspace_repo_idx').on(table.workspaceId, table.repoFullName),
  ],
);
