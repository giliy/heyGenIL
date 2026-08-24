import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { FONT_BODY_H, FONT_EDITORIAL_H } from '../fonts';
import { stagger } from './shorts';

// =============================================================================
// vox collage kit — layered-collage documentary language (see vox/DESIGN.md)
// Every scene is a stack of layers on a paper board; a virtual camera pans/zooms
// across the board and layers carry depth for parallax. All motion frame-based.
// =============================================================================

export const VOX = {
  paper: '#efe6d3',
  paperDeep: '#e0d2b8',
  ink: '#282217',
  inkSoft: '#544a3a',
  red: '#c0392b',
  yellow: '#e8b73a',
  teal: '#33695d',
  cream: '#faf5ea',
} as const;

export const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
export const EASE_INOUT = Easing.bezier(0.42, 0, 0.24, 1);
export const EASE_PLACE = Easing.bezier(0.22, 1.2, 0.36, 1); // settles with a soft overshoot

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Deterministic frame-normalized progress (0..1) — no wall-clock anywhere.
const prog = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.0001, b - a)));

// -----------------------------------------------------------------------------
// Torn-paper / washi styling (T10). Opt-in per layer via `style="torn"` so old
// vox shorts render byte-identical with the prop off.
//   style: 'plain' (default) | 'torn'
// -----------------------------------------------------------------------------
export type LayerStyle = 'plain' | 'torn';

// Brand-adjacent washi pastels — the paper world's ink/cream family, muted so a
// strip reads as translucent tape on cream, never as a flat block of color.
export const WASHI = {
  blush: 'rgba(214,166,148,0.38)',  // dusty rose
  sage: 'rgba(168,183,160,0.36)',   // soft sage
  butter: 'rgba(224,198,130,0.38)', // faded butter
  sky: 'rgba(164,180,192,0.36)',    // dusty slate blue
} as const;

// Two-soft-shadow lift under paper cards: a tight, close shadow plus a wide,
// soft one. Box-shadow (not feDropShadow) — cheap, bounded to the card box.
export const PAPER_LIFT = '0 4px 10px rgba(40,28,12,0.16), 0 22px 40px rgba(40,28,12,0.22)';

// -----------------------------------------------------------------------------
// GrainSvg — SELF-CONTAINED SVG paper-grain overlay (zero assets). FeTurbulence
// noise is desaturated to luma by an feColorMatrix and composited over the
// collage stack at low opacity with mix-blend overlay, reading as paper tooth.
// Deterministic: fixed seed and NO per-frame reseed, so the grain is a still
// paper texture rather than shimmering film noise (unlike <Grain> below, which
// re-seeds every 2 frames for animate film grain — that one stays untouched).
// Mount LAST (outside the board) so it sits over everything.
// -----------------------------------------------------------------------------
export const GrainSvg: React.FC<{
  opacity?: number; // ~0.08 reads as paper; keep ≤ 0.15
  seed?: number; // fixed — change only to pick a different static paper texture
  baseFrequency?: number; // 0.6–0.9 = fine paper tooth; lower = coarser
  id?: string; // filter id; must be unique if more than one GrainSvg is mounted
}> = ({ opacity = 0.08, seed = 7, baseFrequency = 0.8, id = 'collage-grain' }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity }}>
    <svg width="100%" height="100%" aria-hidden>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} seed={seed} stitchTiles="stitch" />
        {/* desaturate the RGB noise to greyscale luma so no color speckle leaks through */}
        <feColorMatrix
          type="matrix"
          values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  </AbsoluteFill>
);

// -----------------------------------------------------------------------------
// TornEdge — SELF-CONTAINED SVG torn-paper edge filter (zero assets). A rect
// (or any element) referencing this filter via `filter: url(#id)` gets its
// silhouette displaced by feTurbulence noise, producing a slow, wavy torn-paper
// contour. Deterministic for a fixed seed — each layer keeps ONE stable filter
// id -> a stable torn silhouette across every frame (no flicker).
//   baseFrequency ~0.02–0.05 + numOctaves ~2  -> slow wavy paper tears
//   feDisplacementMap scale 6–14              -> roughs the edge a few px
// The optional `edgeBlur` adds a faint 1px irregular lightening along the tear,
// like the exposed inner fibre of ripped paper; keep 0 for a clean die-cut.
// The filter region is padded tight around the element box (bleed = displacement
// range) so the GPU work stays small.
// -----------------------------------------------------------------------------
export const TornEdge: React.FC<{
  id: string; // unique per layer — this is what elements reference via url(#id)
  scale?: number; // displacement strength in px (±scale/2); 6–14 typical
  baseFrequency?: number; // 0.02–0.05 = slow wavy tears; higher = crumpled
  seed?: number; // fixed seed -> stable silhouette, no per-frame flicker
  edgeBlur?: number; // 0 = off; ~0.8 adds a soft torn-fibre fringe
}> = ({
  id,
  scale = 10,
  baseFrequency = 0.03,
  seed = 0,
  edgeBlur = 0,
}) => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
    <defs>
      <filter id={id} x="-18%" y="-18%" width="136%" height="136%">
        <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} seed={seed} stitchTiles="stitch" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" result="torn" />
        {edgeBlur > 0 ? (
          // feather the displaced silhouette a hair so the tear reads as fibre, not a vector cut
          <feGaussianBlur in="torn" stdDeviation={edgeBlur} />
        ) : null}
      </filter>
    </defs>
  </svg>
);

// A torn white paper backing card sized to EXPLICIT w/h px.
export const TornCard: React.FC<{
  id: string;
  w: number; // card width in px
  h: number; // card height in px
  scale?: number;
  baseFrequency?: number;
  seed?: number;
  shadow?: boolean;
  color?: string;
}> = ({ id, w, h, scale = 10, baseFrequency = 0.03, seed = 0, shadow = true, color = VOX.cream }) => {
  const bleed = scale; // displacement is ±scale/2; full `scale` covers it
  return (
    <>
      <TornEdge id={id} scale={scale} baseFrequency={baseFrequency} seed={seed} />
      <div
        style={{
          position: 'absolute',
          left: -bleed,
          top: -bleed,
          width: w + bleed * 2,
          height: h + bleed * 2,
          background: color,
          filter: `url(#${id})`,
          boxShadow: shadow ? PAPER_LIFT : undefined,
        }}
      />
    </>
  );
};

// A torn white backing that FILLS its parent's box (with a small bleed) — the
// right fit under a die-cut image whose exact aspect isn't known in advance.
export const TornBacking: React.FC<{
  id: string;
  scale?: number;
  baseFrequency?: number;
  seed?: number;
  shadow?: boolean;
  color?: string;
  bleed?: number;
}> = ({ id, scale = 10, baseFrequency = 0.03, seed = 0, shadow = true, color = VOX.cream, bleed }) => {
  const b = bleed ?? scale;
  return (
    <>
      <TornEdge id={id} scale={scale} baseFrequency={baseFrequency} seed={seed} />
      <div
        style={{
          position: 'absolute',
          inset: -b,
          background: color,
          filter: `url(#${id})`,
          boxShadow: shadow ? PAPER_LIFT : undefined,
        }}
      />
    </>
  );
};

// -----------------------------------------------------------------------------
// WashiTape — a small rotated translucent brand-pastel strip pinning a layer
// corner. Settles in with a deterministic spring (drop + tiny rotation ease),
// then rides the layer's idle drift via a `drift` seed offset so it moves with
// its parent, not independently.
// -----------------------------------------------------------------------------
export const WashiTape: React.FC<{
  x: number; // px within the parent layer's box (0..w)
  y: number; // px within the parent layer's box (0..h)
  len?: number; // strip length (px)
  thick?: number; // strip thickness (px)
  angle?: number; // deg, relative to the card
  color?: string;
  opacity?: number; // 0.3–0.4 typical
  at?: number; // settle frame (local)
  seed?: number; // stable per layer so drift matches the card
  drift?: number; // idle amplitude multiplier (inherit the card's)
}> = ({ x, y, len = 150, thick = 30, angle = -35, color = WASHI.blush, opacity = 0.36, at = 0, seed = 0, drift = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Deterministic spring settle: the strip drops on and its rotation eases in.
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 120, mass: 0.6 } });
  const settle = Math.max(0, Math.min(1, s));
  const rot = interpolate(settle, [0, 1], [angle + (angle > 0 ? 9 : -9), angle]);
  const drop = (1 - settle) * 26;
  // Idle breathing — phase-locked to the card's drift via the same seed math the
  // Layer uses, so tape + card move as one physical object.
  const dy = Math.cos(frame * 0.017 + seed * 1.7) * 2.6 * drift;
  const dx = Math.sin(frame * 0.021 + seed) * 2.2 * drift;
  const paper = color.replace(/[\d.]+\)$/, `${opacity})`);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: len,
        height: thick,
        transform: `translate(${dx}px, ${dy + drop}px) rotate(${rot}deg)`,
        background: paper,
        opacity: interpolate(settle, [0, 1], [0, 1]),
        filter: 'blur(0.6px)', // soft edges — washi is slightly feathered, not crisp
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(40,28,12,0.18)',
        pointerEvents: 'none',
      }}
    />
  );
};


// -----------------------------------------------------------------------------
// Camera — CollageBoard wraps a whole composition (or one scene). `cam` keyframes
// are BOARD-local frames (global when mounted at root). Layers read the camera
// displacement through context to add parallax by depth.
// -----------------------------------------------------------------------------
export type CamKey = { f: number; x: number; y: number; z: number };

const CamCtx = createContext({ offX: 0, offY: 0, zoom: 1 });

export const CollageBoard: React.FC<{
  cam: CamKey[]; // strictly increasing f; camera CENTER in canvas px + zoom
  children: React.ReactNode;
}> = ({ cam, children }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const fs = cam.map((k) => k.f);
  const camX = cam.length > 1 ? interpolate(frame, fs, cam.map((k) => k.x), { easing: EASE_INOUT, ...clamp }) : cam[0].x;
  const camY = cam.length > 1 ? interpolate(frame, fs, cam.map((k) => k.y), { easing: EASE_INOUT, ...clamp }) : cam[0].y;
  const zoom = cam.length > 1 ? interpolate(frame, fs, cam.map((k) => k.z), { easing: EASE_INOUT, ...clamp }) : cam[0].z;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `scale(${zoom}) translate(${W / 2 / zoom - camX}px, ${H / 2 / zoom - camY}px)`,
        }}
      >
        <CamCtx.Provider value={{ offX: camX - W / 2, offY: camY - H / 2, zoom }}>{children}</CamCtx.Provider>
      </div>
    </AbsoluteFill>
  );
};

// -----------------------------------------------------------------------------
// Layer — shared entrance/idle/parallax engine. Positions are canvas px of the
// layer's CENTER. `at` is in the frames of the surrounding Sequence (local).
// -----------------------------------------------------------------------------
export type Enter = 'pop' | 'place' | 'slide-l' | 'slide-r' | 'rise' | 'fade' | 'wipe' | 'none';

const seedOf = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) % 1000;

export const Layer: React.FC<{
  x: number;
  y: number;
  w: number;
  at?: number;
  dur?: number;
  enter?: Enter;
  rotate?: number;
  depth?: number; // parallax: 0 = glued to board, 0.05–0.15 foreground, negative = far
  drift?: number; // idle "breathing" amplitude multiplier; 0 = static
  z?: number;
  children: React.ReactNode;
}> = ({ x, y, w, at = 0, dur = 14, enter = 'place', rotate = 0, depth = 0, drift = 1, z, children }) => {
  const frame = useCurrentFrame();
  const { offX, offY } = useContext(CamCtx);
  const seed = seedOf(x, y);

  const raw = interpolate(frame, [at, at + dur], [0, 1], { easing: enter === 'place' ? EASE_PLACE : EASE_OUT, ...clamp });
  if (frame < at) return null;

  // idle drift — every layer breathes, nothing ever fully freezes
  const dx = Math.sin(frame * 0.021 + seed) * 2.2 * drift;
  const dy = Math.cos(frame * 0.017 + seed * 1.7) * 2.6 * drift;
  const dr = Math.sin(frame * 0.012 + seed * 0.6) * 0.45 * drift;

  let ex = 0, ey = 0, sc = 1, rot = 0, op = 1;
  let clip: string | undefined;
  switch (enter) {
    case 'pop':
      sc = interpolate(raw, [0, 1], [0.55, 1]);
      op = interpolate(raw, [0, 0.35], [0, 1], clamp);
      break;
    case 'place': // dropped onto the paper by hand: shrinks + settles its rotation
      sc = interpolate(raw, [0, 1], [1.28, 1]);
      rot = interpolate(raw, [0, 1], [rotate > 0 ? 7 : -7, 0]);
      op = interpolate(raw, [0, 0.25], [0, 1], clamp);
      break;
    case 'slide-l':
      ex = interpolate(raw, [0, 1], [-w * 0.55 - 120, 0]);
      op = interpolate(raw, [0, 0.4], [0, 1], clamp);
      rot = interpolate(raw, [0, 1], [-3, 0]);
      break;
    case 'slide-r':
      ex = interpolate(raw, [0, 1], [w * 0.55 + 120, 0]);
      op = interpolate(raw, [0, 0.4], [0, 1], clamp);
      rot = interpolate(raw, [0, 1], [3, 0]);
      break;
    case 'rise':
      ey = interpolate(raw, [0, 1], [90, 0]);
      op = interpolate(raw, [0, 0.5], [0, 1], clamp);
      break;
    case 'wipe':
      clip = `inset(0 ${interpolate(raw, [0, 1], [100, 0])}% 0 0)`;
      break;
    case 'fade':
      op = raw;
      sc = interpolate(raw, [0, 1], [1.04, 1]);
      break;
    case 'none':
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        zIndex: z,
        opacity: op,
        clipPath: clip,
        transform: `translate(-50%, -50%) translate(${-offX * depth + ex + dx}px, ${-offY * depth + ey + dy}px) rotate(${rotate + rot + dr}deg) scale(${sc})`,
      }}
    >
      {children}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Cutout — transparent PNG placed on the paper: white sticker edge + soft shadow.
// -----------------------------------------------------------------------------
export const Cutout: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  at?: number;
  dur?: number;
  enter?: Enter;
  rotate?: number;
  depth?: number;
  drift?: number;
  sticker?: number; // white outline px (0 = none)
  shadow?: number; // 0..3 elevation
  z?: number;
  style?: LayerStyle; // 'plain' (default, unchanged) | 'torn' (T10: torn paper + washi)
  tornSeed?: number; // stable per-layer torn silhouette seed; defaults to the layer seed
  tape?: boolean | number; // torn only: pin a washi strip. true = default corner, or give an index
}> = ({ src, x, y, w, at = 0, dur = 14, enter = 'place', rotate, depth, drift = 1, sticker = 5, shadow = 2, z, style = 'plain', tornSeed, tape = true }) => {
  const frame = useCurrentFrame();
  const s = sticker;
  const outline = s > 0
    ? `drop-shadow(${s}px 0 0 ${VOX.cream}) drop-shadow(-${s}px 0 0 ${VOX.cream}) drop-shadow(0 ${s}px 0 ${VOX.cream}) drop-shadow(0 -${s}px 0 ${VOX.cream}) `
    : '';
  const soft = shadow > 0 ? `drop-shadow(0 ${8 * shadow}px ${10 * shadow}px rgba(40,28,12,${0.14 + 0.07 * shadow}))` : '';

  if (style === 'torn') {
    // Torn-paper treatment: a cream backing card with feDisplacementMap-roughened
    // edges sits UNDER the die-cut; the die-cut keeps its clean alpha. The card
    // settles with a deterministic prog() pop synced to the Layer entrance.
    const seed = tornSeed ?? seedOf(x, y);
    const id = `torn-${seed}-${Math.round(x)}x${Math.round(y)}`;
    const settle = prog(frame, at, at + Math.max(dur, 12));
    const pop = interpolate(settle, [0, 1], [1.03, 1]); // gentle paper settle
    return (
      <Layer x={x} y={y} w={w} at={at} dur={dur} enter={enter} rotate={rotate} depth={depth} drift={drift} z={z}>
        <div style={{ position: 'relative', width: w, transform: `scale(${pop})` }}>
          <TornBacking id={id} seed={seed} scale={11} baseFrequency={0.035} shadow />
          <Img src={src} style={{ position: 'relative', width: '100%', display: 'block' }} />
          {tape ? (
            <WashiTape
              x={-w * 0.06}
              y={-w * 0.045}
              len={w * 0.34}
              thick={w * 0.085}
              angle={typeof tape === 'number' && tape % 2 === 1 ? 32 : -36}
              color={WASHI.blush}
              at={at + 4}
              seed={seed}
              drift={drift}
            />
          ) : null}
        </div>
      </Layer>
    );
  }

  return (
    <Layer x={x} y={y} w={w} at={at} dur={dur} enter={enter} rotate={rotate} depth={depth} drift={drift} z={z}>
      <Img src={src} style={{ width: '100%', display: 'block', filter: outline + soft }} />
    </Layer>
  );
};

// -----------------------------------------------------------------------------
// ArchivalPhoto — bordered photo print, duotone/sepia treatment, optional tape.
// -----------------------------------------------------------------------------
export const ArchivalPhoto: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  at?: number;
  dur?: number;
  enter?: Enter;
  rotate?: number;
  depth?: number;
  drift?: number;
  tape?: boolean;
  treatment?: 'sepia' | 'mono' | 'none';
  caption?: string;
  z?: number;
  style?: LayerStyle; // 'plain' (default, unchanged) | 'torn' (T10: torn border + washi)
  tornSeed?: number; // stable torn silhouette seed
}> = ({ src, x, y, w, at = 0, dur = 14, enter = 'place', rotate = -2, depth, drift = 1, tape = true, treatment = 'sepia', caption, z, style = 'plain', tornSeed }) => {
  const filt =
    treatment === 'sepia' ? 'grayscale(1) sepia(0.42) contrast(1.06) brightness(0.97)'
    : treatment === 'mono' ? 'grayscale(1) contrast(1.1)'
    : undefined;
  const tapeStyle: React.CSSProperties = {
    position: 'absolute',
    width: w * 0.22,
    height: w * 0.07,
    background: 'rgba(232,222,196,0.75)',
    boxShadow: '0 1px 4px rgba(40,28,12,0.18)',
  };

  if (style === 'torn') {
    // Torn photo print: roughen the white border card's edges (keep the print
    // clean), lift it off the paper with the two-shadow stack, pin with washi.
    const seed = tornSeed ?? seedOf(x, y);
    const id = `torn-${seed}-${Math.round(x)}x${Math.round(y)}-ph`;
    return (
      <Layer x={x} y={y} w={w} at={at} dur={dur} enter={enter} rotate={rotate} depth={depth} drift={drift} z={z}>
        <div style={{ position: 'relative', width: w }}>
          <TornBacking id={id} seed={seed} scale={12} baseFrequency={0.03} shadow />
          <div style={{ position: 'relative', background: VOX.cream, padding: w * 0.035, paddingBottom: caption ? w * 0.035 : w * 0.05 }}>
            <Img src={src} style={{ width: '100%', display: 'block', filter: filt }} />
            {caption ? (
              <div style={{ fontFamily: FONT_BODY_H, fontSize: w * 0.042, fontWeight: 500, color: VOX.inkSoft, paddingTop: w * 0.028, letterSpacing: 0.4 }}>
                {caption}
              </div>
            ) : null}
          </div>
          {tape ? (
            <WashiTape
              x={-w * 0.05}
              y={-w * 0.04}
              len={w * 0.34}
              thick={w * 0.09}
              angle={-34}
              color={WASHI.sage}
              at={at + 4}
              seed={seed}
              drift={drift}
            />
          ) : null}
        </div>
      </Layer>
    );
  }

  return (
    <Layer x={x} y={y} w={w} at={at} dur={dur} enter={enter} rotate={rotate} depth={depth} drift={drift} z={z}>
      <div style={{ background: VOX.cream, padding: w * 0.035, paddingBottom: caption ? w * 0.035 : w * 0.05, boxShadow: '0 16px 34px rgba(40,28,12,0.3)' }}>
        <Img src={src} style={{ width: '100%', display: 'block', filter: filt }} />
        {caption ? (
          <div style={{ fontFamily: FONT_BODY_H, fontSize: w * 0.042, fontWeight: 500, color: VOX.inkSoft, paddingTop: w * 0.028, letterSpacing: 0.4 }}>
            {caption}
          </div>
        ) : null}
      </div>
      {tape ? (
        <>
          <div style={{ ...tapeStyle, top: -w * 0.02, left: -w * 0.05, transform: 'rotate(-38deg)' }} />
          <div style={{ ...tapeStyle, top: -w * 0.02, right: -w * 0.05, transform: 'rotate(35deg)' }} />
        </>
      ) : null}
    </Layer>
  );
};

// -----------------------------------------------------------------------------
// PaperBG — the board surface: texture image (preferred) or flat cream, plus
// fibre grain and a soft vignette. Size it to the full canvas, depth ~ -0.06.
// -----------------------------------------------------------------------------
export const PaperBG: React.FC<{ src?: string; w: number; h: number; depth?: number }> = ({ src, w, h, depth = -0.06 }) => {
  const { offX, offY } = useContext(CamCtx);
  return (
    <div
      style={{
        position: 'absolute',
        left: -w * 0.05,
        top: -h * 0.05,
        width: w * 1.1,
        height: h * 1.1,
        background: VOX.paper,
        transform: `translate(${-offX * depth}px, ${-offY * depth}px)`,
      }}
    >
      {src ? <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 46%, rgba(52,38,18,0.24) 100%)' }} />
    </div>
  );
};

// Film grain over EVERYTHING (mount last, outside the board). Re-seeds every 2 frames.
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'multiply', opacity }}>
      <svg width="100%" height="100%">
        <filter id="voxgrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2)} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#voxgrain)" />
      </svg>
    </AbsoluteFill>
  );
};

// -----------------------------------------------------------------------------
// LabelChip — the white annotation tag (place names, dates, stats).
// -----------------------------------------------------------------------------
export const LabelChip: React.FC<{
  text: string;
  x: number;
  y: number;
  at?: number;
  size?: number;
  rotate?: number;
  accent?: string; // left bar color; omit for plain
  kicker?: string; // tiny overline
  kickerColor?: string; // defaults to accent — override when the accent is too light
  //                       for text on cream (e.g. VOX.yellow)
  depth?: number;
  z?: number;
  rtl?: boolean; // right-to-left (Hebrew)
}> = ({ text, x, y, at = 0, size = 30, rotate = -1.5, accent, kicker, kickerColor, depth = 0.02, z, rtl = false }) => (
  <Layer x={x} y={y} w={size * text.length * 0.75 + 60} at={at} dur={10} enter="pop" rotate={rotate} depth={depth} drift={0.7} z={z}>
    <div
      style={{
        display: 'inline-block',
        background: VOX.cream,
        borderLeft: accent ? `${Math.max(5, size * 0.2)}px solid ${accent}` : undefined,
        padding: `${size * 0.38}px ${size * 0.65}px`,
        boxShadow: '0 6px 16px rgba(40,28,12,0.25)',
        whiteSpace: 'nowrap',
        direction: rtl ? 'rtl' : 'ltr',
      }}
    >
      {kicker ? (
        <div style={{ fontFamily: FONT_BODY_H, fontSize: size * 0.52, fontWeight: 600, letterSpacing: 2.2, color: kickerColor ?? accent ?? VOX.red, textTransform: 'uppercase', margin: 0 }}>
          {kicker}
        </div>
      ) : null}
      <div style={{ fontFamily: FONT_BODY_H, fontSize: size, fontWeight: 600, color: VOX.ink, margin: 0, lineHeight: 1.15 }}>{text}</div>
    </div>
  </Layer>
);

// -----------------------------------------------------------------------------
// SerifStatement — the big editorial line; each word rises in, optional words
// get a marker-highlight sweep once the line has landed.
// -----------------------------------------------------------------------------
export const SerifStatement: React.FC<{
  words: { t: string; hl?: boolean }[];
  x: number;
  y: number;
  w: number;
  at?: number;
  size?: number;
  color?: string;
  hlColor?: string;
  align?: 'left' | 'center';
  backing?: boolean; // cream strips behind every word — REQUIRED over busy layers (maps,
  //                    photos): bare ink and the yellow sweep both die against sepia tones
  depth?: number;
  z?: number;
  rtl?: boolean; // right-to-left (Hebrew): order words right-to-left
}> = ({ words, x, y, w, at = 0, size = 64, color = VOX.ink, hlColor = VOX.yellow, align = 'center', backing = false, depth = 0.03, z, rtl = false }) => {
  const frame = useCurrentFrame();
  const allIn = at + words.length * 3 + 10;
  return (
    <Layer x={x} y={y} w={w} at={at} dur={1} enter="none" depth={depth} drift={0.5} z={z}>
      <div style={{ fontFamily: FONT_EDITORIAL_H, fontSize: size, fontWeight: 700, color, textAlign: align, direction: rtl ? 'rtl' : 'ltr', lineHeight: backing ? 1.42 : 1.22, margin: 0 }}>
        {words.map((wd, i) => {
          const p = interpolate(frame, [stagger(i, at, 3), stagger(i, at, 3) + 9], [0, 1], { easing: EASE_OUT, ...clamp });
          const sweep = wd.hl ? interpolate(frame, [allIn, allIn + 12], [0, 100], { easing: EASE_INOUT, ...clamp }) : 0;
          const bg = wd.hl
            ? `linear-gradient(to right, ${hlColor} ${sweep}%, ${backing ? VOX.cream : 'transparent'} ${sweep}%)`
            : backing
              ? VOX.cream
              : undefined;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: p,
                transform: `translateY(${(1 - p) * 24}px)`,
                marginRight: backing ? size * 0.14 : size * 0.26,
                background: bg,
                padding: backing ? `${size * 0.06}px ${size * 0.18}px` : wd.hl ? `0 ${size * 0.08}px` : undefined,
                boxShadow: backing ? '0 5px 14px rgba(40,28,12,0.22)' : undefined,
              }}
            >
              {wd.t}
            </span>
          );
        })}
      </div>
    </Layer>
  );
};

// -----------------------------------------------------------------------------
// RubberStamp — red official stamp that slams onto the collage (bans, verdicts,
// dates). Keep text short and uppercase-worthy; it renders uppercase regardless.
// -----------------------------------------------------------------------------
export const RubberStamp: React.FC<{
  text: string;
  x: number;
  y: number;
  at?: number;
  size?: number;
  color?: string;
  rotate?: number;
  depth?: number;
  z?: number;
}> = ({ text, x, y, at = 0, size = 72, color = VOX.red, rotate = -11, depth = 0.04, z }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 7], [0, 1], { easing: EASE_PLACE, ...clamp });
  return (
    <Layer x={x} y={y} w={size * text.length + 120} at={at} dur={1} enter="none" rotate={rotate} depth={depth} drift={0.4} z={z}>
      <div
        style={{
          display: 'inline-block',
          opacity: interpolate(p, [0, 0.4, 1], [0, 0.95, 0.88]),
          transform: `scale(${interpolate(p, [0, 1], [2.1, 1])})`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_EDITORIAL_H,
            fontWeight: 900,
            fontSize: size,
            letterSpacing: size * 0.08,
            textTransform: 'uppercase',
            color,
            border: `${Math.max(5, size * 0.09)}px solid ${color}`,
            borderRadius: size * 0.12,
            padding: `${size * 0.12}px ${size * 0.3}px`,
            whiteSpace: 'nowrap',
            mixBlendMode: 'multiply',
            margin: 0,
          }}
        >
          {text}
        </div>
      </div>
    </Layer>
  );
};

// -----------------------------------------------------------------------------
// SketchArrow / DashedRoute — hand-annotation strokes that draw themselves on.
// Both take a raw SVG path in CANVAS coordinates (vb = canvas w/h).
// -----------------------------------------------------------------------------
export const SketchArrow: React.FC<{
  d: string;
  vb: { w: number; h: number };
  at?: number;
  dur?: number;
  color?: string;
  width?: number;
  dashed?: boolean;
  head?: boolean;
  id: string; // unique per instance (mask id)
  z?: number;
}> = ({ d, vb, at = 0, dur = 20, color = VOX.red, width = 7, dashed = false, head = true, id, z }) => {
  const frame = useCurrentFrame();
  const prog = interpolate(frame, [at, at + dur], [0, 1], { easing: EASE_INOUT, ...clamp });
  if (frame < at || prog <= 0.001) return null;
  const evolved = evolvePath(prog, d);
  const len = getLength(d);
  const tip = getPointAtLength(d, len * prog);
  const back = getPointAtLength(d, Math.max(0, len * prog - 26));
  if (!tip || !back) return null; // getPointAtLength can return null — guard, no visual change
  const ang = (Math.atan2(tip.y - back.y, tip.x - back.x) * 180) / Math.PI;
  return (
    <svg viewBox={`0 0 ${vb.w} ${vb.h}`} style={{ position: 'absolute', left: 0, top: 0, width: vb.w, height: vb.h, overflow: 'visible', zIndex: z }}>
      {dashed ? (
        <>
          <mask id={id}>
            <path d={d} fill="none" stroke="#fff" strokeWidth={width * 3} strokeDasharray={evolved.strokeDasharray} strokeDashoffset={evolved.strokeDashoffset} />
          </mask>
          <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${width * 2.6} ${width * 2.2}`} mask={`url(#${id})`} />
        </>
      ) : (
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={evolved.strokeDasharray} strokeDashoffset={evolved.strokeDashoffset} />
      )}
      {head && prog > 0.06 ? (
        <g transform={`translate(${tip.x}, ${tip.y}) rotate(${ang})`}>
          <path d={`M 0 0 L ${-width * 3.2} ${-width * 1.9} M 0 0 L ${-width * 3.2} ${width * 1.9}`} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />
        </g>
      ) : null}
    </svg>
  );
};
