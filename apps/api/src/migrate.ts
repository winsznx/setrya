import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const migrationsFolder = process.env.SETRYA_MIGRATIONS_DIR ?? fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url));
const sql = postgres(url, { max: 1, onnotice: () => undefined });
await migrate(drizzle(sql), { migrationsFolder });
await sql.end();
console.log('migrations applied');
