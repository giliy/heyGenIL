// GET /api/projects/[id]/srt — download the project's captions as a .srt file.
// The SRT keeps LOGICAL word order (RTL-safe) and the ORIGINAL line text with nikkud intact —
// stripNikkud is display-only and NEVER applied here. Served as text/plain with
// Content-Disposition: attachment so the browser saves it as <title>.srt.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, buildSrt } from '@shorts/spec';

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

  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'stored spec invalid' }, { status: 500 });
  }

  // Clamp cues to the project's stored durationSec (the spec has no top-level durationSec).
  const srt = buildSrt(v.data, {
    durationSec: project.durationSec ?? undefined,
  });
  if (!srt) {
    return NextResponse.json({ error: 'no voice captions to export' }, { status: 404 });
  }

  const filename = `${(project.title ?? 'short').replace(/[^\w\-]+/g, '_')}.srt`;
  return new NextResponse(srt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
