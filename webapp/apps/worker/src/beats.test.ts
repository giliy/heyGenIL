// beats.test.ts — the pure beat-derivation helpers (parseBpmFromText, estimateTempoBpm,
// gridTimesForBpm). The DB/ffmpeg-coupled deriveBeats is exercised by the integration tests.
import { describe, it, expect } from 'vitest';
import { parseBpmFromText, estimateTempoBpm, gridTimesForBpm } from './beats';

describe('parseBpmFromText', () => {
  it('parses a "<N> BPM" hint from the catalog prompt', () => {
    expect(parseBpmFromText('...around 90 BPM, restrained and premium')).toBe(90);
    expect(parseBpmFromText('roughly 70 BPM feel')).toBe(70);
    expect(parseBpmFromText('Around 75 BPM')).toBe(75);
  });
  it('returns null when no BPM is present', () => {
    expect(parseBpmFromText('soft ambient pads, no drums')).toBeNull();
    expect(parseBpmFromText(undefined)).toBeNull();
  });
  it('rejects implausible BPM values', () => {
    expect(parseBpmFromText('1200 BPM')).toBeNull();
    expect(parseBpmFromText('5 BPM')).toBeNull();
  });
});

describe('gridTimesForBpm', () => {
  it('generates onsets at 60/bpm intervals', () => {
    // 120 BPM -> 0.5s intervals
    expect(gridTimesForBpm(120, 2)).toEqual([0, 0.5, 1, 1.5, 2]);
    // 60 BPM -> 1s intervals
    expect(gridTimesForBpm(60, 3)).toEqual([0, 1, 2, 3]);
  });
});

describe('estimateTempoBpm', () => {
  it('returns null for a flat (beatless) envelope — ambient pad', () => {
    // constant RMS, no onsets -> no tempo
    const flat = new Array(200).fill(-30);
    expect(estimateTempoBpm(flat)).toBeNull();
  });

  it('returns null for too-few onsets', () => {
    const env = new Array(200).fill(-50);
    env[10] = -10; env[100] = -10; // two spikes only
    expect(estimateTempoBpm(env)).toBeNull();
  });

  it('detects a regular pulse as a BPM', () => {
    // 200 samples at 50ms = 10s; put a spike every 0.5s (every 10 samples) = 120 BPM.
    const env = new Array(400).fill(-50);
    for (let i = 0; i < env.length; i += 10) env[i] = -10;
    const bpm = estimateTempoBpm(env);
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeGreaterThan(90);
    expect(bpm!).toBeLessThan(130);
  });
});
