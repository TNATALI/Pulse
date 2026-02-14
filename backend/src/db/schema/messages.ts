import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    slackTs: varchar('slack_ts', { length: 64 }).notNull(),
    threadTs: varchar('thread_ts', { length: 64 }),
    text: text('text').notNull().default(''),
    hasGithubLink: boolean('has_github_link').notNull().default(false),
    githubUrls: jsonb('github_urls').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('messages_channel_ts_idx').on(table.channelId, table.slackTs),
    index('messages_thread_idx').on(table.channelId, table.threadTs),
    index('messages_user_idx').on(table.userId),
  ],
);
