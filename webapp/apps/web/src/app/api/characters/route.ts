// GET  /api/characters — list the caller's locked recurring characters (newest first).
// POST /api/characters — create + mint a character from an uploaded reference portrait.
//   multipart/form-data: { name, file, videoModel? }
//   → stores the source portrait as an 'upload' asset, inserts a characters row
//     (status 'minting'), enqueues a 'character-mint' generate job that runs
//     gen_image --ref to lock character.png, reserves the aiImage credit cost, and
//     returns the new character. Cost is stated up front and charged ONLY on success.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, characters, projects, jobs, assets, balanceOf, reserveCredits } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';
import { CREDIT_TABLE } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';
import { writeFile, keyFor } from '@/lib/storage';
import { createId } from '@paralleldrive/cuid2';

const db = getDb();

/** GET — list the caller's characters. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const list = await db.query.characters.findMany({
    where: eq(characters.userId, session.user.id),
    orderBy: [desc(characters.createdAt)],
  });
  return NextResponse.json({ characters: list });
}

const IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

/** POST — create + mint a character (paid-only: the lock image is a generated AI image). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }
  const name = (form.get('name') as string | null)?.trim();
  const videoModel = ((form.get('videoModel') as string | null) ?? 'seedance').trim() || 'seedance';
  const file = form.get('file');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'file (reference portrait) required' }, { status: 400 });
  const ext = IMAGE_MIME[file.type];
  if (!ext) return NextResponse.json({ error: `unsupported image mime: ${file.type}` }, { status: 415 });

  // PAID-ONLY gate: the lock image is a generated AI image (a Creator feature).
  const billing = await getBillingInfo(userId, db);
  if (!isPaidTier(billing.tier)) {
    return NextResponse.json({ error: 'characters_require_paid', tier: billing.tier }, { status: 403 });
  }

  // Cost: one AI image (the locked reference). State it up front; charge only on success.
  const cost = CREDIT_TABLE.aiImage;
  const balance = await balanceOf(userId, db);
  if (balance < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', shortfall: cost - balance, credits: cost, balance },
      { status: 402 }
    );
  }

  // The jobs table requires a projectId (NOT NULL). Anchor the mint job to the caller's
  // most-recent project when one exists (the claim loop joins projects for the owner id).
  const anchor = await db.query.projects.findFirst({
    where: eq(projects.userId, userId),
    orderBy: [desc(projects.createdAt)],
  });

  // 1) Store the uploaded source portrait as an 'upload' asset under the new character id.
  const characterId = createId();
  const sourceKey = `characters/${characterId}/source.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(sourceKey, bytes);
  await db.insert(assets).values({
    userId,
    projectId: anchor?.id ?? null,
    kind: 'image',
    storageKey: sourceKey,
    url: `/media/${sourceKey}`,
    bytes: bytes.length,
    source: 'upload',
  });

  // 2) Insert the character row (status 'minting') with the canonical spec stub.
  const [character] = await db
    .insert(characters)
    .values({
      id: characterId,
      userId,
      name,
      status: 'minting',
      sourceImageKey: sourceKey,
      specJson: { video_model: videoModel, locked: false },
    })
    .returning();

  // 3) Enqueue the character-mint generate job + reserve the credit cost.
  const inputJson = {
    kind: 'character-mint' as const,
    characterId,
    userId,
    sourceKey,
    videoModel,
    name,
  };
  const [job] = await db
    .insert(jobs)
    .values({
      projectId: anchor?.id ?? characterId, // anchor to a project for the claim-loop owner join
      type: 'generate',
      status: 'queued',
      stage: 'mint',
      progress: 0,
      inputJson,
      costCredits: cost,
      reservedCredits: cost,
    })
    .returning();

  // Record the mint job on the character (for progress/error surfacing in the UI).
  await db.update(characters).set({ mintJobId: job.id, updatedAt: new Date() }).where(eq(characters.id, characterId));

  try {
    await reserveCredits(userId, cost, job.id, 'reserve:character-mint', db);
  } catch (e) {
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    await db.update(characters).set({ status: 'failed' }).where(eq(characters.id, characterId));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ character, jobId: job.id, costCredits: cost }, { status: 201 });
}
