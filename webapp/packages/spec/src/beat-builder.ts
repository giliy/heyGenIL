// beat-builder.ts — the deterministic beat-sheet builder shared by the web script-preview
// (POST /api/generate/script) and the worker's story stage.
//
// SCRIPT FIDELITY: the same locked lines => the same timings in BOTH the step-2 preview and
// the actual job. The worker's story stage always starts from the user's LOCKED vo[] lines
// (passed in the generate payload) — never re-derived. Timing is assigned deterministically
// at ~2.7 words/sec with a slack rule.

export interface BeatVoLine {
  text: string;
  start: number;
  end: number;
  words?: { w: string; start: number; end: number }[];
}

export interface BeatsJson {
  id: string;
  title: string;
  format: { width: number; height: number; fps: number; durationSec: number };
  voiceStatus?: string;
  vo: BeatVoLine[];
  beats: { name: string; start_s: number; end_s: number }[];
}

const WORDS_PER_SEC = 2.7;
const MIN_LINE_SEC = 0.9;
const LINE_GAP = 0.05;

/** Estimate the spoken duration of one line (seconds). */
export function estimateLineSec(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_LINE_SEC, words / WORDS_PER_SEC + 0.3);
}

/**
 * Build a beats.json from a set of (possibly user-locked) VO lines. Deterministic:
 * same lines => same timings.
 */
export function buildBeatsFromLines(
  lines: { text: string }[],
  opts: { id: string; title: string; format?: { width: number; height: number; fps: number } }
): BeatsJson {
  const format = opts.format ?? { width: 1080, height: 1920, fps: 30 };
  const vo: BeatVoLine[] = [];
  const beats: { name: string; start_s: number; end_s: number }[] = [];

  let t = 0.5;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    const dur = estimateLineSec(text);
    const start = Math.round(t * 100) / 100;
    const end = Math.round((start + dur) * 100) / 100;
    vo.push({ text, start, end });
    beats.push({ name: `beat-${i + 1}`, start_s: start, end_s: end });
    t = end + LINE_GAP;
  }

  const totalSec = Math.round((vo.length > 0 ? vo[vo.length - 1].end : 1) * 100) / 100;
  return {
    id: opts.id,
    title: opts.title,
    format: { ...format, durationSec: totalSec },
    vo,
    beats,
  };
}

/**
 * Topic-only story builder: a rules-based beat template (hook → pain → intro →
 * how-it-works → proof → cta) seeded by the topic. The user edits these in step 2 before
 * locking, so they become the locked script.
 */
export function topicToLines(topic: string, title?: string): string[] {
  const t = title?.trim() || topic.trim();
  return [
    `Want to master ${t}? Here's the shortcut.`,
    `Most people get ${t} wrong — and it costs them.`,
    `Here's how ${t} actually works, step by step.`,
    `This is the part everyone skips — don't.`,
    `Do this once, and ${t} starts working for you.`,
    `That's ${t} — simpler than you thought. Try it today.`,
  ];
}
