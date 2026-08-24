// Worker entry: boot HTTP /health, then the job claim loop.
import { getDb } from '@shorts/db';
import { startHealthServer } from './health.js';
import { runLoop } from './loop.js';
import { failStaleJobs } from './claim.js';

const PORT = Number(process.env.PORT ?? 3100);
const WATCHDOG_MS = 30_000;
const STALE_MS = 10 * 60_000; // 10 min heartbeat timeout

async function main() {
  const db = getDb();
  startHealthServer(PORT);

  const signal = { stop: false };
  process.on('SIGINT', () => { signal.stop = true; process.exit(0); });
  process.on('SIGTERM', () => { signal.stop = true; process.exit(0); });

  // Watchdog: sweep stale running jobs.
  const watchdog = setInterval(() => {
    void failStaleJobs(db, STALE_MS).then((n) => {
      if (n > 0) console.warn(`[watchdog] failed ${n} stalled job(s)`);
    });
  }, WATCHDOG_MS);

  console.log('[worker] starting job loop…');
  await runLoop(db, signal);
  clearInterval(watchdog);
}

main().catch((e) => {
  console.error('[worker] fatal:', e);
  process.exit(1);
});
