// ai-image.ts — worker handler for the Phase-4 AI-image generate job (type='generate',
// inputJson.kind='ai-image'). Runs tools/gen_image.py in the AI_IMAGE_VENV interpreter,
// then on SUCCESS writes the asset + image overlay into the project's spec and DEDUCTS;
// on FAIL refunds and leaves the spec untouched ("charged only on success").
import { getDb, projects, assets, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createId } from '@paralleldrive/cuid2';
import { completeAndDeduct, failAndRefund } from './billing.js';
import { resolveKey } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');

export interface AiImageInput {
  kind: 'ai-image';
  projectId: string;
  sceneId: string;
  prompt: string;
  model: 'fast' | 'pro' | 'lite';
  tier: 'free' | 'creator' | 'pro';
  /** Phase 2: storage key of the LOCKED character reference to condition the image on. */
  characterRef?: string;
}

/** Resolve the python interpreter for gen_image.py (AI_IMAGE_VENV, default .venv-image312). */
function imagePython(): string {
  const venv = process.env.AI_IMAGE_VENV ?? '.venv-image312';
  return path.join(repoRoot, venv, 'Scripts', 'python.exe');
}

function genImagePy(): string {
  return path.join(repoRoot, 'tools', 'gen_image.py');
}

/** Run a python script as a promise; reject on non-zero exit. */
function runPython(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(imagePython(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.stdout.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gen_image exited ${code}: ${err.slice(-1500)}`));
    });
    child.on('error', (e) => reject(e));
  });
}

/**
 * Run an AI-image job. Reads the input payload, runs gen_image.py to a storage path,
 * and on success writes the asset + overlay (revision++) and deducts. On any exception it
 * refunds and leaves the project spec untouched.
 */
export async function runAiImageJob(
  db: Db,
  jobId: string,
  projectId: string,
  userId: string,
  inputJson: unknown,
  reservedCredits: number
): Promise<void> {
  const input = inputJson as AiImageInput;
  if (input.kind !== 'ai-image') {
    await failAndRefund(db, jobId, userId, reservedCredits, 'invalid ai-image payload');
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

  // Output file name ai-<cuid>.png inside the project's storage folder.
  const cuid = createId();
  const filename = `ai-${cuid}.png`;
  const storageKey = `${projectId}/${filename}`;
  const absOut = resolveKey(storageKey);
  const url = `/media/${storageKey}`;

  // State the derived cost BEFORE generating (log only; the route already quoted it).
  console.log(`[ai-image] generating for project ${projectId} scene ${input.sceneId}: model=${input.model} cost=${reservedCredits}cr`);

  // Phase 2: when a locked character ref is present, condition the image on it so every
  // scene image shares the recurring character's face (gen_image --ref <character.png>).
  const refArgs: string[] = input.characterRef
    ? ['--ref', resolveKey(input.characterRef)]
    : [];

  try {
    await runPython([
      genImagePy(),
      '--prompt', input.prompt,
      '--model', input.model,
      '--aspect', '9:16',
      '--size', '2K',
      '--out', absOut,
      ...refArgs,
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ai-image] generation failed: ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `ai-image failed: ${msg}`);
    return;
  }

  // ---- SUCCESS: write asset + overlay, persist spec, then DEDUCT (atomic). ----
  try {
    // 1) assets row (source 'ai')
    await db.insert(assets).values({
      userId,
      projectId,
      kind: 'image',
      storageKey,
      url,
      source: 'ai',
    });

    // 2) Insert/replace the image overlay into specJson.scenes[sceneId].overlays + revision++
    const sceneIdx = (spec as { scenes: { id: string }[] }).scenes.findIndex((s) => s.id === input.sceneId);
    if (sceneIdx < 0) throw new Error(`scene ${input.sceneId} not found in spec`);
    const scene = (spec as { scenes: { id: string; durationSec: number; overlays: unknown[] }[] }).scenes[sceneIdx];
    const dur = scene.durationSec || 3;
    const overlay = {
      id: createId(),
      type: 'image',
      assetId: null,
      src: url,
      x: 140,
      y: 720,
      w: 800,
      h: 800,
      rotation: 0,
      opacity: 1,
      start: 0,
      end: Math.min(3, dur),
      animation: 'fade',
    };
    // Replace-vs-add: if the scene already has an image overlay, swap src on the FIRST one
    // (keeps geometry/timing). Otherwise push a new overlay.
    const existing = scene.overlays.find((o) => (o as { type?: string }).type === 'image');
    if (existing) {
      Object.assign(existing, { src: url, assetId: null });
    } else {
      scene.overlays.push(overlay);
    }
    (spec as { meta: { revision: number; updatedAt: string } }).meta.revision =
      ((spec as { meta: { revision: number } }).meta.revision ?? 0) + 1;
    (spec as { meta: { updatedAt: string } }).meta.updatedAt = new Date().toISOString();

    // 3) Persist the spec.
    await db
      .update(projects)
      .set({ specJson: spec, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    // 4) DEDUCT + mark done atomically.
    await completeAndDeduct(db, jobId, userId, reservedCredits, 'deduct:ai-image');
    await db.update(jobs).set({ resultJson: { url, storageKey } }).where(eq(jobs.id, jobId)).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ai-image] post-processing failed (refund): ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `ai-image post failed: ${msg}`);
  }
}
