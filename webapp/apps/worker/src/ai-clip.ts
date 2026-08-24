// ai-clip.ts — worker handler for the Phase-4 AI-clip generate job (type='generate',
// inputJson.kind='ai-clip'). Runs tools/gen_clip.py in image-to-video mode: the locked
// character's reference frame is uploaded to fal storage and passed as image_url, so the
// clip is conditioned on the recurring face. On SUCCESS writes the asset + scene.clip
// into the project's spec and DEDUCTS; on FAIL refunds and leaves the spec untouched
// ("charged only on success").
//
// Model passthrough: the model id is the character's video_model endpoint (default
// seedance v1.5 pro image-to-video) — the tool is model-agnostic by design.
import { getDb, projects, assets, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { completeAndDeduct, failAndRefund } from './billing.js';
import { resolveKey } from './storage.js';
import { uploadRefToFal } from './fal.js';
import { runPython } from './orchestrate/py.js';

export interface AiClipInput {
  kind: 'ai-clip';
  projectId: string;
  sceneId: string;
  prompt: string;
  /** The character's video_model endpoint (fal id). */
  model: string;
  /** Requested clip seconds (snapped by the model; the honest quote floor). */
  clipSeconds: number;
  tier: 'free' | 'creator' | 'pro';
  /** Storage key of the LOCKED character reference (image-to-video first frame). */
  characterRef?: string;
}

function genClipPy(): string {
  return path.join('tools', 'gen_clip.py');
}

/**
 * Run an AI-clip job. Reads the input payload, uploads the character ref to fal storage,
 * runs gen_clip.py image-to-video to a storage path, and on success writes the asset +
 * scene.clip (revision++) and deducts. On any exception it refunds and leaves the project
 * spec untouched.
 */
export async function runAiClipJob(
  db: Db,
  jobId: string,
  projectId: string,
  userId: string,
  inputJson: unknown,
  reservedCredits: number
): Promise<void> {
  const input = inputJson as AiClipInput;
  if (input.kind !== 'ai-clip') {
    await failAndRefund(db, jobId, userId, reservedCredits, 'invalid ai-clip payload');
    return;
  }
  if (!input.characterRef) {
    await failAndRefund(db, jobId, userId, reservedCredits, 'ai-clip requires a locked character reference');
    return;
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) {
    await failAndRefund(db, jobId, userId, reservedCredits, 'project not found');
    return;
  }
  let spec: unknown = project.specJson;
  if (!spec) {
    await failAndRefund(db, jobId, userId, reservedCredits, 'project has no spec');
    return;
  }

  // Output file name clip-<cuid>.mp4 inside the project's storage folder.
  const cuid = createId();
  const filename = `clip-${cuid}.mp4`;
  const storageKey = `${projectId}/${filename}`;
  const absOut = resolveKey(storageKey);
  const url = `/media/${storageKey}`;

  // State the derived cost BEFORE generating (log only; the route already quoted it).
  const secs = Math.max(1, Math.round(input.clipSeconds || 4));
  console.log(
    `[ai-clip] generating for project ${projectId} scene ${input.sceneId}: model=${input.model} dur=${secs}s cost=${reservedCredits}cr`
  );

  try {
    // Upload the LOCKED character reference to fal storage -> public image_url. This is the
    // first frame the clip is conditioned on (image-to-video, never text-to-video).
    const absRef = resolveKey(input.characterRef);
    const imageUrl = await uploadRefToFal(absRef);

    await runPython({
      tool: 'stdlib',
      args: [
        genClipPy(),
        '--model', input.model,
        '--prompt', input.prompt,
        '--aspect', '9:16',
        '--set', `image_url=${imageUrl}`,
        '--set', `duration=${secs}`,
        '--set', 'resolution=1080p',
        '--set', 'generate_audio=false', // voice is the TTS pipeline; fal audio off
        '--out', absOut,
      ],
      timeoutMs: 15 * 60 * 1000, // 15 min ceiling per clip
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ai-clip] generation failed: ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `ai-clip failed: ${msg}`);
    return;
  }

  // ---- SUCCESS: write asset + scene.clip, persist spec, then DEDUCT (atomic). ----
  try {
    await db.insert(assets).values({
      userId,
      projectId,
      kind: 'video',
      storageKey,
      url,
      source: 'ai',
    });

    // Insert/replace scene.clip on specJson.scenes[sceneId] + revision++.
    const sceneIdx = (spec as { scenes: { id: string }[] }).scenes.findIndex((s) => s.id === input.sceneId);
    if (sceneIdx < 0) throw new Error(`scene ${input.sceneId} not found in spec`);
    const scene = (spec as { scenes: { id: string; durationSec: number; clip?: unknown }[] }).scenes[sceneIdx];
    scene.clip = {
      src: url,
      durationSec: secs,
    };
    (spec as { meta: { revision: number; updatedAt: string } }).meta.revision =
      ((spec as { meta: { revision: number } }).meta.revision ?? 0) + 1;
    (spec as { meta: { updatedAt: string } }).meta.updatedAt = new Date().toISOString();

    await db
      .update(projects)
      .set({ specJson: spec, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await completeAndDeduct(db, jobId, userId, reservedCredits, 'deduct:ai-clip');
    await db.update(jobs).set({ resultJson: { url, storageKey } }).where(eq(jobs.id, jobId)).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ai-clip] post-processing failed (refund): ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `ai-clip post failed: ${msg}`);
  }
}
