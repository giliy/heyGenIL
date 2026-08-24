// POST /api/generate — the 4th wizard step: create a project (draft) + a type='generate'
// job (queued). Quotes cost (free tier = 0cr) and records it on the job row (the reserve
// hook Phase 4 arms). The LOCKED script rides in the payload so the worker's story stage
// starts from the exact user-approved text (script fidelity).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, jobs } from '@shorts/db';
import { validateGeneratePayload, getTemplate, getTrack, tierAllowsTrack, tierAtLeast } from '@shorts/spec';
import { getBillingInfo } from '@/lib/billing-server';
import { createId } from '@paralleldrive/cuid2';

const db = getDb();

/**
 * Quote the cost of a generate job. FREE TIER (Phase 3): kokoro/edge voice + TSX template
 * => 0 credits. Phase 4 arms this (reserve at submit, deduct on done, refund on fail).
 */
function quoteCost(payload: { template: string }): number {
  const template = getTemplate(payload.template);
  if (!template) return 0;
  // TSX templates + kokoro/edge voice are free. AI engine would be quoted here in Phase 4.
  return 0;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const payload = validateGeneratePayload(body);
  if (!payload.ok) {
    return NextResponse.json(
      { error: 'invalid generate payload', issues: payload.error.issues },
      { status: 400 }
    );
  }
  const data = payload.data;

  const template = getTemplate(data.template);
  if (!template) {
    return NextResponse.json({ error: `unknown template: ${data.template}` }, { status: 400 });
  }

  // Phase 1: resolve the content track (mode) and language. Explicit payload wins; else the
  // template's declared mode/language (its defaultSpec); else the track catalog default.
  const mode = data.mode ?? template.mode ?? template.defaultSpec.mode ?? 'tsx';
  const language = data.language ?? template.defaultSpec.language ?? getTrack(mode)?.language ?? 'en';

  // Phase 6 TIER→TRACK GATE (server-side, never trust the client): the chosen track's minTier
  // must be within the caller's subscription. Free can only generate 'tsx'; creator adds
  // ad/kids; pro adds ai/vox. budgetTier is the wizard's *intent* — enforce the real tier.
  const billing = await getBillingInfo(session.user.id, db);
  if (!tierAllowsTrack(billing.tier, mode)) {
    const track = getTrack(mode);
    return NextResponse.json(
      {
        error: 'track_requires_tier',
        mode,
        minTier: track?.minTier ?? 'pro',
        tier: billing.tier,
      },
      { status: 403 }
    );
  }
  // If the caller set a budgetTier intent above their real tier, that's a mismatch — reject.
  if (data.budgetTier && !tierAtLeast(billing.tier, data.budgetTier)) {
    return NextResponse.json(
      { error: 'budget_tier_exceeds_subscription', budgetTier: data.budgetTier, tier: billing.tier },
      { status: 403 }
    );
  }

  // Hebrew tracks speak Hebrew by default — if the caller asked for Hebrew but passed an
  // English voice id, swap in the default Hebrew edge voice so the ad/kids track renders RTL
  // narration without the wizard having to know the exact id.
  const effectiveVoice =
    language === 'he' && data.voice.engine === 'edge' && !data.voice.voiceId.startsWith('he-IL-')
      ? { ...data.voice, voiceId: 'he-IL-HilaNeural' }
      : data.voice;

  const quoted = quoteCost(data);
  const title = data.title?.trim() || data.topic.trim();

  // Stamp the resolved mode/language (+ ad block) back onto the payload that rides to the
  // worker, so the story stage and the assembled spec see the declared track, not a guess.
  const jobInput = { ...data, voice: effectiveVoice, mode, language, tier: billing.tier };

  // Project + job are inserted together so a claim always has both.
  const projectId = createId();
  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      userId: session.user.id,
      title,
      template: template.id,
      engine: template.engine,
      mode,
      status: 'generating',
      width: template.defaultSpec.format.width,
      height: template.defaultSpec.format.height,
      fps: template.defaultSpec.format.fps,
      revision: 0,
    })
    .returning();

  const [job] = await db
    .insert(jobs)
    .values({
      projectId: project.id,
      type: 'generate',
      status: 'queued',
      stage: 'queued',
      progress: 0,
      inputJson: jobInput,
      costCredits: quoted,
    })
    .returning();

  return NextResponse.json({ projectId: project.id, jobId: job.id, costCredits: quoted }, { status: 201 });
}
