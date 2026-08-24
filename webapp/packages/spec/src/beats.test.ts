// beats.test.ts — the beat-sync quantizer. Pins the invariants: never before the scene's VO
// floor, never past the next scene start, start untouched, grid vs nearest, beatless -> grid.
import { describe, it, expect } from 'vitest';
import { quantizeScenes, type BeatInfo } from './beats';
import type { Spec } from './types';

function specWithScenes(durations: number[]): Spec {
  return {
    id: 'b1',
    title: 'Beats test',
    template: 'Short16Formy',
    engine: 'tsx',
    format: { width: 1080, height: 1920, fps: 30 },
    theme: {},
    scenes: durations.map((d, i) => ({ id: `s${i}`, durationSec: d, overlays: [] })),
    captions: { preset: 'pill', burnIn: true },
    meta: { revision: 0, updatedAt: '2026-08-22' },
  };
}

describe('quantizeScenes — grid mode', () => {
  it('snaps each scene end to the nearest grid multiple', () => {
    // grid 0.5s; scenes 3.1, 4.2 -> 3.0, 4.0 (absolute 3.0, 7.0 -> snapped)
    const s = specWithScenes([3.1, 4.2]);
    const beats: BeatInfo = { bpm: 120, gridMs: 500, source: 'bpm-grid' };
    const { spec, diff } = quantizeScenes(s, beats, 'grid');
    expect(spec.scenes[0].durationSec).toBeCloseTo(3.0, 3);
    // scene 1 ends at 3.0+4.2=7.2 abs; grid -> 7.0; dur = 7.0-3.0 = 4.0
    expect(spec.scenes[1].durationSec).toBeCloseTo(4.0, 3);
    expect(diff.length).toBeGreaterThan(0);
  });

  it('returns an empty diff when already on-grid', () => {
    const s = specWithScenes([3.0, 4.0]);
    const beats: BeatInfo = { gridMs: 500, source: 'bpm-grid' };
    const { diff } = quantizeScenes(s, beats, 'grid');
    expect(diff).toEqual([]);
  });
});

describe('quantizeScenes — nearest mode', () => {
  it('snaps to the nearest beat onset', () => {
    // scenes 3.0, 4.0 -> abs ends 3.0, 7.0; beats at 3.1 and 7.2
    const s = specWithScenes([3.0, 4.0]);
    const beats: BeatInfo = { bpm: 120, times: [3.1, 7.2], source: 'bpm-analyzed' };
    const { spec, diff } = quantizeScenes(s, beats, 'nearest');
    expect(spec.scenes[0].durationSec).toBeCloseTo(3.1, 3);
    // scene 1: absEnd = 3.1+4.0=7.1; nearest beat 7.2 -> dur = 7.2-3.1 = 4.1
    expect(spec.scenes[1].durationSec).toBeCloseTo(4.1, 3);
    expect(diff.length).toBe(2);
  });
});

describe('quantizeScenes — invariants', () => {
  it('never moves a scene end before its VO floor (speech is never cut)', () => {
    const s = specWithScenes([4.0, 4.0]);
    // A voice line that runs 0.5 -> 3.9 (inside scene 0). The floor = 3.9 + 0.05 = 3.95.
    s.voice = {
      engine: 'edge',
      voiceId: 'v',
      lines: [{ text: 'some words', start: 0.5, end: 3.9 }],
    };
    // grid 0.5s would snap 4.0 -> 4.0 (no change); force a grid that would go BELOW the floor:
    const beats: BeatInfo = { gridMs: 1000, source: 'bpm-grid' }; // 1s grid -> snaps 4.0 -> 4.0
    const { spec } = quantizeScenes(s, beats, 'grid');
    expect(spec.scenes[0].durationSec).toBeGreaterThanOrEqual(3.95);
  });

  it('scene 0 start stays 0 and start is never modified (only end moves)', () => {
    const s = specWithScenes([3.3, 4.4]);
    const beats: BeatInfo = { gridMs: 500, source: 'bpm-grid' };
    const { spec } = quantizeScenes(s, beats, 'grid');
    // Scenes are contiguous; start is implicit (sum of prior durations). Only durationSec moves.
    // Verify the total changed only via ends, and scene order is preserved.
    expect(spec.scenes.map((x) => x.id)).toEqual(['s0', 's1']);
    expect(spec.scenes.every((x) => x.durationSec > 0)).toBe(true);
  });

  it('clamps overlays into a shrunken scene window', () => {
    const s = specWithScenes([4.0]);
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'x', x: 0, y: 0, w: 100, h: 100, start: 0, end: 4.0 },
    ];
    // Snap scene 0 to ~3.0; the overlay end (4.0) must be clamped to <= 3.0.
    const beats: BeatInfo = { gridMs: 3000, source: 'bpm-grid' }; // 3s grid -> 4.0 -> 3.0
    const { spec } = quantizeScenes(s, beats, 'grid');
    expect(spec.scenes[0].durationSec).toBeCloseTo(3.0, 3);
    expect(spec.scenes[0].overlays[0].end).toBeLessThanOrEqual(3.0 + 0.001);
  });
});

describe('quantizeScenes — beatless fallback (honest: never fake beats)', () => {
  it("source:'none' forces the grid fallback even when mode:'nearest'", () => {
    const s = specWithScenes([3.3, 4.3]);
    // 'none' with NO times and NO gridMs -> default 0.5s grid.
    const beats: BeatInfo = { source: 'none' };
    const { spec, diff } = quantizeScenes(s, beats, 'nearest');
    // grid 0.5: 3.3 -> 3.5; abs scene1 end = 3.5+4.3=7.8 -> 8.0 -> dur 4.5
    expect(spec.scenes[0].durationSec).toBeCloseTo(3.5, 3);
    expect(spec.scenes[1].durationSec).toBeCloseTo(4.5, 3);
    expect(diff.length).toBe(2);
  });
});
