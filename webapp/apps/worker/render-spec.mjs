// render-spec.mjs — render a composition from a Spec, zero new TSX.
//
// Phase 1 refactor (the intended seam): the render logic is exported as a callable
//   renderSpec(templateId, spec, opts)  ->  { outputPath, posterPath, durationSec, width, height, fps }
// so the job-driven worker (src/render.ts) can invoke it in-process. The CLI keeps
// working for backward compat:
//   node render-spec.mjs --spec <spec.json> --template <CompId> [--out out/<id>.mp4] [--scale 1]
//
// Recipe mirrors remotion/scripts/render-all.mjs: zod-validate FIRST (fail fast, no
// Chrome launch), bundle once (cached), selectComposition with inputProps, renderMedia
// with the pinned headless-shell Chrome + concurrency:'75%' + onProgress.
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer';
import { readFileSync, mkdirSync, existsSync, statSync, copyFileSync, readdirSync, lstatSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { parseSpec } from '@shorts/spec';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'); // webapp/apps/worker -> repo root
const remotionRoot = path.join(root, 'remotion');
const mediaRoot = path.join(root, 'media');
const cacheDir = path.join(root, 'webapp', '.cache', 'bundles');
const outDirDefault = path.join(root, 'webapp', 'apps', 'worker', 'out');
mkdirSync(cacheDir, { recursive: true });

// ---- pinned Chrome shell (copied verbatim from remotion/scripts/render-all.mjs) ----
const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
export function resolvePinnedShell() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return path.resolve(process.env.REMOTION_BROWSER_EXECUTABLE);
  const candidates = [path.join(root, ...SHELL_REL)];
  const parts = root.split(path.sep);
  const wi = parts.lastIndexOf('worktrees');
  if (wi > 0 && parts[wi - 1] === '.claude') candidates.push(path.join(...parts.slice(0, wi - 1), ...SHELL_REL));
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const BROWSER_EXECUTABLE = resolvePinnedShell();
if (!BROWSER_EXECUTABLE) {
  console.warn('warn: pinned Chrome shell not found — falling back to Remotion default (rasterization may drift).');
}

// ---- bundle cache (keyed by template + remotion version + entry mtime) ----
async function getServeUrl(template) {
  const entryPoint = path.join(remotionRoot, 'src', 'index.ts');
  const pkgVersion = JSON.parse(readFileSync(path.join(remotionRoot, 'package.json'), 'utf8')).version ?? '0';
  const entryMtime = Math.round(statSync(entryPoint).mtimeMs);
  const cacheKey = `${template}-${pkgVersion}-${entryMtime}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const serveUrlPath = path.join(cacheDir, cacheKey);
  if (existsSync(serveUrlPath) && existsSync(path.join(serveUrlPath, 'index.html'))) {
    return serveUrlPath;
  }
  console.log('bundling remotion...');
  const url = await bundle({ entryPoint, publicDir: mediaRoot });
  // bundle() returns a temp dir; we copy it into a stable cache path so later runs reuse it.
  mkdirSync(serveUrlPath, { recursive: true });
  copyDir(url, serveUrlPath);
  return serveUrlPath;
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (lstatSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

/**
 * Render a spec to an mp4 (+ a frame-0 poster jpg).
 * @param {string} templateId   composition id (e.g. 'Short16Formy')
 * @param {unknown} specInput   the Spec (validated here; throws on malformed input)
 * @param {object} [opts]
 * @param {string} [opts.outputLocation]  absolute path for the mp4 (default worker/out/<id>.mp4)
 * @param {string} [opts.posterLocation]  absolute path for the poster jpg (default alongside mp4)
 * @param {number} [opts.scale]           render scale (default 1)
 * @param {(p:{progress:number})=>void} [opts.onProgress]
 * @returns {Promise<{outputPath:string, posterPath:string, durationSec:number, width:number, height:number, fps:number, durationInFrames:number}>}
 */
export async function renderSpec(templateId, specInput, opts = {}) {
  // 1) zod-validate FIRST (fail fast, no Chrome launch)
  const spec = parseSpec(specInput);
  if (spec.template !== templateId) {
    console.warn(`warn: spec.template (${spec.template}) != templateId (${templateId}); rendering ${templateId} anyway.`);
  }

  // 2) bundle once, cached
  const serveUrl = await getServeUrl(templateId);

  // 3) select composition with inputProps = { spec } (template props shape is { spec? });
  //    calculateMetadata derives duration from the passed spec.
  const inputProps = { spec };
  const composition = await selectComposition({
    serveUrl,
    id: templateId,
    inputProps,
    browserExecutable: BROWSER_EXECUTABLE,
  });
  console.log(`composition ${composition.id}: ${composition.durationInFrames}f @ ${composition.fps}fps ${composition.width}x${composition.height}`);

  const scale = opts.scale ?? 1;
  const outputPath = opts.outputLocation
    ? path.resolve(opts.outputLocation)
    : path.join(outDirDefault, `${templateId}-${spec.id}.mp4`);
  const posterPath = opts.posterLocation
    ? path.resolve(opts.posterLocation)
    : path.join(path.dirname(outputPath), `${templateId}-${spec.id}.poster.jpg`);
  mkdirSync(path.dirname(outputPath), { recursive: true });

  // Concurrency: 1080x1920 frames are memory-heavy. '75%' (~10 tabs on 14 cores) OOM-crashed a
  // tab mid-render on a 9.7GB-free box (Page crashed! at ~12%). A low ABSOLUTE cap is far more
  // reliable than a percentage of cores — tabs don't scale linearly with available RAM. Default
  // 4; override with REMOTION_CONCURRENCY when the box has headroom.
  const concurrency = Math.max(1, Number(process.env.REMOTION_CONCURRENCY ?? 4) || 4);

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    outputLocation: outputPath,
    scale,
    overwrite: true,
    concurrency,
    codec: 'h264',
    pixelFormat: 'yuv420p',
    imageFormat: 'jpeg',
    crf: 21,
    browserExecutable: BROWSER_EXECUTABLE,
    onProgress: opts.onProgress,
  });

  // Poster = frame 0 (fully composed per brand.md §6). Non-fatal if it fails.
  try {
    await renderStill({
      serveUrl,
      composition,
      inputProps,
      output: posterPath,
      frame: 0,
      scale,
      overwrite: true,
      imageFormat: 'jpeg',
      browserExecutable: BROWSER_EXECUTABLE,
    });
  } catch (e) {
    console.warn('warn: poster renderStill failed (continuing without poster):', e?.message ?? String(e));
  }

  return {
    outputPath,
    posterPath,
    durationSec: composition.durationInFrames / composition.fps,
    durationInFrames: composition.durationInFrames,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
  };
}

// ---- CLI (backward compat) ----
function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const specPath = flag('--spec');
  const template = flag('--template');
  const outArg = flag('--out');
  const scale = flag('--scale') ? Number(flag('--scale')) : 1;
  if (!specPath || !template) {
    console.error('usage: node render-spec.mjs --spec <spec.json> --template <CompId> [--out out/x.mp4] [--scale 1]');
    process.exit(1);
  }
  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    console.error('could not read spec file:', e?.message ?? String(e));
    process.exit(1);
  }
  try {
    const result = await renderSpec(template, spec, {
      outputLocation: outArg ?? undefined,
      scale,
      onProgress: ({ progress }) => process.stdout.write(`\r  ${template}: ${Math.round(progress * 100)}%   `),
    });
    process.stdout.write('\n');
    console.log('rendered ->', result.outputPath);
  } catch (e) {
    if (e?.errors) {
      console.error('spec validation failed (no render started):');
      for (const err of e.errors) console.error(`  - ${err.path.join('.')} :: ${err.message}`);
    } else {
      console.error('render failed:', e?.message ?? String(e));
    }
    process.exit(1);
  }
}

if (isMain()) {
  main();
}
