// render-versions.test.ts — the render_versions immutability + one-version-per-revision invariant,
// against a live Postgres. Skips cleanly when DATABASE_URL is unset (CI without a DB).
//
// Phase 5 invariants under test:
//   1. UNIQUE(projectId, revision) — a second insert for the SAME (projectId, revision) with
//      plain .insert() fails (proves one row per revision; the worker uses onConflictDoUpdate
//      for crash-safe retries, but the table itself enforces uniqueness).
//   2. Two renders of two DIFFERENT revisions produce two DISTINCT version rows (each downloads
//      its own output), newest-first ordering by revision.
//   3. Version rows carry their frozen specJson + format + outputKey (immutable snapshot).
import { describe, it, expect, beforeAll } from 'vitest';
import { sql, eq, desc } from 'drizzle-orm';
import { createDb, users, projects, jobs, renderVersions } from './index';
import type { Db } from './client';

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

let db: Db;
let userId: string;
let projectId: string;

// Scope cleanup to THIS test's rows only (keyed by the random userId/projectId created in
// beforeAll). A blanket `delete ... where true` would wipe any shared dev DB this runs against.
async function clean() {
  if (projectId) {
    await db.delete(renderVersions).where(eq(renderVersions.projectId, projectId));
    await db.delete(jobs).where(eq(jobs.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
  }
  if (userId) {
    await db.delete(users).where(eq(users.id, userId));
  }
}

const FMT = { width: 1080, height: 1920, fps: 30 };
const makeSpec = (rev: number) => ({
  id: 'spec-x',
  title: 'V test',
  template: 'Short16Formy',
  engine: 'tsx' as const,
  format: FMT,
  theme: {},
  scenes: [{ id: 'scene-1', durationSec: 3, overlays: [] }],
  meta: { revision: rev, updatedAt: new Date(0).toISOString() },
});

d('render_versions (live DB)', () => {
  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!);
    await clean();
    const [u] = await db.insert(users).values({ email: `rv-${Date.now()}@test.local` }).returning();
    userId = u.id;
    const [p] = await db
      .insert(projects)
      .values({ userId, title: 'Versions test', template: 'Short16Formy' })
      .returning();
    projectId = p.id;
  });

  it('enforces UNIQUE(projectId, revision) — duplicate revision insert fails', async () => {
    const [j] = await db
      .insert(jobs)
      .values({ projectId, type: 'render', status: 'done', stage: 'render' })
      .returning();

    const base = {
      projectId,
      revision: 1,
      format: FMT,
      outputKey: `${projectId}/out-1.mp4`,
      posterKey: `${projectId}/poster-1.jpg`,
      durationSec: 3,
      specJson: makeSpec(1),
      jobId: j.id,
    };
    await db.insert(renderVersions).values(base);
    // A plain second insert for the same (projectId, revision) must violate the unique index.
    await expect(db.insert(renderVersions).values({ ...base, outputKey: 'other.mp4' })).rejects
      .toThrow();
  });

  it('two renders of two DIFFERENT revisions yield two distinct rows, newest first', async () => {
    const [j2] = await db
      .insert(jobs)
      .values({ projectId, type: 'render', status: 'done', stage: 'render' })
      .returning();
    await db.insert(renderVersions).values({
      projectId,
      revision: 2,
      format: FMT,
      outputKey: `${projectId}/out-2.mp4`,
      posterKey: `${projectId}/poster-2.jpg`,
      durationSec: 4,
      specJson: makeSpec(2),
      jobId: j2.id,
    });

    const rows = await db.query.renderVersions.findMany({
      where: eq(renderVersions.projectId, projectId),
      orderBy: [desc(renderVersions.revision)],
    });
    expect(rows.length).toBe(2);
    expect(rows[0].revision).toBe(2); // newest first
    expect(rows[1].revision).toBe(1);
    // Each row owns its own output key (distinct downloads).
    expect(rows[0].outputKey).toContain('out-2');
    expect(rows[1].outputKey).toContain('out-1');
    // Frozen specJson snapshot present (specJson is jsonb/unknown — cast to read meta).
    expect((rows[0].specJson as { meta?: { revision?: number } } | null)?.meta?.revision).toBe(2);
  });

  it('the worker upsert on (projectId, revision) retried render stays one row', async () => {
    // Simulate the worker's crash-safe retry: same revision, onConflictDoUpdate — still ONE row.
    const [j3] = await db
      .insert(jobs)
      .values({ projectId, type: 'render', status: 'done', stage: 'render' })
      .returning();
    await db
      .insert(renderVersions)
      .values({
        projectId,
        revision: 2,
        format: FMT,
        outputKey: `${projectId}/out-2-retry.mp4`,
        posterKey: `${projectId}/poster-2.jpg`,
        durationSec: 4,
        specJson: makeSpec(2),
        jobId: j3.id,
      })
      .onConflictDoUpdate({
        target: [renderVersions.projectId, renderVersions.revision],
        set: { outputKey: `${projectId}/out-2-retry.mp4`, jobId: j3.id },
      });

    const rows = await db.query.renderVersions.findMany({
      where: eq(renderVersions.projectId, projectId),
    });
    // Still exactly 2 rows for this project — the retry updated rev 2, not a third row.
    expect(rows.length).toBe(2);
    const rev2 = rows.find((r) => r.revision === 2);
    expect(rev2?.outputKey).toContain('out-2-retry');
  });
});
