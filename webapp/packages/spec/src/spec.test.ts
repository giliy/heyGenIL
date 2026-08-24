import { describe, it, expect } from 'vitest';
import {
  parseSpec,
  validateSpec,
  getDurationSec,
  specDurationFrames,
  specToFrames,
  clampOverlayToScene,
  normalizeSpec,
  isRtlText,
  specHasRtlCaptions,
  splitLineAtWord,
  splitLineAtChar,
  mergeLines,
  nudgeLine,
  estimateWords,
  newId,
  defaultTextOverlay,
  defaultImageOverlay,
  parseGeneratePayload,
  validateGeneratePayload,
  parseGenerateScriptRequest,
  validateAdSpec,
  GENERATE_STAGES,
} from './index';

const baseSpec = () => ({
  id: 'test-1',
  title: 'Test',
  template: 'Short16Formy',
  engine: 'tsx' as const,
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#6366F1' },
  scenes: [
    { id: 'hook', durationSec: 3, overlays: [] },
    { id: 'body', durationSec: 4, overlays: [] },
    { id: 'cta', durationSec: 2, overlays: [] },
  ],
  captions: { preset: 'pill' as const, burnIn: false },
  meta: { revision: 0, updatedAt: '2026-08-22' },
});

describe('spec validators', () => {
  it('spec.valid — a complete valid spec passes and returns typed Spec', () => {
    const s = parseSpec(baseSpec());
    expect(s.id).toBe('test-1');
    expect(s.scenes).toHaveLength(3);
  });

  it('spec.missingTemplate — rejects with /template/ in the error path', () => {
    const s = baseSpec() as any;
    delete s.template;
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(JSON.stringify(r.error.issues)).toContain('template');
    }
  });

  it('spec.badOverlayType — type:"video" rejects', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'video', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
  });

  it('spec.overlayTimingOOR — overlay start > scene.durationSec rejects with the overlay path', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'hi', x: 0, y: 0, w: 100, h: 100, start: 5, end: 6 },
    ]; // scene duration is 3, start 5 > 3
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const json = JSON.stringify(r.error.issues);
      expect(json).toContain('overlays');
    }
  });

  it('spec.overlayZeroBox — w:0 rejects', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'hi', x: 0, y: 0, w: 0, h: 100, start: 0, end: 1 },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
  });

  it('spec.opacityOOR — opacity:1.5 rejects', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'hi', x: 0, y: 0, w: 10, h: 10, start: 0, end: 1, opacity: 1.5 },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
  });

  it('spec.endBeforeStart — end <= start rejects', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'hi', x: 0, y: 0, w: 10, h: 10, start: 2, end: 1 },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
  });

  it('spec.getDuration — 3 scenes of 3+4+2s @30 -> 270 frames', () => {
    const s = parseSpec(baseSpec());
    expect(getDurationSec(s)).toBe(9);
    expect(specDurationFrames(s)).toBe(270);
  });

  it('spec.rtlText — a Hebrew text overlay (align right, font hebrew) parses', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      {
        id: 'o1', type: 'text', content: 'שלום עולם', x: 0, y: 0, w: 200, h: 100,
        start: 0, end: 2, style: { font: 'hebrew', align: 'right', size: 64 },
      },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(true);
  });

  it('spec.imageOverlay — an image overlay with src parses', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'logo', type: 'image', src: 'library/logos/x.png', x: 0, y: 0, w: 100, h: 100, start: 0, end: 2 },
    ];
    const r = validateSpec(s);
    expect(r.ok).toBe(true);
  });

  it('spec.emptyScenes — scenes: [] rejects', () => {
    const s = baseSpec() as any;
    s.scenes = [];
    expect(validateSpec(s).ok).toBe(false);
  });
});

describe('generate payload validators', () => {
  it('valid generate payload passes (kokoro, free voice)', () => {
    const p = parseGeneratePayload({
      topic: 'how to make a form',
      template: 'form-card',
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
      captions: { preset: 'pill', burnIn: true },
    });
    expect(p.template).toBe('form-card');
    expect(p.captions.preset).toBe('pill');
  });

  it('locked script lines pass through verbatim', () => {
    const p = parseGeneratePayload({
      topic: 'x',
      template: 'form-card',
      script: [{ text: 'my exact locked line', start: 0.5 }],
      voice: { engine: 'edge', voiceId: 'en-US-AriaNeural' },
    });
    expect(p.script?.[0].text).toBe('my exact locked line');
  });

  it('missing template rejects', () => {
    const r = validateGeneratePayload({
      topic: 'x',
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
    } as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(JSON.stringify(r.error.issues)).toContain('template');
  });

  it('empty topic rejects', () => {
    const r = validateGeneratePayload({
      topic: '',
      template: 'form-card',
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
    });
    expect(r.ok).toBe(false);
  });

  it('elevenlabs engine validates (tier gate is server-side, not schema)', () => {
    // Phase 1: elevenlabs is a valid engine so the voice stage can run it; the PAID gate
    // lives at the route/worker (a free-tier generate/render requesting elevenlabs is 403).
    const r = validateGeneratePayload({
      topic: 'x',
      template: 'form-card',
      voice: { engine: 'elevenlabs', voiceId: 'x' },
    });
    expect(r.ok).toBe(true);
  });

  it('generate payload accepts mode + language + ad block', () => {
    const r = validateGeneratePayload({
      topic: 'מכירת קיץ',
      template: 'ad-liat',
      mode: 'ad',
      language: 'he',
      ad: { business: 'ליאת קוסמטיקה', ctaText: 'להזמנת תור', price: 199, oldPrice: 290 },
      voice: { engine: 'edge', voiceId: 'he-IL-HilaNeural' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.mode).toBe('ad');
      expect(r.data.language).toBe('he');
      expect(r.data.ad?.price).toBe(199);
    }
  });

  it('generate payload without mode/language still validates (inferred downstream)', () => {
    const r = validateGeneratePayload({
      topic: 'x',
      template: 'form-card',
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.mode).toBeUndefined();
      expect(r.data.language).toBeUndefined();
    }
  });

  it('generate payload + spec accept a characterId (Phase 2 locked character)', () => {
    const r = validateGeneratePayload({
      topic: 'x',
      template: 'form-card',
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
      characterId: 'char_123',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.characterId).toBe('char_123');
  });

  it('empty locked script ([]) rejects', () => {
    const r = validateGeneratePayload({
      topic: 'x',
      template: 'form-card',
      script: [],
      voice: { engine: 'kokoro', voiceId: 'af_bella' },
    });
    expect(r.ok).toBe(false);
  });

  it('script request parses without voice', () => {
    const r = parseGenerateScriptRequest({
      topic: 'x',
      template: 'form-card',
      script: [{ text: 'line one' }, { text: 'line two' }],
    });
    expect(r.script).toHaveLength(2);
  });

  it('GENERATE_STAGES is exactly the canonical ordered set', () => {
    expect(GENERATE_STAGES).toEqual(['story', 'voice', 'talk', 'pixel', 'build', 'qa', 'mix', 'render']);
  });
});

describe('timing utils', () => {
  it('specToFrames — 3 scenes 3+4+2s @30 -> 270 (must equal calculateMetadata)', () => {
    const s = parseSpec(baseSpec());
    expect(specToFrames(s)).toBe(270);
  });

  it('clampOverlayToScene — bounds end to scene duration', () => {
    const ov = { start: 2, end: 5 };
    const clamped = clampOverlayToScene(ov, 3);
    expect(clamped.end).toBeLessThanOrEqual(3);
    expect(clamped.start).toBeLessThan(clamped.end);
  });

  it('clampOverlayToScene — preserves start<end when both exceed the scene', () => {
    const ov = { start: 4, end: 6 };
    const clamped = clampOverlayToScene(ov, 3);
    expect(clamped.end).toBeLessThanOrEqual(3);
    expect(clamped.start).toBeLessThan(clamped.end);
    expect(clamped.start).toBeGreaterThanOrEqual(0);
  });

  it('clampOverlayToScene — does not mutate the input', () => {
    const ov = { start: 2, end: 5 };
    clampOverlayToScene(ov, 3);
    expect(ov.end).toBe(5);
  });
});

describe('normalizeSpec', () => {
  it('fills missing animation/opacity/rotation and caption defaults', () => {
    const s = baseSpec() as any;
    s.scenes[0].overlays = [
      { id: 'o1', type: 'text', content: 'hi', x: 0, y: 0, w: 10, h: 10, start: 0, end: 1 },
    ];
    const n = normalizeSpec(parseSpec(s));
    expect(n.captions.preset).toBe('pill'); // base spec's preset is preserved
    expect(n.captions.burnIn).toBe(false);
    expect(n.scenes[0].overlays[0].animation).toBe('none');
    expect(n.scenes[0].overlays[0].opacity).toBe(1);
    expect(n.scenes[0].overlays[0].rotation).toBe(0);
  });

  it('normalizes a spec with NO captions block to the pop/burnIn defaults', () => {
    const s = baseSpec() as any;
    delete s.captions;
    const n = normalizeSpec(parseSpec(s));
    expect(n.captions).toEqual({ preset: 'pop', burnIn: true });
  });
});

describe('captions / RTL', () => {
  it('isRtlText — flags Hebrew first-strong, not Latin', () => {
    expect(isRtlText('שלום עולם')).toBe(true);
    expect(isRtlText('Hello world')).toBe(false);
    expect(isRtlText('123 hello')).toBe(false);
  });

  it('specHasRtlCaptions — a Hebrew line makes the spec RTL', () => {
    const s = baseSpec() as any;
    s.voice = { engine: 'edge', voiceId: 'x', lines: [{ text: 'שלום', start: 0, end: 1 }] };
    expect(specHasRtlCaptions(s)).toBe(true);
  });

  it('estimateWords — distributes the window across words in order', () => {
    const line = { text: 'א ב ג', start: 0, end: 3 };
    const words = estimateWords(line);
    expect(words).toHaveLength(3);
    expect(words[0].start).toBe(0);
    expect(words[2].end).toBeLessThanOrEqual(3);
    // strictly increasing, non-overlapping
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end);
  });

  it('splitLineAtWord — distributes words and timings across two lines', () => {
    const line = { text: 'א ב ג ד', start: 0, end: 4, words: [
      { w: 'א', start: 0, end: 1 }, { w: 'ב', start: 1, end: 2 }, { w: 'ג', start: 2, end: 3 }, { w: 'ד', start: 3, end: 4 },
    ] };
    const [first, second] = splitLineAtWord(line, 2);
    expect(first.text).toBe('א ב');
    expect(second.text).toBe('ג ד');
    expect(first.words).toHaveLength(2);
    expect(second.words).toHaveLength(2);
    expect(first.end).toBe(second.start);
  });

  it('splitLineAtChar — caret mid-line splits at the nearest word boundary', () => {
    const line = { text: 'one two three', start: 0, end: 3 };
    // caret right after "one " -> before "two"
    const [first, second] = splitLineAtChar(line, 4);
    expect(first.text).toBe('one');
    expect(second.text).toBe('two three');
  });

  it('mergeLines — joins text and concatenates words in logical order', () => {
    const a = { text: 'שלום', start: 0, end: 1, words: [{ w: 'שלום', start: 0, end: 1 }] };
    const b = { text: 'עולם', start: 1, end: 2, words: [{ w: 'עולם', start: 1, end: 2 }] };
    const m = mergeLines(a, b);
    expect(m.text).toBe('שלום עולם');
    expect(m.start).toBe(0);
    expect(m.end).toBe(2);
    expect(m.words).toHaveLength(2);
  });

  it('nudgeLine — shifts the window and word times by delta', () => {
    const line = { text: 'hi', start: 1, end: 2, words: [{ w: 'hi', start: 1, end: 2 }] };
    const n = nudgeLine(line, 0.1);
    expect(n.start).toBeCloseTo(1.1);
    expect(n.end).toBeCloseTo(2.1);
    expect(n.words?.[0].start).toBeCloseTo(1.1);
  });
});

describe('overlay factories', () => {
  it('newId — produces url-safe unique ids with the prefix', () => {
    const a = newId('ov');
    const b = newId('ov');
    expect(a.startsWith('ov_')).toBe(true);
    expect(a).not.toBe(b);
    expect(/^[a-zA-Z0-9_]+$/.test(a)).toBe(true);
  });

  it('defaultTextOverlay — scene-relative window fits the scene', () => {
    const ov = defaultTextOverlay(3) as any;
    expect(ov.type).toBe('text');
    expect(ov.end).toBeLessThanOrEqual(3);
    expect(ov.start).toBeLessThan(ov.end);
  });

  it('defaultImageOverlay — sizes to aspect ratio and centers', () => {
    const ov = defaultImageOverlay(4, '/media/x.png', 'a1', 1000, 500) as any;
    expect(ov.type).toBe('image');
    expect(ov.src).toBe('/media/x.png');
    expect(ov.assetId).toBe('a1');
    // 1000x500 -> w=800, h=400
    expect(ov.w).toBe(800);
    expect(ov.h).toBe(400);
    expect(ov.x).toBe(Math.round((1080 - 800) / 2));
    expect(ov.end).toBeLessThanOrEqual(4);
  });
});

describe('validateAdSpec (Phase 3 — validate_ad_beats mirror)', () => {
  const adSpec = () => ({
    mode: 'ad' as const,
    scenes: [],
    ad: {
      business: 'ליאת קוסמטיקה',
      ctaText: 'להזמנה בוואטסאפ',
      price: 199,
      oldPrice: 290,
      phone: '050-1234567',
      endCardHoldSec: 4,
    },
  });

  it('returns no issues for a complete ad spec', () => {
    expect(validateAdSpec(adSpec())).toEqual([]);
  });

  it('ignores non-ad specs', () => {
    expect(validateAdSpec({ mode: 'tsx' as const, scenes: [] })).toEqual([]);
  });

  it('flags a missing ad block', () => {
    const issues = validateAdSpec({ mode: 'ad' as const, scenes: [] });
    expect(issues.some((i) => i.key === 'business')).toBe(true);
  });

  it('flags a short end-card hold (< 2.0s)', () => {
    const s = adSpec();
    s.ad.endCardHoldSec = 1.0;
    const issues = validateAdSpec(s);
    expect(issues.some((i) => i.key === 'hold')).toBe(true);
  });

  it('flags oldPrice <= price', () => {
    const s = adSpec();
    s.ad.oldPrice = 150;
    const issues = validateAdSpec(s);
    expect(issues.some((i) => i.key === 'price')).toBe(true);
  });

  it('flags missing contact path (no phone/website/logo)', () => {
    const s = adSpec();
    delete (s.ad as any).phone;
    const issues = validateAdSpec(s);
    expect(issues.some((i) => i.key === 'contact')).toBe(true);
  });
});
