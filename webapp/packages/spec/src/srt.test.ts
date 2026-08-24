// srt.test.ts — SubRip export. Pins the nikkud/RTL invariants: cues carry the ORIGINAL
// line.text (nikkud intact, logical order); stripNikkud is NEVER applied to the export.
import { describe, it, expect } from 'vitest';
import { buildSrt, formatSrtTimestamp } from './srt';
import type { Spec } from './types';

function specWithLines(lines: { text: string; start: number; end: number; words?: { w: string; start: number; end: number }[] }[]): Spec {
  return {
    id: 'srt1',
    title: 'SRT test',
    template: 'Short16Formy',
    engine: 'tsx',
    format: { width: 1080, height: 1920, fps: 30 },
    theme: {},
    voice: { engine: 'edge', voiceId: 'he-IL-AvriNeural', lines },
    scenes: [{ id: 's1', durationSec: 40, overlays: [] }],
    captions: { preset: 'pill', burnIn: true },
    meta: { revision: 0, updatedAt: '2026-08-22' },
  };
}

// Hebrew text WITH nikkud (vowel points U+0591–U+05C7 present).
const NIKKUD_LINE = 'צָרִיךְ לְהַחְתִּים הַרְבֵּה לֹקוּחוֹת?';

describe('formatSrtTimestamp', () => {
  it('formats HH:MM:SS,mmm', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(0.5)).toBe('00:00:00,500');
    expect(formatSrtTimestamp(3.23)).toBe('00:00:03,230');
    expect(formatSrtTimestamp(61.5)).toBe('00:01:01,500');
    expect(formatSrtTimestamp(3600)).toBe('01:00:00,000');
  });
  it('clamps negatives to 0', () => {
    expect(formatSrtTimestamp(-1)).toBe('00:00:00,000');
  });
});

describe('buildSrt — cue structure', () => {
  it('emits 1-based cue numbers + HH:MM:SS,mmm ranges', () => {
    const srt = buildSrt(specWithLines([
      { text: 'First line', start: 0.5, end: 3.23 },
      { text: 'Second line', start: 3.3, end: 7.71 },
    ]));
    const blocks = srt.trim().split('\n\n');
    expect(blocks.length).toBe(2);
    expect(blocks[0]).toBe('1\n00:00:00,500 --> 00:00:03,230\nFirst line');
    expect(blocks[1]).toBe('2\n00:00:03,300 --> 00:00:07,710\nSecond line');
  });

  it('returns empty string for a spec with no voice', () => {
    const s = specWithLines([]);
    delete (s as { voice?: unknown }).voice;
    expect(buildSrt(s)).toBe('');
  });

  it('still exports when burnIn:false (SRT is a separate file, not burned)', () => {
    const s = specWithLines([{ text: 'x', start: 0, end: 1 }]);
    s.captions = { preset: 'pill', burnIn: false };
    expect(buildSrt(s)).toContain('x');
  });

  it('clamps cue ends to durationSec', () => {
    const s = specWithLines([{ text: 'long', start: 1, end: 999 }]);
    const srt = buildSrt(s, { durationSec: 40 });
    expect(srt).toContain('00:00:40,000');
    expect(srt).not.toContain('999');
  });

  it('drops cues entirely past durationSec', () => {
    const s = specWithLines([
      { text: 'in', start: 1, end: 5 },
      { text: 'out', start: 100, end: 200 },
    ]);
    const srt = buildSrt(s, { durationSec: 40 });
    expect(srt).toContain('in');
    expect(srt).not.toContain('out');
  });
});

describe('buildSrt — RTL + nikkud (the pinned invariant)', () => {
  it('keeps the ORIGINAL line.text byte-for-byte — nikkud intact, logical order', () => {
    const s = specWithLines([{ text: NIKKUD_LINE, start: 0.5, end: 3.23 }]);
    const srt = buildSrt(s);
    // The cue text must equal the original line.text exactly — stripNikkud NOT applied.
    expect(srt).toContain(NIKKUD_LINE);
    // Confirm nikkud codepoints survived (a stripNikkud'd version would lack them).
    const cue = srt.trim().split('\n\n')[0].split('\n')[2];
    expect(cue).toBe(NIKKUD_LINE);
    expect(/[֑-ׇ]/.test(cue)).toBe(true); // nikkud present
  });

  it('never reverses logical word order for RTL lines', () => {
    const s = specWithLines([
      { text: 'צריך להחתים הרבה לקוחות?', start: 0.5, end: 3.23 },
      { text: 'טפסים על הנייר.', start: 3.3, end: 7.71 },
    ]);
    const srt = buildSrt(s);
    // Logical order: the first spoken line appears in cue 1, second in cue 2.
    const i1 = srt.indexOf('צריך להחתים הרבה לקוחות?');
    const i2 = srt.indexOf('טפסים על הנייר.');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
  });

  it('per-word mode emits one cue per word without reversing order', () => {
    const s = specWithLines([
      {
        text: 'hello world',
        start: 0,
        end: 1,
        words: [
          { w: 'hello', start: 0, end: 0.5 },
          { w: 'world', start: 0.5, end: 1 },
        ],
      },
    ]);
    const srt = buildSrt(s, { per: 'word' });
    const blocks = srt.trim().split('\n\n');
    expect(blocks.length).toBe(2);
    expect(blocks[0]).toContain('hello');
    expect(blocks[1]).toContain('world');
  });
});
