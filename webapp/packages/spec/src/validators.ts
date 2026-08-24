// Validators + pure duration helpers. `parseSpec`/`validateSpec` throw ZodError on
// malformed input; `getDurationSec` sums scene durations (the value calculateMetadata
// uses — scenes are back-to-back, no inter-scene gaps).
import { z } from 'zod';
import {
  specSchema,
  specWithOverlayBoundsSchema,
  generatePayloadSchema,
  generateScriptRequestSchema,
} from './schema';
import type { Spec, GeneratePayload, GenerateScriptRequest } from './types';

export type { Spec };

/**
 * Parse + validate a Generate wizard payload. Throws ZodError on any violation.
 */
export function parseGeneratePayload(input: unknown): GeneratePayload {
  return generatePayloadSchema.parse(input);
}

/**
 * Safe parse of a Generate payload — { ok, data } | { ok, error }.
 */
export function validateGeneratePayload(
  input: unknown
): { ok: true; data: GeneratePayload } | { ok: false; error: z.ZodError } {
  const r = generatePayloadSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

/**
 * Parse + validate the script-preview request (POST /api/generate/script).
 */
export function parseGenerateScriptRequest(input: unknown): GenerateScriptRequest {
  return generateScriptRequestSchema.parse(input);
}

/**
 * Parse + validate an unknown value as a Spec. Throws ZodError on any violation.
 * Includes the scene-relative overlay-bound check (start/end within scene duration).
 */
export function parseSpec(input: unknown): Spec {
  return specWithOverlayBoundsSchema.parse(input);
}

/**
 * Safe parse — returns { ok: true, data } or { ok: false, error } without throwing.
 */
export function validateSpec(
  input: unknown
): { ok: true; data: Spec } | { ok: false; error: z.ZodError } {
  const r = specWithOverlayBoundsSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

/**
 * Total duration in seconds = sum(scenes[].durationSec).
 */
export function getDurationSec(spec: Pick<Spec, 'scenes'>): number {
  return spec.scenes.reduce<number>((acc, s) => acc + s.durationSec, 0);
}

/**
 * Total duration in frames = round(getDurationSec * fps). Used by calculateMetadata.
 */
export function specDurationFrames(spec: Pick<Spec, 'scenes' | 'format'>): number {
  return Math.round(getDurationSec(spec) * spec.format.fps);
}

/**
 * Composition dimensions from the spec format block.
 */
export function specDimensions(spec: Pick<Spec, 'format'>): { width: number; height: number } {
  return { width: spec.format.width, height: spec.format.height };
}

// ---------------------------------------------------------------------------
// Ad-toolkit validation (Phase 3) — a spec-level mirror of the engine's
// validate_ad_beats CTA-hold rule, so the wizard + editor can surface the same
// contract inline without running Python. Returns a list of { key, message } issues;
// empty array = the ad block is complete.
// ---------------------------------------------------------------------------
export interface AdSpecIssue {
  key:
    | 'business'
    | 'cta'
    | 'hold'
    | 'price'
    | 'contact'
    | 'logo';
  message: string;
}

const MIN_CTA_HOLD_SEC = 2.0;

export function validateAdSpec(spec: Pick<Spec, 'ad' | 'scenes' | 'mode'>): AdSpecIssue[] {
  const issues: AdSpecIssue[] = [];
  const ad = spec.ad;
  if (spec.mode !== 'ad') return issues;
  if (!ad) {
    issues.push({ key: 'business', message: 'Missing the ad block (business name).' });
    return issues;
  }

  if (!ad.business?.trim()) {
    issues.push({ key: 'business', message: 'Add the business name — it drives the end card.' });
  }

  const cta = ad.ctaText?.trim();
  if (!cta) {
    issues.push({ key: 'cta', message: 'Add a call-to-action text (the payoff line on the end card).' });
  }

  const hold = ad.endCardHoldSec;
  if (hold == null) {
    issues.push({ key: 'hold', message: 'Set an end-card hold — the CTA card must hold so it can be tapped.' });
  } else if (hold < MIN_CTA_HOLD_SEC) {
    issues.push({
      key: 'hold',
      message: `End card holds only ${hold}s — needs >= ${MIN_CTA_HOLD_SEC}s to be tappable (validate_ad_beats).`,
    });
  }

  if (ad.price != null && ad.oldPrice != null && ad.oldPrice <= ad.price) {
    issues.push({ key: 'price', message: 'oldPrice must be greater than price for the badge to make sense.' });
  }

  // A phone/website/logo is strongly recommended so the viewer can act on the CTA.
  if (!ad.phone && !ad.website && !ad.logoAssetId) {
    issues.push({ key: 'contact', message: 'Add a phone/website or a logo so viewers can act on the CTA.' });
  }

  return issues;
}

export { specSchema };
