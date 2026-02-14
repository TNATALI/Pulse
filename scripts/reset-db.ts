import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5432/pulse';

async function reset() {
  const sql = postgres(DATABASE_URL);
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  console.log('All tables dropped and schema reset.');
  await sql.end();
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
