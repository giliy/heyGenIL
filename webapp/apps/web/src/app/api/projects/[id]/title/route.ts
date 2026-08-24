import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec } from '@shorts/spec';

const db = getDb();

/**
 * PATCH /api/projects/[id]/title — save the top-bar title. Also rides the spec's title
 * so the dashboard card + Player reflect it. Body: { title }.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Update the title on the project row AND in the stored spec (if a spec exists), so the
  // spec document stays the source of truth for the Player + future renders.
  let specJson = project.specJson as Record<string, unknown> | null | undefined;
  if (specJson) {
    const parsed = validateSpec(specJson);
    if (parsed.ok) {
      specJson = { ...specJson, title };
      await db.update(projects).set({ specJson }).where(eq(projects.id, id));
    }
  }

  const [updated] = await db
    .update(projects)
    .set({ title, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}
