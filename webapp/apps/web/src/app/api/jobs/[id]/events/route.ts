// GET /api/jobs/[id]/events — Server-Sent Events stream of a job's progress.
// FLAG-GATED: only live when SSE_ENABLED=true. Otherwise 404 (the client falls back to the
// default polling of GET /api/jobs/[id]). OFF by default per _shared-decisions.md §Jobs.
//
// When live, emits an event every ~1s with the job's {status, stage, progress, result} until the
// job reaches a terminal state (succeeded/failed/canceled), then closes the stream.
import { auth } from '@/auth';
import { getDb, jobs, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.SSE_ENABLED !== 'true') {
    // Flag OFF — the client polls GET /api/jobs/[id] instead. 404 per the plan.
    return new Response('SSE disabled', { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('unauthorized', { status: 401 });
  }
  const { id } = await params;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
  if (!job) return new Response('job not found', { status: 404 });
  // Ownership: the job's project must belong to the caller.
  const project = await db.query.projects.findFirst({ where: eq(projects.id, job.projectId) });
  if (!project || project.userId !== session.user.id) {
    return new Response('forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      // Initial snapshot.
      send({
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        result: job.resultJson ?? null,
        error: job.error ?? null,
      });
      if (TERMINAL.has(job.status)) {
        controller.close();
        closed = true;
        return;
      }
      const timer = setInterval(async () => {
        try {
          const cur = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
          if (!cur) {
            clearInterval(timer);
            controller.close();
            closed = true;
            return;
          }
          send({
            status: cur.status,
            stage: cur.stage,
            progress: cur.progress,
            result: cur.resultJson ?? null,
            error: cur.error ?? null,
          });
          if (TERMINAL.has(cur.status)) {
            clearInterval(timer);
            controller.close();
            closed = true;
          }
        } catch {
          clearInterval(timer);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          closed = true;
        }
      }, 1000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
