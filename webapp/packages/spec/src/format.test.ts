// format.test.ts — aspect-resize helpers. Pure unit tests (no I/O).
import { describe, it, expect } from 'vitest';
import {
  computeFormat,
  aspectOfFormat,
  transformOverlayForAspect,
  transformSpecForAspect,
} from './format';
import type { Spec } from './types';

function baseSpec(): Spec {
  return {
    id: 'f1',
    title: 'Format test',
    template: 'Short16Formy',
    engine: 'tsx',
    format: { width: 1080, height: 1920, fps: 30 },
    theme: {},
    scenes: [
      {
        id: 's1',
        durationSec: 3,
        overlays: [
          // centered overlay on a 1080x1920 canvas
          { id: 'o1', type: 'text', content: 'hi', x: 40, y: 240, w: 1000, h: 100, start: 0, end: 3 },
        ],
      },
    ],
    captions: { preset: 'pill', burnIn: true },
    meta: { revision: 0, updatedAt: '2026-08-22' },
  };
}

describe('computeFormat', () => {
  it('9:16 -> 1080x1920', () => {
    const s = baseSpec();
    expect(computeFormat(s, '9:16')).toEqual({ width: 1080, height: 1920, fps: 30 });
  });
  it('1:1 -> 1080x1080', () => {
    const s = baseSpec();
    expect(computeFormat(s, '1:1')).toEqual({ width: 1080, height: 1080, fps: 30 });
  });
  it('16:9 -> 1920x1080', () => {
    const s = baseSpec();
    expect(computeFormat(s, '16:9')).toEqual({ width: 1920, height: 1080, fps: 30 });
  });
  it('preserves fps', () => {
    const s = baseSpec();
    s.format.fps = 60;
    expect(computeFormat(s, '1:1').fps).toBe(60);
  });
});

describe('aspectOfFormat', () => {
  it('detects canonical aspects', () => {
    expect(aspectOfFormat({ width: 1080, height: 1920 })).toBe('9:16');
    expect(aspectOfFormat({ width: 1080, height: 1080 })).toBe('1:1');
    expect(aspectOfFormat({ width: 1920, height: 1080 })).toBe('16:9');
  });
  it('returns custom for non-standard ratios', () => {
    expect(aspectOfFormat({ width: 1000, height: 500 })).toBe('custom'); // 2:1
    expect(aspectOfFormat({ width: 1280, height: 1000 })).toBe('custom');
  });
});

describe('transformOverlayForAspect (option A: scale + center, no crop)', () => {
  it('scales + vertically-letterboxes for 9:16 -> 1:1', () => {
    const ov = { x: 40, y: 240, w: 1000, h: 100 };
    // 9:16 -> 1:1: scale = 1080/1920 = 0.5625; newW=1080, oldW*scale=607.5, offsetX=(1080-607.5)/2=236.25
    const out = transformOverlayForAspect(ov, { width: 1080, height: 1920 }, { width: 1080, height: 1080 });
    expect(out.x).toBeCloseTo(40 * 0.5625 + 236.25, 3);
    expect(out.y).toBeCloseTo(240 * 0.5625, 3);
    expect(out.w).toBeCloseTo(1000 * 0.5625, 3);
    expect(out.h).toBeCloseTo(100 * 0.5625, 3);
  });

  it('scales + horizontally-letterboxes for 9:16 -> 16:9', () => {
    const ov = { x: 40, y: 240, w: 1000, h: 100 };
    // 9:16 -> 16:9: scale = 1080/1920 = 0.5625; newW=1920, oldW*scale=607.5, offsetX=(1920-607.5)/2=656.25
    const out = transformOverlayForAspect(ov, { width: 1080, height: 1920 }, { width: 1920, height: 1080 });
    expect(out.x).toBeCloseTo(40 * 0.5625 + 656.25, 3);
    expect(out.y).toBeCloseTo(240 * 0.5625, 3);
    expect(out.w).toBeCloseTo(1000 * 0.5625, 3);
    expect(out.h).toBeCloseTo(100 * 0.5625, 3);
  });

  it('16:9 -> 9:16 round-trips a centered overlay', () => {
    const ov = { x: 40, y: 240, w: 1000, h: 100 };
    const a = transformOverlayForAspect(ov, { width: 1080, height: 1920 }, { width: 1920, height: 1080 });
    const b = transformOverlayForAspect(a, { width: 1920, height: 1080 }, { width: 1080, height: 1920 });
    expect(b.x).toBeCloseTo(ov.x, 1);
    expect(b.y).toBeCloseTo(ov.y, 1);
    expect(b.w).toBeCloseTo(ov.w, 1);
    expect(b.h).toBeCloseTo(ov.h, 1);
  });
});

describe('transformSpecForAspect', () => {
  it('swaps format + transforms overlays', () => {
    const s = baseSpec();
    const out = transformSpecForAspect(s, '1:1');
    expect(out.format).toEqual({ width: 1080, height: 1080, fps: 30 });
    const ov = out.scenes[0].overlays[0];
    expect(ov.y).toBeCloseTo(240 * 0.5625, 3);
  });

  it('leaves overlay scene-relative timing untouched', () => {
    const s = baseSpec();
    const out = transformSpecForAspect(s, '1:1');
    const ov = out.scenes[0].overlays[0];
    expect(ov.start).toBe(0);
    expect(ov.end).toBe(3);
  });

  it('is a no-op (returns same object) when already at target aspect', () => {
    const s = baseSpec();
    const out = transformSpecForAspect(s, '9:16');
    expect(out).toBe(s);
  });

  it('handles empty-overlay scenes + degenerate single-scene specs', () => {
    const s = baseSpec();
    s.scenes = [{ id: 'empty', durationSec: 2, overlays: [] }];
    const out = transformSpecForAspect(s, '16:9');
    expect(out.scenes[0].overlays).toEqual([]);
    expect(out.format.width).toBe(1920);
  });
});
