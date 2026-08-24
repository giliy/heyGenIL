// pixel.ts — stage 3: the "pixels" for a template.
//
// FREE TIER NO-OP (engine 'tsx'): the pixels ARE the template's own TSX — nothing to spend
// and no fal call. We still write an empty asset-manifest.json and validate it with
// contracts.py `manifest` so the pixel→build contract seam is preserved and VERIFIED.
//
// Phase 4 (engine 'ai'): the pixels are AI-video clips. For every scene we run
// tools/gen_clip.py in image-to-video mode, conditioned on the project's LOCKED character
// reference frame (uploaded once to fal storage), and set scene.clip on the spec. The clip
// count × CREDIT_TABLE.aiVideoSec is the pixel spend — gated by the cost-before-pixels check
// so the quote reserved at submit is never exceeded.
import path from 'path';
import { promises as fs } from 'fs';
import { createId } from '@paralleldrive/cuid2';
import type { Spec } from '@shorts/spec';
import { CREDIT_TABLE, resolveVideoModel } from '@shorts/spec';
import { getDb, projects, characters, assets, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { runPython, runProcess, repoRoot, storageDir } from '../py';
import { resolveKey } from '../../storage.js';
import { uploadRefToFal } from '../../fal.js';
import type { StageReport } from '../types';
import type { StageWriter } from '../writer';

export interface PixelOutcome {
  manifestPath: string;
  /** Phase 4: sceneId → clip src/duration produced this stage (empty for TSX). */
  clips: { sceneId: string; src: string; storageKey: string; durationSec: number }[];
  /** Phase 5: layerId → src minted this stage (empty unless vox). */
  layers: { sceneId: string; layerId: string; src: string; storageKey: string }[];
}

/**
 * Run the pixel stage. Returns the validated asset-manifest path (+ any AI clips produced).
 * @param quotedCredits the cost quoted at submit (reserved); free tier = 0.
 */
export async function runPixelStage(
  spec: Spec,
  projectId: string,
  quotedCredits: number,
  workDir: string,
  writer: StageWriter,
  db?: Db
): Promise<PixelOutcome> {
  await writer.begin('pixel');

  // COST-BEFORE-PIXELS GATE (inert on free tier; armed by Phase 4).
  // If this template ever spends on pixels, the spend must not exceed the quote.
  if (spec.engine === 'ai') {
    return runAiPixelStage(spec, projectId, quotedCredits, workDir, writer, db ?? getDb());
  }
  if (spec.engine === 'vox') {
    return runVoxPixelStage(spec, projectId, quotedCredits, workDir, writer, db ?? getDb());
  }
  if (spec.engine !== 'tsx') {
    // Unknown engine — never spend unquoted.
    throw new Error(`pixel stage: unknown engine '${spec.engine}' (free tier is TSX templates only)`);
  }
  // assert quoted >= spend (spend = 0 on free tier)
  if (quotedCredits < 0) {
    throw new Error(`cost gate: quoted cost ${quotedCredits}cr is negative (internal error)`);
  }

  // Free-tier TSX no-op: write an EMPTY asset-manifest (the TSX is the pixels).
  const manifest = {
    project: `generate/${projectId}`,
    track: spec.template,
    layers: [],
    clips: [],
    hero: null,
    cost: { credits: 0, usd: '0.00', note: 'free tier: TSX template, no fal' },
  };
  const manifestPath = path.join(workDir, 'asset-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Contract gate: the manifest must validate (real, confirmed validator).
  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'manifest', manifestPath],
  });

  await writer.flush('pixel', 1);
  return { manifestPath, clips: [], layers: [] };
}

/**
 * Phase 4 — AI-video pixel stage. Generates one image-to-video clip per scene, conditioned
 * on the locked character's reference frame. Mutates spec.scenes[].clip and returns the
 * produced clips. The per-second spend is gated against the quote.
 */
async function runAiPixelStage(
  spec: Spec,
  projectId: string,
  quotedCredits: number,
  workDir: string,
  writer: StageWriter,
  db: Db
): Promise<PixelOutcome> {
  // 1) The project MUST carry a locked character (image-to-video, never text-to-video).
  const characterId = (spec as { characterId?: string }).characterId;
  if (!characterId) {
    throw new Error('AI-video pixel stage requires a locked character (spec.characterId)');
  }
  const character = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
  if (!character || character.status !== 'ready' || !character.refImageKey) {
    throw new Error(`AI-video pixel stage: locked character ${characterId} not ready`);
  }

  // 2) Upload the reference frame ONCE; every scene clip shares it (the recurring face).
  const absRef = resolveKey(character.refImageKey);
  const imageUrl = await uploadRefToFal(absRef);
  const model = resolveVideoModel(
    (spec as { aiModel?: string }).aiModel ??
      (character.specJson as { video_model?: string } | null)?.video_model
  );

  // 3) Cost gate: the intended spend (Σ clip seconds × aiVideoSec) must not exceed the quote.
  const totalSec = spec.scenes.reduce((s, sc) => s + (sc.durationSec || 4), 0);
  const intendedSpend = Math.ceil(totalSec) * CREDIT_TABLE.aiVideoSec;
  if (quotedCredits < intendedSpend) {
    throw new Error(
      `cost gate: AI-video spend ${intendedSpend}cr exceeds quoted ${quotedCredits}cr — re-quote before rendering`
    );
  }

  const produced: PixelOutcome['clips'] = [];
  const clipManifest: { id: string; file: string }[] = [];

  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const dur = Math.max(1, Math.round(scene.durationSec || 4));
    const cuid = createId();
    const filename = `clip-${scene.id}-${cuid}.mp4`;
    const storageKey = `${projectId}/${filename}`;
    const absOut = resolveKey(storageKey);
    const url = `/media/${storageKey}`;

    // Prompt: scene visual (the action) + the locked-character consistency + one-character guard.
    const prompt =
      (scene.visual?.trim() || `${spec.title}: shot ${i + 1}`) +
      ' — same locked recurring character, EXACTLY ONE character in the scene for the entire shot, no morphing, no clones';

    await writer.set('pixel', (i + 1) / (spec.scenes.length + 1));
    await runPython({
      tool: 'stdlib',
      args: [
        path.join('tools', 'gen_clip.py'),
        '--model', model,
        '--prompt', prompt,
        '--aspect', '9:16',
        '--set', `image_url=${imageUrl}`,
        '--set', `duration=${dur}`,
        '--set', 'resolution=1080p',
        '--set', 'generate_audio=false',
        '--out', absOut,
      ],
      timeoutMs: 15 * 60 * 1000,
    });

    // Write the clip asset (source 'ai').
    await db.insert(assets).values({
      userId: (await db.query.projects.findFirst({ where: eq(projects.id, projectId) }))!.userId,
      projectId,
      kind: 'video',
      storageKey,
      url,
      durationSec: dur,
      source: 'ai',
    });

    // Set the scene's clip reference (consumed by the build/render stage + the quote).
    (scene as { clip?: unknown }).clip = { src: url, durationSec: dur };
    clipManifest.push({ id: scene.id, file: absOut });
    produced.push({ sceneId: scene.id, src: url, storageKey, durationSec: dur });
  }

  // 4) Write the asset-manifest with the produced clips.
  const manifest = {
    project: `generate/${projectId}`,
    track: spec.template,
    layers: [],
    clips: clipManifest,
    hero: null,
    cost: {
      credits: intendedSpend,
      usd: (intendedSpend / 100).toFixed(2),
      note: `AI-video: ${spec.scenes.length} clip(s) @ ${CREDIT_TABLE.aiVideoSec}cr/s (image-to-video, character-locked)`,
    },
  };
  const manifestPath = path.join(workDir, 'asset-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Contract gate: the manifest must validate (clip files must exist).
  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'manifest', manifestPath],
  });

  await writer.flush('pixel', 1);
  return { manifestPath, clips: produced, layers: [] };
}

/**
 * Phase 5 — Vox paper-collage pixel stage. The "pixels" are the die-cut layers: for every
 * scene cutout/photo layer with no src yet, mint it (gen_image.py; cutouts then run cutout.py
 * for the transparent die-cut) into project storage and set layer.src. The spend (Σ
 * image-bearing layers × voxLayer) is gated against the quote — the wizard quotes
 * payload.voxLayers × voxLayer up front. Label/stamp layers are free (TSX/SVG, no raster).
 */
async function runVoxPixelStage(
  spec: Spec,
  projectId: string,
  quotedCredits: number,
  workDir: string,
  writer: StageWriter,
  db: Db
): Promise<PixelOutcome> {
  // DESIGN.md style-lock: paper world (warm cream/kraft), die-cut subjects, documentary
  // editorial. cutout.py supplies the transparency; collage.tsx Cutout supplies the white
  // sticker edge + soft drop shadow in TSX — so do NOT bake a sticker border into the PNG.
  const VOX_STYLE =
    'Hand-crafted paper collage illustration on warm cream kraft paper, cut-paper die-cut ' +
    'subject, gentle watercolor washes, fine ink outlines, flat editorial documentary style, ' +
    'muted warm palette. No text, no letters, no words, no watermark.';

  if (!spec.vox) {
    throw new Error('vox pixel stage: spec.vox (paper + cam keyframes) is required');
  }

  // 1) Cost gate: intended spend (image-bearing layers missing a src × voxLayer) ≤ quote.
  const wanted: { sceneIdx: number; layerIdx: number; kind: 'cutout' | 'photo'; prompt: string }[] = [];
  spec.scenes.forEach((scene, si) => {
    (scene.vox?.layers ?? []).forEach((layer, li) => {
      const kind = layer.type === 'cutout' || layer.type === 'photo' ? layer.type : null;
      if (!kind) return; // label/stamp: free TSX/SVG
      const hasSrc = typeof (layer as { src?: string }).src === 'string' && (layer as { src?: string }).src;
      if (hasSrc) return; // already minted (rerun-safe)
      wanted.push({ sceneIdx: si, layerIdx: li, kind, prompt: (layer as { srcPrompt?: string }).srcPrompt ?? layer.id });
    });
  });
  const intendedSpend = wanted.length * CREDIT_TABLE.voxLayer;
  if (quotedCredits < intendedSpend) {
    throw new Error(
      `cost gate: vox pixel spend ${intendedSpend}cr (${wanted.length} layer(s) × ${CREDIT_TABLE.voxLayer}cr) exceeds quoted ${quotedCredits}cr — re-quote before rendering`
    );
  }

  const userId = (await db.query.projects.findFirst({ where: eq(projects.id, projectId) }))!.userId;
  const minted: PixelOutcome['layers'] = [];
  const layerManifest: { id: string; file: string }[] = [];

  for (let i = 0; i < wanted.length; i++) {
    const { sceneIdx, layerIdx, kind, prompt } = wanted[i];
    const cuid = createId();
    const rawKey = `${projectId}/raw-${cuid}.png`;
    const layerKey = kind === 'cutout' ? `${projectId}/layer-${cuid}.png` : rawKey;
    const absRaw = resolveKey(rawKey);
    const absLayer = resolveKey(layerKey);
    const url = `/media/${layerKey}`;

    const fullPrompt = `${VOX_STYLE} ${prompt}.`;

    await writer.set('pixel', i / (wanted.length + 1));
    await runPython({
      tool: 'gen_image',
      args: [
        '--prompt', fullPrompt,
        '--aspect', '9:16',
        '--size', '2K',
        '--model', 'fast',
        '--out', absRaw,
      ],
      timeoutMs: 5 * 60 * 1000,
    });

    // Cutouts get the transparent die-cut (rembg birefnet matting, alpha only — the sticker
    // edge is a TSX drop-shadow in collage.tsx Cutout, not baked pixels). Photos keep the raw.
    if (kind === 'cutout') {
      await runPython({
        tool: 'gen_image',
        args: [
          path.join('tools', 'cutout.py'),
          absRaw, absLayer,
          '--method', 'rembg', '--model', 'birefnet-general', '--pad', '16',
        ],
        timeoutMs: 5 * 60 * 1000,
      });
    }

    await db.insert(assets).values({ userId, projectId, kind: 'image', storageKey: layerKey, url, source: 'ai' });

    // Fill the layer's src in place (consumed by VoxSpec's Cutout/ArchivalPhoto).
    const layer = spec.scenes[sceneIdx].vox!.layers[layerIdx] as { src?: string };
    layer.src = url;
    layerManifest.push({ id: spec.scenes[sceneIdx].vox!.layers[layerIdx].id, file: absLayer });
    minted.push({ sceneId: spec.scenes[sceneIdx].id, layerId: spec.scenes[sceneIdx].vox!.layers[layerIdx].id, src: url, storageKey: layerKey });
  }

  // 2) Asset-manifest with the minted layers (clips: [] — collage moves via cam, not clips).
  const manifest = {
    project: `generate/${projectId}`,
    track: spec.template,
    layers: layerManifest,
    clips: [],
    hero: null,
    cost: {
      credits: intendedSpend,
      usd: (intendedSpend / 100).toFixed(2),
      note: `vox collage: ${wanted.length} image layer(s) @ ${CREDIT_TABLE.voxLayer}cr (gen_image${wanted.some((w) => w.kind === 'cutout') ? ' + cutout' : ''})`,
    },
  };
  const manifestPath = path.join(workDir, 'asset-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'manifest', manifestPath],
  });

  await writer.flush('pixel', 1);
  return { manifestPath, clips: [], layers: minted };
}
