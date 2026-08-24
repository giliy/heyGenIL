// srt.ts — SubRip (.srt) subtitle export. Pure, unit-tested, shared by web (Download SRT)
// and worker. Phase 5.
//
// Derived from spec.voice.lines[] (one cue per line, default; a per-word toggle is P1).
// INVARIANTS (from phase-5-polish.md §Worker/C):
//   - Cue numbering is 1-based.
//   - Timestamps are HH:MM:SS,mmm (SubRip comma-millisecond form).
//   - Lines stay in LOGICAL (spoken) order — RTL-safe, NEVER reversed.
//   - Each cue carries the ORIGINAL line.text — NIKKUD INTACT. stripNikkud is display-only
//     (the on-screen caption burn); it is NEVER applied to the exported .srt (a standalone
//     subtitle artifact burned elsewhere). A unit test pins this byte-for-byte.
//   - If burnIn:false we still export (SRT is a separate file, not burned).
//   - Cues are clamped to the spec's total duration (durationSec).
import type { Spec, VoiceLine } from './types';
import { estimateWords, round3 } from './helpers';

export interface SrtOptions {
  /** Total duration in seconds; cues are clamped to [0, durationSec]. */
  durationSec?: number;
  /** 'line' (default) emits one cue per voice line; 'word' emits one cue per word. */
  per?: 'line' | 'word';
}

/** Format seconds as SubRip HH:MM:SS,mmm. */
export function formatSrtTimestamp(sec: number): string {
  const clamped = Math.max(0, sec);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

interface Cue {
  text: string;
  start: number;
  end: number;
}

/**
 * Build the cue list from a spec's voice lines. Falls back to estimateWords timing when a
 * line has no real word times and we emit per-word cues. Keeps logical order (no reversal).
 */
function buildCues(spec: Spec, opts: SrtOptions): Cue[] {
  const lines = spec.voice?.lines ?? [];
  const per = opts.per ?? 'line';
  const cues: Cue[] = [];
  for (const line of lines) {
    if (per === 'word') {
      // Prefer real word times; fall back to the engine's timeWords estimate for the line.
      const words =
        line.words && line.words.length > 0 ? line.words : estimateWords(line as VoiceLine);
      for (const w of words) {
        cues.push({ text: w.w, start: w.start, end: w.end });
      }
    } else {
      // Per-line (default). Use the line's own window; if a line lacks explicit times but has
      // words, span the words. Otherwise use line.start/end.
      let start = line.start;
      let end = line.end;
      cues.push({ text: line.text, start, end });
    }
  }
  return cues;
}

/**
 * Build a SubRip (.srt) string from a spec. Cue text = the ORIGINAL line.text (nikkud intact,
 * logical order). stripNikkud is NOT applied here. Returns '' for a spec with no voice lines.
 */
export function buildSrt(spec: Spec, opts: SrtOptions = {}): string {
  const durationSec = opts.durationSec ?? Number.POSITIVE_INFINITY;
  const cues = buildCues(spec, opts);
  if (cues.length === 0) return '';

  const blocks: string[] = [];
  cues.forEach((cue, i) => {
    // Clamp to [0, durationSec]; drop cues that fall entirely outside the duration.
    const start = Math.max(0, Math.min(round3(cue.start), durationSec));
    const end = Math.max(start, Math.min(round3(cue.end), durationSec));
    if (cue.start > durationSec) return; // entirely past the end
    if (end <= start) return; // zero/negative span after clamp — skip
    blocks.push(`${i + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${cue.text}`);
  });

  return blocks.join('\n\n') + '\n';
}
