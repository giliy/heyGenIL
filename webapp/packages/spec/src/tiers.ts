// tiers.ts — the tier → capability unlock matrix + per-block credit basis, as PURE SHARED DATA.
// This is the SINGLE SOURCE OF TRUTH for "what can this tier do" so the billing page, the
// wizard, and every server-side gate read the SAME numbers — never hardcoded client-side.
// Consumed by: GET /api/billing/tiers (published), the web routes' gates, and the worker's
// tier re-checks. 1⚡ ≈ $0.01.
//
// Tiers map to the plan's budgets: free = $0 (TSX + kokoro/edge, 720p + watermark),
// creator = the paid entry (ElevenLabs, AI-image, 1080p clean, no watermark), pro = the full
// kit (AI-video clips, vox collage layers, priority). Pricing per block lives in CREDIT_TABLE.
import type { TrackMode } from './tracks';
import { CREDIT_TABLE } from './quote';

export type Tier = 'free' | 'creator' | 'pro';

/** Ordered for "at least" comparisons: free < creator < pro. */
const TIER_ORDER: Record<Tier, number> = { free: 0, creator: 1, pro: 2 };

export interface TierDef {
  id: Tier;
  name: string;
  /** Hebrew display name for the billing page card (RTL UI). */
  nameHe: string;
  /** Display price string for the billing page card (₪). */
  price: string;
  /** Numeric monthly price in ILS (₪) for the Stripe live-flip + honest cost display. */
  priceIls: number;
  /** Monthly render quota (null = unbounded). Free is hard-capped; paid is not. */
  rendersPerMonth: number | null;
  /** Whether renders carry a watermark. */
  watermark: boolean;
  /** Max render resolution. */
  maxResolution: '720p' | '1080p';
  /** The unlock matrix — every paid capability, one row each. */
  capabilities: {
    elevenlabsVoice: boolean;
    aiImage: boolean;
    aiVideoClip: boolean;
    voxCollageLayers: boolean;
    /** Generated SFX / music (vs free library reuse). */
    audioGen: boolean;
    /** Priority queue placement (pro). */
    priorityQueue: boolean;
    /** HeyGen-IL: talking-head lip-sync (mode 'avatar'). */
    talkAvatar: boolean;
    /** HeyGen-IL: the premium/photoreal lip-sync engine (talkSecPremium). */
    talkAvatarPremium: boolean;
  };
  /** The content tracks this tier may generate (TRACKS with minTier ≤ this tier). */
  trackModes: TrackMode[];
}

/** The per-block credit basis — how each billable block prices, published so the wizard's
 * budget slider and the billing page can show honest "costs N⚡" numbers without recomputing. */
export const CREDIT_BASIS = {
  tsxFlat: CREDIT_TABLE.tsxFlat,
  aiImage: CREDIT_TABLE.aiImage,
  elevenVoiceLine: CREDIT_TABLE.elevenVoiceLine,
  aiVideoSec: CREDIT_TABLE.aiVideoSec,
  voxLayer: CREDIT_TABLE.voxLayer,
  sfxGen: CREDIT_TABLE.sfxGen,
  musicGen: CREDIT_TABLE.musicGen,
  talkSec: CREDIT_TABLE.talkSec,
  talkSecPremium: CREDIT_TABLE.talkSecPremium,
} as const;

export const TIERS: TierDef[] = [
  {
    id: 'free',
    name: 'Free',
    nameHe: 'חינם',
    price: '₪0',
    priceIls: 0,
    rendersPerMonth: 10, // FREE_RENDERS_PER_MONTH default; the route reads the env override.
    watermark: true,
    maxResolution: '720p',
    capabilities: {
      elevenlabsVoice: false,
      aiImage: false,
      aiVideoClip: false,
      voxCollageLayers: false,
      audioGen: false,
      priorityQueue: false,
      talkAvatar: false, // HeyGen-IL: talking head is paid
      talkAvatarPremium: false,
    },
    trackModes: ['tsx'],
  },
  {
    id: 'creator',
    name: 'Creator',
    nameHe: 'יוצר',
    price: '₪39/חודש',
    priceIls: 39, // deliberately under the ₪49 line and far under HeyGen's ~₪105 — the Israel wedge
    rendersPerMonth: null,
    watermark: false,
    maxResolution: '1080p',
    capabilities: {
      elevenlabsVoice: true,
      aiImage: true,
      aiVideoClip: false, // AI-video is pro
      voxCollageLayers: false, // vox collage is pro
      audioGen: true, // generated SFX + music
      priorityQueue: false,
      talkAvatar: false, // HeyGen-IL: talking-head avatar is the PRO wedge (twins/photoreal Pro)
      talkAvatarPremium: false,
    },
    trackModes: ['tsx', 'ad', 'kids'],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameHe: 'פרו',
    price: '₪99/חודש',
    priceIls: 99,
    rendersPerMonth: null,
    watermark: false,
    maxResolution: '1080p',
    capabilities: {
      elevenlabsVoice: true,
      aiImage: true,
      aiVideoClip: true,
      voxCollageLayers: true,
      audioGen: true,
      priorityQueue: true,
      talkAvatar: true,
      talkAvatarPremium: true, // photoreal lip-sync engine (talkSecPremium)
    },
    trackModes: ['tsx', 'ad', 'kids', 'ai', 'vox', 'avatar'],
  },
];

export function getTier(id: Tier): TierDef {
  const t = TIERS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown tier: ${id}`);
  return t;
}

/** True when `tier` is at least `min` (free < creator < pro). */
export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[min];
}

/** True when `tier` unlocks `cap` (the capability flag on the tier def). */
export function tierAllows(tier: Tier, cap: keyof TierDef['capabilities']): boolean {
  return getTier(tier).capabilities[cap];
}

/** True when `tier` may generate the track `mode` (mode ∈ tier.trackModes). */
export function tierAllowsTrack(tier: Tier, mode: TrackMode): boolean {
  return getTier(tier).trackModes.includes(mode);
}
