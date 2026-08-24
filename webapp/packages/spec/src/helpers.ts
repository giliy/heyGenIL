// Pure, unit-testable spec helpers shared by the editor (web) and the validators/worker.
// No I/O, no framework deps — safe to import anywhere. These encode the cross-phase
// invariants from _shared-decisions.md so editor code and the validator agree.
import type { Spec, Scene, Overlay, VoiceLine, VoiceWord } from './types';

/**
 * A scene's duration in seconds. Trivial, but keeps ONE source of truth so the editor,
 * the validator, and calculateMetadata never drift on what "scene length" means.
 */
export function sceneDurationSec(scene: Pick<Scene, 'durationSec'>): number {
  return scene.durationSec;
}

/** Total spec duration in seconds (scenes are back-to-back, no inter-scene gaps). */
export function totalDurationSec(spec: Pick<Spec, 'scenes'>): number {
  return spec.scenes.reduce<number>((acc, s) => acc + s.durationSec, 0);
}

/**
 * Total duration in frames. MUST equal the template's calculateMetadata (both compute
 * Math.round(sum(durationSec) * fps)). This is the preview==render length invariant.
 */
export function specToFrames(spec: Pick<Spec, 'scenes' | 'format'>): number {
  return Math.round(totalDurationSec(spec) * spec.format.fps);
}

/**
 * The global (composition) start second of a scene, given its index — the sum of all
 * preceding scenes' durations. Used to seek the Player to a scene.
 */
export function sceneStartSec(spec: Pick<Spec, 'scenes'>, sceneIndex: number): number {
  let acc = 0;
  for (let i = 0; i < sceneIndex && i < spec.scenes.length; i++) acc += spec.scenes[i].durationSec;
  return acc;
}

/** Clamp a number into [lo, hi]. */
const clampNum = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Clamp an overlay's scene-relative window into [0, durationSec], preserving the
 * start<end invariant (minimum span MIN_SPAN). Returns a NEW overlay (does not mutate).
 * Used by the range slider + duration stepper so `end` can never exceed the scene and
 * `start` never passes `end`.
 */
export function clampOverlayToScene<T extends Pick<Overlay, 'start' | 'end'>>(
  overlay: T,
  durationSec: number,
  minSpan = 0.1
): T {
  const dur = Math.max(minSpan, durationSec);
  let start = clampNum(overlay.start, 0, dur);
  let end = clampNum(overlay.end, 0, dur);
  if (end - start < minSpan) {
    // Prefer pushing `end` out; if that would exceed the scene, pull `start` back.
    end = Math.min(dur, start + minSpan);
    if (end - start < minSpan) start = Math.max(0, end - minSpan);
  }
  return { ...overlay, start: round3(start), end: round3(end) };
}

/** Round to milliseconds — keeps the spec JSON clean (no float noise from sliders). */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Fill spec defaults so a partial/old spec renders: captions.preset/burnIn, per-overlay
 * animation/opacity/rotation, captions.style. Returns a NEW spec (pure).
 */
export function normalizeSpec(spec: Spec): Spec {
  return {
    ...spec,
    captions: spec.captions
      ? { ...spec.captions, burnIn: spec.captions.burnIn ?? true, preset: spec.captions.preset ?? 'pop' }
      : { preset: 'pop', burnIn: true },
    scenes: spec.scenes.map((s) => ({
      ...s,
      overlays: s.overlays.map((ov) => ({
        ...ov,
        animation: ov.animation ?? 'none',
        opacity: ov.opacity ?? 1,
        rotation: ov.rotation ?? 0,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Bidi / RTL detection — the RTL full-line caption rule. A line is RTL if its first
// strong directional char is Hebrew (U+0590–U+05FF) or Arabic (U+0600–U+06FF etc).
// The preview must render RTL lines as FULL LINES (never token pops) per the engine
// contract (lib/shorts.tsx). We NEVER reverse word arrays — bidi handles ordering.
// ---------------------------------------------------------------------------

// First-strong bidi class scan: skip neutral/weak chars, return on first LTR or RTL strong.
const RTL_STRONG = /[֐-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_STRONG = /[A-Za-zÀ-ɏḀ-ỿ]/;

/** True if the text's first strong-directional character is RTL (Hebrew/Arabic). */
export function isRtlText(text: string): boolean {
  for (const ch of text) {
    if (RTL_STRONG.test(ch)) return true;
    if (LTR_STRONG.test(ch)) return false;
  }
  return false;
}

/** True if ANY caption line is RTL (drives the full-line render rule). */
export function specHasRtlCaptions(spec: Pick<Spec, 'voice'>): boolean {
  return (spec.voice?.lines ?? []).some((l) => isRtlText(l.text));
}

// ---------------------------------------------------------------------------
// Caption line editing — split / merge / nudge. These mirror the engine's timeWords
// estimate (lib/shorts.tsx) so a split redistributes word timings the SAME way the
// renderer would estimate them when no real word times exist.
// ---------------------------------------------------------------------------

/**
 * Estimate word timings for a line (the engine's timeWords estimate): distribute the
 * [start,end] window across words weighted by alpha-length. Used when a split/merge
 * produces a line with no real word times.
 */
export function estimateWords(line: Pick<VoiceLine, 'text' | 'start' | 'end'>): VoiceWord[] {
  const words = line.text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w) => Math.max(2, w.replace(/[^a-zA-Z0-9]/g, '').length) + 1.6);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = line.end - line.start;
  let t = line.start;
  return words.map((w, i) => {
    const d = (weights[i] / total) * span;
    const out = { w, start: round3(t), end: round3(t + d) };
    t += d;
    return out;
  });
}

/**
 * Split a caption line at a word index: words[0..wordIndex) become the first line,
 * words[wordIndex..] the second. Timings split at the boundary word's start; if the line
 * has real word times, each half keeps its own words; otherwise timings are re-estimated.
 * Returns [first, second] — caller splices into voice.lines.
 */
export function splitLineAtWord(line: VoiceLine, wordIndex: number): [VoiceLine, VoiceLine] {
  const words = line.text.split(/\s+/).filter(Boolean);
  const idx = Math.max(1, Math.min(wordIndex, words.length - 1)); // never empty halves
  const firstText = words.slice(0, idx).join(' ');
  const secondText = words.slice(idx).join(' ');

  const timed = line.words && line.words.length === words.length ? line.words : estimateWords(line);
  const firstWords = timed.slice(0, idx);
  const secondWords = timed.slice(idx);
  const splitAt = secondWords[0]?.start ?? line.start + (line.end - line.start) / 2;

  return [
    { text: firstText, start: round3(line.start), end: round3(splitAt), words: firstWords },
    { text: secondText, start: round3(splitAt), end: round3(line.end), words: secondWords },
  ];
}

/**
 * Split a caption line at a CHARACTER offset (Enter-to-split at the caret). Maps the
 * caret position to the nearest word boundary, then delegates to splitLineAtWord.
 */
export function splitLineAtChar(line: VoiceLine, charOffset: number): [VoiceLine, VoiceLine] {
  const words = line.text.split(/\s+/).filter(Boolean);
  // Walk the text to find which word the caret falls in.
  let acc = 0;
  let wordIndex = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    const wEnd = acc + words[i].length;
    // caret in the gap before this word, or inside it -> split BEFORE this word
    if (charOffset <= acc) {
      wordIndex = i;
      break;
    }
    if (charOffset <= wEnd) {
      // inside word i -> split after it if caret past the midpoint, else before
      const mid = acc + words[i].length / 2;
      wordIndex = charOffset > mid ? i + 1 : i;
      break;
    }
    acc = wEnd + 1; // +1 for the space
  }
  return splitLineAtWord(line, wordIndex);
}

/**
 * Merge two adjacent caption lines into one: text joined with a space, window spans
 * first.start..second.end, word arrays concatenated (kept in logical order — never
 * reversed, per the RTL contract).
 */
export function mergeLines(first: VoiceLine, second: VoiceLine): VoiceLine {
  const text = `${first.text} ${second.text}`.replace(/\s+/g, ' ').trim();
  const words =
    first.words || second.words
      ? [...(first.words ?? estimateWords(first)), ...(second.words ?? estimateWords(second))]
      : undefined;
  return { text, start: round3(first.start), end: round3(second.end), words };
}

/** Nudge a caption line's window by deltaSec, clamped to >= 0. Returns a NEW line. */
export function nudgeLine(line: VoiceLine, deltaSec: number): VoiceLine {
  const start = Math.max(0, round3(line.start + deltaSec));
  const end = Math.max(start + 0.05, round3(line.end + deltaSec));
  const words = line.words?.map((w) => ({
    w: w.w,
    start: round3(w.start + deltaSec),
    end: round3(w.end + deltaSec),
  }));
  return { ...line, start, end, words };
}

// ---------------------------------------------------------------------------
// Overlay factories + id generation (editor-side; keep ids unique + url-safe).
// ---------------------------------------------------------------------------

let counter = 0;
/** Collision-resistant overlay/scene id (time + counter + random). */
export function newId(prefix: string): string {
  counter = (counter + 1) % 10000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** A default text overlay at a centered slot on a 1080×1920 canvas. */
export function defaultTextOverlay(sceneDurationSec: number, content = 'New text'): Overlay {
  return clampOverlayToScene(
    {
      id: newId('ov'),
      type: 'text',
      content,
      style: { font: 'hebrew', size: 72, color: '#ffffff', weight: 700, align: 'center' },
      x: 140,
      y: 860,
      w: 800,
      h: 160,
      rotation: 0,
      opacity: 1,
      start: 0,
      end: Math.min(3, sceneDurationSec),
      animation: 'rise',
    },
    sceneDurationSec
  ) as Overlay;
}

/** A default image overlay at a centered slot, sized to the asset's aspect ratio. */
export function defaultImageOverlay(
  sceneDurationSec: number,
  src: string,
  assetId: string | undefined,
  assetW?: number | null,
  assetH?: number | null
): Overlay {
  const maxW = 800;
  let w = maxW;
  let h = maxW;
  if (assetW && assetH && assetW > 0 && assetH > 0) {
    w = Math.min(maxW, assetW);
    h = Math.round((w * assetH) / assetW);
  }
  return clampOverlayToScene(
    {
      id: newId('ov'),
      type: 'image',
      assetId,
      src,
      x: Math.round((1080 - w) / 2),
      y: Math.round((1920 - h) / 2),
      w,
      h,
      rotation: 0,
      opacity: 1,
      start: 0,
      end: Math.min(3, sceneDurationSec),
      animation: 'fade',
    },
    sceneDurationSec
  ) as Overlay;
}
