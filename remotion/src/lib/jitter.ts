// jitter.ts — seeded deterministic wobble for collage layers (vox-shorts).
//
// Pure functions over @remotion/noise simplex fields — the same noise2D(seed, x, y)
// pattern polish.tsx uses for Grain/ShortsBackdrop: the seed string picks a fixed
// slice of the simplex field, and a frame-derived coordinate walks that slice
// smoothly, so motion *evolves* instead of popping. Fully deterministic:
//   - NO Math.random(), NO Date.now(), NO wall-clock anywhere in this module.
//   - Same (seed, frame, opts) ALWAYS yields the same {dx, dy, rot}, in Studio
//     scrubbing, frame QA stills, and the final render.
//
// Remotion determinism contract (CLAUDE.md): all motion derives from
// useCurrentFrame(). Callers pass the current frame in; these helpers never
// read it themselves, so they stay usable outside React components too
// (e.g. computing a transform for a static layer at a known frame).

import {noise2D} from '@remotion/noise';

// =============================================================================
// TYPES
// =============================================================================

/** Options controlling the wobble's amplitude and speed. */
export type WobbleOptions = {
  /**
   * Master amplitude, in px. `dx`/`dy` each range within ±amount, and `rot`
   * within ±(amount * ROT_PER_PX) degrees. Default 6 — a felt-but-calm drift
   * for paper-collage layers (brand.md §5: motion stays subtle).
   */
  amount?: number;
  /**
   * Frames per simplex step — higher = slower, dreamier wobble; lower = more
   * nervous. Default 18 (~0.6s per step at 30fps), a slow organic drift.
   * Grain in polish.tsx uses tempo 6 for a fast shimmer; collage layers want
   * slower. Must be > 0.
   */
  tempo?: number;
  /**
   * Max rotation in degrees at amount=1px of translation amplitude.
   * Default 0.35 — at amount 6 that's ±2.1°, a paper-cutout lean.
   */
  rotPerPx?: number;
};

/** The wobble offsets for one frame: translation (px) + rotation (deg). */
export type Wobble = {
  /** Horizontal offset in px, within ±amount. */
  dx: number;
  /** Vertical offset in px, within ±amount. */
  dy: number;
  /** Rotation in degrees, within ±(amount * rotPerPx). */
  rot: number;
};

// Default rotation gain: degrees of tilt per px of amount. Kept small — a
// collage layer should lean, not spin.
const ROT_PER_PX = 0.35;

// Spatial frequency of the walk through the simplex field. ~0.15 gives gentle
// low-frequency drift (large smooth excursions); >1 would get jittery/buzzy.
const FIELD_FREQ = 0.15;

// Fixed phase offsets so dx, dy and rot sample DIFFERENT parts of the field
// (decorrelated channels — the layer doesn't just slide along one diagonal).
const PHASE_Y = 40;
const PHASE_ROT = 80;

// =============================================================================
// wobble — the main API
// =============================================================================

/**
 * Seeded, frame-driven organic wobble for a collage layer.
 *
 * Each channel samples a seeded simplex field at a frame-derived coordinate:
 *   noise2D(seed, frame/tempo * FREQ, phase)
 * Because the field is smooth in its first coordinate, consecutive frames give
 * consecutive values — continuous drift, never popping. The seed string makes
 * each layer walk a different slice of the field, so stacked layers wobble
 * independently (pass a per-layer seed like `layer-0`, `cutout-headline`).
 *
 * @param seed  Per-layer seed — any stable string or number. The SAME seed
 *              must be used across all frames of that layer (it's what makes
 *              the wobble deterministic AND unique to the layer).
 * @param frame Current frame — pass useCurrentFrame() (or a known frame for
 *              static/QA computation).
 * @param opts  {amount, tempo, rotPerPx} — see WobbleOptions.
 * @returns     {dx, dy, rot} — px offsets and degrees, ready for a CSS
 *              `transform: translate(...) rotate(...)`.
 *
 * @example
 *   const frame = useCurrentFrame();
 *   const w = wobble(`cutout-${i}`, frame, {amount: 6, tempo: 18});
 *   <div style={{transform: `translate(${w.dx}px, ${w.dy}px) rotate(${w.rot}deg)`}} />
 */
export const wobble = (
  seed: string | number,
  frame: number,
  opts: WobbleOptions = {},
): Wobble => {
  const {amount = 6, tempo = 18, rotPerPx = ROT_PER_PX} = opts;
  // Temporal coordinate: walk the field slowly as frames advance.
  const t = (frame / Math.max(1e-6, tempo)) * FIELD_FREQ;
  // Three decorrelated channels off the same seed slice.
  const nx = noise2D(seed, t, 0);
  const ny = noise2D(seed, t, PHASE_Y);
  const nr = noise2D(seed, t, PHASE_ROT);
  return {
    dx: nx * amount,
    dy: ny * amount,
    rot: nr * amount * rotPerPx,
  };
};

/**
 * Convenience: the wobble as a ready-made CSS transform string.
 * Same determinism contract as wobble() — pure in (seed, frame, opts).
 */
export const wobbleTransform = (
  seed: string | number,
  frame: number,
  opts: WobbleOptions = {},
): string => {
  const w = wobble(seed, frame, opts);
  return `translate(${w.dx.toFixed(3)}px, ${w.dy.toFixed(3)}px) rotate(${w.rot.toFixed(3)}deg)`;
};
