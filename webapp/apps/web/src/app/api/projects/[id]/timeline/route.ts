// POST /api/projects/[id]/timeline — persist an overlay-trim from the mini-timeline.
// Body: { sceneId, overlayId, start, end } — validates scene-relative 0<=start<end<=scene.durationSec,
// bumps meta.revision, returns the new spec. This is the mini-timeline escape hatch writing the SAME
// doc fields the range slider writes (scene-relative overlay start/end).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, normalizeSpec, round3 } from '@shorts/spec';
import { z } from 'zod';

const db = getDb();

const bodySchema = z.object({
  sceneId: z.string().min(1),
  overlayId: z.string().min(1),
  start: z.number().nonnegative().finite(),
  end: z.number().positive().finite(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { sceneId, overlayId, start, end } = parsed.data;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'stored spec invalid' }, { status: 500 });
  }
  const spec = v.data;
  const scene = spec.scenes.find((s) => s.id === sceneId);
  if (!scene) return NextResponse.json({ error: 'scene not found' }, { status: 404 });
  const overlay = scene.overlays.find((o) => o.id === overlayId);
  if (!overlay) return NextResponse.json({ error: 'overlay not found' }, { status: 404 });

  // Validate the scene-relative window: 0<=start<end<=scene.durationSec.
  if (start < 0 || end <= start || end > scene.durationSec + 1e-6) {
    return NextResponse.json(
      { error: 'invalid overlay window', start, end, sceneDuration: scene.durationSec },
      { status: 400 }
    );
  }

  // Mutate the overlay's scene-relative timing + bump revision.
  overlay.start = round3(start);
  overlay.end = round3(end);
  const newRevision = project.revision + 1;
  const now = new Date();
  spec.meta = { revision: newRevision, updatedAt: now.toISOString() };

  const normalized = normalizeSpec(spec);
  await db
    .update(projects)
    .set({
      specJson: normalized,
      revision: newRevision,
      durationSec: normalized.scenes.reduce((a, s) => a + s.durationSec, 0),
      updatedAt: now,
    })
    .where(eq(projects.id, id));

  return NextResponse.json({ projectId: id, spec: normalized, revision: newRevision });
}
