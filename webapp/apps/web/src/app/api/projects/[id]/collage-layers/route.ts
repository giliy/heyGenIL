// POST /api/projects/[id]/collage-layers — paid-only vox collage-layer generation.
// Body: { layers: [{ sceneId, layerId, kind: 'cutout'|'photo', prompt }] } → enqueues a
// 'generate' job (kind 'collage-layers').
//   - FREE tier → 403 (the vox collage track is a Pro-tier feature).
//   - Quotes the layer cost (layerCount × CREDIT_TABLE.voxLayer), reserves credits, inserts
//     the job. The worker runs gen_image.py + cutout.py per layer, fills scene.vox.layers[].src,
//     then deducts on success or refunds on fail. Cost stated upfront, CHARGED ONLY ON SUCCESS.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs, balanceOf, reserveCredits } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, CREDIT_TABLE, tierAllows } from '@shorts/spec';
import { getBillingInfo, isPaidTier } from '@/lib/billing-server';

const db = getDb();

const KINDS = ['cutout', 'photo'];
const MAX_LAYERS = 12;

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

  let body: { layers?: { sceneId?: string; layerId?: string; kind?: string; prompt?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const layers = body.layers ?? [];
  if (layers.length === 0) {
    return NextResponse.json({ error: 'layers required' }, { status: 400 });
  }
  if (layers.length > MAX_LAYERS) {
    return NextResponse.json({ error: `too many layers (max ${MAX_LAYERS})` }, { status: 400 });
  }
  // Validate each layer request.
  for (const l of layers) {
    if (!l.sceneId || !l.layerId) {
      return NextResponse.json({ error: 'each layer needs sceneId + layerId' }, { status: 400 });
    }
    if (!l.kind || !KINDS.includes(l.kind)) {
      return NextResponse.json({ error: `unknown layer kind: ${l.kind}` }, { status: 400 });
    }
    if (!l.prompt || !l.prompt.trim()) {
      return NextResponse.json({ error: 'each layer needs a prompt' }, { status: 400 });
    }
  }

  // Vox collage capability gate (matrix-driven — only pro unlocks voxCollageLayers).
  const billing = await getBillingInfo(session.user.id, db);
  if (!tierAllows(billing.tier, 'voxCollageLayers')) {
    return NextResponse.json(
      { error: 'collage_layers_require_paid', tier: billing.tier },
      { status: 403 }
    );
  }

  // The project must be a vox spec with the referenced scenes/layers present.
  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'project spec invalid' }, { status: 400 });
  }
  for (const l of layers) {
    const scene = v.data.scenes.find((s) => s.id === l.sceneId);
    if (!scene) return NextResponse.json({ error: `scene not found: ${l.sceneId}` }, { status: 404 });
    const layer = scene.vox?.layers.find((ly) => ly.id === l.layerId);
    if (!layer) {
      return NextResponse.json(
        { error: `layer ${l.layerId} not in scene ${l.sceneId}.vox.layers` },
        { status: 400 }
      );
    }
    if (layer.type !== l.kind) {
      return NextResponse.json(
        { error: `layer ${l.layerId} is a ${layer.type}, not a ${l.kind}` },
        { status: 400 }
      );
    }
  }

  // Cost: layerCount × CREDIT_TABLE.voxLayer. State the derived cost BEFORE generating.
  const cost = layers.length * CREDIT_TABLE.voxLayer;
  const balance = await balanceOf(session.user.id, db);
  if (balance < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', shortfall: cost - balance, credits: cost, balance },
      { status: 402 }
    );
  }

  const inputJson = {
    kind: 'collage-layers' as const,
    projectId: id,
    tier: billing.tier,
    layers: layers.map((l) => ({
      sceneId: l.sceneId!,
      layerId: l.layerId!,
      kind: l.kind as 'cutout' | 'photo',
      prompt: l.prompt!.trim(),
    })),
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
    await reserveCredits(session.user.id, cost, job.id, 'reserve:collage-layers', db);
  } catch (e) {
    await db.update(jobs).set({ status: 'failed', error: 'reserve failed' }).where(eq(jobs.id, job.id));
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `reserve failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json(
    { jobId: job.id, costCredits: cost, layerCount: layers.length },
    { status: 201 }
  );
}
