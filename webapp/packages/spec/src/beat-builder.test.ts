import { describe, it, expect } from 'vitest';
import {
  buildBeatsFromLines,
  topicToLines,
  estimateLineSec,
} from './beat-builder';

describe('beat-builder', () => {
  it('estimateLineSec scales with word count and respects the floor', () => {
    expect(estimateLineSec('hi')).toBe(0.9); // below floor
    expect(estimateLineSec('one two three four five six seven eight')).toBeCloseTo(8 / 2.7 + 0.3, 5);
  });

  it('buildBeatsFromLines is deterministic (same lines => same timings)', () => {
    const lines = [{ text: 'a b c' }, { text: 'd e f g h' }];
    const a = buildBeatsFromLines(lines, { id: 'x', title: 't' });
    const b = buildBeatsFromLines(lines, { id: 'x', title: 't' });
    expect(a).toEqual(b);
  });

  it('buildBeatsFromLines preserves the locked text verbatim', () => {
    const text = 'SMOKE-EDITED: seven lemons for a single token.';
    const beats = buildBeatsFromLines([{ text }], { id: 'gen-x', title: 'Lemons' });
    expect(beats.vo).toHaveLength(1);
    expect(beats.vo[0].text).toBe(text);
    expect(beats.beats[0].start_s).toBe(beats.vo[0].start);
    expect(beats.beats[0].end_s).toBe(beats.vo[0].end);
  });

  it('buildBeatsFromLines: lines are contiguous, ordered, and durationSec = last end', () => {
    const lines = [{ text: 'first line here' }, { text: 'second line here' }, { text: 'third' }];
    const beats = buildBeatsFromLines(lines, { id: 'x', title: 't' });
    expect(beats.vo).toHaveLength(3);
    expect(beats.beats).toHaveLength(3);
    for (let i = 1; i < beats.vo.length; i++) {
      expect(beats.vo[i].start).toBeGreaterThan(beats.vo[i - 1].end);
    }
    expect(beats.format.durationSec).toBe(beats.vo[beats.vo.length - 1].end);
  });

  it('topicToLines returns a 6-line beat template seeded by the topic', () => {
    const lines = topicToLines('email marketing');
    expect(lines).toHaveLength(6);
    expect(lines.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(lines.some((l) => l.includes('email marketing'))).toBe(true);
  });

  it('topicToLines prefers title over topic', () => {
    const lines = topicToLines('email marketing', 'Inbox Zero');
    expect(lines[0]).toContain('Inbox Zero');
  });
});
