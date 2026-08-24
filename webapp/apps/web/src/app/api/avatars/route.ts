// GET  /api/avatars — list the talking-head avatars available to the caller:
//        • the STOCK marketplace (shared, global rows from the `avatars` table, Hebrew market
//          faces), plus
//        • the caller's OWN photo-avatars and digital twins (characters rows with kind
//          'photo'/'twin', gated by consent).
// POST /api/avatars — create a PHOTO avatar from an uploaded portrait (kind 'photo'). This
//        is the cheap Creator-tier path: the face rides the standard lip-sync engine. The
//        digital-twin path (kind 'twin', a 2-min driver video) goes through /api/consent first
//        and is handled by the avatar-mint flow.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, characters, avatars, assets, balanceOf } from '@shorts/db';
import { eq, desc, or } from 'drizzle-orm';
import { getBillingInfo } from '@/lib/billing-server';
import { writeFile } from '@/lib/storage';
import { createId } from '@paralleldrive/cuid2';

const db = getDb();

/** GET — the avatar picker source of truth: stock marketplace + the caller's own. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Stock marketplace (shared, active rows only).
  const stock = await db.query.avatars.findMany({
    where: eq(avatars.active, true),
    orderBy: [desc(avatars.createdAt)],
  });

  // The caller's own avatars (photo = quick face, twin = consented 2-min driver video).
  const mine = await db.query.characters.findMany({
    where: eq(characters.userId, session.user.id),
    orderBy: [desc(characters.createdAt)],
  });

  return NextResponse.json({
    stock: stock.map((a) => ({
      id: a.id,
      kind: a.kind,
      nameHe: a.nameHe,
      premium: a.premium,
      faceImageUrl: a.faceImageUrl ?? (a.faceImageKey ? `/media/${a.faceImageKey}` : null),
      talkModel: a.talkModel,
    })),
    mine: mine
      .filter((c) => (c as { kind?: string }).kind === 'photo' || (c as { kind?: string }).kind === 'twin')
      .map((c) => ({
        id: c.id,
        kind: (c as { kind?: string }).kind,
        name: c.name,
        status: c.status,
        faceImageUrl: c.refImageUrl ?? (c.refImageKey ? `/media/${c.refImageKey}` : null),
        talkModel: (c as { talkModel?: string | null }).talkModel ?? null,
        consentVerified: Boolean((c as { consentVerifiedAt?: Date | null }).consentVerifiedAt),
      })),
  });
}

const IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};
const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * POST — create a talking-head avatar.
 *  • kind 'photo' (default): upload ONE portrait → standard lip-sync (Creator+). Ready instantly —
 *    the uploaded face IS the locked ref (no mint pass).
 *  • kind 'twin':            upload a ~2-min DRIVER VIDEO → premium photoreal twin (Pro). Stays in
 *    'minting' until a spoken-consent clip clears /api/consent.
 */
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
  const kind = ((form.get('kind') as string | null) ?? 'photo').trim();
  const file = form.get('file');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (kind !== 'photo' && kind !== 'twin') {
    return NextResponse.json({ error: `unsupported kind: ${kind}` }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });

  // Gate: the avatar track is the PRO wedge (tracks.avatar.minTier='pro' / tierAllowsTrack) — a
  // photo avatar AND a digital twin are both Pro capabilities, like HeyGen's paid-only avatars.
  const billing = await getBillingInfo(userId, db);
  if (billing.tier !== 'pro') {
    return NextResponse.json({ error: 'avatars_require_pro', tier: billing.tier }, { status: 403 });
  }

  const id = createId();

  if (kind === 'photo') {
    const ext = IMAGE_MIME[file.type];
    if (!ext) return NextResponse.json({ error: `unsupported image mime: ${file.type}` }, { status: 415 });

    // 1) Store the uploaded portrait as an 'upload' asset.
    const faceKey = `avatars/${id}/face.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(faceKey, bytes);
    await db.insert(assets).values({
      userId,
      kind: 'image',
      storageKey: faceKey,
      url: `/media/${faceKey}`,
      bytes: bytes.length,
      source: 'upload',
    });

    // 2) Insert the avatar as a characters row (kind 'photo', ready — no mint job needed).
    const [row] = await db
      .insert(characters)
      .values({
        id,
        userId,
        name,
        status: 'ready',
        sourceImageKey: faceKey,
        refImageKey: faceKey, // photo avatar: the uploaded face IS the locked ref
        refImageUrl: `/media/${faceKey}`,
        kind: 'photo',
        specJson: { avatar: true },
      })
      .returning();

    return NextResponse.json({ avatar: row }, { status: 201 });
  }

  // kind === 'twin': the uploaded file is the DRIVER VIDEO, not a portrait.
  const ext = VIDEO_MIME[file.type];
  if (!ext) return NextResponse.json({ error: `unsupported video mime: ${file.type}` }, { status: 415 });

  // 1) Store the driver video as an 'upload' asset.
  const driverKey = `avatars/${id}/driver.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(driverKey, bytes);
  await db.insert(assets).values({
    userId,
    kind: 'video',
    storageKey: driverKey,
    url: `/media/${driverKey}`,
    bytes: bytes.length,
    source: 'upload',
  });

  // 2) Insert the twin (kind 'twin', minting — unlocked by the spoken-consent flow). The face ref
  //    is the driver video itself (the talk stage passes it as --driver for video-input models).
  const [row] = await db
    .insert(characters)
    .values({
      id,
      userId,
      name,
      status: 'minting',
      sourceImageKey: driverKey,
      refImageKey: driverKey, // driver video doubles as the premium face/driver ref
      kind: 'twin',
      specJson: { avatar: true, driverVideo: true },
    })
    .returning();

  return NextResponse.json({ avatar: row }, { status: 201 });
}
