// GET /api/projects/[id]/versions — list the project's render versions, newest first.
// Each row is IMMUTABLE (a past render's pinned spec + output); "restore" is a separate flow
// that writes a NEW revision. Returns id, revision, format, durationSec, createdAt, downloadUrl.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, renderVersions } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';

const db = getDb();

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

  const rows = await db.query.renderVersions.findMany({
    where: eq(renderVersions.projectId, id),
    orderBy: [desc(renderVersions.revision)],
  });

  const versions = rows.map((v) => ({
    id: v.id,
    revision: v.revision,
    format: v.format,
    durationSec: v.durationSec,
    createdAt: v.createdAt,
    hasVideo: Boolean(v.outputKey),
    hasPoster: Boolean(v.posterKey),
    downloadUrl: v.outputKey ? `/api/versions/${v.id}/download` : null,
    posterUrl: v.posterKey ? `/media/${v.posterKey}` : null,
  }));

  return NextResponse.json({ projectId: id, versions });
}
