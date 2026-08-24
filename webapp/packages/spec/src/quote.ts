// quote.ts — the canonical upfront credit quote for a spec. Pure, deterministic, no I/O.
// Single source of truth for pricing (imported by web POST /api/quotes AND by the worker
// pre-render re-check so they can never drift). 1 credit ≈ $0.01.
//
// Flat table (mirrors _shared-decisions.md §Billing + WEBAPP-PLAN.md §6):
//   TSX render flat        2–4   (tier-independent; resolution is a post-process, NOT a credit item)
//   AI image each          3–5
//   ElevenLabs voice line  1–2
//   AI video second        6–8   (P1 — always 0 in Phase 4; AI-video scenes are not built yet)
//
// The quote is a FLAT, transparent number (never "735 credits for one 30s video") — we quote the
// CHEAPEST end of each range so the upfront cost is the floor and surprises are impossible.
import type { Spec } from './types';

/** Per-item flat credit cost. */
export const CREDIT_TABLE = {
  tsxFlat: 2, // 2–4 → floor 2
  aiImage: 3, // 3–5 → floor 3 (per AI-source image overlay)
  elevenVoiceLine: 1, // 1–2 → floor 1 (per ElevenLabs voice line)
  aiVideoSec: 6, // 6–8/s → floor 6 (Phase 4: per AI-video scene clip second)
  voxLayer: 3, // Phase 5: per generated collage layer (AI image + cutout matte)
  // Phase 6: generated audio. Library SFX cues / music beds are FREE (reuse-first); only a
  // cue/bed marked generate:true costs — it runs gen_sfx.py / gen_music.py. Priced so the
  // ~$1 tier (a vox collage + a generated bed) lands inside its band.
  sfxGen: 2, // per generated SFX cue (eleven sfx / synthesis)
  musicGen: 4, // per generated music bed (gen_music.py)
  // HeyGen-IL (avatar track): lip-sync talking-head seconds. Standard engine (a photo-avatar
  // backend like MuseTalk/LivePortrait) is the cheap floor; premium (a photoreal engine like
  // OmniHuman/Kling-lip-sync) is ~6× — the same standard/premium burn-gap HeyGen monetizes on.
  talkSec: 4, // per lip-synced talking-head second (standard engine)
  talkSecPremium: 24, // per lip-synced talking-head second (premium/photoreal engine) — 6×
} as const;

export interface QuoteBreakdown {
  /** Flat TSX-render charge (always present; the free engine still costs compute). */
  tsxFlat: number;
  /** AI-image overlays (assets with source 'ai' referenced by image overlays). */
  aiImages: { count: number; credits: number };
  /** ElevenLabs voice lines (spec.voice.engine === 'elevenlabs'). */
  aiVoiceLines: { count: number; credits: number };
  /** AI-video seconds (Phase 4: scenes carrying a video clip reference). */
  aiVideoSec: { seconds: number; credits: number };
  /** Vox collage layers (Phase 5: generated die-cut/photo layers across all scenes). */
  voxLayers: { count: number; credits: number };
  /** Generated audio (Phase 6: SFX cues + music beds marked generate:true). */
  audioGen: { sfx: number; music: number; credits: number };
  /** Talking-head seconds (HeyGen-IL avatar track: lip-sync length × engine rate). */
  talk: { seconds: number; premium: boolean; credits: number };
}

export interface Quote {
  /** Total upfront credits (integer). */
  credits: number;
  breakdown: QuoteBreakdown;
}

/**
 * Count the AI-source image overlays in a spec. An image overlay is "AI" when its
 * assetId resolves to an assets row with source='ai' — but the quote is a PURE function
 * of the spec alone, so we detect AI images structurally: an image overlay whose assetId
 * or src references a generated image (media/projects/<proj>/ai-*.png, the gen_image.py
 * output shape) is billed. Convention: AI-generated overlays carry a src containing
 * `/projects/<proj>/ai-` OR an assetId the caller marked as AI. For the quote we count
 * image overlays that are NOT plain uploads — i.e. we trust the `ai` marker encoded in
 * the src path (gen_image writes ai-<cuid>.png under media/projects/<proj>/).
 */
function countAiImages(spec: Spec): number {
  let n = 0;
  for (const scene of spec.scenes) {
    for (const ov of scene.overlays) {
      if (ov.type !== 'image') continue;
      const src = ov.src ?? '';
      // AI-generated PNGs are written by gen_image.py as ai-<cuid>.png under
      // media/projects/<proj>/ → their served URL contains "/ai-". Uploads never do.
      if (/\/ai-[^/]+\.png$/.test(src) || /ai-[^/]+\.png$/.test(src)) n++;
    }
  }
  return n;
}

/** Count ElevenLabs voice lines (engine === 'elevenlabs'). */
function countElevenLines(spec: Spec): number {
  if (!spec.voice || spec.voice.engine !== 'elevenlabs') return 0;
  return spec.voice.lines.length;
}

/**
 * AI-video seconds — Phase 4. Counts every scene that carries a video clip reference
 * (scene.clip). The billable length is the scene's durationSec (the clip is produced to
 * fill it); when the scene clip explicitly records a real durationSec (from ffprobe) we
 * prefer that, but the quote runs at submit time before generation, so scene.durationSec
 * is the honest, deterministic floor. Scenes without a clip contribute 0.
 */
function aiVideoSeconds(spec: Spec): number {
  let sec = 0;
  for (const scene of spec.scenes) {
    if (!scene.clip) continue;
    const len = scene.clip.durationSec ?? scene.durationSec;
    if (Number.isFinite(len) && len > 0) sec += len;
  }
  return sec;
}

/**
 * Quote a spec for a render. `tier` does NOT change the number of credits (pricing is
 * flat and resolution-independent) — it is accepted for future per-tier discounts and to
 * keep the signature stable, but the result is the same for free and paid.
 */
/**
 * Phase 5 — count the vox collage layers across all scenes. The billable unit is a
 * GENERATED layer (one AI image + a cutout matte per layer). A vox spec declares its
 * layers in scene.vox.layers; each carries a src the collage-layers job mints. We bill
 * image-bearing layers (cutout/photo — these cost a gen_image call); pure text layers
 * (label/stamp) are free (they're SVG/TSX, no raster). The paper texture counts once when
 * it carries a src to mint.
 */
function countVoxLayers(spec: Spec): number {
  let n = 0;
  if (spec.vox?.paper?.src) n++; // the board paper texture
  for (const scene of spec.scenes) {
    for (const layer of scene.vox?.layers ?? []) {
      if (layer.type === 'cutout' || layer.type === 'photo') n++;
    }
  }
  return n;
}

/**
 * Phase 6 — count generated audio. Library SFX cues and music beds are FREE (reuse-first);
 * only a cue/bed with generate:true runs gen_sfx.py / gen_music.py and is billed. Returns the
 * generated-SFX count and whether the music bed is generated (0|1).
 */
function countAudioGen(spec: Spec): { sfx: number; music: number } {
  let sfx = 0;
  for (const cue of spec.audio?.sfx ?? []) {
    if (cue.generate) sfx++;
  }
  const music = spec.audio?.music?.generate ? 1 : 0;
  return { sfx, music };
}

/**
 * Talking-head seconds (HeyGen-IL avatar track). A spec in mode 'avatar' lip-syncs the whole
 * voice track against a locked face; the billable length is the sum of scene durations (the
 * voice track length). Premium engine burns talkSecPremium (~6× the standard floor).
 */
function talkSeconds(spec: Spec): { seconds: number; premium: boolean } {
  if (spec.mode !== 'avatar') return { seconds: 0, premium: false };
  const premium = spec.avatar?.premium === true;
  let sec = 0;
  for (const scene of spec.scenes) {
    if (Number.isFinite(scene.durationSec) && scene.durationSec > 0) sec += scene.durationSec;
  }
  return { seconds: sec, premium };
}

export function quoteSpec(spec: Spec, _tier: 'free' | 'creator' | 'pro' = 'free'): Quote {
  const tsxFlat = CREDIT_TABLE.tsxFlat;

  const aiImgCount = countAiImages(spec);
  const aiImages = { count: aiImgCount, credits: aiImgCount * CREDIT_TABLE.aiImage };

  const elevenCount = countElevenLines(spec);
  const aiVoiceLines = { count: elevenCount, credits: elevenCount * CREDIT_TABLE.elevenVoiceLine };

  const vidSec = aiVideoSeconds(spec);
  const aiVideoSec = { seconds: vidSec, credits: vidSec * CREDIT_TABLE.aiVideoSec };

  const voxLayerCount = countVoxLayers(spec);
  const voxLayers = { count: voxLayerCount, credits: voxLayerCount * CREDIT_TABLE.voxLayer };

  const { sfx: sfxCount, music: musicCount } = countAudioGen(spec);
  const audioGen = {
    sfx: sfxCount,
    music: musicCount,
    credits: sfxCount * CREDIT_TABLE.sfxGen + musicCount * CREDIT_TABLE.musicGen,
  };

  const { seconds: talkSec, premium: talkPremium } = talkSeconds(spec);
  const talk = {
    seconds: talkSec,
    premium: talkPremium,
    credits: Math.ceil(talkSec) * (talkPremium ? CREDIT_TABLE.talkSecPremium : CREDIT_TABLE.talkSec),
  };

  const credits =
    tsxFlat +
    aiImages.credits +
    aiVoiceLines.credits +
    aiVideoSec.credits +
    voxLayers.credits +
    audioGen.credits +
    talk.credits;

  return { credits, breakdown: { tsxFlat, aiImages, aiVoiceLines, aiVideoSec, voxLayers, audioGen, talk } };
}
