// consent.ts — worker handler for the HeyGen-IL 'consent-verify' generate job. Runs
// tools/verify_consent.py (WhisperX Hebrew ASR w/ a deterministic non-silent fallback) over the
// spoken consent clip, and on PASS unlocks the digital-twin character (status 'ready' +
// consentVerifiedAt); on FAIL marks it 'failed' so the UI prompts a re-record.
//
// This job is FREE (0 reserved credits) — the consent gate is a trust/anti-impersonation
// check, not a paid generation. It only ever runs for kind 'twin' characters.
import { getDb, characters, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import path from 'path';
import { runPython, repoRoot } from './orchestrate/py.js';
import { resolveKey } from './storage.js';

export interface ConsentVerifyInput {
  kind: 'consent-verify';
  characterId: string;
  userId: string;
  consentKey: string; // storage key of the recorded consent clip
  phrase: string;     // the issued Hebrew consent phrase to match
}

async function complete(db: Db, jobId: string, resultJson: Record<string, unknown>): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'done', stage: 'complete', progress: 1, resultJson, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

async function fail(db: Db, jobId: string, error: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'failed', stage: 'consent', error, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/** Run the consent-verify job: verify the spoken clip, then lock/unlock the twin. */
export async function runConsentVerifyJob(db: Db, jobId: string, inputJson: unknown): Promise<void> {
  const input = inputJson as ConsentVerifyInput;
  if (input.kind !== 'consent-verify') {
    await fail(db, jobId, 'invalid consent-verify payload');
    return;
  }

  const character = await db.query.characters.findFirst({ where: eq(characters.id, input.characterId) });
  if (!character || character.userId !== input.userId) {
    await fail(db, jobId, 'character not found');
    return;
  }

  const clipAbs = resolveKey(input.consentKey);
  console.log(`[consent-verify] verifying consent for twin ${input.characterId} (phrase: "${input.phrase}")`);

  let ok = false;
  let method = 'unknown';
  let reason = 'verifier error';
  try {
    const res = await runPython({
      tool: 'whisperx', // .venv-voice312 (whisperx + ffmpeg7 via ffw)
      args: [
        path.join(repoRoot(), 'tools', 'verify_consent.py'),
        '--clip', clipAbs,
        '--phrase', input.phrase,
        '--json',
      ],
      failFast: false,
      timeoutMs: 10 * 60 * 1000,
    });
    // Parse the last JSON line from stdout (whisperx logs interleave on stdout/stderr).
    const line = res.stdout.trim().split('\n').reverse().find((l) => l.trim().startsWith('{')) ?? '';
    const v = JSON.parse(line) as { ok?: boolean; method?: string; reason?: string };
    ok = v.ok === true;
    method = v.method ?? 'unknown';
    reason = v.reason ?? reason;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    reason = `verifier crashed: ${msg}`;
  }

  if (ok) {
    await db
      .update(characters)
      .set({ status: 'ready', consentVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(characters.id, input.characterId));
    await complete(db, jobId, { characterId: input.characterId, method, reason });
    console.log(`[consent-verify] twin ${input.characterId} VERIFIED (${method})`);
    return;
  }

  await db
    .update(characters)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(eq(characters.id, input.characterId));
  await fail(db, jobId, `consent rejected (${method}): ${reason}`);
  console.log(`[consent-verify] twin ${input.characterId} REJECTED (${method}): ${reason}`);
}

// getDb imported for the optional default; the loop passes its db. (kept for parity with other jobs)
void getDb;
