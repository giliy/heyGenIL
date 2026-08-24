// POST /api/projects/[id]/ai-clip — paid-only AI-video clip generation for a scene.
// Body: { sceneId, prompt, model?, clipSeconds? } → enqueues a 'generate' job (kind 'ai-clip').
//   - FREE tier → 403 (AI-video is a Pro-tier feature).
//   - The model defaults to the project's LOCKED character's video_model endpoint
//     (image-to-video — the clip is conditioned on the recurring face).
//   - Quotes the clip cost (seconds × CREDIT_TABLE.aiVideoSec), reserves credits, inserts
//     the job. The worker runs gen_clip.py image-to-video, writes the asset + scene.clip,
//     then deducts on success or refunds on fail. Cost stated upfront, CHARGED ONLY ON SUCCESS.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs, characters, balanceOf, reserveCredits } from '@shorts/db';
import { eq, and } from 'drizzle-orm';
import { validateSpec, CREDIT_TABLE, resolveVideoModel, tierAllows } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';

const db = getDb();

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

  let body: { sceneId?: string; prompt?: string; model?: string; clipSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 });
  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  }
  const clipSeconds = Math.max(1, Math.round(body.clipSeconds ?? 4));

  // AI-video capability gate (matrix-driven — only pro unlocks aiVideoClip).
  const billing = await getBillingInfo(session.user.id, db);
  if (!tierAllows(billing.tier, 'aiVideoClip')) {
    return NextResponse.json(
      { error: 'ai_clips_require_paid', tier: billing.tier },
      { status: 403 }
    );
  }

  // The scene must exist in the project's current spec.
  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'project spec invalid' }, { status: 400 });
  }
  const scene = v.data.scenes.find((s) => s.id === body.sceneId);
  if (!scene) return NextResponse.json({ error: 'scene not found' }, { status: 404 });

  // The project must carry a LOCKED character: AI-video is image-to-video from the character's
  // reference frame (never text-to-video — the recurring face is the whole point).
  const characterId = (v.data as { characterId?: string }).characterId;
  if (!characterId) {
    return NextResponse.json(
      { error: 'ai-clip needs a locked character — set one on the project (AI-video is image-to-video)' },
      { status: 400 }
    );
  }
  const character = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.userId, session.user.id)),
  });
  if (!character || character.status !== 'ready' || !character.refImageKey) {
    return NextResponse.json({ error: 'locked character not ready' }, { status: 400 });
  }
  // Default model = the character's picked video_model; resolve shorthand -> fal endpoint.
  const model = resolveVideoModel(
    body.model?.trim() || (character.specJson as { video_model?: string } | null)?.video_model
  );

  // Cost: clip seconds × CREDIT_TABLE.aiVideoSec (6). State the derived cost BEFORE generating.
  const cost = clipSeconds * CREDIT_TABLE.aiVideoSec;
  const balance = await balanceOf(session.user.id, db);
  if (balance < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', shortfall: cost - balance, credits: cost, balance },
      { status: 402 }
    );
  }

  const inputJson = {
    kind: 'ai-clip' as const,
    projectId: id,
    sceneId: body.sceneId,
    prompt: body.prompt.trim(),
    model,
    clipSeconds,
    tier: billing.tier,
    characterRef: character.refImageKey,
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
    await reserveCredits(session.user.id, cost, job.id, 'reserve:ai-clip', db);
  } catch (e) {
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json(
    { jobId: job.id, costCredits: cost, model, clipSeconds },
    { status: 201 }
  );
}
