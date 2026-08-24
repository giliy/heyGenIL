import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, normalizeSpec, getDurationSec } from '@shorts/spec';

const db = getDb();

/**
 * GET /api/projects/[id] — load a project + its spec for the editor.
 * Returns { project, spec }. The spec is normalized (defaults filled) so the editor
 * always works on a complete document.
 */
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

  const parsed = validateSpec(project.specJson);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'stored spec is invalid', issues: parsed.error.issues },
      { status: 500 }
    );
  }
  const spec = normalizeSpec(parsed.data);
  return NextResponse.json({ project, spec });
}

/**
 * PATCH /api/projects/[id] — autosave. Last-write-wins on revision.
 * Body: { spec, revision }. If body.revision < project.revision -> 409 { conflict, serverSpec }.
 * Else: validate, normalize, write specJson, bump revision, update duration/format/updatedAt.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: { spec?: unknown; revision?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (body.spec === undefined || typeof body.revision !== 'number') {
    return NextResponse.json({ error: 'spec and revision required' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Conflict: the client is saving over a newer server version. Last-write-wins means the
  // NEWER revision wins; an older client gets a 409 + the server spec, never an overwrite.
  if (body.revision < project.revision) {
    const serverParsed = validateSpec(project.specJson);
    return NextResponse.json(
      {
        conflict: true,
        serverRevision: project.revision,
        serverSpec: serverParsed.ok ? normalizeSpec(serverParsed.data) : project.specJson,
      },
      { status: 409 }
    );
  }

  const parsed = validateSpec(body.spec);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'invalid spec', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const spec = normalizeSpec(parsed.data);
  const newRevision = project.revision + 1;
  const now = new Date();
  spec.meta = { revision: newRevision, updatedAt: now.toISOString() };

  const [updated] = await db
    .update(projects)
    .set({
      specJson: spec,
      title: spec.title,
      revision: newRevision,
      durationSec: getDurationSec(spec),
      width: spec.format.width,
      height: spec.format.height,
      fps: spec.format.fps,
      updatedAt: now,
    })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated, spec });
}
