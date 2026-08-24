// POST /api/consent — record + verify the SPOKEN consent for a digital-twin avatar.
//
// HeyGen's trust gate: before a user's 2-min driver video can be turned into a lip-synced
// talking head, the person in the video must record themselves speaking a unique Hebrew
// consent phrase (anti-impersonation). This route stores the uploaded consent clip as a
// 'consent_video' asset, runs the spoken-code check (the worker verifies the audio matches
// the issued phrase), and on pass stamps consentVerifiedAt on the character so the twin
// becomes usable in the talk stage.
//
// Flow:
//   1. Client requests a consent challenge (GET) → server returns a one-time Hebrew phrase.
//   2. Client records the phrase on camera, POSTs the clip here.
//   3. The worker's consent-verify step compares the spoken audio to the phrase (WhisperX he
//      alignment) and marks consentVerifiedAt.
//   Body: multipart/form-data { characterId, file } (the recorded consent clip).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, characters, assets, jobs, projects } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';
import { writeFile } from '@/lib/storage';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';

const db = getDb();

// In-memory challenge store (single-process dev). Production: move to a redis/DB row with TTL.
const challenges = new Map<string, { phrase: string; expires: number }>();
const PHRASE_TTL_MS = 10 * 60 * 1000;

const HEBREW_WORDS = [
  'שלום', 'אני', 'מסכים', 'להשתמש', 'בתמונה', 'שלי', 'לסרטון', 'דיגיטלי', 'באחריותי', 'הבנתי',
];

/** GET — issue a one-time spoken-consent challenge phrase (Hebrew) for a character id. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const characterId = new URL(req.url).searchParams.get('characterId');
  if (!characterId) return NextResponse.json({ error: 'characterId required' }, { status: 400 });

  const c = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
  if (!c || c.userId !== session.user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 4 random Hebrew words → the phrase the user must speak on camera.
  const phrase = Array.from({ length: 4 }, () => HEBREW_WORDS[crypto.randomInt(HEBREW_WORDS.length)]).join(' ');
  challenges.set(`${session.user.id}:${characterId}`, { phrase, expires: Date.now() + PHRASE_TTL_MS });
  return NextResponse.json({ phrase, characterId });
}

const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** POST — store the consent clip + mark the character pending verification. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }
  const characterId = (form.get('characterId') as string | null)?.trim();
  const file = form.get('file');
  if (!characterId) return NextResponse.json({ error: 'characterId required' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'file (consent clip) required' }, { status: 400 });
  const ext = VIDEO_MIME[file.type];
  if (!ext) return NextResponse.json({ error: `unsupported video mime: ${file.type}` }, { status: 415 });

  const c = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
  if (!c || c.userId !== userId) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Consent re-record = retry path for a rejected twin. On resubmit, move the character back
  // to 'minting' (consent-pending) so the UI stops showing the failed state while the new
  // clip verifies.
  const isRetry = c.status === 'failed';

  const key = `${userId}:${characterId}`;
  const ch = challenges.get(key);
  if (!ch || ch.expires < Date.now()) {
    return NextResponse.json({ error: 'challenge expired — request a new phrase (GET /api/consent)' }, { status: 410 });
  }

  // Store the consent clip.
  const consentKey = `avatars/${characterId}/consent.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(consentKey, bytes);
  await db.insert(assets).values({
    userId,
    kind: 'consent_video',
    storageKey: consentKey,
    url: `/media/${consentKey}`,
    bytes: bytes.length,
    source: 'upload',
  });

  // Mark the character consent-pending, then ENQUEUE the verify job. The worker's
  // 'consent-verify' handler runs verify_consent.py (WhisperX Hebrew ASR w/ a deterministic
  // non-silent fallback) over the clip and flips the twin to 'ready'+consentVerifiedAt on pass,
  // 'failed' on mismatch. Free (0 credits) — a trust gate, not a paid generation.
  await db
    .update(characters)
    .set({
      consentAssetKey: consentKey,
      // Re-record after a rejection: back to consent-pending while the new clip verifies.
      ...(isRetry ? { status: 'minting' as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId));

  // The jobs table requires a projectId (NOT NULL). Anchor to the caller's most-recent project
  // when one exists (mirrors the character-mint anchor).
  const anchor = await db.query.projects.findFirst({
    where: eq(projects.userId, userId),
    orderBy: [desc(projects.createdAt)],
  });

  const [job] = await db
    .insert(jobs)
    .values({
      projectId: anchor?.id ?? characterId,
      type: 'generate',
      status: 'queued',
      stage: 'consent',
      progress: 0,
      inputJson: {
        kind: 'consent-verify' as const,
        characterId,
        userId,
        consentKey,
        phrase: ch.phrase,
      },
      costCredits: 0,
      reservedCredits: 0,
    })
    .returning();

  challenges.delete(key);
  return NextResponse.json({
    characterId,
    consentAssetKey: consentKey,
    phrase: ch.phrase,
    jobId: job.id,
    status: 'pending_verification',
  });
}
