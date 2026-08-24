import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, assets } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { writeFile, keyFor } from '@/lib/storage';

const db = getDb();

/** GET /api/projects/[id]/assets — list the project's assets (Media tab). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const list = await db.query.assets.findMany({ where: eq(assets.projectId, id) });
  return NextResponse.json({ assets: list });
}

const MIME_KIND: Record<string, 'image' | 'video' | 'audio'> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
};

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * POST /api/projects/[id]/assets — react-dropzone upload -> local disk (/media/<key>),
 * insert an assets row. multipart/form-data: file (with optional w/h/durationSec fields).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const kind = MIME_KIND[file.type];
  if (!kind) {
    return NextResponse.json({ error: `unsupported mime: ${file.type}` }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = EXT[file.type] ?? 'bin';
  const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const key = keyFor(id, filename);
  await writeFile(key, bytes);

  const url = `/media/${key}`;
  const w = Number(form.get('w') ?? '') || null;
  const h = Number(form.get('h') ?? '') || null;
  const durationSec = Number(form.get('durationSec') ?? '') || null;

  const [asset] = await db
    .insert(assets)
    .values({
      userId: session.user.id,
      projectId: id,
      kind,
      storageKey: key,
      url,
      w: w && w > 0 ? w : null,
      h: h && h > 0 ? h : null,
      durationSec,
      bytes: bytes.length,
      source: 'upload',
    })
    .returning();

  return NextResponse.json({ asset }, { status: 201 });
}
