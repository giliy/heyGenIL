// qa.ts — stage 5: QA.
//
// Runs remotion/scripts/qa_frames.mjs <CompId> <f,...> --scale=0.333 to render small JPEGs
// (the worker does NOT read pixels into context — mirrors orchestrate's discipline). It then
// writes qa-verdicts.json. Phase 3's AUTO-QA = a structural pass: the render completed and
// the master's duration matches the spec (via qa-contract). Frame CONTENT verdicting (a
// perceptual-hash / blank-frame check) stays a P1.
//
// QA FAIL => the orchestrator retries the build (bounded, max 2) then re-runs this stage.
import path from 'path';
import { promises as fs } from 'fs';
import type { Spec } from '@shorts/spec';
import { runPython, runProcess, repoRoot, storageDir } from '../py';
import type { StageReport } from '../types';
import type { StageWriter } from '../writer';

export interface QaOutcome {
  verdict: 'PASS';
  verdictPath: string;
}

/**
 * Run the QA stage: render the QA frame JPEGs, then write + validate qa-verdicts.json.
 * `masterPath` is the silent master; `frames` the contract frame list; `expectedDurationSec`
 * the spec duration (structural check). Throws on a FAIL verdict.
 */
export async function runQaStage(
  spec: Spec,
  projectId: string,
  workDir: string,
  masterPath: string,
  frames: number[],
  expectedDurationSec: number,
  writer: StageWriter
): Promise<QaOutcome> {
  await writer.begin('qa');

  const compId = spec.template;
  const frameArg = frames.join(',');

  // Render the QA JPEGs (context-safe; ~5KB each). Non-fatal if a frame render hiccups,
  // but a full failure is a hard QA FAIL.
  try {
    await runProcess('node', [
      path.join(repoRoot(), 'remotion', 'scripts', 'qa_frames.mjs'),
      compId,
      frameArg,
      '--scale=0.333',
      '--jpeg-quality=5',
      `--out=${path.basename(workDir)}`,
    ]);
  } catch (e) {
    throw new Error(`QA FAIL: frame render failed: ${(e as Error).message}`);
  }

  // Structural pass: the master exists and its duration matches the spec.
  // (Frame-content verdicting is a P1 — the audio_gate on the final mux + this structural
  // check are the free-tier QA.)
  let masterDurationSec = expectedDurationSec;
  try {
    masterDurationSec = await probeDurationSec(masterPath);
  } catch {
    throw new Error('QA FAIL: could not probe the master duration');
  }
  const durationOk = Math.abs(masterDurationSec - expectedDurationSec) < 0.5;

  // Phase 4 (AI-video): the seamless loop (frame 0 == last frame) is a HARD contract for
  // engine 'ai'. Frame-pixel comparison is P1, so the structural proxy is: every scene must
  // be backed by a video clip (each clip is generated image-to-video from the locked
  // character, and the tail clip carries end-frame conditioning to settle onto frame 0).
  // A scene missing its clip breaks the loop → QA FAIL, even if duration matches.
  const aiVideo = spec.engine === 'ai' || spec.mode === 'ai';
  let loopOk = true;
  let loopIssue: string | null = null;
  if (aiVideo) {
    const missing = spec.scenes.filter((s) => !s.clip);
    if (missing.length > 0) {
      loopOk = false;
      loopIssue = `AI-video loop: ${missing.length} scene(s) missing a clip (${missing.map((s) => s.id).join(', ')}) — frame 0 == last frame cannot be guaranteed`;
    }
  }

  const issues: string[] = [];
  if (!durationOk) issues.push(`master duration ${masterDurationSec}s != spec ${expectedDurationSec}s`);
  if (loopIssue) issues.push(loopIssue);
  const verdict = issues.length === 0 ? 'PASS' : 'FAIL';

  const qaVerdicts = {
    compId,
    verdict,
    perFrame: frames.map((f) => ({ f, pass: true })),
    loop_match: loopOk,
    ...(aiVideo ? { aiVideo_loop_required: true } : {}),
    issues,
  };
  const verdictPath = path.join(workDir, 'build', 'qa-verdicts.json');
  await fs.writeFile(verdictPath, JSON.stringify(qaVerdicts, null, 2), 'utf8');

  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'qa-verdicts', verdictPath],
  });

  if (verdict !== 'PASS') {
    throw new Error(`QA FAIL: ${qaVerdicts.issues.join('; ')}`);
  }

  await writer.flush('qa', 1);
  return { verdict: 'PASS', verdictPath };
}

async function probeDurationSec(p: string): Promise<number> {
  const probe = await runPython({
    tool: 'stdlib',
    args: [
      '-c',
      [
        'import sys, subprocess, os',
        'sys.path.insert(0, os.path.join(os.getcwd(), "tools"))',
        'import ffw',
        'out = subprocess.run([ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",',
        '  "-of", "default=noprint_wrappers=1:nokey=1", r"' + p + '"], capture_output=True, text=True)',
        'print(out.stdout.strip())',
      ].join('\n'),
    ],
  });
  const val = parseFloat(probe.stdout.trim());
  if (!Number.isFinite(val)) throw new Error(`bad duration: ${val}`);
  return val;
}
