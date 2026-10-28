import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { setryaSql?: postgres.Sql; setryaDb?: Db };

export function getDb(): Db {
  if (globalForDb.setryaDb) return globalForDb.setryaDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { max: 10, onnotice: () => undefined });
  globalForDb.setryaSql = sql;
  globalForDb.setryaDb = drizzle(sql, { schema });
  return globalForDb.setryaDb;
}

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
