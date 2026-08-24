// GET    /api/characters/[id] — character detail (owner-only).
// DELETE /api/characters/[id] — guarded delete. Returns 409 while any of the caller's
//   projects references the character (spec.characterId === id), mirroring the
//   asset-delete rule so an in-flight render never loses its locked reference.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, characters, projects } from '@shorts/db';
import { and, eq } from 'drizzle-orm';

const db = getDb();

async function ownedCharacter(id: string, userId: string) {
  return db.query.characters.findFirst({
    where: and(eq(characters.id, id), eq(characters.userId, userId)),
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const character = await ownedCharacter(id, session.user.id);
  if (!character) return NextResponse.json({ error: 'character not found' }, { status: 404 });
  return NextResponse.json({ character });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const character = await ownedCharacter(id, session.user.id);
  if (!character) return NextResponse.json({ error: 'character not found' }, { status: 404 });

  // Refuse to delete while any of the caller's projects references the character.
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
        error: 'character is in use by a project; remove it from those projects first',
        conflict: true,
        projects: referencing.map((p) => ({ id: p.id, title: p.title })),
      },
      { status: 409 }
    );
  }

  await db.delete(characters).where(and(eq(characters.id, id), eq(characters.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
