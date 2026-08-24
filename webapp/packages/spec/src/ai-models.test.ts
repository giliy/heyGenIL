import { describe, it, expect } from 'vitest';
import { AI_VIDEO_MODELS, AI_VIDEO_MODEL_DEFAULT, resolveVideoModel } from './ai-models';
import { getTemplate, LAUNCH_TEMPLATES } from './templates';
import { getTrack, trackReady } from './tracks';

describe('resolveVideoModel — shorthand → fal endpoint', () => {
  it('maps each short id to its fal endpoint', () => {
    expect(resolveVideoModel('seedance')).toBe('fal-ai/bytedance/seedance/v1.5/pro/image-to-video');
    expect(resolveVideoModel('veo')).toContain('fal-ai/');
    expect(resolveVideoModel('kling')).toContain('fal-ai/');
  });

  it('passes a full fal id through unchanged', () => {
    const full = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
    expect(resolveVideoModel(full)).toBe(full);
  });

  it('falls back to the seedance default on unknown/empty input', () => {
    expect(resolveVideoModel(undefined)).toBe(AI_VIDEO_MODEL_DEFAULT);
    expect(resolveVideoModel('')).toBe(AI_VIDEO_MODEL_DEFAULT);
    expect(resolveVideoModel('not-a-model')).toBe(AI_VIDEO_MODEL_DEFAULT);
  });

  it('every registered short id resolves to a fal endpoint', () => {
    for (const [shortId, endpoint] of Object.entries(AI_VIDEO_MODELS)) {
      expect(endpoint.startsWith('fal-ai/')).toBe(true);
      expect(resolveVideoModel(shortId)).toBe(endpoint);
    }
  });
});

describe('AI-video launch template (Phase 4)', () => {
  it('registers the ai-blue-man template with the AiSpec composition', () => {
    const t = getTemplate('ai-blue-man');
    expect(t).toBeDefined();
    expect(t?.compositionId).toBe('AiSpec');
    expect(t?.engine).toBe('ai');
    expect(t?.mode).toBe('ai');
  });

  it('the AI template carries a locked character + per-scene clips', () => {
    const t = getTemplate('ai-blue-man');
    expect(t?.defaultSpec.characterId).toBe('blue-man');
    expect(t?.defaultSpec.scenes.every((s) => s.clip?.src)).toBe(true);
  });

  it('the AI track is ready (has a registered composition)', () => {
    expect(getTrack('ai')?.compositionIds).toContain('AiSpec');
    expect(trackReady('ai')).toBe(true);
  });

  it('quotes AI-video seconds from the template scenes (clip srcs present)', () => {
    const t = getTemplate('ai-blue-man');
    const total = t!.defaultSpec.scenes.reduce((a, s) => a + (s.clip?.durationSec ?? s.durationSec), 0);
    expect(total).toBeGreaterThan(0);
  });

  it('templates catalog exposes the ai template to /api/generate/templates', () => {
    expect(LAUNCH_TEMPLATES.some((lt) => lt.mode === 'ai')).toBe(true);
  });
});
