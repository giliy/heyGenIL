// The render job body: validate spec, call renderSpec(), post-process (720p + watermark for
// free tier; clean 1080p for paid), write output+poster to storage, update the project.
// Phase 4 billing: on SUCCESS `completeAndDeduct` (deduct + done in ONE tx); on FAIL
// `failAndRefund` (refund + failed in ONE tx). A failed render NEVER charges the user.
import { getDb, projects, jobs, subscriptions, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, getTemplate, getTier, tierAllows } from '@shorts/spec';
import { updateProgress } from './claim.js';
import { copyIntoStorage, keyFor } from './storage.js';
import { completeAndDeduct, failAndRefund } from './billing.js';
import { recordRenderVersion } from './versions.js';
import { postProcess, type PostProcessResult } from './postprocess.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Load render-spec.mjs via dynamic import (NOT createRequire): under `createRequire`,
// the .mjs's transitive `import '@shorts/spec'` is resolved by Node's native ESM
// resolver, which rejects our src/.ts package exports. tsx's loader only hooks
// import(), so we import() it.
interface RenderSpecModule {
  renderSpec: (
    templateId: string,
    spec: unknown,
    opts: {
      outputLocation?: string;
      posterLocation?: string;
      scale?: number;
      onProgress?: (p: { progress: number }) => void;
    }
  ) => Promise<{
    outputPath: string;
    posterPath: string;
    durationSec: number;
    durationInFrames: number;
    width: number;
    height: number;
    fps: number;
  }>;
}
const renderSpecModule = (await import(
  pathToFileURL(path.resolve(here, '..', 'render-spec.mjs')).href
)) as RenderSpecModule;

const PROGRESS_WRITE_MIN_MS = 250;

export interface RenderJobInput {
  template: string;
  spec: unknown;
  renderOptions?: { codec?: string; pixelFormat?: string; crf?: number };
  // Phase 4 post-process flags (set by web submit; RE-CHECKED here against the user's tier).
  resolution?: '720p' | '1080p';
  watermark?: boolean;
  tier?: 'free' | 'creator' | 'pro';
}

/**
 * Render a claimed job. job.inputJson holds { template, spec, renderOptions, resolution,
 * watermark, tier }. projectId is the jobs.projectId (FK to projects). userId is the owning
 * user (ledger target); reservedCredits is the held amount (from jobs.reserved_credits).
 */
export async function runRenderJob(
  db: Db,
  jobId: string,
  projectId: string,
  inputJson: unknown,
  userId: string,
  reservedCredits: number
): Promise<void> {
  const input = inputJson as RenderJobInput;

  // Phase 6 TIER RE-CHECK (never trust the client): derive the actual render tier from the
  // user's subscription, not from what web's submit stamped — read resolution/watermark and
  // the ElevenLabs gate from the SHARED tier matrix so web and worker can never drift.
  const userTier = await currentTier(db, userId);
  const tierDef = getTier(userTier);
  const isPaid = userTier !== 'free';
  const resolution: '720p' | '1080p' = isPaid ? tierDef.maxResolution : '720p';
  const watermark = tierDef.watermark;
  // A user whose tier lacks ElevenLabs must not render an ElevenLabs spec — fail + refund.
  const eleven = (input.spec as { voice?: { engine?: string } } | undefined)?.voice?.engine === 'elevenlabs';
  if (eleven && !tierAllows(userTier, 'elevenlabsVoice')) {
    await failAndRefund(db, jobId, userId, reservedCredits, 'elevenlabs_voice_requires_paid');
    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
    return;
  }

  const template = getTemplate(input.template);
  if (!template) {
    await failAndRefund(db, jobId, userId, reservedCredits, `unknown template: ${input.template}`);
    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
    return;
  }

  const validation = validateSpec(input.spec);
  if (!validation.ok) {
    const msg = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    await failAndRefund(db, jobId, userId, reservedCredits, `invalid spec: ${msg}`);
    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
    return;
  }
  const spec = validation.data;

  // Throttled progress writer
  let lastWrite = 0;
  const onProgress = ({ progress }: { progress: number }) => {
    const now = Date.now();
    if (now - lastWrite < PROGRESS_WRITE_MIN_MS) return;
    lastWrite = now;
    void updateProgress(db, jobId, Math.min(1, Math.max(0, progress))).catch(() => {});
  };

  // Render to a temp path, then post-process + copy into storage.
  const tmpDir = path.join(process.cwd(), 'out', jobId);
  const tmpOut = path.join(tmpDir, 'render.mp4');
  const tmpPoster = path.join(tmpDir, 'poster.jpg');

  let result;
  try {
    result = await renderSpecModule.renderSpec(template.compositionId, spec, {
      outputLocation: tmpOut,
      posterLocation: tmpPoster,
      scale: 1,
      onProgress,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failAndRefund(db, jobId, userId, reservedCredits, msg);
    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return;
  }

  // ---- Phase 4 post-process: free → 720p + watermark; paid → clean 1080p ----
  let post: PostProcessResult | null = null;
  if (watermark || resolution === '720p') {
    try {
      post = await postProcess(tmpOut, { targetResolution: resolution, watermark });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failAndRefund(db, jobId, userId, reservedCredits, `post-process failed: ${msg}`);
      await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      return;
    }
  }
  const finalOut = post ? post.outputPath : tmpOut;
  const finalWidth = post ? post.width : result.width;
  const finalHeight = post ? post.height : result.height;

  // Copy output + poster into storage
  const outputKey = keyFor(projectId, 'render.mp4');
  const posterKey = keyFor(projectId, 'poster.jpg');
  await copyIntoStorage(outputKey, finalOut);
  if (await fileExists(result.posterPath)) {
    await copyIntoStorage(posterKey, result.posterPath);
  }

  const resultJson = {
    outputKey,
    posterKey: (await fileExists(result.posterPath)) ? posterKey : null,
    durationSec: result.durationSec,
    width: finalWidth,
    height: finalHeight,
    fps: result.fps,
    resolution,
    watermark,
  };

  // DEDUCT + done atomically (no charge without a finished render; no done without charge).
  try {
    await completeAndDeduct(db, jobId, userId, reservedCredits, 'deduct:render');
  } catch (e) {
    // The transaction rolled back → job still running, credits untouched. Fail + refund instead.
    const msg = e instanceof Error ? e.message : String(e);
    await failAndRefund(db, jobId, userId, reservedCredits, `deduct failed: ${msg}`);
    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return;
  }

  // Write resultJson on the now-done job (best-effort after the atomic deduct+done).
  await db.update(jobs).set({ resultJson }).where(eq(jobs.id, jobId)).catch(() => {});

  // Phase 5: record the completed render as an IMMUTABLE render_versions row + point the
  // project's lastRenderedVersionId at it (the "current" version). Runs on every render done,
  // normal AND resize — this is the single insertion point the plan designates.
  //
  // CRITICAL: the version row must NOT reference the live `render.mp4` key — every render
  // overwrites that key, which would silently swap the pixels of every PRIOR version (a rev-0
  // "9:16" version would download the rev-1 "1:1" file). Copy the final output to a
  // REVISION-SCOPED key (`render-r<rev>.mp4`) so each version row owns its own immutable pixels.
  try {
    const revision = spec.meta?.revision ?? 0;
    const versionOutputKey = keyFor(projectId, `render-r${revision}.mp4`);
    await copyIntoStorage(versionOutputKey, finalOut);
    let versionPosterKey: string | null = null;
    if (resultJson.posterKey && (await fileExists(result.posterPath))) {
      versionPosterKey = keyFor(projectId, `poster-r${revision}.jpg`);
      await copyIntoStorage(versionPosterKey, result.posterPath);
    }
    await recordRenderVersion(db, {
      projectId,
      jobId,
      spec,
      outputKey: versionOutputKey,
      posterKey: versionPosterKey,
      durationSec: result.durationSec,
      format: { width: finalWidth, height: finalHeight, fps: result.fps },
    });
  } catch (e) {
    // A version-record failure must not fail the (already-deducted, already-done) render, but it
    // would leave history inconsistent — log it loudly for the operator.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[render] render_versions insert failed for job ${jobId}: ${msg}`);
  }

  await db
    .update(projects)
    .set({
      status: 'ready',
      outputKey,
      posterKey: resultJson.posterKey ?? undefined,
      durationSec: result.durationSec,
      width: finalWidth,
      height: finalHeight,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

/** Resolve a user's current effective tier from their subscriptions row. */
async function currentTier(db: Db, userId: string): Promise<'free' | 'creator' | 'pro'> {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
  if (!sub) return 'free';
  const activeLike = sub.status === 'active' || sub.status === 'trialing';
  return activeLike ? (sub.tier as 'free' | 'creator' | 'pro') : 'free';
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
