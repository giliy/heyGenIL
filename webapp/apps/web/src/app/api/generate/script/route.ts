// POST /api/generate/script — the story-stage PREVIEW (wizard step 2).
// Drafts beats.json (vo lines + beats + duration) WITHOUT creating a project/job.
// Implemented as the deterministic story builder (no LLM, no paid pixels). The timings
// match the real job exactly because the worker uses the same builder.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseGenerateScriptRequest, buildBeatsFromLines, topicToLines, getTemplate } from '@shorts/spec';

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

  let req2: ReturnType<typeof parseGenerateScriptRequest>;
  try {
    req2 = parseGenerateScriptRequest(body);
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid script request', issues: (e as { issues?: unknown[] }).issues ?? [] },
      { status: 400 }
    );
  }

  const template = getTemplate(req2.template);
  if (!template) {
    return NextResponse.json({ error: `unknown template: ${req2.template}` }, { status: 400 });
  }

  const locked = req2.script && req2.script.length > 0;
  const title = req2.title?.trim() || req2.topic.trim();
  const lines = locked
    ? req2.script!.map((l) => ({ text: l.text }))
    : topicToLines(req2.topic, title).map((text) => ({ text }));

  const beats = buildBeatsFromLines(lines, {
    id: `preview-${Date.now().toString(36)}`,
    title,
    format: {
      width: template.defaultSpec.format.width,
      height: template.defaultSpec.format.height,
      fps: template.defaultSpec.format.fps,
    },
  });

  return NextResponse.json({
    beats,
    vo: beats.vo,
    totalDurationSec: beats.format.durationSec,
    locked: locked ? req2.script!.map((l) => l.text) : null,
  });
}
