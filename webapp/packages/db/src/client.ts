// Drizzle client (node-postgres driver). Both web and worker import this.
// Connection string comes from DATABASE_URL (see .env.example).
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

export type Db = NodePgDatabase<typeof schema>;

let _pool: pg.Pool | null = null;
let _db: Db | null = null;

export function createDb(connectionString: string): Db {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

/**
 * Lazy singleton — created on first use so importing this module at the edge of
 * a request does not eagerly open a pool before env is loaded.
 */
export function getDb(): Db {
  if (_db) return _db;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('DATABASE_URL is not set');
  _pool = new Pool({ connectionString: cs });
  _db = drizzle(_pool, { schema });
  return _db;
}

export { schema };
