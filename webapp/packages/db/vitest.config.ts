import { defineConfig } from 'vitest/config';

// Set DATABASE_URL at config-evaluation time (this process spawns the test workers, so the
// value IS inherited by them). globalSetup alone would not propagate env into workers.
//
// We default to the dedicated `shorts_test` database (NOT `shorts`) because these suites
// wipe tables between runs (`delete ... where true`) — running against the dev DB would
// destroy dev data. Use 127.0.0.1, not `localhost` (Windows resolves localhost to ::1,
// intercepted by wslrelay into a WSL Postgres). An explicit DATABASE_URL in the env always
// wins.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  process.env.SHORTS_TEST_DATABASE_URL ??
  'postgres://shorts:shorts@127.0.0.1:5434/shorts_test';

export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-setup.ts'],
    // DB-backed suites share one database; run files sequentially to avoid inter-file
    // races on the shared schema/rows.
    fileParallelism: false,
  },
});
