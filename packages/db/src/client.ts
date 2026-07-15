import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema/index';

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  pool: pg.Pool;
}

export function createDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

export async function runMigrations(db: Db, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}
