import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../backend/src/db/schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5432/pulse';

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // Create a default workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: 'Demo Workspace',
      slackTeamId: 'T_DEMO',
      githubOrg: 'demo-org',
    })
    .onConflictDoNothing()
    .returning();

  if (workspace) {
    console.log(`Created workspace: ${workspace.name} (${workspace.id})`);

    // Create sample users
    await db
      .insert(schema.users)
      .values([
        {
          workspaceId: workspace.id,
          displayName: 'Alice Johnson',
          email: 'alice@example.com',
          slackUserId: 'U_ALICE',
          githubUsername: 'alice-j',
        },
        {
          workspaceId: workspace.id,
          displayName: 'Bob Smith',
          email: 'bob@example.com',
          slackUserId: 'U_BOB',
          githubUsername: 'bobsmith',
        },
      ])
      .onConflictDoNothing();

    console.log('Created sample users');
  }

  console.log('Seeding complete!');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
