// runGenerate.ts — the generate orchestrator: walks story → voice ∥ pixel → build → qa →
// mix → render in order, writing heartbeat via writer.ts, and on any throw marks the job
// failed + error. QA FAIL retries the build (bounded, max 2).
import path from 'path';
import { promises as fs } from 'fs';
import { getDb, projects, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateGeneratePayload, validateSpec, getTemplate, getDurationSec, type Spec } from '@shorts/spec';
import { makeStageWriter } from './writer';
import { runStoryStage } from './stages/story';
import { runVoiceStage } from './stages/voice';
import { runTalkStage } from './stages/talk';
import { runPixelStage } from './stages/pixel';
import { runBuildStage } from './stages/build';
import { runQaStage } from './stages/qa';
import { runMixStage } from './stages/mix';
import { runRenderStage } from './stages/render';
import type { StageReport } from './types';

const MAX_QA_RETRIES = 2;

/**
 * Run a generate job end-to-end. job.inputJson holds the wizard GeneratePayload.
 * projectId is the owning project (already inserted at submit, status 'generating').
 */
export async function runGenerate(
  db: Db,
  jobId: string,
  projectId: string,
  inputJson: unknown,
  quotedCredits: number
): Promise<void> {
  // 1) Validate the payload (zod) — never trust the claim loop.
  const payload = validateGeneratePayload(inputJson);
  if (!payload.ok) {
    const msg = payload.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    await fail(db, jobId, projectId, `invalid generate payload: ${msg}`);
    return;
  }

  const writer = makeStageWriter(db, jobId);
  const stages: StageReport[] = [];

  try {
    // 2) Story — locked script fidelity (deterministic from payload.script).
    const story = await runStoryStage(payload.data, projectId, writer);
    stages.push({ stage: 'story', ok: true, outputs: [story.beatsPath] });

    // 3) Build the base spec that the render consumes. Start from the template's
    //    defaultSpec (scenes/overlays/format), override with the payload's voice/captions/
    //    theme, and stamp the locked VO lines + real timings from the voice stage.
    const template = getTemplate(payload.data.template);
    if (!template) throw new Error(`unknown template: ${payload.data.template}`);
    // baseSpec is the composition's defaultProps-derived Spec. We CLONE it so template
    // defaultSpecs are never mutated across jobs (the pixel stage edits scenes in place).
    const baseSpec = JSON.parse(JSON.stringify(template.defaultSpec)) as Spec;

    // Phase 1 + 2: the mode and the locked character are known at submit time and the pixel
    // stage (AI-video) reads them — stamp them on the base spec BEFORE the pixel stage runs.
    const specMode = payload.data.mode ?? baseSpec.mode ?? 'tsx';
    if (payload.data.characterId) {
      (baseSpec as { characterId?: string }).characterId = payload.data.characterId;
    }

    // Phase 4 (AI-video): rebuild the scene list from the story beats — one fal clip per
    // spoken line/beat. Each scene's duration is the wizard's clipSeconds (per-scene clip
    // length) and its `visual` is the beat text (the fal prompt). The pixel stage reads
    // scene.durationSec + scene.visual to mint each clip, so this MUST run before it.
    if (specMode === 'ai' && story.beats.beats.length > 0) {
      const clipSec = Math.max(2, Math.min(10, payload.data.clipSeconds ?? 4));
      baseSpec.scenes = story.beats.beats.map((b, i) => ({
        id: `s${i + 1}`,
        durationSec: clipSec,
        beatId: b.name,
        visual: story.beats.vo[i]?.text ?? b.name,
        overlays: [],
      }));
      if (payload.data.aiModel) {
        (baseSpec as { aiModel?: string }).aiModel = payload.data.aiModel;
      }
    }

    // Phase 5 (vox): rebuild the scene list from the story beats as paper-collage layer
    // stacks. Each scene gets ONE hero cutout (the billed pixel — capped by the wizard's
    // voxLayers budget, spread across scenes) plus FREE label layers (TSX/SVG, no raster)
    // carrying the spoken line + a "context" kicker. The vox paper + cam keyframes ride on
    // baseSpec.vox (from the template default) and are shared across every scene board.
    if (specMode === 'vox' && story.beats.beats.length > 0) {
      const budget = Math.max(1, Math.min(12, payload.data.voxLayers ?? 6));
      const heroCount = Math.min(budget, story.beats.beats.length);
      baseSpec.scenes = story.beats.beats.map((b, i) => {
        const isHero = i < heroCount;
        // Typed as the Spec's own scene-vox layer array so the assign to baseSpec.scenes
        // typechecks against the discriminated vox layer union (cutout/photo/label/stamp).
        const layers: NonNullable<Spec['scenes'][number]['vox']>['layers'] = [];
        // Hero cutout (the die-cut subject) — src is minted by the pixel stage.
        if (isHero) {
          layers.push({
            id: `hero-${i + 1}`,
            type: 'cutout',
            x: 540,
            y: 640,
            w: 620,
            at: 0,
            dur: 12,
            enter: 'rise',
            depth: 1.5,
            drift: 1,
            z: 3,
            srcPrompt: story.beats.vo[i]?.text ?? b.name,
          });
        }
        // Free label chip: the spoken line as an editorial annotation over the cutout.
        layers.push({
          id: `label-${i + 1}`,
          type: 'label',
          text: story.beats.vo[i]?.text ?? b.name,
          x: 540,
          y: 1290,
          w: 840,
          at: 6,
          dur: 10,
          enter: 'slide-l',
          depth: 0.5,
          drift: 0.6,
          z: 2,
          accent: '#c0392b',
        });
        return {
          id: `s${i + 1}`,
          durationSec: Math.max(2, b.end_s - b.start_s),
          beatId: b.name,
          visual: b.name,
          overlays: [],
          vox: { layers },
        };
      });
    }

    // 4) Voice (uses beats.json -> voice.wav + real line/word times).
    const voice = await runVoiceStage(payload.data, baseSpec, story.beatsPath, story.workDir, writer);
    stages.push({ stage: 'voice', ok: true, detail: payload.data.voice.engine, outputs: [voice.voiceWav] });

    // 4.5) Talk — HeyGen-IL avatar track ONLY. Lip-sync the locked face to the Hebrew
    //     voice.wav into a single talking-head clip; mutates baseSpec.scenes[0].clip. The
    //     avatar config (face/model/premium) rides in payload.data.avatar → baseSpec.avatar.
    if (payload.data.avatar) {
      (baseSpec as { avatar?: unknown }).avatar = payload.data.avatar;
    }
    const talk = await runTalkStage(baseSpec, projectId, quotedCredits, voice.voiceWav, story.workDir, writer, db);
    if (talk) {
      stages.push({ stage: 'talk', ok: true, detail: `${talk.model} (${talk.durationSec}s${talk.premium ? ', premium' : ''})`, outputs: [talk.clipSrc] });
    }

    // 5) Pixel — free-tier TSX no-op, or (Phase 4) the AI-video fal clips. For engine 'ai'
    //    the pixel stage MUTATES baseSpec.scenes[].clip in place AND returns the produced
    //    clips; both carry into the assembled spec below.
    const pixel = await runPixelStage(baseSpec, projectId, quotedCredits, story.workDir, writer, db);
    stages.push({
      stage: 'pixel',
      ok: true,
      detail:
        specMode === 'ai'
          ? `ai-video (${pixel.clips.length} clips)`
          : specMode === 'vox'
            ? `vox collage (${pixel.layers.length} layer(s) minted)`
            : 'tsx (no fal)',
    });

    // 6) Assemble the final spec: template scenes/overlays + locked voice lines +
    //    captions + theme. The captions read spec.voice.lines (the exact spoken text).
    //    Phase 1: RTL + the mode/language track are DECLARED, not hardcoded. RTL derives
    //    from the payload language (he) or an already-RTL template; the mode/ad block ride
    //    onto the spec so the render + downstream consumers see the chosen track.
    const payloadLang = payload.data.language;
    const isRtl =
      payloadLang === 'he' ||
      baseSpec.rtl === true ||
      baseSpec.language === 'he' ||
      (baseSpec.captions?.style as { rtl?: boolean } | undefined)?.rtl === true;
    const spec = {
      ...baseSpec,
      id: `gen-${projectId}`,
      title: payload.data.title?.trim() || payload.data.topic.trim(),
      mode: specMode,
      language: payloadLang ?? baseSpec.language ?? (isRtl ? 'he' : 'en'),
      rtl: isRtl,
      ...(specMode === 'ad' && payload.data.ad ? { ad: payload.data.ad } : {}),
      // Phase 2: carry the locked recurring character so ai-image jobs condition on its ref.
      ...(payload.data.characterId ? { characterId: payload.data.characterId } : {}),
      theme: { ...baseSpec.theme, ...(payload.data.theme ?? {}) },
      voice: {
        engine: payload.data.voice.engine,
        voiceId: payload.data.voice.voiceId,
        lines: voice.lines,
      },
      captions: {
        preset: payload.data.captions.preset,
        burnIn: payload.data.captions.burnIn,
        style: { rtl: isRtl }, // declared, language-driven (replaces the hardcoded rtl:true)
      },
      meta: { ...baseSpec.meta, revision: baseSpec.meta.revision + 1, updatedAt: new Date().toISOString() },
    };
    // validateSpec guards the render path (contracts.py's TS port).
    const specCheck = validateSpec(spec);
    if (!specCheck.ok) {
      throw new Error(`assembled spec invalid: ${specCheck.error.issues.map((i) => i.message).join('; ')}`);
    }

    // 7) Build + QA (bounded retry).
    let build;
    let qa;
    let attempt = 0;
    while (true) {
      build = await runBuildStage(spec, projectId, story.workDir, writer);
      stages.push({ stage: 'build', ok: true, detail: `attempt ${attempt + 1}`, outputs: [build.silentMaster] });
      try {
        qa = await runQaStage(
          spec,
          projectId,
          story.workDir,
          build.silentMaster,
          build.frames,
          getDurationSec(spec),
          writer
        );
        stages.push({ stage: 'qa', ok: true, detail: 'PASS' });
        break;
      } catch (e) {
        stages.push({ stage: 'qa', ok: false, detail: (e as Error).message });
        if (attempt >= MAX_QA_RETRIES - 1) throw e;
        console.warn(`[generate] QA FAIL on attempt ${attempt + 1}; re-running build`);
        attempt++;
      }
    }

    // 8) Mix — voice mux + optional sfx/music, audio_gate after each.
    const mix = await runMixStage(
      spec,
      projectId,
      story.workDir,
      build!.silentMaster,
      voice.voiceWav,
      getDurationSec(spec),
      writer
    );
    stages.push({ stage: 'mix', ok: true, outputs: [mix.finalPath] });

    // 9) Render — final copy to storage + project ready + job done.
    const posterPath = await findPoster(build!.silentMaster);
    await runRenderStage(
      db,
      jobId,
      projectId,
      spec,
      mix.finalPath,
      posterPath,
      getDurationSec(spec),
      stages,
      writer
    );
    stages.push({ stage: 'render', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await fail(db, jobId, projectId, msg);
  }
}

/**
 * The build stage's renderSpec writes a frame-0 poster next to the silent master, named
 * `<CompId>-<spec.id>.poster.jpg` (render-spec.mjs's default). Globbing for it is fragile,
 * so we match the exact pattern: `${templateId}-${specId}.poster.jpg` alongside the master,
 * falling back to a few legacy names.
 */
async function findPoster(silentMaster: string): Promise<string | null> {
  const dir = path.dirname(silentMaster);
  // render-spec.mjs writes the poster as `<CompId>-<spec.id>.poster.jpg` alongside the
  // master. We don't know those names here, so scan the build dir for any *.poster.jpg,
  // then fall back to legacy names.
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const poster = entries.find((f) => f.endsWith('.poster.jpg'));
  if (poster) return path.join(dir, poster);
  for (const c of ['silent.poster.jpg', 'poster.jpg']) {
    try {
      await fs.access(path.join(dir, c));
      return path.join(dir, c);
    } catch {
      /* next candidate */
    }
  }
  return null;
}

async function fail(db: Db, jobId: string, projectId: string, error: string): Promise<void> {
  await db.update(jobs).set({ status: 'failed', error, finishedAt: new Date() }).where(eq(jobs.id, jobId));
  await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, projectId));
}
