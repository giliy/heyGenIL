// py.ts — spawn the python engine tools via a per-tool interpreter map.
//
// THE PIPELINE IS PORTED TO TS, but the engine's stages are python tools
// (gen_voice, gen_voice_edge, contracts.py, audio_gate.py, mix_sfx.py, mix_music.py,
// qa_frames via node). This module owns HOW those tools are invoked: repo-root cwd,
// a per-tool TOOL_VENV interpreter map (never a single hard-coded voice venv — Phase 4's
// AI_IMAGE_VENV drops in via the map without refactoring), and a fail-fast runPython
// wrapper.
//
// Interpreter rules:
//   - kokoro/whisperx (gen_voice --engine kokoro, align_words) need Python 3.12 —
//     .venv-voice312. Deps (kokoro/torch) have no cp313/cp314 wheels.
//   - edge-tts (gen_voice_edge) also lives in .venv-voice312.
//   - stdlib tools (contracts.py, audio_gate.py, mix_sfx.py, mix_music.py, ffw.py)
//     run on system python (any 3.10+).
//   - gen_image -> AI_IMAGE_VENV (Phase 4; inert now).
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Repo root. `here` = webapp/apps/worker/src/orchestrate; the repo root is the dir that
// holds webapp/, remotion/, tools/, .venv-voice312 — five levels up.
export function repoRoot(): string {
  return path.resolve(here, '..', '..', '..', '..', '..');
}

export function toolsDir(): string {
  return path.join(repoRoot(), 'tools');
}

export function remotionDir(): string {
  return path.join(repoRoot(), 'remotion');
}

export function voiceVenvDir(): string {
  return path.join(repoRoot(), '.venv-voice312');
}

export function storageDir(): string {
  const dir = process.env.STORAGE_DIR;
  if (!dir) throw new Error('STORAGE_DIR is not set');
  return path.resolve(dir);
}

// --- Per-tool interpreter map. ---
// Keys are the engine tool names; values are a function that resolves the interpreter
// absolute path for that tool. Phase 4 adds 'gen_image' -> AI_IMAGE_VENV here with no
// rework elsewhere.
export type ToolKey = 'kokoro' | 'whisperx' | 'edge' | 'stdlib' | 'gen_image';

export interface ToolVenvSpec {
  /** Human name of the venv, for error messages. */
  label: string;
  /** Resolve the interpreter's absolute path (may throw if the venv is missing). */
  resolve: () => string;
  /** Present required by this tool. */
  required: boolean;
}

const VOICE_VENV = path.join(voiceVenvDir(), 'Scripts', 'python.exe');
const STD_PY = 'python';

function assertFile(p: string, label: string): string {
  if (!existsSync(p)) throw new Error(`${label} interpreter not found: ${p}`);
  return p;
}

export const TOOL_VENV: Record<ToolKey, ToolVenvSpec> = {
  kokoro: {
    label: '.venv-voice312 (Python 3.12)',
    required: true,
    resolve: () => assertFile(VOICE_VENV, 'kokoro'),
  },
  whisperx: {
    label: '.venv-voice312 (Python 3.12)',
    required: true,
    resolve: () => assertFile(VOICE_VENV, 'whisperx'),
  },
  edge: {
    label: '.venv-voice312 (Python 3.12)',
    required: true,
    resolve: () => assertFile(VOICE_VENV, 'edge'),
  },
  stdlib: {
    label: 'system python (3.10+)',
    required: false,
    resolve: () => STD_PY, // resolved by the OS PATH; ffw/contracts are stdlib-only
  },
  // Phase 4 arms this. Phase 3 free tier needs NO image venv.
  gen_image: {
    label: 'AI_IMAGE_VENV',
    required: false,
    resolve: () => process.env.AI_IMAGE_VENV ?? VOICE_VENV, // placeholder until Phase 4
  },
};

/** Resolve the interpreter for a tool key (throws if a required venv is missing). */
export function interpreterFor(tool: ToolKey): string {
  const spec = TOOL_VENV[tool];
  if (!spec) throw new Error(`unknown tool venv key: ${tool}`);
  return spec.resolve();
}

export interface RunPythonOpts {
  tool: ToolKey;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  /** Fail fast on non-zero exit (default true). */
  failFast?: boolean;
  timeoutMs?: number;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  combined: string;
}

/**
 * Run a python tool with the resolved interpreter for `tool`.
 * cwd defaults to the REPO ROOT (engine tools resolve project paths against CWD and
 * engine paths against their own location; repo-root cwd keeps both correct).
 * Throws on non-zero exit unless failFast:false.
 */
export function runPython(opts: RunPythonOpts): Promise<RunResult> {
  const interp = interpreterFor(opts.tool);
  const cwd = opts.cwd ?? repoRoot();
  const env = { ...process.env, ...(opts.env ?? {}) };

  return new Promise((resolve, reject) => {
    const child = spawn(interp, opts.args, { cwd, env });
    let stdout = '';
    let stderr = '';
    const timer =
      opts.timeoutMs !== undefined
        ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs)
        : undefined;

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`failed to spawn ${interp}: ${e.message}`));
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const combined = `${stdout}${stderr}`;
      if (opts.failFast === false || code === 0) {
        resolve({ code: code ?? -1, stdout, stderr, combined });
      } else {
        reject(
          new Error(
            `${opts.tool} tool exited ${code}\n  cmd: ${interp} ${opts.args.join(' ')}\n${combined.slice(-3000)}`
          )
        );
      }
    });
  });
}

/** Spawn a non-python process (e.g. node qa_frames.mjs, npm run gen). cwd=repo root. */
export function runProcess(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; failFast?: boolean } = {}
): Promise<RunResult> {
  const cwd = opts.cwd ?? repoRoot();
  const env = { ...process.env, ...(opts.env ?? {}) };
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => reject(new Error(`failed to spawn ${cmd}: ${e.message}`)));
    child.on('close', (code) => {
      const combined = `${stdout}${stderr}`;
      if (opts.failFast === false || code === 0) {
        resolve({ code: code ?? -1, stdout, stderr, combined });
      } else {
        reject(new Error(`${cmd} exited ${code}\n${combined.slice(-3000)}`));
      }
    });
  });
}
