// Bulk renderer: bundles once, renders every shot in the manifest.
//   node scripts/render-all.mjs                 -> render all
//   node scripts/render-all.mjs LevelsOverview  -> render only these ids
//   node scripts/render-all.mjs --still         -> render a poster PNG per shot instead of video
// Opaque shots -> out/<id>.mp4 (h264). transparent:true shots -> out/<id>.mov (ProRes 4444 + alpha).
// Rendered at scale 2 (author 1080p -> 4K output) to composite crisply over the 4K master.
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');

// Pin the Chrome shell so feDisplacementMap / drop-shadow / box-shadow / blur rasterize
// bit-identically across runs and Remotion bumps (see .claude/plans/upgrade/tickets/T04-bisect-report.md).
// chromeMode defaults to 'headless-shell' and this is the cached headless-shell binary; we pass
// browserExecutable explicitly so a version-file re-download can never silently swap the shell.
// Override with REMOTION_BROWSER_EXECUTABLE to re-pin.
const SHELL_REL = ['.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'];
function resolvePinnedShell() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return path.resolve(process.env.REMOTION_BROWSER_EXECUTABLE);
  // .remotion is gitignored, so it is NOT copied into a worktree. Resolve against this tree first,
  // then against the main repo root (two levels up from a .claude/worktrees/<name> tree) as fallback.
  const candidates = [path.join(repoRoot, ...SHELL_REL)];
  const parts = repoRoot.split(path.sep);
  const wi = parts.lastIndexOf('worktrees');
  if (wi > 0 && parts[wi - 1] === '.claude') candidates.push(path.join(...parts.slice(0, wi - 1), ...SHELL_REL));
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const BROWSER_EXECUTABLE = resolvePinnedShell();
if (!BROWSER_EXECUTABLE) {
  console.warn('warn: pinned Chrome shell not found at', PINNED_SHELL, '— falling back to Remotion default (cross-build rasterization may drift).');
}
const args = process.argv.slice(2);
const stillMode = args.includes('--still');
const scaleArg = args.find((a) => a.startsWith('--scale='));
// Scale precedence: CLI --scale=  >  optional per-shot manifest `scale`  >  default 2.
// CLI_SCALE is null when no --scale= flag was passed, so a manifest `scale: 1` can win;
// when the flag IS passed it always wins. SCALE is the no-manifest fallback (unchanged: 2).
const CLI_SCALE = scaleArg ? Number(scaleArg.split('=')[1]) : null;
const SCALE = CLI_SCALE ?? 2;
const scaleFor = (shot) => CLI_SCALE ?? shot.scale ?? SCALE;
const onlyIds = args.filter((a) => !a.startsWith('--'));

const manifest = JSON.parse(readFileSync(path.join(root, 'src', 'shots.manifest.json'), 'utf8'));
const outDir = path.join(root, 'out');
mkdirSync(outDir, { recursive: true });

console.log('bundling...');
// publicDir must be passed explicitly: remotion.config.ts only applies to the CLI,
// not the programmatic bundle() API. ../media is the public root.
const serveUrl = await bundle({ entryPoint: path.join(root, 'src', 'index.ts'), publicDir: path.join(root, '..', 'media') });

let n = 0;
for (const shot of manifest) {
  if (onlyIds.length && !onlyIds.includes(shot.id)) continue;
  const composition = await selectComposition({ serveUrl, id: shot.id, browserExecutable: BROWSER_EXECUTABLE });

  if (stillMode) {
    const out = path.join(outDir, `${shot.id}.png`);
    await renderStill({
      serveUrl, composition, output: out, scale: scaleFor(shot), overwrite: true,
      frame: Math.floor(composition.durationInFrames * 0.6),
      imageFormat: shot.transparent ? 'png' : 'jpeg',
      browserExecutable: BROWSER_EXECUTABLE,
    });
    console.log('  still ->', path.relative(root, out));
  } else {
    const transparent = !!shot.transparent;
    const out = path.join(outDir, `${shot.id}.${transparent ? 'mov' : 'mp4'}`);
    await renderMedia({
      serveUrl, composition, outputLocation: out, scale: scaleFor(shot), overwrite: true,
      concurrency: '75%', // 100% (all 14 cores, one Chrome tab per frame) oversubscribed the box and
      // 4K frames starved past Remotion's 33s render timeout (TimeoutError at frame 104) — see T05
      // close-out. 75% (~10 tabs) keeps near-full CPU use without the starvation cliff.
      codec: transparent ? 'prores' : 'h264',
      browserExecutable: BROWSER_EXECUTABLE,
      proResProfile: transparent ? '4444' : undefined,
      pixelFormat: transparent ? 'yuva444p10le' : 'yuv420p',
      imageFormat: transparent ? 'png' : 'jpeg',
      crf: transparent ? undefined : 18, // 21 -> 18: Remotion's high-quality-social guidance; cleaner gradients/text at a modest size cost
      onProgress: ({ progress }) => process.stdout.write(`\r  ${shot.id}: ${Math.round(progress * 100)}%   `),
    });
    process.stdout.write('\n');
    console.log('  ->', path.relative(root, out));
  }
  n++;
}
console.log(`done: ${n} shot(s) rendered to out/`);
