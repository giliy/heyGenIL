// beats.ts — music-bed beat derivation + the shared quantizer.
//
// The QUANTIZER (quantizeScenes) lives in @shorts/spec (pure, shared with web) — re-exported
// here so the worker's canonical path matches phase-5-polish.md §Worker/B.
//
// `deriveBeats(bedPath, bedId)` runs a lightweight beat/BPM pass with stdlib TS + ffmpeg astats
// ONLY (no librosa/aubio). Honesty rule (phase-5-polish.md §Risks): the shipped music beds are
// ambient pads with NO drums and NO BPM metadata, so a bed with no detectable beats reports
// source:'none' (with a default gridMs for the grid fallback). We NEVER fake beats.
//
// Detection ladder:
//   1. A catalog/passed `bpm` (or a "<N> BPM" hint parsed from the catalog prompt) -> real beats
//      at 60/bpm intervals -> source:'bpm-analyzed' (catalog-derived tempo is real metadata).
//   2. Else an ffmpeg astats amplitude-envelope onset detector + peak-picking -> if a stable
//      tempo emerges, source:'bpm-analyzed'; ambient pads yield no stable tempo -> step 3.
//   3. Beatless -> source:'none', times:[], gridMs from the default grid BPM (BEAT_SYNC_GRID_BPM).
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { getDb, musicBeats } from '@shorts/db';
import { eq } from 'drizzle-orm';
import type { BeatInfo } from '@shorts/spec';

// Re-export the shared quantizer so the worker path exists per the plan.
export { quantizeScenes } from '@shorts/spec';
export type { BeatInfo, BeatSyncMode, QuantizeResult, SceneTrim } from '@shorts/spec';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');

/** Default grid BPM for beatless beds (env BEAT_SYNC_GRID_BPM overrides). */
export function defaultGridBpm(): number {
  const v = Number(process.env.BEAT_SYNC_GRID_BPM);
  return Number.isFinite(v) && v > 0 ? v : 120;
}

function resolveFfmpeg(): string {
  return path.join(repoRoot, 'tools', 'bin', 'ffmpeg.exe');
}

/** Parse a "<N> BPM" hint from free text (the music catalog's `prompt` carries one). */
export function parseBpmFromText(text: string | undefined): number | null {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*BPM/i.exec(text);
  if (!m) return null;
  const bpm = Number(m[1]);
  return Number.isFinite(bpm) && bpm >= 30 && bpm <= 300 ? bpm : null;
}

/**
 * Run ffmpeg astats over the bed and return a coarse amplitude envelope (RMS per window) so we
 * can peak-pick onsets. Window = 50ms. Returns samples at ~20Hz. On any failure returns [].
 */
async function amplitudeEnvelope(bedPath: string): Promise<number[]> {
  return new Promise((resolve) => {
    const exe = resolveFfmpeg();
    // astats with metadata -> per-frame RMS injected as lavfi.astats.Overall.RMS_level.
    const args = [
      '-hide_banner',
      '-i', bedPath,
      '-af', 'astats=metadata=1:reset=1:length=0.05,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
      '-f', 'null',
      '-',
    ];
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', () => { /* astats prints metadata to the file='-' (stdout) */ });
    child.on('close', () => {
      const samples: number[] = [];
      const re = /lavfi\.astats\.Overall\.RMS_level=(-?[\d.eE+-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(out)) !== null) {
        const db = parseFloat(m[1]);
        samples.push(Number.isFinite(db) ? db : -90);
      }
      resolve(samples);
    });
    child.on('error', () => resolve([]));
  });
}

/**
 * Peak-pick the amplitude envelope into an onset list and estimate a tempo. Returns null when
 * no stable tempo is present (ambient pads). This is a SIMPLE stdlib detector: count onsets
 * (RMS rises > threshold), and if they form a roughly regular spacing, derive BPM from the
 * median inter-onset interval.
 */
export function estimateTempoBpm(envelope: number[], windowSec = 0.05): number | null {
  if (envelope.length < 40) return null; // too short to be meaningful
  // Adaptive threshold: mean + 0.5 * (max-mean). Peaks above it are onsets.
  const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
  const max = Math.max(...envelope);
  const threshold = mean + 0.5 * (max - mean);
  const onsetIdx: number[] = [];
  for (let i = 1; i < envelope.length; i++) {
    if (envelope[i] > threshold && envelope[i] >= envelope[i - 1]) {
      // simple refractory: skip if the last onset was within 120ms
      const t = i * windowSec;
      if (!onsetIdx.length || t - onsetIdx[onsetIdx.length - 1] * windowSec > 0.12) {
        onsetIdx.push(i);
      }
    }
  }
  if (onsetIdx.length < 6) return null; // too few onsets to be a beat
  // Median inter-onset interval (seconds).
  const intervals: number[] = [];
  for (let i = 1; i < onsetIdx.length; i++) {
    intervals.push((onsetIdx[i] - onsetIdx[i - 1]) * windowSec);
  }
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  if (!(median > 0)) return null;
  // Regularity check: onsets must be fairly periodic (ambient pads are not). Coefficient of
  // variation of intervals < 0.5 indicates a real pulse; otherwise treat as beatless.
  const meanI = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((a, b) => a + (b - meanI) ** 2, 0) / intervals.length;
  const stddev = Math.sqrt(variance);
  const cv = meanI > 0 ? stddev / meanI : 1;
  if (cv > 0.5) return null; // irregular -> not a beat (ambient pad)
  // Map the median interval to a musical BPM (30..300), folding octaves into range.
  let bpm = 60 / median;
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

/** Build beat onset times at 60/bpm intervals spanning `durationSec`. */
export function gridTimesForBpm(bpm: number, durationSec: number): number[] {
  const interval = 60 / bpm;
  const times: number[] = [];
  for (let t = 0; t <= durationSec + 1e-6; t += interval) {
    times.push(Math.round(t * 1000) / 1000);
  }
  return times;
}

/** ffprobe duration (seconds). */
async function probeDuration(bedPath: string): Promise<number> {
  return new Promise((resolve) => {
    const exe = path.join(repoRoot, 'tools', 'bin', 'ffprobe.exe');
    const child = spawn(exe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', bedPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('close', () => resolve(parseFloat(out.trim()) || 0));
    child.on('error', () => resolve(0));
  });
}

/**
 * Derive beat metadata for a bed. CACHED in music_beats (library-first: never re-analyze a bed
 * already analyzed). `catalogBpm` (optional) is a structured bpm from the music catalog; the
 * catalog `prompt` BPM hint is parsed when catalogBpm is absent.
 */
export async function deriveBeats(
  bedPath: string,
  bedId: string,
  opts: { catalogBpm?: number | null; catalogPrompt?: string; durationSec?: number } = {},
  db: ReturnType<typeof getDb> = getDb()
): Promise<BeatInfo> {
  // Cache hit: a bed already analyzed returns its stored metadata.
  const cached = await db.query.musicBeats.findFirst({ where: eq(musicBeats.bedId, bedId) });
  if (cached) {
    return {
      bpm: cached.bpm,
      times: cached.times ?? [],
      gridMs: cached.gridMs,
      source: (cached.source as BeatInfo['source']) ?? 'none',
    };
  }

  const durationSec = opts.durationSec && opts.durationSec > 0 ? opts.durationSec : await probeDuration(bedPath);
  const gridBpm = defaultGridBpm();
  const gridMs = 60000 / gridBpm / 2; // 8th notes

  // 1) Structured catalog bpm, or a "<N> BPM" hint parsed from the catalog prompt.
  const bpm = opts.catalogBpm ?? parseBpmFromText(opts.catalogPrompt);
  let info: BeatInfo;
  if (bpm) {
    info = { bpm, times: gridTimesForBpm(bpm, durationSec), gridMs: 60000 / bpm / 2, source: 'bpm-analyzed' };
  } else {
    // 2) ffmpeg astats onset detector -> a stable tempo, or null for ambient pads.
    let detected: number | null = null;
    try {
      const env = await amplitudeEnvelope(bedPath);
      detected = estimateTempoBpm(env);
    } catch {
      detected = null;
    }
    if (detected) {
      info = { bpm: detected, times: gridTimesForBpm(detected, durationSec), gridMs: 60000 / detected / 2, source: 'bpm-analyzed' };
    } else {
      // 3) Honest beatless fallback: no beats. The grid is reported but source stays 'none'.
      info = { bpm: null, times: [], gridMs, source: 'none' };
    }
  }

  // Persist (library-first cache). Best-effort; a concurrent insert race is tolerated.
  try {
    await db.insert(musicBeats).values({
      bedId,
      bpm: info.bpm ?? null,
      times: info.times ?? [],
      gridMs: info.gridMs ?? null,
      source: info.source,
    });
  } catch {
    /* cache write is best-effort; the caller still gets the derived info */
  }
  return info;
}
