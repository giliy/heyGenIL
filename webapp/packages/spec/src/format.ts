// format.ts — aspect-resize helpers. Pure, unit-tested, shared by web (resize preview)
// and worker (the resize render path). Phase 5.
//
// `computeFormat` maps a target aspect to the new {width,height,fps}. `transformSpecForAspect`
// applies OPTION A (letterbox-safe): every overlay is scaled by newH/oldH and horizontally
// re-centered; nothing crops. Overlay start/end are SCENE-RELATIVE seconds and are untouched —
// only the composition px placement (x/y/w/h) transforms. Mirrors _shared-decisions.md §Spec.
import type { Spec, SpecFormat, Overlay } from './types';
import { round3 } from './helpers';

/** Supported resize aspects (the toggle set in the Render dialog). */
export type Aspect = '9:16' | '1:1' | '16:9';

/** Aspect -> pixel dimensions (fps is preserved from the source spec). */
export const ASPECT_DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

/**
 * Derive the new SpecFormat for a target aspect. fps is carried over from the source spec
 * (fps never changes on resize). `aspect` defaults to reading the source spec's ratio.
 */
export function computeFormat(spec: Pick<Spec, 'format'>, aspect: Aspect): SpecFormat {
  const dims = ASPECT_DIMENSIONS[aspect];
  return { width: dims.width, height: dims.height, fps: spec.format.fps };
}

/**
 * The aspect string a spec's format currently represents. Used to mark projects.aspectRatio
 * and to skip a no-op resize. Falls back to 'custom' for non-standard ratios.
 */
export function aspectOfFormat(format: Pick<SpecFormat, 'width' | 'height'>): Aspect | 'custom' {
  const ratio = format.width / format.height;
  // Compare against the three canonical ratios with a small epsilon.
  const targets: Record<Aspect, number> = {
    '9:16': 9 / 16,
    '1:1': 1,
    '16:9': 16 / 9,
  };
  for (const a of Object.keys(targets) as Aspect[]) {
    if (Math.abs(ratio - targets[a]) < 0.01) return a;
  }
  return 'custom';
}

/**
 * OPTION A (letterbox-safe) coordinate transform for ONE overlay.
 * scale = newH/oldH; x' = x*scale + (newW - oldW*scale)/2; y' = y*scale; w' = w*scale; h' = h*scale.
 * Deterministic; nothing crops. Returns a NEW overlay (pure).
 */
export function transformOverlayForAspect<T extends Pick<Overlay, 'x' | 'y' | 'w' | 'h'>>(
  overlay: T,
  from: Pick<SpecFormat, 'width' | 'height'>,
  to: Pick<SpecFormat, 'width' | 'height'>
): T {
  const scale = to.height / from.height;
  const offsetX = (to.width - from.width * scale) / 2;
  return {
    ...overlay,
    x: round3(overlay.x * scale + offsetX),
    y: round3(overlay.y * scale),
    w: round3(overlay.w * scale),
    h: round3(overlay.h * scale),
  };
}

/**
 * Transform a WHOLE spec for a target aspect (OPTION A): swap format + remap every overlay's
 * placement. Overlays' scene-relative start/end are untouched. Returns a NEW spec (pure);
 * meta.revision is NOT bumped here (persistence-layer revisioning owns that).
 */
export function transformSpecForAspect(spec: Spec, aspect: Aspect): Spec {
  const target = computeFormat(spec, aspect);
  // No-op when the spec is already at the target aspect's pixel dims.
  if (spec.format.width === target.width && spec.format.height === target.height) {
    return spec;
  }
  const from = { width: spec.format.width, height: spec.format.height };
  const to = { width: target.width, height: target.height };
  return {
    ...spec,
    format: target,
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      overlays: scene.overlays.map((ov) => transformOverlayForAspect(ov, from, to)),
    })),
  };
}
