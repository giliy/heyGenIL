/**
 * freehand.tsx — pressure-varying freehand strokes via perfect-freehand (MIT).
 *
 * perfect-freehand takes a series of [x, y] points (optionally with pressure)
 * and returns the OUTLINE polygon of a stroke that thickens/thins like a real
 * pen stroke — the hand-drawn arrows / underlines / scribbles the vox collage
 * annotation look needs, which lib/sketch.tsx (rough-js wobble) alone can't do.
 *
 * DETERMINISM: getStroke() is a pure function of its input points + options —
 * no randomness at all. Feed it fixed points and it returns the same outline on
 * every frame and every render. So the ONLY rule is: pass a fixed point list
 * (module-scope constant or useMemo), never points derived from Date.now() or
 * Math.random(). The draw-on reveal animates the dash offset, not the points.
 *
 * Pairs with lib/sketch.tsx (rough wobble) and lib/annotation.tsx (rough-notation
 * progress-driven highlights). Use freehand when you want the stroke itself to
 * have pen-pressure character; use sketch when you want geometric wobble.
 */
import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { getStroke } from 'perfect-freehand';

/** One input point: [x, y] or [x, y, pressure(0..1)]. */
export type FreehandPoint = [number, number] | [number, number, number];

export type FreehandOptions = {
  /** Base stroke size in px (the max thickness). Default 8. */
  size?: number;
  /** How much pressure thins the stroke (0 = constant, ~0.6 = pen-like). */
  thinning?: number;
  /** 0..1 path smoothing. Default 0.5. */
  smoothing?: number;
  /** 0..1 streamline (lazy-hand pull). Default 0.5. */
  streamline?: number;
  /** Taper at the start. */
  taperStart?: number;
  /** Taper at the end. */
  taperEnd?: number;
  /** Whether the stroke is closed. */
  closed?: boolean;
};

/** Convert perfect-freehand outline points to an SVG path `d` string. */
const outlineToPath = (points: number[][]): string => {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const segs = rest.map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  return `M${first[0].toFixed(2)} ${first[1].toFixed(2)} ${segs} Z`;
};

/**
 * Pure: compute the filled outline path `d` for a pressure stroke through
 * `points`. Memoize-friendly (pure function); safe to call in a render body
 * because it is deterministic — but wrap in useMemo for perf on long strokes.
 */
export const freehandPath = (points: FreehandPoint[], options: FreehandOptions = {}): string => {
  const {
    size = 8,
    thinning = 0.6,
    smoothing = 0.5,
    streamline = 0.5,
    taperStart = 0,
    taperEnd = 0,
    closed = false,
  } = options;
  const outline = getStroke(points as number[][], {
    size,
    thinning,
    smoothing,
    streamline,
    last: true,
    simulatePressure: points.length > 0 && points[0].length < 3,
  });
  return outlineToPath(outline as number[][]);
};

/**
 * <Freehand> — a static pressure-varying stroke (filled path) through `points`.
 * `points` are in the same coordinate space as the surrounding <svg> (pass the
 * canvas via `vb`). Fully deterministic (getStroke is pure).
 */
export const Freehand: React.FC<{
  points: FreehandPoint[];
  vb: { w: number; h: number };
  color?: string;
  options?: FreehandOptions;
  style?: React.CSSProperties;
}> = ({ points, vb, color = '#e8879f', options, style }) => {
  const d = useMemo(() => freehandPath(points, options), [points, options]);
  return (
    <svg
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      <path d={d} fill={color} />
    </svg>
  );
};

/**
 * <FreehandDrawOn> — the pressure stroke reveals along its length over a
 * window. The stroke path is pure (freehandPath); only a clip/scale progress
 * animates via useCurrentFrame. We reveal by sweeping a clip rect across the
 * points' bounding box — simple, deterministic, no per-frame path regen.
 */
export const FreehandDrawOn: React.FC<{
  points: FreehandPoint[];
  vb: { w: number; h: number };
  color?: string;
  options?: FreehandOptions;
  at?: number;
  dur?: number;
  /** 'lr' | 'rl' sweep direction (use 'rl' for RTL). Default 'lr'. */
  direction?: 'lr' | 'rl';
  style?: React.CSSProperties;
}> = ({ points, vb, color = '#e8879f', options, at = 0, dur = 20, direction = 'lr', style }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const d = useMemo(() => freehandPath(points, options), [points, options]);
  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const span = Math.max(1, maxX - minX);
  // Reveal with a clip rect that grows from the start edge to the end edge.
  const clipX = direction === 'lr' ? minX : maxX - span * progress;
  const clipW = span * progress;
  const clipId = `fh-${minX.toFixed(0)}-${maxX.toFixed(0)}-${at}`;
  return (
    <svg
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={clipX} y={-9999} width={clipW} height={19998} />
        </clipPath>
      </defs>
      <path d={d} fill={color} clipPath={`url(#${clipId})`} />
    </svg>
  );
};
