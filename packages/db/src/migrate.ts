import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const sql = postgres(url, { max: 1, onnotice: () => undefined });
await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
await sql.end();
console.log('migrations applied');
