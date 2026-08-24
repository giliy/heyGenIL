// GET    /api/avatars/[id] — one of the caller's OWN avatars (characters kind photo|twin).
// DELETE /api/avatars/[id] — guarded delete. Returns 409 while any of the caller's projects
//   references the avatar (spec.characterId === id), so an in-flight render never loses its
//   locked face/driver reference. Stock avatars are shared → never deletable from here.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, characters, projects } from '@shorts/db';
import { and, eq } from 'drizzle-orm';

const db = getDb();

const AVATAR_KINDS = new Set(['photo', 'twin']);

async function ownedAvatar(id: string, userId: string) {
  const row = await db.query.characters.findFirst({
    where: and(eq(characters.id, id), eq(characters.userId, userId)),
  });
  if (!row) return null;
  const kind = (row as { kind?: string }).kind;
  return kind && AVATAR_KINDS.has(kind) ? row : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const avatar = await ownedAvatar(id, session.user.id);
  if (!avatar) return NextResponse.json({ error: 'avatar not found' }, { status: 404 });
  return NextResponse.json({ avatar });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const avatar = await ownedAvatar(id, session.user.id);
  if (!avatar) return NextResponse.json({ error: 'avatar not found' }, { status: 404 });

  // Refuse to delete while any of the caller's projects references the avatar.
  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
    columns: { id: true, title: true, specJson: true },
  });
  const referencing = userProjects.filter((p) => {
    const spec = p.specJson as { characterId?: string } | null;
    return spec?.characterId === id;
  });
  if (referencing.length > 0) {
    return NextResponse.json(
      {
        error: 'avatar is in use by a project; remove it from those projects first',
        conflict: true,
        projects: referencing.map((p) => ({ id: p.id, title: p.title })),
      },
      { status: 409 }
    );
  }

  await db.delete(characters).where(and(eq(characters.id, id), eq(characters.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
