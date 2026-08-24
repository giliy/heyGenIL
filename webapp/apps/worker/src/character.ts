// character.ts — worker handler for the Phase-2 'character-mint' generate job. Runs
// gen_image.py --ref <source portrait> to produce the LOCKED canonical reference
// (character.png), writes the asset + updates the characters row to 'ready', then
// DEDUCTS on success or REFUNDS on fail ("charged only on success").
//
// The mint output is the reference every later scene image is conditioned on
// (runAiImageJob passes --ref <character.png> when a project carries characterId).
import { getDb, characters, assets, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { completeAndDeduct, failAndRefund } from './billing.js';
import { resolveKey } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');

export interface CharacterMintInput {
  kind: 'character-mint';
  characterId: string;
  userId: string;
  sourceKey: string; // the uploaded source portrait (storage key)
  videoModel: string;
  name: string;
}

function imagePython(): string {
  const venv = process.env.AI_IMAGE_VENV ?? '.venv-image312';
  return path.join(repoRoot, venv, 'Scripts', 'python.exe');
}
function genImagePy(): string {
  return path.join(repoRoot, 'tools', 'gen_image.py');
}

function runPython(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(imagePython(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.stdout.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gen_image exited ${code}: ${err.slice(-1500)}`));
    });
    child.on('error', (e) => reject(e));
  });
}

/**
 * Run a character-mint job: lock the canonical reference image. On success set the
 * character 'ready' with refImageKey/refImageUrl + specJson.video_model, write the
 * reference as an 'ai' asset, and DEDUCT. On any failure set 'failed' and REFUND.
 */
export async function runCharacterMintJob(
  db: Db,
  jobId: string,
  inputJson: unknown,
  reservedCredits: number
): Promise<void> {
  const input = inputJson as CharacterMintInput;
  if (input.kind !== 'character-mint') {
    await failAndRefund(db, jobId, input.userId, reservedCredits, 'invalid character-mint payload');
    return;
  }

  const character = await db.query.characters.findFirst({ where: eq(characters.id, input.characterId) });
  if (!character) {
    await failAndRefund(db, jobId, input.userId, reservedCredits, 'character not found');
    return;
  }

  // The locked reference: characters/<id>/character.png, conditioned on the source portrait.
  const refKey = `characters/${input.characterId}/character.png`;
  const absOut = resolveKey(refKey);
  const absSource = resolveKey(input.sourceKey);
  const url = `/media/${refKey}`;

  console.log(`[character-mint] locking reference for ${input.characterId} from ${input.sourceKey} cost=${reservedCredits}cr`);

  try {
    await runPython([
      genImagePy(),
      '--prompt',
      `A clean, front-facing, well-lit character reference portrait of: ${input.name}. Neutral background, full face visible, high detail — this is the canonical reference for a recurring character.`,
      '--ref', absSource,
      '--model', 'pro',
      '--aspect', '9:16',
      '--size', '2K',
      '--out', absOut,
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[character-mint] generation failed: ${msg}`);
    await db.update(characters).set({ status: 'failed', updatedAt: new Date() }).where(eq(characters.id, input.characterId));
    await failAndRefund(db, jobId, input.userId, reservedCredits, `character-mint failed: ${msg}`);
    return;
  }

  // ---- SUCCESS: write the reference asset, lock the character, then DEDUCT. ----
  try {
    await db.insert(assets).values({
      userId: input.userId,
      projectId: null,
      kind: 'image',
      storageKey: refKey,
      url,
      source: 'ai',
    });

    await db
      .update(characters)
      .set({
        status: 'ready',
        refImageKey: refKey,
        refImageUrl: url,
        specJson: { video_model: input.videoModel, locked: true, sourceKey: input.sourceKey },
        updatedAt: new Date(),
      })
      .where(eq(characters.id, input.characterId));

    await completeAndDeduct(db, jobId, input.userId, reservedCredits, 'deduct:character-mint');
    await db.update(jobs).set({ resultJson: { url, storageKey: refKey } }).where(eq(jobs.id, jobId)).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[character-mint] post-processing failed (refund): ${msg}`);
    await db.update(characters).set({ status: 'failed', updatedAt: new Date() }).where(eq(characters.id, input.characterId));
    await failAndRefund(db, jobId, input.userId, reservedCredits, `character-mint post failed: ${msg}`);
  }
}
