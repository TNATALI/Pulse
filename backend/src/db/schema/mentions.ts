import { pgTable, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';
import { users } from './users.js';

export const mentions = pgTable(
  'mentions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('mentions_message_user_idx').on(table.messageId, table.userId)],
);
