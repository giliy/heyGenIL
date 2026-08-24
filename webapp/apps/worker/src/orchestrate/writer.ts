// writer.ts — the stage/progress heartbeat the web UI polls.
// Small, shared by every stage. Progress is throttled so the DB isn't hammered.
import { getDb, jobs } from '@shorts/db';
import { eq } from 'drizzle-orm';
import type { Db } from '@shorts/db';

const THROTTLE_MS = 400;

export interface StageWriter {
  jobId: string;
  /** Set the current stage + progress, writing a heartbeat. Throttled. */
  set(stage: string, progress: number): void;
  /** Force a write (bypasses throttle) — used at stage boundaries. */
  flush(stage: string, progress: number): Promise<void>;
  /** Mark the current stage started (progress 0). */
  begin(stage: string): Promise<void>;
  /** Mark a heartbeat without changing stage/progress (for long sub-steps). */
  beat(): Promise<void>;
}

export function makeStageWriter(db: Db, jobId: string): StageWriter {
  let lastWrite = 0;
  let lastStage = '';
  let lastProgress = -1;

  async function write(stage: string, progress: number): Promise<void> {
    await db
      .update(jobs)
      .set({ stage, progress: Math.min(1, Math.max(0, progress)), heartbeatAt: new Date() })
      .where(eq(jobs.id, jobId));
  }

  return {
    jobId,

    set(stage: string, progress: number): void {
      const now = Date.now();
      if (stage === lastStage && Math.abs(progress - lastProgress) < 0.01) return; // no-op
      if (now - lastWrite < THROTTLE_MS && stage === lastStage) return; // throttled
      lastWrite = now;
      lastStage = stage;
      lastProgress = progress;
      void write(stage, progress).catch(() => {});
    },

    async flush(stage: string, progress: number): Promise<void> {
      lastWrite = Date.now();
      lastStage = stage;
      lastProgress = progress;
      await write(stage, progress);
    },

    async begin(stage: string): Promise<void> {
      await write(stage, 0);
    },

    async beat(): Promise<void> {
      await db.update(jobs).set({ heartbeatAt: new Date() }).where(eq(jobs.id, jobId));
    },
  };
}
