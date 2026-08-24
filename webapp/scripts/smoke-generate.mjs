// smoke-generate.mjs — Phase 3 end-to-end smoke for the generate orchestrator.
//
// What it does (no paid keys — kokoro voice + TSX template = free tier):
//   1. Ensures a smoke user + project exist.
//   2. Inserts a type='generate' job whose inputJson carries a LOCKED 3-line script
//      (with one deliberately EDITED line — this is the script-fidelity assertion).
//   3. Claims + runs it in-process via claimNextGenerateJob + runGenerate (same path the
//      worker loop uses).
//   4. Asserts: job done, stage 'render', resultJson.outputKey set, project ready.
//   5. ffprobe's the stored mp4: has a video stream AND a non-silent audio stream, and
//      the spec's spoken lines match the locked text verbatim.
// Exits 0 on pass, 1 on fail.
//
// Run from webapp/:  node scripts/smoke-generate.mjs
// Requires: DATABASE_URL + STORAGE_DIR (worker .env), docker db up, .venv-voice312 built.
//
// The orchestrator is TypeScript, so this script must run under `tsx` (the same loader the
// worker uses). When invoked as plain `node scripts/smoke-generate.mjs`, we re-exec
// ourselves through tsx from the repo node_modules. Everything below that point is the
// real body and runs under tsx.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bootstrap: if we were started with plain `node`, re-exec via tsx so .ts imports resolve.
// We invoke `node` with tsx's ESM loader directly (NOT the .bin/tsx.cmd wrapper) so stdout
// propagates reliably from a plain `node scripts/smoke-generate.mjs` invocation.
if (!process.env.SMOKE_GENERATE_IN_TSX) {
  const webappRoot = path.resolve(__dirname, '..');
  const tsxEsm = path.join(webappRoot, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs');
  const tsxPkg = path.join(webappRoot, 'node_modules', 'tsx', 'package.json');
  if (!existsSync(tsxPkg)) {
    console.error('smoke-generate: tsx not installed — run `npm install` in webapp/ first');
    process.exit(1);
  }
  const loaderArg = existsSync(tsxEsm)
    ? ['--import', pathToFileURL(tsxEsm).href]
    : ['--loader', pathToFileURL(path.join(webappRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href];
  const r = spawnSync(
    process.execPath,
    [...loaderArg, fileURLToPath(import.meta.url)],
    { stdio: 'inherit', env: { ...process.env, SMOKE_GENERATE_IN_TSX: '1' }, cwd: webappRoot }
  );
  process.exit(r.status ?? 1);
}
const WEBAPP = path.resolve(__dirname, '..');
const WORKER_ENV = path.join(WEBAPP, 'apps', 'worker', '.env');

// --- Load the worker .env (DATABASE_URL + STORAGE_DIR) into the process env. ---
function loadEnv(file) {
  if (!existsSync(file)) throw new Error(`missing env file: ${file}`);
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(WORKER_ENV);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set (worker .env)');
if (!process.env.STORAGE_DIR) throw new Error('STORAGE_DIR not set (worker .env)');

// Dynamic imports AFTER env is loaded (db pool opens lazily, but keep order explicit).
const { getDb, users, projects, jobs } = await import('@shorts/db');
const { createId } = await import('@paralleldrive/cuid2');
const { claimNextGenerateJob } = await import('../apps/worker/src/claim.ts');
const { runGenerate } = await import('../apps/worker/src/orchestrate/runGenerate.ts');
const { eq } = await import('drizzle-orm');

const db = getDb();
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

// The locked script. Line 2 is deliberately "weird" (the user's EDITED line) so we can
// assert the spoken/caption text carries it VERBATIM (script fidelity, not re-derived).
const LOCKED_LINES = [
  'These three words rebuilt a small shop.',
  'SMOKE-EDITED: seven lemons for a single token.',
  'You can say it back in one breath.',
];

async function main() {
  console.log('smoke-generate: seeding user + project + generate job…');

  // 1) User (upsert by email).
  const email = 'smoke-generate@local';
  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    const id = createId();
    await db.insert(users).values({ id, email, name: 'Smoke Generate' });
    user = await db.query.users.findFirst({ where: eq(users.email, email) });
  }

  // 2) Project (status generating; the orchestrator flips it ready/failed).
  const projectId = createId();
  await db.insert(projects).values({
    id: projectId,
    userId: user.id,
    title: 'Smoke Generate — lemons',
    template: 'form-card',
    engine: 'tsx',
    status: 'generating',
    width: 1080,
    height: 1920,
    fps: 30,
    revision: 0,
  });

  // 3) Job — inputJson is the GeneratePayload with the LOCKED script + kokoro voice.
  const jobId = createId();
  const payload = {
    topic: 'A tiny shop rebuilt with three words',
    title: 'Smoke Generate — lemons',
    template: 'form-card',
    script: LOCKED_LINES.map((text) => ({ text })),
    voice: { engine: 'kokoro', voiceId: 'af_bella' },
    captions: { preset: 'pop', burnIn: true },
    theme: { accent: '#6366F1' },
  };
  await db.insert(jobs).values({
    id: jobId,
    projectId,
    type: 'generate',
    status: 'queued',
    stage: 'queued',
    progress: 0,
    inputJson: payload,
    costCredits: 0,
  });
  console.log(`  jobId=${jobId} projectId=${projectId} (3 locked lines, kokoro)`);

  // 4) Claim + run in-process (same claim the worker loop uses).
  const claimed = await claimNextGenerateJob(db);
  check('claimed the inserted generate job', !!claimed && claimed.id === jobId, claimed ? `claimed ${claimed.id}` : 'nothing claimed');
  if (!claimed) return 1;

  console.log('smoke-generate: running story → voice → pixel → build → qa → mix → render…');
  await runGenerate(db, jobId, projectId, claimed.inputJson, claimed.costCredits ?? 0);

  // 5) Re-read job + project, assert terminal state.
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  const proj = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });

  check('job status done', job?.status === 'done', `status=${job?.status}${job?.error ? ` error=${job.error}` : ''}`);
  check('job stage render (final)', job?.stage === 'render', `stage=${job?.stage}`);
  const outputKey = job?.resultJson?.outputKey ?? null;
  check('resultJson.outputKey set', typeof outputKey === 'string' && outputKey.length > 0, outputKey ?? 'missing');
  check('project status ready', proj?.status === 'ready', `status=${proj?.status}`);
  if (outputKey && proj?.outputKey) {
    check('project.outputKey mirrors job', proj.outputKey === outputKey, proj.outputKey);
  }

  // 6) Script fidelity: the stored spec's spoken lines must equal the LOCKED text verbatim.
  const spoken = job?.resultJson?.spec?.voice?.lines ?? null;
  if (Array.isArray(spoken) && spoken.length === LOCKED_LINES.length) {
    const verbatim = LOCKED_LINES.every((l, i) => (spoken[i].text ?? '') === l);
    check('locked script spoken VERBATIM (incl. edited line)', verbatim, verbatim ? 'all 3 lines match' : `got ${JSON.stringify(spoken.map((s) => s.text))}`);
  } else {
    check('locked script lines recorded', false, `expected 3 lines, got ${JSON.stringify(spoken)}`);
  }

  // 7) ffprobe the stored mp4: video stream + non-silent audio stream.
  if (outputKey) {
    const mp4 = path.join(process.env.STORAGE_DIR, outputKey);
    check('output mp4 exists on disk', existsSync(mp4), mp4);
    if (existsSync(mp4)) {
      const probe = probeMedia(mp4);
      check('mp4 has a video stream', probe.hasVideo, probe.streams);
      check('mp4 has an audio stream', probe.hasAudio, probe.streams);
      check('mp4 audio is NON-SILENT', probe.nonSilent, `meanVol=${probe.meanVolume ?? 'n/a'} maxVol=${probe.maxVolume ?? 'n/a'}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0
    ? `\nsmoke-generate: PASS (${results.length}/${results.length})`
    : `\nsmoke-generate: FAIL (${failed.length} failed)`);
  return failed.length === 0 ? 0 : 1;
}

// ffprobe via the repo wrapper (tools/ffw.py) — never a bare ffmpeg/ffprobe on PATH.
function probeMedia(mp4) {
  const repoRoot = path.resolve(WEBAPP, '..');
  const ffw = path.join(repoRoot, 'tools', 'ffw.py');
  const script = [
    'import json,sys',
    'sys.path.insert(0, r' + JSON.stringify(path.join(repoRoot, 'tools')) + ')',
    'import ffw',
    'out = ffw.ffprobe("-v","error","-show_entries","stream=codec_type","-of","json", sys.argv[1]).stdout',
    // volumedetect is an ffmpeg FILTER (ffprobe has no -af); ffmpeg prints stats on stderr,
    // which ffw merges into stdout. -i input, -af volumedetect, null muxer discards frames.
    'vol = ffw.ffmpeg("-v","info","-i",sys.argv[1],"-af","volumedetect","-f","null","-").stdout',
    'print(json.dumps({"streams": json.loads(out), "vol": vol}))',
  ].join('\n');
  const r = spawnSync('python', ['-c', script, mp4], { encoding: 'utf8', cwd: repoRoot });
  const out = { hasVideo: false, hasAudio: false, nonSilent: false, streams: 'none', meanVolume: null, maxVolume: null };
  if (r.status !== 0) return out;
  try {
    const parsed = JSON.parse(r.stdout.trim().split('\n').pop());
    const streams = (parsed.streams && parsed.streams.streams) || [];
    const types = streams.map((s) => s.codec_type);
    out.hasVideo = types.includes('video');
    out.hasAudio = types.includes('audio');
    out.streams = types.join(',');
    const vol = String(parsed.vol || '');
    const mean = vol.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const max = vol.match(/max_volume:\s*([-\d.]+)\s*dB/);
    if (mean) out.meanVolume = Number(mean[1]);
    if (max) out.maxVolume = Number(max[1]);
    // Non-silent: max volume meaningfully above -inf (threshold -45 dB).
    if (out.maxVolume != null && out.maxVolume > -45) out.nonSilent = true;
  } catch {
    /* leave defaults */
  }
  return out;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('smoke-generate: fatal', e);
    process.exit(1);
  });
