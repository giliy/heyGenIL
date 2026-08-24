// talk.ts — HeyGen-IL talking-head stage. Runs AFTER voice (needs the Hebrew voice.wav +
// locked lines) and BEFORE pixel, ONLY for the avatar track (spec.engine === 'avatar').
//
// What it does: takes the LOCKED face (photo avatar = character refImageKey, or digital
// twin = a 2-min driver video) + the stage-produced voice.wav, calls tools/gen_talk.py
// (model-agnostic fal lip-sync) to mint ONE talking-head clip that lipsyncs the whole
// script, uploads the result to project storage, writes a talk_clip asset row, and sets
// scene.clip on the (single) scene so the AvatarSpec render consumes it.
//
// Cost model: the talk spend is the SUM of scene durations (seconds of talking head) ×
// CREDIT_TABLE.talkSec (standard engine) or × talkSecPremium (premium photoreal engine) —
// the HeyGen-style ~6× premium burn gap. The spend is gated against the quote reserved at
// submit (mirrors runAiPixelStage) so the worker never mints beyond what was quoted.
import path from 'path';
import { promises as fs } from 'fs';
import { createId } from '@paralleldrive/cuid2';
import type { Spec } from '@shorts/spec';
import { CREDIT_TABLE, resolveTalkModel } from '@shorts/spec';
import { getDb, projects, characters, assets, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { runPython, repoRoot } from '../py';
import { resolveKey } from '../../storage.js';
import type { StageWriter } from '../writer';

export interface TalkOutcome {
  clipSrc: string;
  storageKey: string;
  durationSec: number;
  premium: boolean;
  model: string;
}

/**
 * Run the talking-head stage. NO-OP for every engine except 'avatar'. Mutates
 * spec.scenes[0].clip in place (the single talking-head scene) and returns the produced
 * clip. @param quotedCredits the cost quoted at submit (reserved); free tier = 0.
 */
export async function runTalkStage(
  spec: Spec,
  projectId: string,
  quotedCredits: number,
  voiceWav: string,
  workDir: string,
  writer: StageWriter,
  db?: Db
): Promise<TalkOutcome | null> {
  if (spec.engine !== 'avatar') return null; // non-avatar tracks skip the talk stage
  await writer.begin('talk');

  const dbc = db ?? getDb();
  const talk = (spec as { avatar?: { faceAssetId?: string; faceSrc?: string; talkModel?: string; premium?: boolean; driverVideo?: boolean } }).avatar;

  // 1) Resolve the LOCKED face. Priority: an explicit faceSrc (photo avatar / driver video
  //    chosen in the wizard), else the project character's locked refImageKey. The talk stage
  //    must never run without a face — the AvatarSpec needs a talking head.
  let faceRef: string | null = null;
  let driverVideo = talk?.driverVideo === true;
  let explicitModel = talk?.talkModel;
  if (talk?.faceSrc) {
    faceRef = resolveKey(talk.faceSrc.replace(/^\/media\//, ''));
  } else if (talk?.faceAssetId) {
    // The wizard's avatarId is EITHER an assets row (a direct face upload) OR a characters row
    // (one of the caller's photo/twin avatars). Try asset first, then fall back to a character
    // so a picked photo/twin resolves its locked refImageKey + derives twin-ness/premium.
    const asset = await dbc.query.assets.findFirst({ where: eq(assets.id, talk.faceAssetId) });
    if (asset?.storageKey) {
      faceRef = resolveKey(asset.storageKey);
    } else {
      const character = await dbc.query.characters.findFirst({ where: eq(characters.id, talk.faceAssetId) });
      if (character?.refImageKey) faceRef = resolveKey(character.refImageKey);
      const kind = (character as { kind?: string } | undefined)?.kind;
      if (kind === 'twin') driverVideo = true;
      const storedModel = (character as { talkModel?: string } | undefined)?.talkModel;
      if (!explicitModel && storedModel) explicitModel = storedModel;
    }
  } else {
    const characterId = (spec as { characterId?: string }).characterId;
    if (characterId) {
      const character = await dbc.query.characters.findFirst({ where: eq(characters.id, characterId) });
      if (character?.refImageKey) faceRef = resolveKey(character.refImageKey);
      // A characterId-backed avatar: derive twin-ness + preferred engine from the character row
      // (kind 'twin' → driver video + premium engine; a stored talkModel overrides the default).
      const kind = (character as { kind?: string } | undefined)?.kind;
      if (kind === 'twin') driverVideo = true;
      const storedModel = (character as { talkModel?: string } | undefined)?.talkModel;
      if (!explicitModel && storedModel) explicitModel = storedModel;
    }
  }
  if (!faceRef || !(await exists(faceRef))) {
    throw new Error(`talk stage: no locked face for avatar project ${projectId} — pick a photo or twin avatar first`);
  }

  // A twin (driver video) always rides the premium engine → premium rate, even if the caller
  // didn't pass premium:true (they picked the avatar by id; its kind decides the tier).
  const premium = talk?.premium === true || driverVideo;
  const rate = premium ? CREDIT_TABLE.talkSecPremium : CREDIT_TABLE.talkSec;

  // 2) Cost gate: the intended spend (Σ scene seconds × talk rate) must not exceed the quote.
  const totalSec = spec.scenes.reduce((s, sc) => s + (sc.durationSec || 2), 0);
  const intendedSpend = Math.ceil(totalSec) * rate;
  if (quotedCredits < intendedSpend) {
    throw new Error(
      `cost gate: talk spend ${intendedSpend}cr (${Math.ceil(totalSec)}s × ${rate}cr/s${premium ? ', premium' : ''}) exceeds quoted ${quotedCredits}cr — re-quote before rendering`
    );
  }

  // 3) Resolve the backend model + driver-video flag. A twin (driver video) rides a video-input
  //    model even if the caller didn't pass an explicit talkModel.
  const modelDef = resolveTalkModel(explicitModel ?? (driverVideo ? 'kling-lipsync' : undefined), premium || driverVideo);
  const model = modelDef.falId; // the raw fal id passed to gen_talk.py
  const isDriver = driverVideo;

  // 4) Mint the talking-head clip. The whole script is one continuous clip (the avatar
  //    speaks the locked VO); scene durations just scope the render window.
  const durationSec = Math.max(1, Math.round(totalSec));
  const cuid = createId();
  const storageKey = `${projectId}/talk-${cuid}.mp4`;
  const absOut = resolveKey(storageKey);
  const url = `/media/${storageKey}`;
  const talkDir = path.join(workDir, 'talk');

  await writer.set('talk', 0.5);
  const args = [
    path.join('tools', 'gen_talk.py'),
    '--model', model,
    '--face', faceRef,
    '--audio', voiceWav,
    '--out', absOut,
    ...(isDriver ? ['--driver'] : []),
  ];
  // The twin driver video / face image may be oversized for the audio; cap the spend.
  await runPython({ tool: 'stdlib', args, timeoutMs: 15 * 60 * 1000 });
  void talkDir; // (kept for a future per-line resegment; single clip for now)

  // 5) Write the talk_clip asset (source 'ai').
  const userId = (await dbc.query.projects.findFirst({ where: eq(projects.id, projectId) }))!.userId;
  await dbc.insert(assets).values({
    userId,
    projectId,
    kind: 'talk_clip',
    storageKey,
    url,
    durationSec,
    source: 'ai',
  });

  // 6) Point the (single) scene's clip at the talking-head video — AvatarSpec renders it.
  const scene = spec.scenes[0];
  if (scene) {
    (scene as { clip?: unknown }).clip = { src: url, durationSec };
  }

  await writer.flush('talk', 1);
  return { clipSrc: url, storageKey, durationSec, premium, model };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
