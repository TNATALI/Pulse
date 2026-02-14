import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export async function resetAllData(): Promise<{ tablesCleared: string[] }> {
  // Truncate ALL tables — full factory reset including settings and workspaces.
  const tables = [
    'mentions',
    'reactions',
    'comments',
    'messages',
    'channels',
    'pull_requests',
    'issues',
    'users',
    'sync_state',
    'settings',
    'workspaces',
  ];

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`));

  return { tablesCleared: tables };
}
