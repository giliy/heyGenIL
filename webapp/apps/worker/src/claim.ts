// Job claim — SELECT … FOR UPDATE SKIP LOCKED so one worker picks one queued render job.
import { getDb, jobs, type Db } from '@shorts/db';
import { sql, eq } from 'drizzle-orm';

export interface ClaimedJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  stage: string | null;
  progress: number;
  inputJson: unknown;
  costCredits?: number | null;
  reservedCredits?: number | null;
}

/**
 * Atomically claim the oldest queued render job: set it running and return it.
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers get disjoint jobs.
 */
export async function claimNextJob(db: Db): Promise<ClaimedJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status='running', stage='render', "started_at"=now(), "heartbeat_at"=now()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status='queued' AND type='render'
        ORDER BY "created_at"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id, "project_id" AS "projectId", type, status, stage, progress, "input_json" AS "inputJson", "cost_credits" AS "costCredits", "reserved_credits" AS "reservedCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedJob[] }).rows ?? (rows as unknown as ClaimedJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Atomically claim the oldest queued generate job. Sets it running (stage 'story').
 * Phase 3 runs generate jobs in the SAME loop, so render + generate workers are one process.
 * EXCLUDES ai-image and ai-clip jobs (input_json->>'kind' IN ('ai-image','ai-clip')) — those
 * are claimed by their dedicated claimers (single-asset, not the full generate pipeline).
 */
export async function claimNextGenerateJob(db: Db): Promise<ClaimedJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status='running', stage='story', "started_at"=now(), "heartbeat_at"=now()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status='queued' AND type='generate'
          AND ("input_json"->>'kind') IS DISTINCT FROM 'ai-image'
          AND ("input_json"->>'kind') IS DISTINCT FROM 'ai-clip'
          AND ("input_json"->>'kind') IS DISTINCT FROM 'collage-layers'
          AND ("input_json"->>'kind') IS DISTINCT FROM 'character-mint'
          AND ("input_json"->>'kind') IS DISTINCT FROM 'consent-verify'
        ORDER BY "created_at"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id, "project_id" AS "projectId", type, status, stage, progress, "input_json" AS "inputJson", "cost_credits" AS "costCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedJob[] }).rows ?? (rows as unknown as ClaimedJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export interface ClaimedAiImageJob {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  stage: string | null;
  inputJson: unknown;
  reservedCredits: number;
}

/**
 * Atomically claim the oldest queued AI-IMAGE generate job (input_json kind 'ai-image'),
 * joining the owning user id so the worker can deduct/refund against the right ledger.
 * Uses FOR UPDATE SKIP LOCKED. Returns null when none are queued.
 */
export async function claimNextAiImageJob(db: Db): Promise<ClaimedAiImageJob | null> {
  // UPDATE ... FROM projects is the valid Postgres form (UPDATE does not accept JOIN). The
  // FOR UPDATE SKIP LOCKED picks the oldest queued ai-image job; FROM joins the owner user id.
  const rows = await db.execute(sql`
    UPDATE jobs j
       SET status='running', stage='pixel', "started_at"=now(), "heartbeat_at"=now()
      FROM projects p
     WHERE j."project_id" = p.id
       AND j.id = (
         SELECT id FROM jobs
          WHERE status='queued' AND type='generate'
            AND "input_json"->>'kind' = 'ai-image'
          ORDER BY "created_at"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
     RETURNING j.id, j."project_id" AS "projectId", p."user_id" AS "userId",
               j.status, j.stage, j."input_json" AS "inputJson",
               j."reserved_credits" AS "reservedCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedAiImageJob[] }).rows ?? (rows as unknown as ClaimedAiImageJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export interface ClaimedAiClipJob {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  stage: string | null;
  inputJson: unknown;
  reservedCredits: number;
}

/**
 * Atomically claim the oldest queued AI-CLIP generate job (input_json kind 'ai-clip'),
 * joining the owning user id so the worker can deduct/refund against the right ledger.
 * Uses FOR UPDATE SKIP LOCKED. Returns null when none are queued.
 */
export async function claimNextAiClipJob(db: Db): Promise<ClaimedAiClipJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs j
       SET status='running', stage='pixel', "started_at"=now(), "heartbeat_at"=now()
      FROM projects p
     WHERE j."project_id" = p.id
       AND j.id = (
         SELECT id FROM jobs
          WHERE status='queued' AND type='generate'
            AND "input_json"->>'kind' = 'ai-clip'
          ORDER BY "created_at"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
     RETURNING j.id, j."project_id" AS "projectId", p."user_id" AS "userId",
               j.status, j.stage, j."input_json" AS "inputJson",
               j."reserved_credits" AS "reservedCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedAiClipJob[] }).rows ?? (rows as unknown as ClaimedAiClipJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export interface ClaimedCollageLayersJob {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  stage: string | null;
  inputJson: unknown;
  reservedCredits: number;
}

/**
 * Atomically claim the oldest queued COLLAGE-LAYERS generate job (input_json kind
 * 'collage-layers'), joining the owning user id so the worker can deduct/refund against the
 * right ledger. Uses FOR UPDATE SKIP LOCKED. Returns null when none are queued.
 */
export async function claimNextCollageLayersJob(db: Db): Promise<ClaimedCollageLayersJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs j
       SET status='running', stage='pixel', "started_at"=now(), "heartbeat_at"=now()
      FROM projects p
     WHERE j."project_id" = p.id
       AND j.id = (
         SELECT id FROM jobs
          WHERE status='queued' AND type='generate'
            AND "input_json"->>'kind' = 'collage-layers'
          ORDER BY "created_at"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
     RETURNING j.id, j."project_id" AS "projectId", p."user_id" AS "userId",
               j.status, j.stage, j."input_json" AS "inputJson",
               j."reserved_credits" AS "reservedCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedCollageLayersJob[] }).rows ?? (rows as unknown as ClaimedCollageLayersJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

export interface ClaimedCharacterMintJob {
  id: string;
  userId: string;
  inputJson: unknown;
  reservedCredits: number;
}

export interface ClaimedConsentVerifyJob {
  id: string;
  userId: string;
  inputJson: unknown;
}

/**
 * Atomically claim the oldest queued CONSENT-VERIFY generate job (input_json kind
 * 'consent-verify'). Free (0 reserved credits) — the consent gate is a trust check, not a
 * paid generation. Payload carries userId on the character, so no projects join is needed.
 */
export async function claimNextConsentVerifyJob(db: Db): Promise<ClaimedConsentVerifyJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status='running', stage='consent', "started_at"=now(), "heartbeat_at"=now()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status='queued' AND type='generate'
          AND "input_json"->>'kind' = 'consent-verify'
        ORDER BY "created_at"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id,
               "input_json"->>'userId' AS "userId",
               "input_json" AS "inputJson"
  `);
  const list = (rows as unknown as { rows?: ClaimedConsentVerifyJob[] }).rows ?? (rows as unknown as ClaimedConsentVerifyJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Atomically claim the oldest queued CHARACTER-MINT generate job (input_json kind
 * 'character-mint'). The mint payload carries its own userId (the characters row owns it),
 * so unlike the ai-image claim this does NOT join projects — mint jobs are anchored to a
 * project row only to satisfy the jobs.project_id NOT NULL constraint.
 */
export async function claimNextCharacterMintJob(db: Db): Promise<ClaimedCharacterMintJob | null> {
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status='running', stage='mint', "started_at"=now(), "heartbeat_at"=now()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status='queued' AND type='generate'
          AND "input_json"->>'kind' = 'character-mint'
        ORDER BY "created_at"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id,
               "input_json"->>'userId' AS "userId",
               "input_json" AS "inputJson",
               "reserved_credits" AS "reservedCredits"
  `);
  const list = (rows as unknown as { rows?: ClaimedCharacterMintJob[] }).rows ?? (rows as unknown as ClaimedCharacterMintJob[]);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/** Update progress + heartbeat. Throttled by the caller. */
export async function updateProgress(db: Db, jobId: string, progress: number): Promise<void> {
  await db
    .update(jobs)
    .set({ progress, heartbeatAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/** Mark a job done + write resultJson. */
export async function completeJob(
  db: Db,
  jobId: string,
  resultJson: Record<string, unknown>
): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'done', stage: 'complete', progress: 1, resultJson, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/** Mark a job failed. */
export async function failJob(db: Db, jobId: string, error: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'failed', stage: 'render', error, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/**
 * Watchdog: fail `running` jobs whose heartbeat is older than `staleMs`.
 */
export async function failStaleJobs(db: Db, staleMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status='failed', error='stalled (no heartbeat)', "finished_at"=now()
     WHERE status='running' AND "heartbeat_at" < ${cutoff}
     RETURNING id
  `);
  const list = (rows as unknown as { rows?: { id: string }[] }).rows ?? [];
  return Array.isArray(list) ? list.length : 0;
}
