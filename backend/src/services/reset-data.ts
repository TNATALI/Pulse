import { sql } from 'drizzle-orm';
import { db } from '../db/connection.js';

export async function resetAllData(): Promise<{ tablesCleared: string[] }> {
  // Truncate synced data tables — settings and workspaces are preserved.
  const tables = [
    'scorecard_snapshots',
    'commits',
    'mentions',
    'reactions',
    'comments',
    'messages',
    'channels',
    'pull_requests',
    'issues',
    'repositories',
    'users',
    'sync_state',
  ];

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`));

  return { tablesCleared: tables };
}
