// TRACKS — the content-track catalog (Phase 1 of the track-alignment plan).
// This is the SINGLE SOURCE OF TRUTH the wizard track picker and tier gating read from.
// One row per engine track: what it's called, its mode flag, language/RTL defaults, whether
// it exposes a CTA end card, the minimum tier that can use it, and a coarse credit band.
//
// The worker renders a track via its LAUNCH_TEMPLATES compositionId; a track is "ready"
// only when it has at least one registered template (compositionId present).
import { specModeSchema, specLanguageSchema } from './schema';
import type { z } from 'zod';

export type TrackMode = z.infer<typeof specModeSchema>;
export type TrackLanguage = z.infer<typeof specLanguageSchema>;

export interface TrackDef {
  /** Stable id == the spec/payload mode. */
  id: TrackMode;
  /** Display name for the track picker. */
  name: string;
  /** One-line description shown on the picker card. */
  blurb: string;
  /** Default spoken language (drives RTL + the voice list). */
  language: TrackLanguage;
  /** RTL caption/layout default for the language. */
  rtl: boolean;
  /** Whether this track ends on a conversion CTA end card. */
  exposesCta: boolean;
  /** Minimum billing tier that can generate this track ('free'|'creator'|'pro'). */
  minTier: 'free' | 'creator' | 'pro';
  /** Coarse upfront credit band for the picker (1⚡ ≈ $0.01). */
  creditBand: { min: number; max: number };
  /** The compositionIds this track can render (registered spec-driven comps). */
  compositionIds: string[];
}

/**
 * The five tracks. Order is the picker order. Only tracks with a registered compositionId
 * are renderable today. ai/vox now ship spec-driven compositions (AiSpec, VoxSpec) so the
 * picker marks them ready; the worker paths (fal clips, collage layers) back them.
 */
export const TRACKS: TrackDef[] = [
  {
    id: 'tsx',
    name: 'Story short',
    blurb: 'A fast animated explainer on any topic.',
    language: 'en',
    rtl: false,
    exposesCta: false,
    minTier: 'free',
    creditBand: { min: 0, max: 0 },
    compositionIds: ['Short16Formy', 'Short1Chess'],
  },
  {
    id: 'ad',
    name: 'Ad / commercial',
    blurb: 'A Hebrew SMB ad with a price badge and a CTA end card.',
    language: 'he',
    rtl: true,
    exposesCta: true,
    minTier: 'creator',
    creditBand: { min: 26, max: 30 },
    compositionIds: ['Ad1Liat', 'Ad2Noa'],
  },
  {
    id: 'kids',
    name: 'Kids story',
    blurb: 'A gentle Hebrew bedtime story with nikkud captions.',
    language: 'he',
    rtl: true,
    exposesCta: false,
    minTier: 'creator',
    creditBand: { min: 26, max: 30 },
    compositionIds: [], // Short7Kids is legacy (no defaultProps); converted in Phase 1.
  },
  {
    id: 'ai',
    name: 'AI video',
    blurb: 'A generative short with a locked recurring character.',
    language: 'en',
    rtl: false,
    exposesCta: false,
    minTier: 'pro',
    creditBand: { min: 235, max: 250 },
    compositionIds: ['AiSpec'], // worker fal path + spec-driven comp land in Phase 4.
  },
  {
    id: 'vox',
    name: 'Vox explainer',
    blurb: 'A paper-collage documentary-style explainer.',
    language: 'en',
    rtl: false,
    exposesCta: false,
    minTier: 'pro',
    creditBand: { min: 85, max: 100 },
    compositionIds: ['VoxSpec'], // spec-driven collage comp (Phase 5).
  },
  {
    id: 'avatar',
    name: 'Talking avatar',
    blurb: 'A Hebrew talking-head video from your own photo or a 2-min digital twin.',
    language: 'he',
    rtl: true,
    exposesCta: false,
    minTier: 'pro', // the HeyGen-IL PRO wedge (lip-sync costs talkSec credits; twins/photoreal Pro)
    creditBand: { min: 40, max: 400 }, // ~10-30s × talkSec 4–24cr/s
    compositionIds: ['AvatarSpec'], // spec-driven talking-head comp (Phase P0/P1).
  },
];

export function getTrack(id: TrackMode): TrackDef | undefined {
  return TRACKS.find((t) => t.id === id);
}

/** True when the track has at least one registered, renderable composition. */
export function trackReady(id: TrackMode): boolean {
  return (getTrack(id)?.compositionIds.length ?? 0) > 0;
}
