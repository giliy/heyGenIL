/**
 * lib/morph.tsx — flubber path-morph wrapper (deterministic).
 *
 * flubber (MIT, https://github.com/veltman/flubber) turns two SVG path strings
 * into an interpolator `(t: 0..1) => pathString`. That interpolator is a PURE
 * function — for a fixed `from`, `to`, and `t` it always returns the same path.
 * So a morph is a pure function of the current frame, exactly what Remotion's
 * frame-driven model requires. No wall-clock, no rAF, no state.
 *
 * DETERMINISM CONTRACT:
 *  - The flubber interpolator is built ONCE per (from,to) pair and memoized —
 *    rebuilding it every frame is wasted work (and flubber's internal shape
 *    matching is deterministic anyway, so the result would be identical).
 *  - The ONLY per-frame input is `progress` (0..1), derived from
 *    `useCurrentFrame()` via a clamped `interpolate()`.
 *  - Never feed a random/wall-clock value into `progress`.
 *
 * NOTE on path compatibility: flubber matches two paths best when they have a
 * similar number of segments. For wildly different shapes pass a `maxSegmentLength`
 * (flubber subdivides to that length before matching) — the default (2) is a
 * good general value. Shapes from lib/sketch (rough-js) are PathInfo[] — convert
 * to a single path string first if morphing to/from a sketch path.
 */
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { interpolate as flubberInterpolate } from 'flubber';

export type MorphEasing = (t: number) => number;

export interface UseMorphPathOptions {
  /** Subdivide paths to this segment length before matching (lower = smoother morph, more points). Default 2. */
  maxSegmentLength?: number;
  /** Wrap the morph in a single closed shape (flubber `single: true`) — use when one path encloses the other. */
  single?: boolean;
}

/**
 * Build a memoized flubber interpolator for `from`→`to` and return the path
 * string at `progress` (0..1). Pure per (from,to,progress).
 */
export const useMorphPath = (
  from: string,
  to: string,
  progress: number,
  options: UseMorphPathOptions = {},
): string => {
  const { maxSegmentLength = 2, single = false } = options;
  const morphFn = useMemo(
    () =>
      flubberInterpolate(from, to, {
        maxSegmentLength,
        single,
      }),
    [from, to, maxSegmentLength, single],
  );
  // progress is clamped by the caller's interpolate(); clamp here too so an
  // out-of-range t can never produce an invalid path.
  const t = Math.min(1, Math.max(0, progress));
  return morphFn(t);
};

export interface MorphProps extends UseMorphPathOptions {
  from: string;
  to: string;
  /** Frame the morph starts. */
  at: number;
  /** Duration of the morph in frames. */
  dur: number;
  /** Optional easing applied to the 0..1 progress (e.g. EASE_INOUT). */
  easing?: MorphEasing;
  // SVG presentation props
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  opacity?: number;
  /** Render inside an <svg> with this viewBox; otherwise returns a bare <path>. */
  viewBox?: string;
  style?: React.CSSProperties;
  pathStyle?: React.CSSProperties;
}

/**
 * Frame-driven morphing <path>. The morph runs from frame `at` to `at+dur`,
 * clamped on both ends. Renders the interpolated path at the current frame.
 */
export const Morph: React.FC<MorphProps> = ({
  from,
  to,
  at,
  dur,
  easing,
  maxSegmentLength,
  single,
  fill = 'none',
  stroke,
  strokeWidth = 2,
  strokeLinecap = 'round',
  opacity = 1,
  viewBox,
  style,
  pathStyle,
}) => {
  const frame = useCurrentFrame();
  const raw = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const progress = easing ? easing(raw) : raw;
  const d = useMorphPath(from, to, progress, { maxSegmentLength, single });

  const path = (
    <path
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      opacity={opacity}
      style={pathStyle}
    />
  );

  if (viewBox) {
    return (
      <svg viewBox={viewBox} style={style}>
        {path}
      </svg>
    );
  }
  return path;
};

/**
 * Convenience: morph between two circle-ish paths (e.g. a small dot → a big
 * ring) by generating the circle paths for you. Center + radius in viewBox units.
 */
export const circlePath = (cx: number, cy: number, r: number): string =>
  `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;

export default Morph;
