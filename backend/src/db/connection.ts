import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema/index.js';

const client = postgres(config.database.url);

export const db = drizzle(client, { schema });
export type Database = typeof db;
