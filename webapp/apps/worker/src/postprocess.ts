// postprocess.ts — Phase 4 free-tier post-render pass: downscale to 720p + burn a
// semi-transparent brand watermark. PAID renders are clean 1080p (no pass → no quality loss).
//
// Approach: render is always 1080p at scale:1 from renderSpec; only a free render runs this
// ffmpeg pass. Resolution: `scale=-2:1280` keeps aspect → 720p vertical (720x1280 for 9:16).
// Watermark: a pre-generated brand PNG (media/library/brand/watermark.png, indigo gradient
// bar + "made with Shorts Studio") composited in the lower-third above the SAFE bottom zone,
// at y≈1440 in 1920-high composition space → after 720p scale (0.667), y≈960 of 1280.
//
// ffmpeg is resolved via tools/bin/ (never bare `ffmpeg` — see ENV CORRECTIONS).
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
// repo root = webapp/apps/worker/src -> ../../../..  (webapp/apps/worker/src -> webapp -> repo root)
const repoRoot = path.resolve(here, '..', '..', '..', '..');

export interface PostProcessResult {
  outputPath: string;
  width: number;
  height: number;
}

/** Resolve the full ffmpeg.exe path (tools/bin/ffmpeg.exe). */
export function resolveFfmpeg(): string {
  const p = path.join(repoRoot, 'tools', 'bin', 'ffmpeg.exe');
  return p;
}

/** Resolve the brand watermark PNG path. */
export function watermarkPng(): string {
  return path.join(repoRoot, 'media', 'library', 'brand', 'watermark.png');
}

/**
 * Run ffmpeg as a promise, streaming stderr to the worker log. Throws on non-zero exit.
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const exe = resolveFfmpeg();
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-2000)}`));
    });
    child.on('error', (e) => reject(e));
  });
}

/**
 * Read a video's true pixel dimensions via ffprobe (never trust a hardcoded value — the
 * rendered file is the source of truth). Throws if ffprobe can't parse the stream.
 */
export async function probeDims(file: string): Promise<{ width: number; height: number }> {
  const exe = path.join(repoRoot, 'tools', 'bin', 'ffprobe.exe');
  return new Promise((resolve, reject) => {
    const child = spawn(
      exe,
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${err.slice(-500)}`));
      const m = out.trim().match(/(\d+)\s*,\s*(\d+)/);
      if (!m) return reject(new Error(`ffprobe unparsable dims: ${out.trim()}`));
      resolve({ width: parseInt(m[1], 10), height: parseInt(m[2], 10) });
    });
    child.on('error', (e) => reject(e));
  });
}

/**
 * Post-process a rendered mp4 for the free tier: downscale to the tier's max height and burn
 * the watermark. Returns the path to the processed file + its TRUE dimensions (probed, not
 * assumed). Throws on ffmpeg failure (the caller refunds + fails the job).
 *
 * ASPECT-AWARE: renders come in at the spec's format (9:16 1080×1920, 1:1 1080×1080, 16:9
 * 1920×1080, …). The old code hardcoded `scale=-2:1280` + `720×1280`, which UPSCALED a square
 * or landscape frame and reported wrong dims. Now we scale by the LONGEST side to the tier's
 * 1280 target (preserving aspect) and probe the real output dims.
 */
export async function postProcess(
  inputPath: string,
  opts: { targetResolution: '720p' | '1080p'; watermark: boolean }
): Promise<PostProcessResult> {
  const outPath = path.join(path.dirname(inputPath), 'processed.mp4');
  const wmPath = watermarkPng();

  // Downscale to the free tier's 720p budget, ASPECT-AWARE, NEVER upscaling. Cap each side at
  // 1280 via min(1280, i{w,h}) so a smaller source (e.g. 1:1 1080×1080) is left untouched, while
  // a larger one shrinks to fit. `force_original_aspect_ratio=decrease` preserves aspect (no
  // crop); `force_divisible_by=2` keeps dims even for libx264/yuv420p.
  //   9:16 1080×1920 -> 720×1280   (long side 1920→1280)
  //   1:1  1080×1080 -> 1080×1080  (already ≤1280 — no upscale)
  //   16:9 1920×1080 -> 1280×720   (long side 1920→1280)
  const scaleFilter =
    `scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;

  let args: string[];
  if (opts.watermark) {
    // Watermark sits at 75% of frame height (above the safe bottom) regardless of aspect;
    // sized to 39% of frame width so it reads on square + landscape too.
    const filter =
      `[0:v]${scaleFilter}[base];` +
      `[1:v]scale='trunc(iw*0.39/2)*2':-1[wm];` +
      `[base][wm]overlay=(main_w-overlay_w)/2:main_h*0.75-overlay_h/2:format=auto`;
    args = [
      '-y',
      '-i', inputPath,
      '-i', wmPath,
      '-filter_complex', filter,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outPath,
    ];
  } else {
    args = [
      '-y',
      '-i', inputPath,
      '-vf', scaleFilter,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outPath,
    ];
  }
  await runFfmpeg(args);
  // Report the TRUE dims (probed), never a hardcoded constant.
  const dims = await probeDims(outPath);
  return { outputPath: outPath, width: dims.width, height: dims.height };
}
