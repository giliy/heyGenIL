/**
 * sketch.tsx — hand-drawn / sketch annotation kit built on rough-js (MIT).
 *
 * This is the ONE place shots get "hand-drawn" strokes from. rough-js produces
 * the wobbly, hand-sketched underlines / circles / boxes / arrows the vox
 * collage track already fakes with crisp SVG, and the kids track wants warmer
 * tile borders. It pairs with lib/freehand.tsx (pressure-varying strokes) and
 * lib/annotation.tsx (Remotion rough-notation highlight/box, driven by progress).
 *
 * DETERMINISM CONTRACT (read before use):
 *   rough-js's generator IS deterministic when given a NON-ZERO integer `seed`:
 *   its RNG is a pure linear-congruential generator seeded per element
 *   (roughjs/bin/math.js `Random.next()` — `seed` truthy → LCG, `seed` falsy/0
 *   → Math.random()). So the ONE rule that keeps pixels a pure function of
 *   frame is: **every sketch element must render with a concrete non-zero
 *   seed.** This module enforces that by defaulting `seed` to STABLE_SEED when
 *   the caller omits it, so an unseeded call is still reproducible across
 *   frames, re-renders, and separate render invocations (each render is a fresh
 *   browser page — the LCG is module-level pure, so the same seed yields the
 *   same wobble everywhere). Pass a DIFFERENT positive integer per element to
 *   vary the wobble; NEVER pass 0/undefined expecting a fixed path.
 *
 *   The frozen path is also memoized (useMemo on geometry+options+seed) so the
 *   wobble is held constant for the element's lifetime within a render — the
 *   belt-and-suspenders to the seed being the actual reproducibility source.
 *   NEVER call rough's generator raw inside a render body.
 */
import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { evolvePath, getLength } from '@remotion/paths';
import rough from 'roughjs';
import type { Options as RoughOptions, PathInfo } from 'roughjs/bin/core';
import { RoughGenerator } from 'roughjs/bin/generator';

/**
 * The default wobble seed used when a caller omits `seed`. Must be a NON-ZERO
 * positive integer (rough-js treats falsy seed as "use Math.random()"). Any
 * fixed value works; 7 is arbitrary but stable across the whole library, so
 * all unseeded sketch elements share one reproducible wobble.
 */
export const STABLE_SEED = 7;

/**
 * rough.newSeed() — a fresh random non-zero integer a shot can pass as an
 * element's `seed` to get a DIFFERENT wobble than STABLE_SEED. (Author-time
 * helper: the returned value should be hard-coded into the shot, not called in
 * a render body — calling it per-render would itself be non-deterministic.)
 */
export const newSeed = (): number => {
  const s = RoughGenerator.newSeed();
  return s === 0 ? STABLE_SEED : s;
};

export type SketchOptions = RoughOptions;

/** The frozen toPaths() output for one sketch element. */
export type SketchPath = PathInfo;

/**
 * Resolve a caller seed to a concrete non-zero integer. undefined/0/NaN →
 * STABLE_SEED, so an omitted seed still yields a reproducible path. This is
 * the single choke point that guarantees determinism.
 */
const resolveSeed = (seed?: number): number =>
  typeof seed === 'number' && Number.isFinite(seed) && seed !== 0 ? seed : STABLE_SEED;

/**
 * Generate + freeze ONE rough drawable into its SVG path data, once. Called
 * only inside a useMemo (never raw in a render body) so the random wobble is
 * frozen per element and output is deterministic. Returns gen.toPaths().
 * The seed is resolved to a concrete non-zero integer BEFORE reaching the
 * generator — that, not the memo, is what makes output reproducible across
 * separate render invocations.
 */
const sketchPaths = (
  build: (gen: RoughGenerator) => ReturnType<RoughGenerator['line']>,
  options: SketchOptions,
  seed?: number,
): PathInfo[] => {
  // A seed inside `options` (RoughOptions.seed) is honored but also resolved,
  // so options.seed===0/undefined can't silently re-enable Math.random().
  const { seed: optSeed, ...rest } = options;
  const gen = rough.generator({ options: { ...rest, seed: resolveSeed(seed ?? optSeed) } });
  const drawable = build(gen);
  return gen.toPaths(drawable);
};

export type SketchProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** rough-js options (stroke, strokeWidth, roughness, bowing, ...). */
  options?: SketchOptions;
  /** rough-js seed (style only — the wobble is frozen per element, not seeded). */
  seed?: number;
};

/**
 * Generate + freeze one rough line into its SVG path data, memoized on the
 * geometry + options. Returns rough's toPaths() result (array of {d, stroke,
 * strokeWidth, fill}). THIS is the deterministic primitive — the same frozen
 * path data is returned on every call/frame. Never call the generator raw.
 */
export const useSketchLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: SketchOptions = {},
  seed?: number,
): SketchPath[] => {
  const memoKey = JSON.stringify({ x1, y1, x2, y2, options, seed });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => sketchPaths((gen) => gen.line(x1, y1, x2, y2, options), options, seed), [memoKey]);
};

/**
 * A frozen hand-drawn line as an inline <svg> (viewBox = the canvas it lives
 * in, so coords are canvas px). The path is generated once (memoized) and
 * reused every frame, so the wobble is constant and output is deterministic.
 */
export const SketchLine: React.FC<
  SketchProps & { vb: { w: number; h: number }; style?: React.CSSProperties }
> = ({ vb, x1, y1, x2, y2, options, seed, style }) => {
  const paths = useSketchLine(x1, y1, x2, y2, options, seed);
  return (
    <svg
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
      ))}
    </svg>
  );
};

/**
 * A hand-drawn line that draws itself on over a window (evolvePath dash trick).
 * The wobble is frozen (useSketchLine); only the dash progress animates, driven
 * by useCurrentFrame — fully frame-deterministic.
 */
export const SketchLineDrawOn: React.FC<
  SketchProps & { vb: { w: number; h: number }; at?: number; dur?: number; style?: React.CSSProperties }
> = ({ vb, x1, y1, x2, y2, options, seed, at = 0, dur = 20, style }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const paths = useSketchLine(x1, y1, x2, y2, options, seed);
  return (
    <svg
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      {paths.map((p, i) => {
        const ev = evolvePath(progress, p.d);
        return (
          <path
            key={i}
            d={p.d}
            fill={p.fill ?? 'none'}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
          />
        );
      })}
    </svg>
  );
};

/**
 * Resolve a rough generator into a frozen path for an arbitrary kind
 * (underline / box / circle / ellipse / rectangle / arrow). Utility for shots
 * that want a sketch shape, not just a line. Returns toPaths() output.
 */
export const useSketchShape = (
  kind: 'underline' | 'box' | 'circle' | 'ellipse' | 'rectangle' | 'arrow',
  geom: Record<string, number> | [number, number][],
  options: SketchOptions = {},
  seed?: number,
): SketchPath[] => {
  const memoKey = JSON.stringify({ kind, geom, options, seed });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () =>
      sketchPaths((gen) => {
        if (kind === 'underline') {
          const g = geom as { x: number; y: number; w: number };
          return gen.line(g.x, g.y, g.x + g.w, g.y, options);
        } else if (kind === 'box' || kind === 'rectangle') {
          const g = geom as { x: number; y: number; w: number; h: number };
          return gen.rectangle(g.x, g.y, g.w, g.h, options);
        } else if (kind === 'circle') {
          const g = geom as { x: number; y: number; w: number };
          return gen.circle(g.x + g.w / 2, g.y + g.w / 2, g.w, options);
        } else if (kind === 'ellipse') {
          const g = geom as { x: number; y: number; w: number; h: number };
          return gen.ellipse(g.x + g.w / 2, g.y + g.h / 2, g.w, g.h, options);
        }
        // arrow — a hand-drawn line (draw the head separately if needed)
        const g = geom as { x1: number; y1: number; x2: number; y2: number };
        return gen.line(g.x1, g.y1, g.x2, g.y2, options);
      }, options, seed),
    [memoKey],
  );
};

/** Frozen-path SVG for a sketch shape (see useSketchShape for `kind`/`geom`). */
export const SketchShape: React.FC<{
  kind: 'underline' | 'box' | 'circle' | 'ellipse' | 'rectangle' | 'arrow';
  geom: Record<string, number> | [number, number][];
  options?: SketchOptions;
  seed?: number;
  vb: { w: number; h: number };
  style?: React.CSSProperties;
}> = ({ kind, geom, options, seed, vb, style }) => {
  const paths = useSketchShape(kind, geom, options, seed);
  return (
    <svg
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', pointerEvents: 'none', ...style }}
      aria-hidden
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
      ))}
    </svg>
  );
};

/** Re-export getLength for callers that need a path's length for timing. */
export { getLength };
