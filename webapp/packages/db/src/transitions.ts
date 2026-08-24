// Pure job-state transition helper — the legal state machine for jobs.status.
// Unit-tested; both web (job insert) and worker (claim/finish) rely on it so an
// illegal transition is caught here, not as a confusing DB write later.
import { z } from 'zod';

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobStatusSchema = z.enum(JOB_STATUSES);

/** Legal next states for each current status. `done`/`failed` are terminal. */
const LEGAL: Record<JobStatus, readonly JobStatus[]> = {
  queued: ['running', 'failed'],
  running: ['done', 'failed'],
  done: [],
  failed: [],
};

/**
 * Assert a transition is legal. Returns the target status on success,
 * throws on an illegal transition.
 */
export function assertTransition(from: JobStatus, to: JobStatus): JobStatus {
  const fromParsed = jobStatusSchema.parse(from);
  const toParsed = jobStatusSchema.parse(to);
  if (!LEGAL[fromParsed].includes(toParsed)) {
    throw new Error(`illegal job transition: ${fromParsed} -> ${toParsed}`);
  }
  return toParsed;
}

/** Non-throwing variant: returns true when the transition is legal. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  try {
    assertTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
