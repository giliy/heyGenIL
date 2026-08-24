import { NextResponse } from 'next/server';
import { getDb, jobs, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

/**
 * Job status polling. Middleware allows GET /api/jobs/* for any signed-in request.
 * Returns live worker-written fields so the dashboard card can derive its UI.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 });
  }

  let posterKey: string | null | undefined;
  let projectTitle: string | undefined;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, job.projectId) });
  if (project) {
    posterKey = project.posterKey;
    projectTitle = project.title;
  }

  const result = job.resultJson as Record<string, unknown> | null | undefined;

  return NextResponse.json({
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error,
    outputKey: result?.outputKey ?? null,
    posterKey: posterKey ?? null,
    durationSec: result?.durationSec ?? null,
    width: result?.width ?? null,
    height: result?.height ?? null,
    fps: result?.fps ?? null,
    title: projectTitle ?? null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  });
}
