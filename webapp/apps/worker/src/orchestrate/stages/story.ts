// story.ts — stage 1: produce beats.json (+ script.md) from the wizard payload.
//
// SCRIPT FIDELITY (the differentiator): when the user passed a LOCKED vo[] script in the
// generate payload, this stage builds beats.json directly from those exact lines — never
// re-derived, never rewritten by an LLM. Timing is assigned deterministically at ~2.7
// words/sec with a slack rule. The topic-only path (no locked script) is a rules-based
// beat template seeded by the topic; the user then edits those lines in step 2 BEFORE
// locking, so the happy path still ends at a locked script.
//
// Output: beats.json (validated by contracts.py beats) + script.md.
import path from 'path';
import { promises as fs } from 'fs';
import type { GeneratePayload } from '@shorts/spec';
import { buildBeatsFromLines, topicToLines, type BeatsJson } from '@shorts/spec';
import { runPython, repoRoot, storageDir } from '../py';
import type { StageWriter } from '../writer';

/**
 * Run the story stage for a generate job.
 * - lockedScript present => build beats.json from the exact lines (script fidelity).
 * - topic only => rules-based template (user edits before locking in step 2).
 * Writes input.json, beats.json, script.md under <STORAGE_DIR>/generate/<projectId>/.
 * Validates beats.json with contracts.py beats. Returns the beats + the working dir.
 */
export async function runStoryStage(
  payload: GeneratePayload,
  projectId: string,
  writer: StageWriter
): Promise<{ beatsPath: string; workDir: string; beats: BeatsJson }> {
  await writer.begin('story');

  const workDir = path.join(storageDir(), 'generate', projectId);
  await fs.mkdir(path.join(workDir, 'voice'), { recursive: true });
  await fs.mkdir(path.join(workDir, 'build'), { recursive: true });
  await fs.mkdir(path.join(workDir, 'out'), { recursive: true });

  // The working-dir contract: input.json is the seed.
  await fs.writeFile(path.join(workDir, 'input.json'), JSON.stringify(payload, null, 2), 'utf8');

  const title = payload.title?.trim() || payload.topic.trim();
  const locked = payload.script && payload.script.length > 0;

  const lines = locked
    ? payload.script!.map((l) => ({ text: l.text }))
    : topicToLines(payload.topic, title).map((text) => ({ text }));

  const beats = buildBeatsFromLines(lines, {
    id: `gen-${projectId}`,
    title,
  });

  const beatsPath = path.join(workDir, 'beats.json');
  await fs.writeFile(beatsPath, JSON.stringify(beats, null, 2), 'utf8');

  // script.md — the human brief (optional but nice; mirrors the engine).
  const scriptMd = [
    `# ${title}`,
    '',
    ...beats.vo.map((l, i) => `${i + 1}. ${l.text}`),
    '',
    `_(locked: ${locked ? 'yes' : 'no — topic-derived draft'})_`,
  ].join('\n');
  await fs.writeFile(path.join(workDir, 'script.md'), scriptMd, 'utf8');

  // Contract gate: beats.json must validate.
  await runPython({
    tool: 'stdlib',
    args: [path.join(repoRoot(), 'tools', 'contracts.py'), 'beats', beatsPath],
  });

  await writer.flush('story', 1);
  return { beatsPath, workDir, beats };
}
