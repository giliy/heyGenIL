// reading.tsx — the READING-track kit (mode:"reading"): the big isolated pointed letter /
// syllable that is the "hero" of a teach beat. Mirrors how lib/ads.tsx is the ad-mode kit that
// non-ad shots never import — only /make-reading-short compositions import this file, so every
// other track's style stays untouched.
//
// North-star (research/hebrew-reading/00-findings.md §1+§4): highlight the WHOLE pointed letter,
// never the vowel mark alone; the pop cue is color PLUS scale, never color alone. The timing
// source is the SAME `t` the Captions units path uses (a global clock), so a tile and its caption
// pop together in exact sync with the spoken unit (vo[].units[] from gen_voice_reading.py).
//
// Display font stays Heebo/Rubik (pointed-safe, findings §4). If the per-mark pixel QA gate fails,
// swap ONLY the tile's fontFamily to a vendored FONT_NIKKUD_DISPLAY (SBL Hebrew) — captions
// unchanged. That fallback is conditional and NOT built here on spec.
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { EASE_OUT, prog, SAFE } from './shorts';
import { FONT_HEBREW, FONT_HEBREW_CAPTION, FONT_BODY_H } from '../fonts';
import { COLORS } from '../brand';

// Re-export the shared grapheme splitter so reading comps have one import site. The splitter
// MUST match tools/nikkud.py graphemes(); the authoritative split is the one baked into
// vo[].units[].g — this is the display-side mirror only.
export { graphemeSpans } from './shorts';

// Display-face selection for the per-mark pixel QA gate (findings §4): the gate renders each
// mark in BOTH candidate faces and reads them. 'rubik' = the caption face (Rubik-900 stack),
// 'heebo' = the Hebrew display face (Heebo-700 stack). Default rubik (FONT_HEBREW_CAPTION).
export type TileFont = 'rubik' | 'heebo';
const TILE_FONT: Record<TileFont, { family: string; weight: number }> = {
  rubik: { family: FONT_HEBREW_CAPTION, weight: 900 }, // Rubik 900 (vendored hebrew+latin)
  heebo: { family: FONT_HEBREW, weight: 700 }, // Heebo 700 (vendored hebrew+latin)
};

// Split a pointed grapheme's codepoints into the base letter and its combining marks, so the
// target nikkud sign can be drawn in a STABLE accent color (so the child learns to find the
// sign) layered over the neutral letter. Pure codepoint partition — no font hack.
//   base  = the Hebrew letter(s)
//   marks = the combining nikkud / dagesh / shin-dot codepoints
const splitGrapheme = (g: string): { base: string; marks: string } => {
  let base = '';
  let marks = '';
  for (const ch of g) {
    if (/[א-ת]/.test(ch)) base += ch; // Hebrew letter U+05D0–U+05EA
    else marks += ch; // combining mark (nikkud / dagesh / shin-dot)
  }
  return { base, marks };
};

// ─── GraphemeTile ────────────────────────────────────────────────────────────
// The big isolated pointed letter. Props per master plan §3.3. Same timing source as Captions:
// `soundWindow` (from vo[].units[]) is the pop/tint window; the tile springs in at `at`, then
// scale-pops + tints while the global clock is inside soundWindow.
export const GraphemeTile: React.FC<{
  g: string; // pointed grapheme, e.g. "בָּ"
  at: number; // seconds (global) when the tile enters
  soundWindow?: { start: number; end: number }; // from vo[].units[] — the pop/tint window
  nikkudColor?: string; // stable color for the target sign (default brand accent)
  accent?: string; // "sounding now" highlight color (default warn yellow)
  size?: number; // px font-size — default sized for the MARK's legibility (findings §4/B)
  y?: number; // vertical CENTER; default SAFE-clear
  showSoundLabel?: boolean; // small Latin/phonetic label under the tile (never uppercased)
  label?: string; // the phonetic label text (e.g. "ba"); required if showSoundLabel
  font?: TileFont; // display face (QA gate A/B); default 'rubik'
  colorNikkud?: boolean; // draw the target sign in nikkudColor (default true when nikkudColor set)
}> = ({
  g,
  at,
  soundWindow,
  nikkudColor = COLORS.accent,
  accent = COLORS.warn,
  size = 340,
  y = 760,
  showSoundLabel = false,
  label,
  font = 'rubik',
  colorNikkud,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const face = TILE_FONT[font];

  // Entrance: brand spring in at `at` (snappy, no overshoot).
  const enter = spring({
    frame: frame - Math.round(at * fps),
    fps,
    config: { damping: 200, mass: 0.8, stiffness: 120, overshootClamping: true },
  });
  if (enter <= 0.005) return null;

  // Sound-window pop: while the global clock is inside [start,end), tint + scale up. This is
  // the SAME t the Captions units path reads, so tile + caption pop together.
  const sounding = soundWindow ? t >= soundWindow.start && t < soundWindow.end + 0.04 : false;
  // Redundant cue (never color alone): color AND scale. Scale eases in on onset.
  const popP = soundWindow ? EASE_OUT(prog(t, soundWindow.start, soundWindow.start + 0.08)) : 0;
  const scale = enter * (1 + 0.16 * popP);
  const letterColor = sounding ? accent : '#ffffff';

  const colorSign = colorNikkud ?? true;
  const { base, marks } = splitGrapheme(g);
  const hasMarks = marks.length > 0;

  const glyphStyle: React.CSSProperties = {
    fontFamily: face.family,
    fontWeight: face.weight,
    fontSize: size,
    lineHeight: 1.5, // kidsNikkud rule, always on: the below-letter point never clips
    textTransform: 'none', // a Latin sound-label must NOT be uppercased
    direction: 'rtl',
    unicodeBidi: 'isolate',
    textShadow: '0 6px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
    whiteSpace: 'pre',
    // NO letterSpacing here: a non-zero tracking forces Blink to break the text into
    // per-grapheme shaping runs, which DETACHES a combining ניקוד from its base letter
    // (the אבא / רוֹן defect). We keep base+marks in ONE text run (below) and zero tracking
    // so the font's own mark anchors position the sign correctly.
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: SAFE.left,
        right: SAFE.right,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(-50%) scale(${scale})`,
        opacity: enter,
        direction: 'rtl',
      }}
    >
      {/* The pointed glyph, two-layer overlay so the target sign keeps its OWN stable color.
          Each layer draws base + marks as ONE text run (never split into sibling spans) so Blink
          shapes them as a single cluster and the ניקוד stays anchored to its letter.
          UNDER layer: whole grapheme in letterColor. OVER layer (absolutely stacked, identical
          font metrics so the marks register at EXACTLY the same position): whole grapheme with
          base transparent and marks in nikkudColor — painted on top, so the colored marks replace
          the letterColor marks beneath while the base stays letterColor. */}
      <div style={{ position: 'relative', ...glyphStyle, color: letterColor }}>
        <span style={glyphStyle}>{g}</span>
        {colorSign && hasMarks ? (
          <span
            aria-hidden
            style={{ ...glyphStyle, position: 'absolute', inset: 0, pointerEvents: 'none', textShadow: 'none' }}
          >
            {/* One shaping run: an INVISIBLE copy of the base immediately followed by the marks,
                both as adjacent text inside the SAME span. The invisible base gives the combining
                marks their anchor (so they sit exactly where the under-layer's marks sit), and the
                marks alone take nikkudColor. We never put the marks in their own detached element. */}
            <span style={{ color: nikkudColor }}>
              <span style={{ color: 'transparent' }}>{base}</span>
              {marks}
            </span>
          </span>
        ) : null}
      </div>

      {showSoundLabel && label ? (
        <div
          style={{
            marginTop: size * 0.10,
            fontFamily: FONT_BODY_H,
            fontWeight: 600,
            fontSize: Math.max(40, size * 0.18),
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: 2,
            textTransform: 'none', // Latin phonetic label — never uppercased (brand)
            direction: 'ltr',
            textShadow: '0 3px 18px rgba(0,0,0,0.6)',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

// ─── SyllableTile ────────────────────────────────────────────────────────────
// A CV צירוף (e.g. בָּ, מָּ, קָּ) — the teach-cv hero. Same contract as GraphemeTile; the prop
// is named `syllable` for call-site clarity. Renders identically (a syllable IS a grapheme or a
// grapheme cluster drawn as one unit).
export const SyllableTile: React.FC<{
  syllable: string; // a צירוף like "בָּ"
  at: number;
  soundWindow?: { start: number; end: number };
  nikkudColor?: string;
  accent?: string;
  size?: number;
  y?: number;
  showSoundLabel?: boolean;
  label?: string;
  font?: TileFont;
  colorNikkud?: boolean;
}> = ({ syllable, ...rest }) => <GraphemeTile g={syllable} {...rest} />;

// ─── TileMark ────────────────────────────────────────────────────────────────
// A STATIC, in-flow pointed mark for the per-mark pixel QA fixture (read-0-test). Unlike
// GraphemeTile it is NOT absolutely positioned and NOT animated — it renders inline so a grid
// can lay many marks out on one frame for the QA agent to read. Uses the SAME two-layer
// base/marks overlay so the target sign shows in its stable nikkudColor.
export const TileMark: React.FC<{
  g: string;
  size?: number;
  font?: TileFont;
  nikkudColor?: string;
  colorNikkud?: boolean;
}> = ({ g, size = 128, font = 'rubik', nikkudColor = COLORS.accent, colorNikkud = true }) => {
  const face = TILE_FONT[font];
  const { base, marks } = splitGrapheme(g);
  const hasMarks = marks.length > 0;
  const glyphStyle: React.CSSProperties = {
    fontFamily: face.family,
    fontWeight: face.weight,
    fontSize: size,
    lineHeight: 1.5, // the below-letter point never clips
    textTransform: 'none',
    direction: 'rtl',
    unicodeBidi: 'isolate',
    // NO letterSpacing: non-zero tracking forces per-grapheme shaping runs in Blink, detaching a
    // combining ניקוד from its base letter.
    whiteSpace: 'pre',
    textShadow: '0 4px 22px rgba(0,0,0,0.45)',
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...glyphStyle, color: '#ffffff' }}>
      {/* UNDER layer: whole grapheme as ONE text run in white so base+marks shape as a single
          cluster and the ניקוד stays anchored. OVER layer (stacked): an invisible copy of the base
          immediately followed by the marks in nikkudColor, adjacent inside the SAME span — the
          invisible base anchors the marks exactly where the under-layer's marks sit. */}
      <span style={glyphStyle}>{g}</span>
      {colorNikkud && hasMarks ? (
        <span aria-hidden style={{ ...glyphStyle, position: 'absolute', inset: 0, pointerEvents: 'none', textShadow: 'none' }}>
          <span style={{ color: nikkudColor }}>
            <span style={{ color: 'transparent' }}>{base}</span>
            {marks}
          </span>
        </span>
      ) : null}
    </div>
  );
};
