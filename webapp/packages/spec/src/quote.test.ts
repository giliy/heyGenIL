import { describe, it, expect } from 'vitest';
import { quoteSpec, CREDIT_TABLE } from './quote';
import type { Spec } from './types';

// A spec with NO AI images, NO elevenlabs, NO AI video → flat only.
function baseSpec(): Spec {
  return {
    id: 'q1',
    title: 'Quote test',
    template: 'Short16Formy',
    engine: 'tsx',
    format: { width: 1080, height: 1920, fps: 30 },
    theme: {},
    scenes: [
      { id: 'hook', durationSec: 3, overlays: [] },
      { id: 'body', durationSec: 4, overlays: [] },
      { id: 'cta', durationSec: 2, overlays: [] },
    ],
    captions: { preset: 'pop', burnIn: true },
    meta: { revision: 0, updatedAt: '2026-08-22' },
  };
}

describe('quoteSpec — upfront flat pricing', () => {
  it('plain TSX spec quotes exactly the flat charge (2)', () => {
    const q = quoteSpec(baseSpec());
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat);
    expect(q.breakdown.tsxFlat).toBe(CREDIT_TABLE.tsxFlat);
    expect(q.breakdown.aiImages.credits).toBe(0);
    expect(q.breakdown.aiVoiceLines.credits).toBe(0);
    expect(q.breakdown.aiVideoSec.credits).toBe(0);
  });

  it('free and paid tiers quote the SAME (resolution is a post-process, not a credit item)', () => {
    const free = quoteSpec(baseSpec(), 'free');
    const paid = quoteSpec(baseSpec(), 'creator');
    expect(free.credits).toBe(paid.credits);
  });

  it('counts AI-generated image overlays at 3 each', () => {
    const s = baseSpec();
    s.scenes[0].overlays = [
      // an AI image (gen_image.py output path contains /ai-...png)
      { id: 'o1', type: 'image', src: '/media/projects/abc/ai-c1abcd.png', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
      // a plain upload — must NOT be billed as AI
      { id: 'o2', type: 'image', src: '/media/proj1/logo.png', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
    ];
    const q = quoteSpec(s);
    expect(q.breakdown.aiImages.count).toBe(1);
    expect(q.breakdown.aiImages.credits).toBe(CREDIT_TABLE.aiImage);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat + CREDIT_TABLE.aiImage);
  });

  it('counts ElevenLabs voice lines at 1 each', () => {
    const s = baseSpec();
    s.voice = {
      engine: 'elevenlabs',
      voiceId: 'v1',
      lines: [
        { text: 'a', start: 0, end: 1 },
        { text: 'b', start: 1, end: 2 },
        { text: 'c', start: 2, end: 3 },
      ],
    };
    const q = quoteSpec(s);
    expect(q.breakdown.aiVoiceLines.count).toBe(3);
    expect(q.breakdown.aiVoiceLines.credits).toBe(3 * CREDIT_TABLE.elevenVoiceLine);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat + 3 * CREDIT_TABLE.elevenVoiceLine);
  });

  it('kokoro/edge voice is NOT billed (free voice engine)', () => {
    const s = baseSpec();
    s.voice = { engine: 'edge', voiceId: 'he-IL-AvriNeural', lines: [{ text: 'x', start: 0, end: 1 }] };
    const q = quoteSpec(s);
    expect(q.breakdown.aiVoiceLines.credits).toBe(0);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat);
  });

  it('spec with no clip references quotes 0 AI-video seconds', () => {
    const q = quoteSpec(baseSpec());
    expect(q.breakdown.aiVideoSec.seconds).toBe(0);
    expect(q.breakdown.aiVideoSec.credits).toBe(0);
  });

  it('counts AI-video clip seconds at 6/s (Phase 4)', () => {
    const s = baseSpec();
    // Two scenes carry video clips (mode 'ai'); the third is a plain scene.
    (s.scenes[0] as any).clip = { src: '/media/projects/abc/clip-hook.mp4', durationSec: 5 };
    (s.scenes[1] as any).clip = { src: '/media/projects/abc/clip-body.mp4' }; // no durationSec → uses scene.durationSec (4)
    s.engine = 'ai';
    const q = quoteSpec(s);
    expect(q.breakdown.aiVideoSec.seconds).toBe(5 + 4);
    expect(q.breakdown.aiVideoSec.credits).toBe(9 * CREDIT_TABLE.aiVideoSec);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat + 9 * CREDIT_TABLE.aiVideoSec);
  });

  it('combined spec sums all line items', () => {
    const s = baseSpec();
    s.voice = { engine: 'elevenlabs', voiceId: 'v', lines: [{ text: 'a', start: 0, end: 1 }, { text: 'b', start: 1, end: 2 }] };
    s.scenes[0].overlays = [
      { id: 'o1', type: 'image', src: '/media/projects/abc/ai-x.png', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
      { id: 'o2', type: 'image', src: '/media/projects/abc/ai-y.png', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
    ];
    const q = quoteSpec(s);
    expect(q.credits).toBe(
      CREDIT_TABLE.tsxFlat + 2 * CREDIT_TABLE.aiImage + 2 * CREDIT_TABLE.elevenVoiceLine
    );
  });

  it('vox quotes only image-bearing layers (cutout/photo) + paper; label/stamp are FREE (Phase 5)', () => {
    const s = baseSpec();
    s.engine = 'vox';
    s.vox = {
      paper: { src: '/media/projects/p/proj/paper-x.png' }, // paper = 1 billed layer
      cam: [
        { f: 0, x: 540, y: 960, z: 1 },
        { f: 540, x: 540, y: 960, z: 1.4 },
      ],
      grain: 0.055,
    };
    // Scene 1: one hero cutout (billed), one label (free), one stamp (free).
    s.scenes[0].vox = {
      layers: [
        { id: 'hero-1', type: 'cutout', x: 540, y: 640, w: 620, at: 0, dur: 12, enter: 'rise', depth: 1.5, z: 3 },
        { id: 'label-1', type: 'label', text: 'The line', x: 540, y: 1290, w: 840, at: 6, enter: 'slide-l' },
        { id: 'stamp-1', type: 'stamp', text: 'APR 2026', x: 900, y: 400, size: 42 },
      ],
    };
    // Scene 2: one archival photo (billed).
    s.scenes[1].vox = {
      layers: [
        { id: 'photo-2', type: 'photo', x: 540, y: 640, w: 620, at: 0, treatment: 'sepia' },
      ],
    };
    // Scene 3: no vox layers (empty stack — not billed).
    const q = quoteSpec(s);
    // paper (1) + hero cutout (1) + archival photo (1) = 3 billed vox layers.
    expect(q.breakdown.voxLayers.count).toBe(3);
    expect(q.breakdown.voxLayers.credits).toBe(3 * CREDIT_TABLE.voxLayer);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat + 3 * CREDIT_TABLE.voxLayer);
  });

  it('a vox layer missing its src still bills (src is minted at pixel stage, not yet present)', () => {
    const s = baseSpec();
    s.engine = 'vox';
    s.vox = {
      paper: {},
      cam: [{ f: 0, x: 540, y: 960, z: 1 }],
    };
    s.scenes[0].vox = {
      layers: [
        // No src, no srcPrompt — the pixel stage fills src in place from the job.
        { id: 'hero-1', type: 'cutout', x: 540, y: 640, w: 620 },
        { id: 'photo-1', type: 'photo', x: 540, y: 640, w: 620 },
      ],
    };
    const q = quoteSpec(s);
    expect(q.breakdown.voxLayers.count).toBe(2);
    expect(q.breakdown.voxLayers.credits).toBe(2 * CREDIT_TABLE.voxLayer);
  });

  it('library SFX + music bed are FREE (reuse-first, no generation cost)', () => {
    const s = baseSpec();
    s.audio = {
      sfx: [
        { id: 'whoosh', at: 0 },
        { id: 'pop', at: 2 },
      ],
      music: { id: 'ambient-pad' },
    };
    const q = quoteSpec(s);
    expect(q.breakdown.audioGen.sfx).toBe(0);
    expect(q.breakdown.audioGen.music).toBe(0);
    expect(q.breakdown.audioGen.credits).toBe(0);
    expect(q.credits).toBe(CREDIT_TABLE.tsxFlat);
  });

  it('GENERATED SFX + music bed bill at sfxGen/musicGen (Phase 6)', () => {
    const s = baseSpec();
    s.audio = {
      sfx: [
        { id: 'whoosh', at: 0, generate: true },
        { id: 'pop', at: 2 }, // library cue — free
        { id: 'ding', at: 4, generate: true },
      ],
      music: { id: 'vox-bed', generate: true },
    };
    const q = quoteSpec(s);
    expect(q.breakdown.audioGen.sfx).toBe(2);
    expect(q.breakdown.audioGen.music).toBe(1);
    expect(q.breakdown.audioGen.credits).toBe(
      2 * CREDIT_TABLE.sfxGen + 1 * CREDIT_TABLE.musicGen
    );
    expect(q.credits).toBe(
      CREDIT_TABLE.tsxFlat + 2 * CREDIT_TABLE.sfxGen + 1 * CREDIT_TABLE.musicGen
    );
  });
});
