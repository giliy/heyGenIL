import { describe, it, expect } from 'vitest';
import {
  TIERS,
  CREDIT_BASIS,
  getTier,
  tierAtLeast,
  tierAllows,
  tierAllowsTrack,
} from './tiers';
import { CREDIT_TABLE } from './quote';

describe('tiers — the unlock matrix as shared data', () => {
  it('defines exactly free/creator/pro in order', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['free', 'creator', 'pro']);
  });

  it('free is 720p + watermark + 10 renders; paid is 1080p clean + unbounded', () => {
    expect(getTier('free').maxResolution).toBe('720p');
    expect(getTier('free').watermark).toBe(true);
    expect(getTier('free').rendersPerMonth).toBe(10);
    for (const t of ['creator', 'pro'] as const) {
      expect(getTier(t).maxResolution).toBe('1080p');
      expect(getTier(t).watermark).toBe(false);
      expect(getTier(t).rendersPerMonth).toBeNull();
    }
  });

  it('free unlocks NO paid capability (elevenlabs/ai-image/ai-clip/vox/audioGen)', () => {
    const free = getTier('free').capabilities;
    expect(free.elevenlabsVoice).toBe(false);
    expect(free.aiImage).toBe(false);
    expect(free.aiVideoClip).toBe(false);
    expect(free.voxCollageLayers).toBe(false);
    expect(free.audioGen).toBe(false);
  });

  it('creator unlocks voice/ai-image/audioGen but NOT ai-clip/vox (those are pro)', () => {
    expect(tierAllows('creator', 'elevenlabsVoice')).toBe(true);
    expect(tierAllows('creator', 'aiImage')).toBe(true);
    expect(tierAllows('creator', 'audioGen')).toBe(true);
    expect(tierAllows('creator', 'aiVideoClip')).toBe(false);
    expect(tierAllows('creator', 'voxCollageLayers')).toBe(false);
  });

  it('pro unlocks everything incl. ai-clip + vox + priority', () => {
    const pro = getTier('pro').capabilities;
    for (const k of Object.keys(pro) as (keyof typeof pro)[]) {
      expect(pro[k]).toBe(true);
    }
  });

  it('tierAtLeast orders free < creator < pro', () => {
    expect(tierAtLeast('free', 'free')).toBe(true);
    expect(tierAtLeast('creator', 'free')).toBe(true);
    expect(tierAtLeast('pro', 'creator')).toBe(true);
    expect(tierAtLeast('free', 'creator')).toBe(false);
    expect(tierAtLeast('creator', 'pro')).toBe(false);
    expect(tierAtLeast('pro', 'pro')).toBe(true);
  });

  it('track gating: free=tsx only; creator=+ad/kids; pro=all six (incl. avatar)', () => {
    expect(getTier('free').trackModes).toEqual(['tsx']);
    expect(getTier('creator').trackModes).toEqual(['tsx', 'ad', 'kids']);
    expect(getTier('pro').trackModes).toEqual(['tsx', 'ad', 'kids', 'ai', 'vox', 'avatar']);
    expect(tierAllowsTrack('free', 'ai')).toBe(false);
    expect(tierAllowsTrack('creator', 'vox')).toBe(false);
    expect(tierAllowsTrack('creator', 'avatar')).toBe(false);
    expect(tierAllowsTrack('pro', 'ai')).toBe(true);
    expect(tierAllowsTrack('pro', 'vox')).toBe(true);
    expect(tierAllowsTrack('pro', 'avatar')).toBe(true);
  });

  it('CREDIT_BASIS mirrors CREDIT_TABLE (single source of truth for per-block pricing)', () => {
    expect(CREDIT_BASIS.tsxFlat).toBe(CREDIT_TABLE.tsxFlat);
    expect(CREDIT_BASIS.aiImage).toBe(CREDIT_TABLE.aiImage);
    expect(CREDIT_BASIS.elevenVoiceLine).toBe(CREDIT_TABLE.elevenVoiceLine);
    expect(CREDIT_BASIS.aiVideoSec).toBe(CREDIT_TABLE.aiVideoSec);
    expect(CREDIT_BASIS.voxLayer).toBe(CREDIT_TABLE.voxLayer);
    expect(CREDIT_BASIS.sfxGen).toBe(CREDIT_TABLE.sfxGen);
    expect(CREDIT_BASIS.musicGen).toBe(CREDIT_TABLE.musicGen);
  });

  it('getTier throws on an unknown tier', () => {
    expect(() => getTier('enterprise' as never)).toThrow();
  });
});
