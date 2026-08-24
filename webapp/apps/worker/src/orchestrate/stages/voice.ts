// voice.ts — stage 2: generate the voice track from beats.json.
//
// kokoro (default, $0, local via .venv-voice312) is primary; edge is a P1 secondary and
// on edge failure we fall back to kokoro automatically. Either writes voice.wav + real
// word times back into beats.json (gen_voice*.py does this). We then:
//   1. audio_gate the voice.wav (non-silent) — a silent voice is a hard stop.
//   2. Read beats.json back for the REAL line timings + words, and update the spec's
//      voice.lines so the render consumes the exact spoken + captioned text.
// Sub-progress reports line i/n as each line is fit (gen_voice emits per-line lines we
// can't easily parse, so we report coarse per-stage progress + a heartbeat).
import path from 'path';
import { promises as fs } from 'fs';
import type { GeneratePayload, Spec, VoiceLine, BeatsJson } from '@shorts/spec';
import { runPython, repoRoot, storageDir } from '../py';
import type { StageReport } from '../types';
import type { StageWriter } from '../writer';

const KOKORO_DEFAULT = 'af_bella'; // zero-key local voice (ENGLISH ONLY — no Hebrew)
const EDGE_DEFAULT = 'en-US-AriaNeural';
const EDGE_HEBREW_DEFAULT = 'he-IL-HilaNeural'; // the Hebrew-safe edge voice
const ELEVENLABS_DEFAULT = 'TX3LPaxmHKxFdv7VOQHJ'; // ElevenLabs premade "Liam"
// The two bundled Hebrew edge personas (api/generate/voices). On a Hebrew edge failure we try
// the OTHER he-IL voice before giving up — NEVER kokoro (English-only, would garble Hebrew).
const EDGE_HEBREW_VOICES = ['he-IL-HilaNeural', 'he-IL-AvriNeural'];

type VoiceEngine = 'kokoro' | 'edge' | 'elevenlabs';

const HEBREW_RE = /[֑-׿]/; // Hebrew Unicode block U+0591–U+05FF

/** True when this spec is Hebrew-spoken: declared language/rtl, the avatar track, or the
 *  locked script lines actually contain Hebrew characters. Drives the kokoro guard. */
function specIsHebrew(spec: Spec, payload: GeneratePayload): boolean {
  if (spec.language === 'he' || spec.rtl === true) return true;
  if (spec.engine === 'avatar' || spec.mode === 'avatar') return true;
  const lines = payload.script ?? spec.voice?.lines ?? [];
  return lines.some((l) => HEBREW_RE.test(l.text ?? ''));
}

export interface VoiceOutcome {
  voiceWav: string;
  lines: VoiceLine[]; // spec voice.lines with REAL word times
}

/**
 * Run gen_voice*.py for the given engine and read back the real timings.
 * Returns the updated beats.json vo[] (with words).
 *
 * kokoro + elevenlabs both go through gen_voice.py (--engine selects the backend); edge has
 * its own tool (gen_voice_edge.py). ElevenLabs is a paid path — the tier gate runs earlier
 * (generate/render route + cost gate), so by the time we're here the spend was authorized.
 */
async function synthesize(
  engine: VoiceEngine,
  voiceId: string,
  beatsPath: string,
  workDir: string,
  writer: StageWriter
): Promise<BeatsJson> {
  const emitTs = path.join(repoRoot(), 'remotion', 'src', 'shots', 'short-16', 'vo.gen.ts');
  if (engine === 'kokoro' || engine === 'elevenlabs') {
    await runPython({
      tool: engine === 'kokoro' ? 'kokoro' : 'stdlib', // elevenlabs needs no kokoro venv
      args: [
        path.join(repoRoot(), 'tools', 'gen_voice.py'),
        '--beats', beatsPath,
        '--engine', engine,
        '--voice', voiceId,
        '--emit-ts', emitTs,
      ],
    });
  } else {
    await runPython({
      tool: 'edge',
      args: [
        path.join(repoRoot(), 'tools', 'gen_voice_edge.py'),
        '--beats', beatsPath,
        '--voice', voiceId,
        '--emit-ts', emitTs,
      ],
    });
  }
  // gen_voice*.py wrote actual timings + words back into beats.json.
  const raw = await fs.readFile(beatsPath, 'utf8');
  return JSON.parse(raw) as BeatsJson;
}

/**
 * Run the voice stage. kokoro primary, edge fallback. Gates the voice.wav (non-silent),
 * then returns the spec voice.lines with real word times.
 */
export async function runVoiceStage(
  payload: GeneratePayload,
  spec: Spec,
  beatsPath: string,
  workDir: string,
  writer: StageWriter
): Promise<VoiceOutcome> {
  await writer.begin('voice');

  const voiceWav = path.join(workDir, 'voice', 'voice.wav');
  const requestedEngine = payload.voice.engine;
  let engine: VoiceEngine = requestedEngine;
  let voiceId = payload.voice.voiceId;

  const hebrew = specIsHebrew(spec, payload);

  // Ensure we always have a valid default voice id per engine. For Hebrew specs, NEVER seed a
  // kokoro default (kokoro is English-only) — push to a Hebrew edge voice instead.
  if (engine === 'kokoro' && hebrew) {
    console.warn('[voice] kokoro has NO Hebrew — redirecting Hebrew spec to edge ' + EDGE_HEBREW_DEFAULT);
    engine = 'edge';
    voiceId = EDGE_HEBREW_DEFAULT;
  }
  if (engine === 'kokoro' && !voiceId) voiceId = KOKORO_DEFAULT;
  if (engine === 'edge' && !voiceId) voiceId = hebrew ? EDGE_HEBREW_DEFAULT : EDGE_DEFAULT;
  if (engine === 'elevenlabs' && !voiceId) voiceId = ELEVENLABS_DEFAULT;

  let beats: BeatsJson;
  try {
    beats = await synthesize(engine, voiceId, beatsPath, workDir, writer);
  } catch (e) {
    if (engine === 'edge') {
      if (hebrew) {
        // HEBREW: never fall back to kokoro (English-only). Try the OTHER he-IL voice once,
        // then rethrow — a failed Hebrew voice must hard-stop, not silently become English.
        const other = EDGE_HEBREW_VOICES.find((v) => v !== voiceId) ?? EDGE_HEBREW_DEFAULT;
        console.warn(`[voice] edge ${voiceId} failed for Hebrew (${(e as Error).message}); trying ${other} — kokoro fallback DISABLED for Hebrew`);
        beats = await synthesize('edge', other, beatsPath, workDir, writer);
      } else {
        // English/LTR P1 fallback: edge is an unofficial endpoint; fall back to kokoro.
        console.warn(`[voice] edge failed (${(e as Error).message}); falling back to kokoro`);
        engine = 'kokoro';
        voiceId = KOKORO_DEFAULT;
        beats = await synthesize(engine, voiceId, beatsPath, workDir, writer);
      }
    } else {
      throw e;
    }
  }

  // Progress within voice: gen_voice synthesizes per-line. Report coarse progress.
  const total = Math.max(1, beats.vo.length);
  for (let i = 0; i < beats.vo.length; i++) {
    writer.set('voice', i / total);
  }
  await writer.flush('voice', 1);

  // AUDIO GATE on voice.wav — a silent voice is a hard stop.
  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'audio_gate.py'), voiceWav],
  });

  // Build the spec voice.lines from the REAL timings + words.
  const lines: VoiceLine[] = beats.vo.map((l) => ({
    text: l.text,
    start: l.start,
    end: l.end,
    words: l.words,
  }));

  return { voiceWav, lines };
}
