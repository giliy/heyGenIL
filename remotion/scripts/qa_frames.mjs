// qa_frames.mjs — FAST parallel QA still renderer (the context-safe replacement for
// the read-every-PNG loop).
//
//   node remotion/scripts/qa_frames.mjs <CompId> <f1,f2,...> [--scale=0.333] [--jpeg-quality=5] [--out=qa]
//
// Bundles once, then renders ALL cue frames of ONE composition IN PARALLEL via
// renderFrames (concurrency + onFrameBuffer) and writes each as a SMALL JPEG
// (~60KB) to remotion/out/qa/<out>/<id>-f####.jpg. This is what lets a QA agent
// read the whole cue set without overflowing context.
//
// Runs from the repo root. Needs the composition registered (npm run gen first).
// Requires a full-ish node + the @remotion packages already in remotion/node_modules.
import { bundle } from '@remotion/bundler';
import { selectComposition, renderFrames } from '@remotion/renderer';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMOTION = path.resolve(__dirname, '..'); // this script lives in remotion/scripts/
const ROOT = path.resolve(REMOTION, '..');      // repo root
const MEDIA = path.join(ROOT, 'media');

// Pin the SAME Chrome shell as render-all.mjs so QA stills match production renders
// bit-for-bit (feDisplacementMap / shadows / blur are GPU/Skia-rasterized and drift across
// Chrome builds). Override with REMOTION_BROWSER_EXECUTABLE. See render-all.mjs + T04-bisect-report.md.
const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
function resolvePinnedShell() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return path.resolve(process.env.REMOTION_BROWSER_EXECUTABLE);
  // .remotion is gitignored, so it is NOT copied into a worktree. Resolve against this tree first,
  // then against the main repo root (two levels up from a .claude/worktrees/<name> tree) as fallback.
  const candidates = [path.join(ROOT, ...SHELL_REL)];
  const parts = ROOT.split(path.sep);
  const wi = parts.lastIndexOf('worktrees');
  if (wi > 0 && parts[wi - 1] === '.claude') candidates.push(path.join(...parts.slice(0, wi - 1), ...SHELL_REL));
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const BROWSER_EXECUTABLE = resolvePinnedShell();
if (!BROWSER_EXECUTABLE) {
  console.warn('warn: pinned Chrome shell not found at', PINNED_SHELL, '— falling back to Remotion default.');
}

const args = process.argv.slice(2);
const id = args[0];
const frames = (args[1] ?? '0').split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n));
const scaleArg = args.find((a) => a.startsWith('--scale='));
const jqArg = args.find((a) => a.startsWith('--jpeg-quality='));
const outArg = args.find((a) => a.startsWith('--out='));
const SCALE = scaleArg ? Number(scaleArg.split('=')[1]) : 1 / 3; // ~360x640 on a 1080x1920 canvas
const JPEG_Q = jqArg ? Number(jqArg.split('=')[1]) : 5;
const SUB = (outArg ? outArg.split('=')[1] : 'small').replace(/^\/+|\/+$/g, '');

if (!id || frames.length === 0) {
  console.error('usage: node tools/qa_frames.mjs <CompId> <f1,f2,...> [--scale=0.333] [--jpeg-quality=5] [--out=small]');
  process.exit(1);
}

const outDir = path.join(REMOTION, 'out', 'qa', SUB);
mkdirSync(outDir, { recursive: true });

console.log(`bundling ${id}...`);
const serveUrl = await bundle({ entryPoint: path.join(REMOTION, 'src', 'index.ts'), publicDir: MEDIA });
const composition = await selectComposition({ serveUrl, id, browserExecutable: BROWSER_EXECUTABLE });
const last = composition.durationInFrames - 1;
const clamped = frames.map((f) => Math.max(0, Math.min(last, f)));

// Render each cue frame as its own 1-frame renderFrames call, ALL in parallel over
// the shared bundled serveUrl. frameRange is a single frame number (one frame); a
// multi-element list is NOT a valid FrameRange, so we fan out per-frame.
let done = 0;
await Promise.all(clamped.map(async (f) => {
  await renderFrames({
    serveUrl,
    composition,
    frameRange: f,
    scale: SCALE,
    concurrency: '75%', // 100% oversubscribed the box (14 Chrome tabs on 4K frames -> 33s render timeout);
    // 75% keeps QA parallel but stable (see T05 close-out).
    jpegQuality: JPEG_Q,
    imageFormat: 'jpeg',
    browserExecutable: BROWSER_EXECUTABLE,
    onFrameBuffer: (buffer, frame) => {
      const out = path.join(outDir, `${id}-f${String(frame).padStart(4, '0')}.jpg`);
      writeFileSync(out, buffer);
      console.log(`  -> ${path.relative(ROOT, out)} (${(buffer.length / 1024).toFixed(0)} KB)`);
    },
  });
  done++;
}));

console.log(`done: ${done} frame(s) -> ${path.relative(ROOT, outDir)}/`);
