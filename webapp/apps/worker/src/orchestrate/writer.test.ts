import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeStageWriter, type StageWriter } from './writer';
import type { Db } from '@shorts/db';

// A minimal fake Db that records update() calls. The writer only touches
// db.update(jobs).set({...}).where(...) — we chain a fluent recorder.
function makeFakeDb() {
  const writes: { stage?: string; progress?: number; heartbeatOnly: boolean }[] = [];
  const db = {
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: async () => {
          writes.push({
            stage: vals.stage as string | undefined,
            progress: vals.progress as number | undefined,
            heartbeatOnly: !('stage' in vals) && !('progress' in vals),
          });
        },
      }),
    }),
  } as unknown as Db;
  return { db, writes };
}

describe('stage writer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('begin() writes stage + progress 0', async () => {
    const { db, writes } = makeFakeDb();
    const w: StageWriter = makeStageWriter(db, 'job-1');
    await w.begin('story');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ stage: 'story', progress: 0 });
  });

  it('flush() forces a write even when throttled', async () => {
    const { db, writes } = makeFakeDb();
    const w = makeStageWriter(db, 'job-1');
    await w.flush('voice', 1);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ stage: 'voice', progress: 1 });
  });

  it('set() is throttled and collapses rapid same-stage updates', async () => {
    const { db, writes } = makeFakeDb();
    const w = makeStageWriter(db, 'job-1');
    w.set('build', 0.1);
    w.set('build', 0.11); // <0.01 delta => no-op
    w.set('build', 0.2);  // throttled (<400ms since first) => dropped
    await vi.advanceTimersByTimeAsync(0);
    expect(writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ stage: 'build', progress: 0.1 });
  });

  it('set() clamps progress to [0,1]', async () => {
    const { db, writes } = makeFakeDb();
    const w = makeStageWriter(db, 'job-1');
    w.set('mix', 1.7);
    await vi.advanceTimersByTimeAsync(0);
    expect(writes[0].progress).toBe(1);
  });

  it('set() writes again after the throttle window', async () => {
    const { db, writes } = makeFakeDb();
    const w = makeStageWriter(db, 'job-1');
    w.set('build', 0.1);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500); // pass the 400ms throttle
    w.set('build', 0.5);
    await vi.advanceTimersByTimeAsync(0);
    expect(writes.length).toBe(2);
    expect(writes[1]).toMatchObject({ stage: 'build', progress: 0.5 });
  });

  it('beat() writes a heartbeat without stage/progress', async () => {
    const { db, writes } = makeFakeDb();
    const w = makeStageWriter(db, 'job-1');
    await w.beat();
    expect(writes).toHaveLength(1);
    expect(writes[0].heartbeatOnly).toBe(true);
  });
});
