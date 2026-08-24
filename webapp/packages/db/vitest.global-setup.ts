// Global setup for DB-backed tests: ensure the target schema is migrated before any test
// file runs. The DATABASE_URL used here is the one vitest.config.ts already set on the
// spawning process (inherited here); it points at the dedicated `shorts_test` database by
// default so wiping tables between runs never touches dev data.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[db tests] DATABASE_URL is unset after vitest.config.ts defaulting — expected it to be set.'
    );
  }

  // Migrate the test schema. drizzle-kit reads drizzle.config.ts which honors DATABASE_URL.
  // Run from this directory so the config's `./drizzle` out path resolves correctly.
  try {
    const drizzleKit = path.resolve(__dirname, '../../node_modules/.bin/drizzle-kit');
    execFileSync(drizzleKit, ['migrate'], {
      cwd: __dirname,
      // `shell: true` lets Windows resolve the .cmd shim; the direct bash shim (no
      // extension) otherwise fails under execFileSync on win32.
      shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[db tests] failed to migrate ${url}. Is Postgres up (docker compose up -d)? ` +
        `Create the test DB once: docker compose exec postgres psql -U shorts -d postgres ` +
        `-c "CREATE DATABASE shorts_test OWNER shorts".\n${msg}`
    );
  }
}
