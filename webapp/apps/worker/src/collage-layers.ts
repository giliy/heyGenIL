// collage-layers.ts — worker handler for the Phase-5 collage-layers generate job
// (type='generate', inputJson.kind='collage-layers'). For every requested layer it runs
// tools/gen_image.py (an AI illustration on the vox paper-collage style) then tools/cutout.py
// (background removal -> a transparent die-cut PNG layer). On SUCCESS it writes the assets +
// fills scene.vox.layers[].src on the project's spec and DEDUCTS; on FAIL it refunds and
// leaves the spec untouched ("charged only on success").
//
// Style lock: every prompt is prefixed with the vox paper-collage style phrase (vox/DESIGN.md)
// so all generated layers share one coherent look. Cutouts are painted isolated-on-white
// (gen_image) then rembg-matted (cutout.py); photos are left as flat illustrations (no matte).
import { getDb, projects, assets, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import { createId } from '@paralleldrive/cuid2';
import { completeAndDeduct, failAndRefund } from './billing.js';
import { resolveKey } from './storage.js';
import { runPython } from './orchestrate/py.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');

export interface CollageLayerRequest {
  /** The scene whose scene.vox.layers[] entry this fills. */
  sceneId: string;
  /** The layer's stable id inside that scene's vox.layers[] — we swap its src in place. */
  layerId: string;
  /** 'cutout' = die-cut subject (isolated-on-white + rembg matte); 'photo' = flat illustration. */
  kind: 'cutout' | 'photo';
  /** The layer's content prompt (the scene visual / object description). */
  prompt: string;
}

export interface CollageLayersInput {
  kind: 'collage-layers';
  projectId: string;
  /** The layers to mint this job. Each is billed at CREDIT_TABLE.voxLayer. */
  layers: CollageLayerRequest[];
  tier: 'free' | 'creator' | 'pro';
}

// The vox paper-collage style phrase — locked (vox/DESIGN.md): paper world (warm cream/kraft),
// die-cut subjects, gentle washes, fine ink outlines, muted warm palette, no text/watermark.
// Reused verbatim (here and in the pixel stage) so every layer shares one coherent look.
const VOX_STYLE =
  'Hand-crafted paper collage illustration on warm cream kraft paper, cut-paper die-cut ' +
  'subject, gentle watercolor washes, fine ink outlines, flat editorial documentary style, ' +
  'muted warm palette. No text, no letters, no words, no watermark.';

/** Isolated-subject suffix for cutouts so cutout.py's matte has a clean white ground. */
const ISOLATED = 'Isolated subject on a plain pure-white background.';

/** gen_image.py needs GEMINI_API_KEY (its own venv: AI_IMAGE_VENV, default .venv-image312). */
function imagePython(): string {
  const venv = process.env.AI_IMAGE_VENV ?? '.venv-image312';
  return path.join(repoRoot, venv, 'Scripts', 'python.exe');
}

/** cutout.py needs pillow + rembg (same image venv as gen_image). */
function cutoutPython(): string {
  return imagePython();
}

function genImagePy(): string {
  return path.join('tools', 'gen_image.py');
}

function cutoutPy(): string {
  return path.join('tools', 'cutout.py');
}

/**
 * Run a collage-layers job. Mints each requested layer into the project's storage folder,
 * fills the matching scene.vox.layers[].src, writes assets, and deducts once on success.
 * Any exception refunds and leaves the project spec untouched.
 */
export async function runCollageLayersJob(
  db: Db,
  jobId: string,
  projectId: string,
  userId: string,
  inputJson: unknown,
  reservedCredits: number
): Promise<void> {
  const input = inputJson as CollageLayersInput;
  if (input.kind !== 'collage-layers') {
    await failAndRefund(db, jobId, userId, reservedCredits, 'invalid collage-layers payload');
    return;
  }
  if (!input.layers || input.layers.length === 0) {
    await failAndRefund(db, jobId, userId, reservedCredits, 'collage-layers requires at least one layer');
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

  // State the derived cost BEFORE generating (log only; the route already quoted it).
  console.log(
    `[collage-layers] generating ${input.layers.length} layer(s) for project ${projectId} cost=${reservedCredits}cr`
  );

  const minted: { src: string; storageKey: string; layerId: string; sceneId: string }[] = [];
  try {
    for (let i = 0; i < input.layers.length; i++) {
      const req = input.layers[i];
      const cuid = createId();
      const isCutout = req.kind === 'cutout';

      // Raw AI illustration (isolated-on-white for cutouts so cutout.py gets a clean ground).
      const rawName = `raw-${cuid}.png`;
      const rawKey = `${projectId}/${rawName}`;
      const absRaw = resolveKey(rawKey);
      const prompt = `${VOX_STYLE} ${req.prompt}${isCutout ? ISOLATED : ''}.`;
      await runPython({
        tool: 'gen_image',
        args: [
          genImagePy(),
          '--prompt', prompt,
          '--model', 'fast',
          '--aspect', '9:16',
          '--size', '2K',
          '--out', absRaw,
        ],
        timeoutMs: 5 * 60 * 1000,
      });

      // The layer PNG: cutouts get a transparent die-cut matte (cutout.py); photos are the
      // illustration itself (no matte — ArchivalPhoto applies its own sepia border).
      let layerKey = rawKey;
      if (isCutout) {
        const layerName = `layer-${cuid}.png`;
        layerKey = `${projectId}/${layerName}`;
        const absLayer = resolveKey(layerKey);
        await runPython({
          tool: 'gen_image', // same venv (pillow + rembg) — cutout is a sibling tool
          args: [
            cutoutPy(),
            absRaw,
            absLayer,
            '--method', 'rembg',
            '--model', 'birefnet-general',
            // No --border: the white sticker edge is a TSX drop-shadow in collage.tsx Cutout,
            // not baked pixels (baking + drop-shadow would double it).
            '--pad', '16',
          ],
          timeoutMs: 3 * 60 * 1000,
        });
      }

      const url = `/media/${layerKey}`;
      await db.insert(assets).values({
        userId,
        projectId,
        kind: 'image',
        storageKey: layerKey,
        url,
        source: 'ai',
      });
      minted.push({ src: url, storageKey: layerKey, layerId: req.layerId, sceneId: req.sceneId });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[collage-layers] generation failed: ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `collage-layers failed: ${msg}`);
    return;
  }

  // ---- SUCCESS: write assets + fill layer srcs, persist spec, then DEDUCT (atomic). ----
  try {
    // Fill each minted layer's src on the matching scene.vox.layers[] entry (in place).
    const scenes = (spec as { scenes: { id: string; vox?: { layers: { id: string; src?: string }[] } }[] }).scenes;
    for (const m of minted) {
      const scene = scenes.find((s) => s.id === m.sceneId);
      if (!scene?.vox) throw new Error(`scene ${m.sceneId} has no vox layer stack`);
      const layer = scene.vox.layers.find((l) => l.id === m.layerId);
      if (!layer) throw new Error(`layer ${m.layerId} not found in scene ${m.sceneId}.vox.layers`);
      layer.src = m.src;
    }

    (spec as { meta: { revision: number; updatedAt: string } }).meta.revision =
      ((spec as { meta: { revision: number } }).meta.revision ?? 0) + 1;
    (spec as { meta: { updatedAt: string } }).meta.updatedAt = new Date().toISOString();

    await db
      .update(projects)
      .set({ specJson: spec, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await completeAndDeduct(db, jobId, userId, reservedCredits, 'deduct:collage-layers');
    await db
      .update(jobs)
      .set({ resultJson: { layers: minted.map((m) => ({ layerId: m.layerId, src: m.src })) } })
      .where(eq(jobs.id, jobId))
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[collage-layers] post-processing failed (refund): ${msg}`);
    await failAndRefund(db, jobId, userId, reservedCredits, `collage-layers post failed: ${msg}`);
  }
}
