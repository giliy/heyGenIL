// beats.ts — beat-sync quantizer. Pure, unit-tested, shared by web (Sync-to-beat API) and
// worker. Phase 5.
//
// `quantizeScenes` trims each scene's `end` (and thus its durationSec) to the nearest beat
// (mode 'nearest') or the nearest grid multiple (mode 'grid'). INVARIANTS (phase-5-polish.md
// §Worker/B):
//   - a scene's `end` never moves earlier than its first VO word's `end` + 0.05s;
//   - never moves past the next scene's `start`;
//   - `start` is untouched; scene 0 `start` stays 0;
//   - overlay scene-relative windows are clamped into the new duration.
// Returns a NEW spec (revision bumped by the caller/persistence layer, NOT here) + a diff list
// [{sceneId, from, to}] for the UI toast.
//
// Beat source honesty: the shipped music beds are ambient pads with NO beats (verified), so a
// bed with no real beats carries source:'none' and we never fake beats — the grid fallback is
// reported as such. See apps/worker/src/beats.ts (deriveBeats) and phase-5-polish.md §Risks.
import type { Spec, Scene } from './types';
import { round3, clampOverlayToScene } from './helpers';

/** Beat metadata for a music bed. `times` are beat onsets (seconds, absolute within the clip). */
export interface BeatInfo {
  bpm?: number | null;
  times?: number[] | null;
  /** Subdivision in ms (e.g. 60000/bpm/2 for 8th notes). Used by mode 'grid'. */
  gridMs?: number | null;
  /** 'bpm-analyzed' | 'bpm-grid' | 'none' — 'none' means the bed is beatless (honest). */
  source: 'bpm-analyzed' | 'bpm-grid' | 'none';
}

export type BeatSyncMode = 'nearest' | 'grid';

export interface SceneTrim {
  sceneId: string;
  /** Old scene duration (seconds). */
  from: number;
  /** New scene duration (seconds). */
  to: number;
}

export interface QuantizeResult {
  spec: Spec;
  /** Per-scene duration changes (only scenes that moved). */
  diff: SceneTrim[];
}

/** The global (composition) start second of the scene at `index`. */
function sceneStart(scenes: Scene[], index: number): number {
  let acc = 0;
  for (let i = 0; i < index && i < scenes.length; i++) acc += scenes[i].durationSec;
  return acc;
}

/**
 * The ABSOLUTE VO floor for a scene — the max end of the LAST word of every voice line that
 * starts within this scene's ORIGINAL window. Voice line times are absolute (anchored to the
 * rendered audio, which does NOT move when scene boundaries shift), so the floor is an absolute
 * composition second a scene's end may not cross below (never cut off speech). This is a
 * SUPERSET of the plan's stated "first VO word's end + 0.05s" floor (max word end >= first).
 */
function sceneVoFloorAbs(spec: Spec, sceneIndex: number): number {
  // VO line windows are ABSOLUTE (composition seconds) against the ORIGINAL layout.
  const start = sceneStart(spec.scenes, sceneIndex);
  const end = start + spec.scenes[sceneIndex].durationSec;
  const lines = spec.voice?.lines ?? [];
  let floor = 0;
  for (const line of lines) {
    // A line belongs to this scene if it starts within the scene's original window.
    if (line.start >= start && line.start < end) {
      const lastWordEnd = line.words && line.words.length ? line.words[line.words.length - 1].end : line.end;
      floor = Math.max(floor, lastWordEnd);
    }
  }
  return floor;
}

/** Snap a value to the nearest beat time (mode 'nearest'), preferring the closest onset. */
function nearestBeat(t: number, times: number[]): number {
  if (!times.length) return t;
  let best = times[0];
  let bestD = Math.abs(t - best);
  for (const bt of times) {
    const d = Math.abs(t - bt);
    if (d < bestD) {
      best = bt;
      bestD = d;
    }
  }
  return best;
}

/** Snap a value to the nearest grid multiple (mode 'grid'). */
function nearestGrid(t: number, gridSec: number): number {
  if (gridSec <= 0) return t;
  return Math.round(t / gridSec) * gridSec;
}

/**
 * Quantize scene durations to beats. `beats.source === 'none'` forces grid mode (the honest
 * fallback for beatless beds). Returns a new spec + the per-scene diff.
 */
export function quantizeScenes(spec: Spec, beats: BeatInfo, mode: BeatSyncMode = 'nearest'): QuantizeResult {
  // Beatless bed -> the grid fallback (never fake beats).
  const effectiveMode: BeatSyncMode = beats.source === 'none' ? 'grid' : mode;
  const gridSec = beats.gridMs && beats.gridMs > 0 ? beats.gridMs / 1000 : 0.5; // default 0.5s grid
  const times = beats.times ?? [];

  const diff: SceneTrim[] = [];
  let startAcc = 0; // scene start using NEW (already-quantized) durations, so timing stays coherent
  const newScenes = spec.scenes.map((scene, i) => {
    const start = startAcc;
    const absEnd = start + scene.durationSec;

    // The candidate snapped end (absolute), then back to scene-relative.
    const snappedAbs =
      effectiveMode === 'grid'
        ? nearestGrid(absEnd, gridSec)
        : nearestBeat(absEnd, times.length ? times : []);

    // INVARIANT: never earlier than the scene's VO floor (+0.05s) — never cut off speech.
    // The floor is ABSOLUTE (voice times don't move), applied to the new absolute end.
    let newAbsEnd = snappedAbs;
    const absFloor = sceneVoFloorAbs(spec, i) + 0.05;
    if (newAbsEnd < absFloor) newAbsEnd = absFloor;

    // Convert to a new scene-relative duration. INVARIANT: keep it positive (scenes stay
    // back-to-back and ordered; overlap is structurally impossible — scenes are contiguous).
    let newDur = newAbsEnd - start;
    if (newDur <= 0.05) newDur = 0.05;

    newDur = round3(newDur);
    if (Math.abs(newDur - scene.durationSec) > 0.001) {
      diff.push({ sceneId: scene.id, from: round3(scene.durationSec), to: newDur });
    }
    startAcc += newDur; // accumulate for the next scene's start (coherent new timing)
    // Clamp overlays into the (possibly shrunken) window.
    const overlays = scene.overlays.map((ov) => clampOverlayToScene(ov, newDur));
    return { ...scene, durationSec: newDur, overlays };
  });

  return { spec: { ...spec, scenes: newScenes }, diff };
}
