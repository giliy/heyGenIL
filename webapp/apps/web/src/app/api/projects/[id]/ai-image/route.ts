// POST /api/projects/[id]/ai-image — paid-only AI image generation for a scene.
// Body: { sceneId, prompt, model? }  → enqueues a 'generate' job (stage 'pixel').
//   - FREE tier → 403 (AI images are a Creator-plan feature).
//   - Quotes the AI-image cost, reserves credits, inserts the job with reservedCredits.
//   - The worker runs gen_image.py, writes the asset + image overlay, then deducts on success
//     or refunds on fail. Cost is stated upfront and CHARGED ONLY ON SUCCESS.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs, characters, balanceOf, reserveCredits } from '@shorts/db';
import { eq, and } from 'drizzle-orm';
import { validateSpec, CREDIT_TABLE, tierAllows } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';

const db = getDb();

const MODELS = ['fast', 'pro', 'lite'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  let body: { sceneId?: string; prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 });
  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  }
  const model = body.model ?? 'fast';
  if (!MODELS.includes(model)) {
    return NextResponse.json({ error: `unknown model: ${model}` }, { status: 400 });
  }

  // AI-image capability gate (matrix-driven — creator+ unlock aiImage).
  const billing = await getBillingInfo(session.user.id, db);
  if (!tierAllows(billing.tier, 'aiImage')) {
    return NextResponse.json(
      { error: 'ai_images_require_paid', tier: billing.tier },
      { status: 403 }
    );
  }

  // The scene must exist in the project's current spec (validate it parses).
  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'project spec invalid' }, { status: 400 });
  }
  const scene = v.data.scenes.find((s) => s.id === body.sceneId);
  if (!scene) return NextResponse.json({ error: 'scene not found' }, { status: 404 });

  // Phase 2: if the project carries a locked character, resolve its reference image so the
  // generated scene image shares the recurring character's face.
  let characterRef: string | undefined;
  const characterId = (v.data as { characterId?: string }).characterId;
  if (characterId) {
    const character = await db.query.characters.findFirst({
      where: and(eq(characters.id, characterId), eq(characters.userId, session.user.id)),
    });
    if (character?.refImageKey) characterRef = character.refImageKey;
  }

  // Cost: 1 AI image = CREDIT_TABLE.aiImage (3). State the derived cost BEFORE generating.
  const cost = CREDIT_TABLE.aiImage;
  const balance = await balanceOf(session.user.id, db);
  if (balance < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', shortfall: cost - balance, credits: cost, balance },
      { status: 402 }
    );
  }

  const inputJson = {
    // Discriminator so the worker's ai-image claimer picks this job and Phase 3's full
    // generate orchestrator (which validates a GeneratePayload) skips it.
    kind: 'ai-image' as const,
    projectId: id,
    sceneId: body.sceneId,
    prompt: body.prompt.trim(),
    model,
    tier: billing.tier,
    ...(characterRef ? { characterRef } : {}),
  };

  const [job] = await db
    .insert(jobs)
    .values({
      projectId: project.id,
      type: 'generate',
      status: 'queued',
      stage: 'pixel',
      progress: 0,
      inputJson,
      costCredits: cost,
      reservedCredits: cost,
    })
    .returning();

  try {
    await reserveCredits(session.user.id, cost, job.id, 'reserve:ai-image', db);
  } catch (e) {
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id, costCredits: cost, model }, { status: 201 });
}
