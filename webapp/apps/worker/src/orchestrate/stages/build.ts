// build.ts — stage 4: build the silent master.
//
// 1) cd remotion && npm run gen (regenerate the registry + vo.gen.ts from the just-written
//    voice stage file).
// 2) engine.ts: cached bundle + selectComposition + renderMedia a SILENT MASTER to
//    <dir>/build/silent.mp4 (75% concurrency, pinned headless shell, crf:21).
// 3) Write qa-contract.json (compId, master, frame list from beat boundaries + frame 0,
//    loop f0/flast, scale 0.333, jpegQuality) and validate it with contracts.py qa-contract.
//
// The bundle is cached per template+version by render-spec.mjs (Phase 1's lever).
import path from 'path';
import { promises as fs } from 'fs';
import type { Spec } from '@shorts/spec';
import { renderSilentMaster } from '../engine';
import { runPython, runProcess, repoRoot, storageDir } from '../py';
import type { StageReport } from '../types';
import type { StageWriter } from '../writer';

export interface BuildOutcome {
  silentMaster: string;
  qaContractPath: string;
  frames: number[];
  durationInFrames: number;
  fps: number;
}

/**
 * Run the build stage. `onSubProgress` maps renderMedia's 0..1 into the build stage window.
 */
export async function runBuildStage(
  spec: Spec,
  projectId: string,
  workDir: string,
  writer: StageWriter
): Promise<BuildOutcome> {
  await writer.begin('build');

  // 1) Regenerate the remotion registry + vo.gen.ts (the voice stage wrote it).
  await runProcess('npm', ['run', 'gen'], { cwd: path.join(repoRoot(), 'remotion') });

  // 2) Render the silent master.
  const silentMaster = path.join(workDir, 'build', 'silent.mp4');
  const { outputPath, durationSec, durationInFrames, fps } = await renderSilentMaster(
    spec.template,
    spec,
    silentMaster,
    ({ progress }) => writer.set('build', progress)
  );

  // 3) QA contract — frame list = frame 0 + a frame near each beat boundary + the last frame.
  const fpsNum = spec.format.fps;
  const lastFrame = Math.max(0, durationInFrames - 1);
  const frames = new Set<number>([0, lastFrame]);
  // Sample at scene boundaries (global seconds -> frames).
  let acc = 0;
  for (const s of spec.scenes) {
    frames.add(Math.min(lastFrame, Math.max(0, Math.round(acc * fpsNum))));
    acc += s.durationSec;
  }
  frames.add(Math.min(lastFrame, Math.max(0, Math.round(acc * fpsNum))));
  const frameList = Array.from(frames).sort((a, b) => a - b);

  // Phase 4 (AI-video): a generative short is only "done" when frame 0 == last frame (the
  // seamless loop). That closure is a HARD contract for engine 'ai', so the build stage
  // declares it and the QA stage enforces it. TSX/other tracks leave closure unspecified
  // (their loop is cosmetic, not a success gate).
  const aiVideo = spec.engine === 'ai' || spec.mode === 'ai';
  const qaContract = {
    compId: spec.template,
    master: outputPath,
    frames: frameList.map((f) => ({ f, at: 'beat-boundary' })),
    loop: { f0: 0, flast: lastFrame, ...(aiVideo ? { closure: 'required' } : {}) },
    ...(aiVideo ? { aiVideo: true } : {}),
    scale: 0.333,
    jpegQuality: 5,
  };
  const qaContractPath = path.join(workDir, 'build', 'qa-contract.json');
  await fs.writeFile(qaContractPath, JSON.stringify(qaContract, null, 2), 'utf8');

  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'qa-contract', qaContractPath],
  });

  await writer.flush('build', 1);
  return { silentMaster: outputPath, qaContractPath, frames: frameList, durationInFrames, fps };
}
