// AI-video model registry (Phase 4). The character's `video_model` is stored as a SHORT
// id (seedance/veo/kling — the wizard + characters page picker). The fal queue needs a full
// model id, so this maps the short id to its fal endpoint. Consumers (the /api/[id]/ai-clip
// route, the worker pixel stage, the ai-clip job) resolve through it — never pass shorthand
// straight to gen_clip.py.
export const AI_VIDEO_MODELS: Record<string, string> = {
  // Seedance v1.5 pro image-to-video — the default character model.
  seedance: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  // Veo 3.1 — image-to-video.
  veo: 'fal-ai/veo3.1/fast',
  // Kling 2.5 turbo — image-to-video.
  kling: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
};

export const AI_VIDEO_MODEL_DEFAULT = AI_VIDEO_MODELS.seedance;

/**
 * Resolve a stored/short model id (seedance|veo|kling) OR a full fal model id to the fal
 * endpoint gen_clip.py can queue against. Unknown short ids fall back to the seedance
 * default; a value that already looks like a fal id (contains 'fal-ai/') passes through.
 */
export function resolveVideoModel(model?: string | null): string {
  if (!model) return AI_VIDEO_MODEL_DEFAULT;
  if (model.includes('fal-ai/')) return model; // already a full fal endpoint
  return AI_VIDEO_MODELS[model] ?? AI_VIDEO_MODEL_DEFAULT;
}

// ---------------------------------------------------------------------------
// HeyGen-IL (avatar track) — lip-sync / talking-head model registry. The character's
// `talk_model` is stored as a SHORT id; the fal queue needs a full endpoint. gen_talk.py
// consumes the resolved id via --model. Two tiers: standard (cheap, photo-avatar) and
// premium (photoreal, ~6× the credits). See research/heygen-hebrew-platform-plan.md.
// ---------------------------------------------------------------------------
export interface TalkModelDef {
  /** The fal endpoint id (image+audio or video+audio → talking-head). */
  falId: string;
  /** 'image' = photo-avatar (still face); 'video' = digital-twin (2-min driver video). */
  input: 'image' | 'video';
  /** Billing tier: 'standard' (talkSec) or 'premium' (talkSecPremium). */
  tier: 'standard' | 'premium';
  /** Rough fal cost per second of output (USD) — for the derived-cost gate. */
  costPerSecUsd: number;
  /** True when the model is NOT driven by voice audio (e.g. driving-video reenactment). The
   *  talk stage is audio-driven; such models must only be reachable by explicit override. */
  notAudioDriven?: boolean;
}

// Verified against fal.ai model pages 2026-08-24. The defaults are VEED Fabric for the still-
// image photo-avatar (true image+audio → talking-head, $0.10/s) and OmniHuman for the premium
// tier (image+audio, $0.14/s). Kling lipsync is the cheap video+audio re-dub (digital twin's
// driver video) at $0.014/s — an order of magnitude below the old placeholder.
export const TALK_MODELS: Record<string, TalkModelDef> = {
  // Standard (cheap) tier — photo-avatar from a STILL face. VEED Fabric is the real image+audio
  // talking-head model. Cost basis is 720p ($0.20/s; 480p is $0.10/s but upscales 2.25× to the
  // 1080×1920 comp = soft). gen_talk.py now defaults resolution to 720p.
  'fabric-1.0': { falId: 'fal-ai/veed/fabric-1.0', input: 'image', tier: 'standard', costPerSecUsd: 0.20 },
  'fabric-1.0-fast': { falId: 'fal-ai/veed/fabric-1.0/fast', input: 'image', tier: 'standard', costPerSecUsd: 0.20 },
  // ⚠ NOT an audio lip-sync model: LivePortrait is facial REENACTMENT — it animates a still
  // image off a DRIVING VIDEO, it never consumes the voice audio. Kept only as an explicit
  // --model override for the reenactment lane; it must NEVER be a talk-stage default, and
  // resolveTalkModel must not return it for an audio-driven request (see resolveTalkModel).
  'live-portrait': { falId: 'fal-ai/live-portrait', input: 'image', tier: 'standard', costPerSecUsd: 0.02, notAudioDriven: true },
  // MuseTalk is video+audio lip-sync over PRE-EXISTING footage ($0/compute-sec serverless — the
  // cheapest re-dub). Requires a source video with a visible face.
  musetalk: { falId: 'fal-ai/musetalk', input: 'video', tier: 'standard', costPerSecUsd: 0.0 },
  // Kling lipsync audio-to-video — video+audio, $0.014/s billed in 5s increments. Cheap twin re-dub.
  'kling-lipsync': { falId: 'fal-ai/kling-video/lipsync/audio-to-video', input: 'video', tier: 'premium', costPerSecUsd: 0.014 },
  // Premium (photoreal) tier — OmniHuman image+audio, $0.14/s billed on actual duration. Pro upsell.
  omnihuman: { falId: 'fal-ai/bytedance/omnihuman', input: 'image', tier: 'premium', costPerSecUsd: 0.14 },
};

export const TALK_MODEL_DEFAULT = 'fabric-1.0';
export const TALK_MODEL_PREMIUM_DEFAULT = 'omnihuman';

/**
 * Resolve a stored/short talk-model id OR a full fal id to its def. Unknown ids fall back
 * to the standard default. `premium` selects the premium default when no explicit model set.
 */
export function resolveTalkModel(model?: string | null, premium?: boolean): TalkModelDef {
  const fallback = premium ? TALK_MODEL_PREMIUM_DEFAULT : TALK_MODEL_DEFAULT;
  if (!model) return TALK_MODELS[fallback];
  if (model.includes('fal-ai/')) {
    // A raw fal id — wrap it; infer tier from the premium flag (best-effort).
    return { falId: model, input: 'image', tier: premium ? 'premium' : 'standard', costPerSecUsd: premium ? 0.14 : 0.10 };
  }
  const def = TALK_MODELS[model];
  // The talk stage is AUDIO-driven. Never resolve a non-audio-driven model (e.g. live-portrait
  // driving-video reenactment) for it — fall back to the tier default instead of silently
  // producing a video whose mouth ignores the Hebrew audio.
  if (!def) return TALK_MODELS[fallback];
  if (def.notAudioDriven) {
    console.warn(`[ai-models] ${model} is not audio-driven (driving-video reenactment) — refusing for talk; using ${fallback}`);
    return TALK_MODELS[fallback];
  }
  return def;
}
