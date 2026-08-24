/**
 * annotation.tsx — the factory's hand-annotation idiom (highlight / underline /
 * circle / box / bracket / strike / crossed-off) built on @remotion/rough-notation.
 *
 * rough-notation renders rough-js-style annotations AROUND its children (a word,
 * a phrase, a price, a tile). The components take a `progress` (0→1) and a
 * `seed` — so we drive `progress` as a pure function of useCurrentFrame() and
 * pin `seed` for a stable wobble. That keeps pixels frame-deterministic while
 * giving the "edited by a human / marker-on-paper" look the vox + kids tracks
 * want, and the ad highlight-on-the-price moment.
 *
 * LICENSE NOTE: @remotion/rough-notation declares `"license": "MIT"` in its
 * package.json (author Jonny Burger / Remotion). The npm tarball does NOT ship a
 * LICENSE file (a packaging omission — the whole remotion/@remotion family uses
 * the MIT SPDX expression). We vendor a THIRD_PARTY_NOTICES entry to be explicit.
 *
 * RTL: Underline/StrikeThrough/CrossedOff/Highlight take an `rtl` prop; set it
 * for Hebrew so the stroke sweeps right-to-left with the reading direction.
 *
 * All wrappers below are frame-deterministic: `progress` = interpolate(frame),
 * `seed` defaults to a fixed value (change it only to pick a different wobble).
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import {
  Box as RNBox,
  Bracket as RNBracket,
  Circle as RNCircle,
  CrossedOff as RNCrossedOff,
  Highlight as RNHighlight,
  StrikeThrough as RNStrikeThrough,
  Underline as RNUnderline,
} from '@remotion/rough-notation';

/** Frames-to-progress helper: 0→1 across [at, at+dur], clamped. */
const useAnnotProgress = (at: number, dur: number): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

const FIXED_SEED = 7; // stable default wobble; override per element to vary

type Common = {
  /** Frame the annotation starts drawing. Default 0. */
  at?: number;
  /** Frames the draw-on takes. Default 14. */
  dur?: number;
  /** Rough-js wobble seed (fixed default → deterministic). */
  seed?: number;
  /** Stroke / fill color. */
  color?: string;
  /** Stroke width (px) where applicable. */
  strokeWidth?: number;
  /** Hebrew / RTL: sweep the stroke right-to-left. */
  rtl?: boolean;
  children: React.ReactNode;
};

/** Marker-highlight sweep behind the children (the kids / price hero move). */
export const AnnotateHighlight: React.FC<Common & { padding?: number }> = ({
  at = 0,
  dur = 14,
  seed = FIXED_SEED,
  color = '#f5d76e',
  rtl = false,
  padding = 2,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNHighlight progress={progress} seed={seed} color={color} rtl={rtl} padding={{ top: padding, bottom: padding, left: padding, right: padding }}>
      {children}
    </RNHighlight>
  );
};

/** Hand-drawn underline beneath the children. */
export const AnnotateUnderline: React.FC<Common & { padding?: number; iterations?: number }> = ({
  at = 0,
  dur = 14,
  seed = FIXED_SEED,
  color = '#e8879f',
  strokeWidth = 4,
  rtl = false,
  padding = 2,
  iterations,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNUnderline
      progress={progress}
      seed={seed}
      color={color}
      strokeWidth={strokeWidth}
      rtl={rtl}
      iterations={iterations}
      padding={{ top: padding }}
    >
      {children}
    </RNUnderline>
  );
};

/** Hand-drawn circle/ellipse around the children (the "watch this" call-out). */
export const AnnotateCircle: React.FC<Common & { padding?: number; iterations?: number }> = ({
  at = 0,
  dur = 16,
  seed = FIXED_SEED,
  color = '#6366f1',
  strokeWidth = 4,
  padding = 8,
  iterations,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNCircle
      progress={progress}
      seed={seed}
      color={color}
      strokeWidth={strokeWidth}
      iterations={iterations}
      padding={{ top: padding, bottom: padding, left: padding, right: padding }}
    >
      {children}
    </RNCircle>
  );
};

/** Hand-drawn box around the children. */
export const AnnotateBox: React.FC<Common & { padding?: number; iterations?: number }> = ({
  at = 0,
  dur = 16,
  seed = FIXED_SEED,
  color = '#4db8a8',
  strokeWidth = 3,
  padding = 8,
  iterations,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNBox
      progress={progress}
      seed={seed}
      color={color}
      strokeWidth={strokeWidth}
      iterations={iterations}
      padding={{ top: padding, bottom: padding, left: padding, right: padding }}
    >
      {children}
    </RNBox>
  );
};

/** Hand-drawn bracket(s) beside/around the children. */
export const AnnotateBracket: React.FC<
  Common & { padding?: number; bracketLeft?: boolean; bracketRight?: boolean; bracketTop?: boolean; bracketBottom?: boolean }
> = ({ at = 0, dur = 14, seed = FIXED_SEED, color = '#1a1a2e', strokeWidth = 3, padding = 6, children, ...sides }) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNBracket
      progress={progress}
      seed={seed}
      color={color}
      strokeWidth={strokeWidth}
      padding={{ top: padding, bottom: padding, left: padding, right: padding }}
      {...sides}
    >
      {children}
    </RNBracket>
  );
};

/** Hand-drawn strike-through (the "old price" / "the hard way" negation). */
export const AnnotateStrikeThrough: React.FC<Common & { iterations?: number }> = ({
  at = 0,
  dur = 12,
  seed = FIXED_SEED,
  color = '#e8879f',
  strokeWidth = 4,
  rtl = false,
  iterations,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNStrikeThrough progress={progress} seed={seed} color={color} strokeWidth={strokeWidth} rtl={rtl} iterations={iterations}>
      {children}
    </RNStrikeThrough>
  );
};

/** Hand-drawn crossed-off (X) over the children. */
export const AnnotateCrossedOff: React.FC<Common & { iterations?: number }> = ({
  at = 0,
  dur = 14,
  seed = FIXED_SEED,
  color = '#e8879f',
  strokeWidth = 4,
  rtl = false,
  iterations,
  children,
}) => {
  const progress = useAnnotProgress(at, dur);
  return (
    <RNCrossedOff progress={progress} seed={seed} color={color} strokeWidth={strokeWidth} rtl={rtl} iterations={iterations}>
      {children}
    </RNCrossedOff>
  );
};

// Re-export the raw components for shots that want to drive progress themselves.
export { RNHighlight, RNUnderline, RNCircle, RNBox, RNBracket, RNStrikeThrough, RNCrossedOff };
