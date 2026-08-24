// GET /api/versions/[id]/download — stream the version's mp4 as a forced download
// (Content-Disposition: attachment). Ownership enforced via the version's project.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, renderVersions, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { resolveKey, stat, contentTypeFor } from '@/lib/storage';
import { promises as fs } from 'fs';

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
  if (!version.outputKey) {
    return NextResponse.json({ error: 'no output for this version' }, { status: 404 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, version.projectId),
  });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let st;
  try {
    st = await stat(version.outputKey);
  } catch {
    return NextResponse.json({ error: 'output file missing' }, { status: 404 });
  }
  if (!st.isFile()) {
    return NextResponse.json({ error: 'output file missing' }, { status: 404 });
  }

  const abs = resolveKey(version.outputKey);
  const data = await fs.readFile(abs);
  const filename = `${(project.title ?? 'short').replace(/[^\w\-]+/g, '_')}-r${version.revision}.mp4`;

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(version.outputKey),
      'Content-Length': String(st.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
