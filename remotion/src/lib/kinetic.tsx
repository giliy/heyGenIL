// Kinetic captions — word-staggered entrance built on the SAME .words.json
// contract the existing caption renderers consume (lib/shorts.tsx: TimedWord[]
// = [{w, start, end}, ...] in SECONDS, logical/spoken order, never reversed).
//
// Unlike CaptionsPop (fade+scale pop) and CaptionsPill (karaoke pill), each
// word here enters with an individual spring(): a gentle overshoot driven by
// OVERSHOOT_EASE (Easing.bezier) mapped over the spring's 0..1 progress, so the
// word slightly passes its rest scale/position and settles back — the classic
// kinetic-typography snap. All motion derives from useCurrentFrame() vs the
// word's own start time: deterministic, frame-repeat safe, no wall-clock.
//
// RTL contract (identical to lib/shorts.tsx):
//   - Word ORDER comes from the timing array — always logical (spoken) order.
//     NEVER reverse the array: direction:'rtl' on the container lays logical
//     order out right-to-left via the bidi algorithm; reversing double-reverses.
//   - Every word <span> sets unicodeBidi:'isolate'.
//   - anchorRtl() (reused from lib/shorts.tsx) suffixes RLM on tokens whose
//     trailing punctuation or pure numeric/Latin runs would detach in RTL.
import React from 'react';
import { Easing, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_DISPLAY, FONT_HEBREW_CAPTION } from '../fonts';
import { anchorRtl, stripNikkud, type TimedWord } from './shorts';

// Gentle-overshoot curve: eases out fast, crests slightly past 1, settles back.
// Applied over spring progress so the entrance overshoots without the spring
// itself needing an underdamped (bouncy) config — the overshoot amount stays
// visually consistent across words regardless of their stagger.
const OVERSHOOT_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

export type KineticWordStyle = {
  /** Frame-relative entrance values for one word at the current frame. */
  opacity: number; // 0 → 1
  scale: number; // fromScale → (1 + overshoot) → 1
  translateY: number; // risePx → 0 (positive = starts below rest position)
};

/**
 * Frame math for one word's entrance, driven by the word's own start time.
 * - `delay` is the word's start converted to frames — the spring begins exactly
 *   when the word is spoken (that IS the stagger: no artificial index delay).
 * - Spring config is snappy-but-soft (damping ~14 lets OVERSHOOT_EASE supply the
 *   visible overshoot); progress is then mapped through OVERSHOOT_EASE.
 * Pure function of (frame, fps, startSec) — exported for tests/proofs.
 */
export const kineticWordStyle = (
  frame: number,
  fps: number,
  startSec: number,
  opts: { risePx?: number; fromScale?: number } = {},
): KineticWordStyle => {
  const { risePx = 26, fromScale = 0.6 } = opts;
  const s = spring({
    frame,
    fps,
    delay: Math.round(startSec * fps),
    config: { damping: 14, mass: 0.6, stiffness: 170 },
  });
  const e = OVERSHOOT_EASE(s); // 0 → ~1.06 (overshoot) → 1
  return {
    opacity: Math.min(1, s * 1.6), // fade completes before scale settles
    scale: fromScale + (1 - fromScale) * e,
    translateY: (1 - e) * risePx, // negative during overshoot = slight dip above rest
  };
};

export type KineticCaptionsProps = {
  /** Word timings — the parsed .words.json content (TimedWord[]), logical order. */
  words: TimedWord[];
  /** Vertical center of the caption block (px). Default 1280 (above the Shorts UI zone). */
  y?: number;
  /** Font size (px). Default 64. */
  size?: number;
  /** Color of the currently-spoken word. Default brand yellow. */
  accent?: string;
  /** Color of upcoming/already-spoken words. Default white. */
  baseColor?: string;
  /** Dark pill behind the words — for light scenes. Default false. */
  plate?: boolean;
  /** Right-to-left (Hebrew/Arabic): rtl container + Hebrew caption font + anchorRtl. */
  rtl?: boolean;
  /** Pixels a word rises from. Default 26. */
  risePx?: number;
  /** Seconds — hide the whole caption block once t >= cap (seamless loop tails). */
  cap?: number;
};

/**
 * Word-staggered kinetic captions: every word springs in at its own spoken
 * start time with a gentle overshoot, and the active word tints to `accent`.
 * Consumes the same timing data as <Captions> — pass one VO line's words (or a
 * phrase chunk); page/chunk across lines upstream exactly as CaptionsPop does
 * via chunkLines() if multi-line paging is needed.
 */
export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  words,
  y = 1280,
  size = 64,
  accent = '#f5d76e',
  baseColor = '#ffffff',
  plate = false,
  rtl = false,
  risePx = 26,
  cap,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cap !== undefined && t >= cap) return null;
  if (words.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: y,
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          columnGap: size * 0.26,
          rowGap: size * 0.14,
          maxWidth: '100%',
          direction: rtl ? 'rtl' : 'ltr', // bidi lays logical order out RTL — never reverse the array
          ...(plate
            ? {
                background: 'rgba(13,17,23,0.86)',
                borderRadius: 22,
                padding: `${size * 0.28}px ${size * 0.5}px`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
              }
            : {}),
        }}
      >
        {words.map((word, i) => {
          const { opacity, scale, translateY } = kineticWordStyle(frame, fps, word.start, { risePx });
          const isActive = t >= word.start && t < word.end + 0.05;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block', // transform on inline spans is ignored without this
                fontFamily: rtl ? FONT_HEBREW_CAPTION : FONT_DISPLAY,
                fontWeight: 700,
                fontSize: size,
                lineHeight: 1.15,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isActive ? accent : baseColor,
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                textShadow: '0 3px 26px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.5)',
                unicodeBidi: 'isolate', // one word's direction can't leak and drag neighbors
              }}
            >
              {rtl ? anchorRtl(stripNikkud(word.w)) : word.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
