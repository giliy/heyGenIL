import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs, balanceOf, reserveCredits } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, quoteSpec, getTier, tierAllows } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';

const db = getDb();

/**
 * Insert a render job for a project owned by the signed-in user.
 * Body: { projectId: string, inputSpec?: Spec, captionsDiverged?: boolean, resolution?: '720p'|'1080p' }
 *   - projectId is required (ownership check).
 *   - inputSpec is the EDITOR's current spec (optional). When provided it is zod-validated
 *     and becomes jobs.inputJson.spec; otherwise the stored project spec is used.
 *   - resolution: '1080p' is PAID-only — a free user is forced to 720p + watermark regardless
 *     of what the client sends (tier is enforced server-side; the client field is a request).
 *   - captionsDiverged flags the display-only caption divergence so the result metadata
 *     carries the state (edited captions never silently claimed to match the muxed voice).
 *
 * Phase-4 billing flow: validate spec → quote credits → check balance (402 if short) →
 * RESERVE credits (ledger hold) → insert the queued job with reservedCredits. The worker
 * deducts on done and refunds on fail.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    projectId?: string;
    inputSpec?: unknown;
    captionsDiverged?: boolean;
    resolution?: '720p' | '1080p';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, body.projectId),
  });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Prefer the editor's current spec; fall back to the stored spec.
  const specInput = body.inputSpec ?? project.specJson;
  const result = validateSpec(specInput);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'invalid spec', issues: result.error.issues },
      { status: 400 }
    );
  }
  const spec = result.data;

  // --- Phase 4: tier + quote + reserve ---
  const billing = await getBillingInfo(session.user.id, db);
  const paid = isPaidTier(billing.tier);

  // Tier gate (server-side, never trust the client): read resolution/watermark from the tier
  // matrix so it's single-source. ElevenLabs voice is a capability gate too — a tier without
  // it is rejected even if the spec asks for it.
  const tierDef = getTier(billing.tier);
  if (!tierAllows(billing.tier, 'elevenlabsVoice') && spec.voice?.engine === 'elevenlabs') {
    return NextResponse.json(
      { error: 'elevenlabs_voice_requires_paid', tier: billing.tier },
      { status: 403 }
    );
  }
  const resolution: '720p' | '1080p' = paid ? (body.resolution ?? tierDef.maxResolution) : '720p';
  const watermark = tierDef.watermark; // free always watermarked (matrix-driven)

  const quote = quoteSpec(spec, billing.tier);
  const balance = await balanceOf(session.user.id, db);
  if (balance < quote.credits) {
    return NextResponse.json(
      {
        error: 'insufficient_credits',
        shortfall: quote.credits - balance,
        credits: quote.credits,
        balance,
      },
      { status: 402 }
    );
  }

  const inputJson = {
    template: project.template,
    spec,
    renderOptions: { codec: 'h264', pixelFormat: 'yuv420p', crf: 21 },
    captionsDiverged: Boolean(body.captionsDiverged),
    // Phase 4 render post-process flags (worker re-checks tier before trusting these too):
    resolution,
    watermark,
    tier: billing.tier,
  };

  // Insert the job first to get its id, then reserve credits against it, then stamp
  // reservedCredits back onto the job. Reserve is a ledger HOLD (-N); the actual charge is
  // the worker's deduct-on-done.
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
    })
    .returning();

  try {
    await reserveCredits(session.user.id, quote.credits, job.id, 'reserve:render', db);
  } catch (e) {
    // Reserve failed (e.g. concurrent race) — don't leave a queued job without a hold.
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  await db.update(projects).set({ status: 'generating' }).where(eq(projects.id, project.id));

  return NextResponse.json(
    { jobId: job.id, credits: quote.credits, resolution, watermark, tier: billing.tier },
    { status: 201 }
  );
}
