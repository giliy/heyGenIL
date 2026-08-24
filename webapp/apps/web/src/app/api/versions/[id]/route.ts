// GET /api/versions/[id] — one render version's detail. Immutable: returns the pinned spec +
// output info for a past render. Ownership enforced via the version's project.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, renderVersions, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const version = await db.query.renderVersions.findFirst({
    where: eq(renderVersions.id, id),
  });
  if (!version) return NextResponse.json({ error: 'version not found' }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, version.projectId),
  });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: version.id,
    projectId: version.projectId,
    revision: version.revision,
    format: version.format,
    durationSec: version.durationSec,
    specJson: version.specJson,
    createdAt: version.createdAt,
    downloadUrl: version.outputKey ? `/api/versions/${version.id}/download` : null,
    posterUrl: version.posterKey ? `/media/${version.posterKey}` : null,
  });
}
