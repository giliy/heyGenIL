// mix.ts — stage 6: the audio mix.
//
// VOICE MUX: resolve ffmpeg via tools/ffw.py (NEVER bare ffmpeg — the silent-AAC trap),
// mux build/silent.mp4 + voice.wav -> mix/voiced.mp4. audio_gate after.
//
// SFX (P1): if a sfx-plan.json was authored for the template, run mix_sfx.py. Music (P1):
// if a bed is chosen, mix_music.py. Phase 3's free happy path is voice-only mux (SFX/music
// cue-sheeting is a manual engine discipline). Each additional mux/mix stage re-runs
// audio_gate.
import path from 'path';
import { promises as fs } from 'fs';
import type { Spec } from '@shorts/spec';
import { runPython, repoRoot, storageDir } from '../py';
import type { StageReport } from '../types';
import type { StageWriter } from '../writer';

export interface MixOutcome {
  finalPath: string; // the final mixed mp4 (voice muxed, SFX/music applied if present)
}

/** Mux voice onto a silent master via ffw (never bare ffmpeg). */
async function muxVoice(
  silentMaster: string,
  voiceWav: string,
  outPath: string,
  durationSec: number
): Promise<void> {
  await runPython({
    tool: 'stdlib',
    args: [
      '-c',
      [
        'import sys, subprocess, os',
        'sys.path.insert(0, os.path.join(os.getcwd(), "tools"))',
        'import ffw',
        'out = r"' + outPath + '"',
        'os.makedirs(os.path.dirname(out), exist_ok=True)',
        'cmd = [ffw.path(), "-y", "-v", "error", "-i", r"' + silentMaster + '", "-i", r"' + voiceWav + '",',
        '  "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",',
        '  "-t", "' + String(durationSec) + '", out]',
        'r = subprocess.run(cmd, capture_output=True, text=True)',
        'if r.returncode != 0:',
        '  sys.exit("mux failed: " + r.stdout + r.stderr)',
      ].join('\n'),
    ],
  });
}

/**
 * Run the mix stage. Voice-only for the free tier; applies SFX/music when a plan is present.
 */
export async function runMixStage(
  spec: Spec,
  projectId: string,
  workDir: string,
  silentMaster: string,
  voiceWav: string,
  durationSec: number,
  writer: StageWriter
): Promise<MixOutcome> {
  await writer.begin('mix');

  const mixDir = path.join(workDir, 'mix');
  await fs.mkdir(mixDir, { recursive: true });
  const voiced = path.join(mixDir, 'voiced.mp4');

  // 1) Voice mux.
  await muxVoice(silentMaster, voiceWav, voiced, durationSec);
  await gate(voiced);

  let final = voiced;

  // 2) SFX (P1): if a sfx-plan.json exists, run mix_sfx.py.
  const sfxPlan = path.join(workDir, 'sfx-plan.json');
  if (await fileExists(sfxPlan)) {
    const sfxOut = path.join(mixDir, 'sfx.mp4');
    await runPython({
      tool: 'stdlib',
      args: [path.join(repoRoot(), 'tools', 'mix_sfx.py'), sfxPlan, '--out', sfxOut],
    });
    await gate(sfxOut);
    final = sfxOut;
  }

  // 3) Music (P1): if a bed is set, mix_music.py.
  const musicBed = spec.audio?.music?.id;
  if (musicBed) {
    const musicOut = path.join(mixDir, 'music.mp4');
    await runPython({
      tool: 'stdlib',
      args: [
        path.join(repoRoot(), 'tools', 'mix_music.py'),
        '--bed', musicBed,
        '--base', final,
        '--out', musicOut,
      ],
    });
    await gate(musicOut);
    final = musicOut;
  }

  await writer.flush('mix', 1);
  return { finalPath: final };
}

async function gate(file: string): Promise<void> {
  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'audio_gate.py'), file],
  });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
