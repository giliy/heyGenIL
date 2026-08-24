// POST /api/projects/[id]/resize — enqueue an aspect-resize render.
// Body: { aspect: '9:16' | '1:1' | '16:9' }.
// Server: read current spec -> computeFormat (option A: scale + center, no crop) -> quote credits
// at the target resolution -> check balance (402) -> RESERVE credits -> insert a `render` job with
// inputAspect + the transformed spec. The worker reuses the cached bundle (same template, only
// inputProps.format changes — no re-bundle) and, on done, records a render_versions row.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs, balanceOf, reserveCredits } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, quoteSpec, transformSpecForAspect, type Aspect } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';

const db = getDb();

const ASPECTS: Aspect[] = ['9:16', '1:1', '16:9'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: { aspect?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.aspect || !ASPECTS.includes(body.aspect as Aspect)) {
    return NextResponse.json({ error: `aspect must be one of ${ASPECTS.join(', ')}` }, { status: 400 });
  }
  const aspect = body.aspect as Aspect;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'stored spec invalid' }, { status: 500 });
  }
  // No-op guard: skip the enqueue when the spec is already at the target aspect's pixel dims.
  const target = transformSpecForAspect(v.data, aspect);
  const sameDims =
    target.format.width === v.data.format.width && target.format.height === v.data.format.height;
  if (sameDims) {
    return NextResponse.json(
      { error: 'project already at that aspect', jobId: null, aspect },
      { status: 409 }
    );
  }

  // Persistence-layer revisioning owns meta.revision (transformSpecForAspect deliberately does
  // NOT bump it). A resize render is a NEW rendered revision: bump project.revision + stamp it
  // onto the transformed spec's meta so recordRenderVersion upserts on a DISTINCT
  // (projectId, revision) key instead of colliding with — and overwriting — the prior version row.
  const newRevision = project.revision + 1;
  target.meta = { revision: newRevision, updatedAt: new Date().toISOString() };

  // Tier + quote + reserve (same flow as POST /api/jobs / Phase 4). Free users always 720p+watermark.
  const billing = await getBillingInfo(session.user.id, db);
  const paid = isPaidTier(billing.tier);
  if (!paid && target.voice?.engine === 'elevenlabs') {
    return NextResponse.json({ error: 'elevenlabs_voice_requires_paid', tier: billing.tier }, { status: 403 });
  }
  const resolution: '720p' | '1080p' = paid ? '1080p' : '720p';
  const watermark = !paid;

  const quote = quoteSpec(target, billing.tier);
  const balance = await balanceOf(session.user.id, db);
  if (balance < quote.credits) {
    return NextResponse.json(
      { error: 'insufficient_credits', shortfall: quote.credits - balance, credits: quote.credits, balance },
      { status: 402 }
    );
  }

  const inputJson = {
    template: project.template,
    spec: target, // the FULL transformed spec (format swapped + overlays remapped)
    renderOptions: { codec: 'h264', pixelFormat: 'yuv420p', crf: 21 },
    captionsDiverged: false,
    resolution,
    watermark,
    tier: billing.tier,
    inputAspect: aspect, // Phase 5: marks this as a resize render
  };

  const [job] = await db
    .insert(jobs)
    .values({
      projectId: project.id,
      type: 'render',
      status: 'queued',
      stage: 'queued',
      progress: 0,
      inputJson,
      costCredits: quote.credits,
      reservedCredits: quote.credits,
      inputAspect: aspect,
    })
    .returning();

  try {
    await reserveCredits(session.user.id, quote.credits, job.id, 'reserve:render', db);
  } catch (e) {
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  // Persist the bumped revision + the resized spec/format so the stored spec and the version
  // row's frozen specJson agree, and the project's width/height reflect the target aspect.
  await db
    .update(projects)
    .set({
      status: 'generating',
      aspectRatio: aspect,
      revision: newRevision,
      specJson: target,
      width: target.format.width,
      height: target.format.height,
    })
    .where(eq(projects.id, project.id));

  return NextResponse.json(
    { jobId: job.id, credits: quote.credits, resolution, aspect, format: target.format },
    { status: 201 }
  );
}
