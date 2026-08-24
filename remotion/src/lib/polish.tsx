// T07 — polish layer: @remotion/transitions + @remotion/effects + @remotion/noise.
// New file (NOT shorts.tsx) to avoid contention. Deterministic throughout:
// every value derives from useCurrentFrame()/spring()/interpolate() — no
// Date.now(), no Math.random(), no wall-clock. @remotion/noise is seeded by frame.
//
// Loop contract (CLAUDE.md): NEVER put a <SceneTransition.Transition> across the
// frame-0 <-> last-frame seam. Transitions belong at INTERIOR cuts only; the first
// and last scenes meet the seam unblended.
import React, {useMemo, useRef} from 'react';
import {
  AbsoluteFill,
  HtmlInCanvas,
  isHtmlInCanvasSupported,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {noise2D} from '@remotion/noise';
import {springTiming, TransitionSeries} from '@remotion/transitions';
import type {TransitionPresentation} from '@remotion/transitions';
import {filmBurn} from '@remotion/transitions/film-burn';
import {dreamyZoom} from '@remotion/transitions/dreamy-zoom';
import {fade} from '@remotion/transitions/fade';
import {glow} from '@remotion/effects/glow';
import {dropShadow} from '@remotion/effects/drop-shadow';
import {COLORS} from '../brand';

// =============================================================================
// GRAIN — film grain via @remotion/noise, deterministic (seeded by frame).
// Rendered once per frame to an ImageData tile, tiled by CSS at low opacity.
// noise2D(`grain-x-y`, frame/tempo, 0) walks the simplex field smoothly as the
// frame advances, so the grain *shimmers* rather than popping. No wall-clock.
// =============================================================================
export const Grain: React.FC<{
  opacity?: number; // 0.03–0.05 per brand (subtle, felt-not-heard)
  size?: number; // tile size in px (the simplex field is sampled over this grid)
  tempo?: number; // frames per simplex step; higher = slower shimmer
}> = ({opacity = 0.04, size = 160, tempo = 6}) => {
  const frame = useCurrentFrame();
  // Data-URI PNG tile, recomputed each frame from the deterministic noise field.
  // Subtlety is baked into the pixels: white/black speckle at very low alpha on a
  // transparent tile, NORMAL blend (no mix-blend-mode, which composites unreliably
  // in headless and would show the whole tile at full strength).
  const url = useMemo(() => {
    if (typeof document === 'undefined') return 'none';
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'none';
    const img = ctx.createImageData(size, size);
    const t = frame / tempo;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Two octaves -> fine speckle + a little structure. Seed folds x/y in so the
        // field is spatially varied while the frame term animates it over time.
        const n =
          noise2D(`g1-${x % 8}-${y % 8}`, x * 0.9 + t, y * 0.9) * 0.7 +
          noise2D(`g2-${x % 4}-${y % 4}`, x * 0.25, y * 0.25 + t) * 0.3;
        const i = (y * size + x) * 4;
        const light = n >= 0; // half the field lifts, half sinks
        const a = Math.round(Math.abs(n) * 255); // speckle strength 0..255
        img.data[i] = light ? 255 : 0;
        img.data[i + 1] = light ? 255 : 0;
        img.data[i + 2] = light ? 255 : 0;
        img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return `url(${canvas.toDataURL('image/png')})`;
  }, [frame, size, tempo]);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: url,
        backgroundRepeat: 'repeat',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

// =============================================================================
// BRAND BACKDROP — animated indigo->violet->teal mesh (brand.md signature
// gradient) + faint dotted grid + vignette + subtle grain. All drift is
// frame-driven simplex noise (slow 8–20s loops per brand.md §5). Replaces the
// flat dark stage. Drop-in: render as the bottom layer of a composition.
// =============================================================================
const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export const ShortsBackdrop: React.FC<{
  base?: string; // dark base behind the mesh
  intensity?: number; // 0..1 master gain on blob alphas
  grain?: number; // grain opacity (0 disables)
  grid?: boolean; // faint dotted grid
}> = ({base = COLORS.ink, intensity = 1, grain = 0.04, grid = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Slow temporal coordinates: each blob completes a loop in ~12–18s.
  const t = frame / fps;
  // Three blobs — indigo / violet / teal — each orbiting on its own noise-driven
  // lissajous. noise2D(seed, t*speed, phase) is smooth & deterministic.
  const blob = (seed: string, speed: number, phase: number, ax: number, ay: number) => ({
    x: 50 + ax * noise2D(seed, t * speed, phase),
    y: 42 + ay * noise2D(seed, t * speed, phase + 40),
  });
  const b1 = blob('mesh-indigo', 0.055, 0, 34, 30); // indigo
  const b2 = blob('mesh-violet', 0.07, 7, 30, 34); // violet
  const b3 = blob('mesh-teal', 0.048, 13, 36, 28); // teal
  const g1 = hexA(COLORS.accent, 0.5 * intensity);
  const g2 = hexA(COLORS.accent2, 0.42 * intensity);
  const g3 = hexA(COLORS.signal, 0.4 * intensity);

  return (
    <AbsoluteFill style={{background: base}}>
      {/* brand mesh: three drifting radial blobs in the signature gradient hues */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 52% at ${b1.x}% ${b1.y}%, ${g1} 0%, transparent 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 46% at ${b2.x}% ${b2.y}%, ${g2} 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 50% at ${b3.x}% ${b3.y}%, ${g3} 0%, transparent 62%)`,
        }}
      />
      {/* faint dotted grid (brand.md §5) */}
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${hexA('#ffffff', 0.05)} 1px, transparent 1.4px)`,
            backgroundSize: '44px 44px',
          }}
        />
      ) : null}
      {/* vignette to seat content */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      {grain > 0 ? <Grain opacity={grain} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================
// SCENE TRANSITION — TransitionSeries with brand defaults baked in.
//   timing: springTiming({damping:200}) — calm, no overshoot (brand.md §5).
//   kind 'hard' -> filmBurn (topic cuts), 'soft' -> dreamyZoom (gentle beats).
// The plain <Sequence>-style API keeps call sites tidy; Scenes and Transitions
// interleave as children.
// =============================================================================
export const brandTiming = (durationInFrames = 24) =>
  springTiming({
    config: {damping: 200, mass: 0.8, stiffness: 120},
    durationInFrames,
    durationRestThreshold: 0.001, // avoid the docs' noted tail cutoff
  });

// Plain wrapper (a namespace-free FC — no monkey-patched statics). Use
// <TransitionSeries.Sequence> from '@remotion/transitions' for the child scenes.
export const SceneTransition: React.FC<{children: React.ReactNode}> = ({children}) => (
  <TransitionSeries>{children}</TransitionSeries>
);
// kind: 'hard' = film-burn topic cut, 'soft' = dreamy-zoom. duration is frames.
//
// filmBurn / dreamyZoom are HTML-in-canvas presentations and THROW when
// HtmlInCanvas.isSupported() is false (no Chrome canvas-draw-element flag — e.g.
// the pinned headless render shell). We pick the presentation at render time:
// when canvas presentations are unavailable we degrade to `fade` (plain DOM,
// always supported) so the render never crashes and still reads as a smooth,
// non-pop cut. Both paths are deterministic (springTiming-driven).
//
// NOTE: TransitionSeries validates its direct children's `type`, so a Transition
// can't be wrapped in a custom component and used as <SceneCut/>. Call it as a
// FUNCTION: `{sceneCut({kind:'hard'})}` — the returned element's type IS
// TransitionSeries.Transition and passes validation.
//
// The canvas presentations (filmBurn/dreamyZoom) are shaders that need a
// canvas-draw-element-enabled Chrome AND reliable HtmlInCanvas width/height. In
// the pinned headless render shell the feature reports supported but the shader
// path can still throw for missing dims, so they're opt-in via
// REMOTION_CANVAS_TRANSITIONS=1 (for a flag-enabled Studio browser). Default =
// `fade` — always supported, deterministic, still a smooth non-pop cut.
// Browser-safe env read: polish.tsx is bundled into the browser, where Remotion
// copies env into `window.process.env` (see setup-env-variables). `process` is
// untyped there, so read it off `globalThis` (typed `any` → TS-clean) instead of
// a bare `process` reference. Same truthy semantics as the old guard, in Node and
// in the browser bundle. Opt-in stays REMOTION_CANVAS_TRANSITIONS=1.
const canvasTransitionsOn = () =>
  !!(globalThis as any)?.process?.env?.REMOTION_CANVAS_TRANSITIONS;

// The three presentations have heterogeneous prop types (FadeProps / FilmBurnProps /
// DreamyZoomProps) whose union won't unify against TransitionPresentation<FadeProps>.
// Widen to the loosest TransitionPresentation<any> so the ternary has one common type.
// Runtime behavior is unchanged: fade by default; filmBurn/dreamyZoom only when
// canvasTransitionsOn() && isHtmlInCanvasSupported().
const pickPresentation = (kind: 'hard' | 'soft'): TransitionPresentation<any> =>
  !(canvasTransitionsOn() && isHtmlInCanvasSupported())
    ? fade()
    : kind === 'hard'
      ? filmBurn({})
      : dreamyZoom({rotation: 4, scale: 1.15});

export const sceneCut = ({
  kind = 'soft',
  durationInFrames = 24,
}: {
  kind?: 'hard' | 'soft';
  durationInFrames?: number;
}) => (
  <TransitionSeries.Transition
    timing={brandTiming(durationInFrames)}
    presentation={pickPresentation(kind)}
  />
);

// =============================================================================
// GLOW REVEAL — @remotion/effects glow + drop-shadow on a reveal.
// The effects are WebGL2/canvas-based, so they require HtmlInCanvas (which needs
// Chrome's canvas-draw-element flag). isHtmlInCanvasSupported() returns false in
// the pinned headless shell -> we degrade to a CSS drop-shadow/text-shadow so the
// render never breaks. In Studio / a flagged browser the real WebGL glow applies.
// Deterministic: intensity can be driven by a frame-derived progress value.
// =============================================================================
export const GlowReveal: React.FC<{
  progress?: number; // 0..1 reveal amount (frame-derived); defaults to fully on
  color?: string;
  glowRadius?: number;
  shadow?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  width?: number; // required for the opt-in WebGL2 path
  height?: number; // required for the opt-in WebGL2 path
}> = ({
  progress = 1,
  color = COLORS.signal,
  glowRadius = 26,
  shadow = true,
  children,
  style,
  width,
  height,
}) => {
  const p = Math.max(0, Math.min(1, progress));
  // WebGL2 path is OPT-IN (REMOTION_CANVAS_EFFECTS=1) AND needs explicit
  // width/height: HtmlInCanvas throws without them. Default render path is the
  // CSS drop-shadow filter — identical look, deterministic, never crashes.
  const useCanvas =
    !!(globalThis as any)?.process?.env?.REMOTION_CANVAS_EFFECTS &&
    isHtmlInCanvasSupported() &&
    typeof width === 'number' &&
    typeof height === 'number';
  if (!useCanvas) {
    return (
      <div
        style={{
          ...style,
          opacity: p,
          filter: `drop-shadow(0 0 ${glowRadius * p}px ${hexA(color, 0.85 * p)})${
            shadow ? ` drop-shadow(0 10px ${24 * p}px rgba(0,0,0,${0.4 * p}))` : ''
          }`,
        }}
      >
        {children}
      </div>
    );
  }
  // Opt-in WebGL2 path: real glow + drop-shadow effects.
  return (
    <HtmlInCanvas width={width} height={height} style={style} effects={[
      glow({radius: glowRadius * p, intensity: 1.6 * p, threshold: 0.2, color}),
      ...(shadow ? [dropShadow({radius: 24, offsetX: 0, offsetY: 10, opacity: 0.4 * p})] : []),
    ]}>
      {children}
    </HtmlInCanvas>
  );
};
