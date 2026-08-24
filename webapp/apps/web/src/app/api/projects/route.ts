import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';
import { getTemplateById, templatePosterKey } from '@/lib/templates';
import { getDurationSec } from '@shorts/spec';
import { copyIntoStorage, resolveKey, exists as storageExists } from '@/lib/storage';

const db = getDb();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const list = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
    orderBy: [desc(projects.createdAt)],
  });
  return NextResponse.json({ projects: list });
}

/**
 * Seed a project from a launch template for the signed-in user.
 * Body: { template: string }  — the template catalog id (e.g. 'form-card').
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { template?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const templateId = body.template;
  const template = templateId ? getTemplateById(templateId) : undefined;
  if (!template) {
    return NextResponse.json({ error: `unknown template: ${templateId}` }, { status: 400 });
  }

  const spec = template.defaultSpec;
  const durationSec = getDurationSec(spec);

  const [project] = await db
    .insert(projects)
    .values({
      userId: session.user.id,
      title: spec.title,
      template: template.id,
      engine: template.engine,
      status: 'draft',
      specJson: spec,
      durationSec,
      width: spec.format.width,
      height: spec.format.height,
      fps: spec.format.fps,
      revision: spec.meta.revision,
    })
    .returning();

  // Seed the frame-0 poster: copy the pre-rendered template poster into this
  // project's storage key (so the card has a thumbnail before any render).
  const srcKey = templatePosterKey(template.id);
  const dstKey = `${project.id}/poster.jpg`;
  if (await storageExists(srcKey)) {
    await copyIntoStorage(dstKey, resolveKey(srcKey));
    await db.update(projects).set({ posterKey: dstKey }).where(eq(projects.id, project.id));
  }

  return NextResponse.json({ project }, { status: 201 });
}
