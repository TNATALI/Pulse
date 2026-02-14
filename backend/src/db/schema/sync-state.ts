import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const syncState = pgTable(
  'sync_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('idle'),
    cursor: text('cursor'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sync_state_workspace_provider_resource_idx').on(
      table.workspaceId,
      table.provider,
      table.resource,
    ),
  ],
);
