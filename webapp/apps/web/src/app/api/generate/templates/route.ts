// GET /api/generate/templates — the wizard's template registry.
// Phase 1: returns ALL registered templates grouped by track (mode), not just TSX — the
// track picker (wizard Step 0) needs the ad/kids entries to exist. Each row carries
// mode + language + rtl so the picker can show the track badge and configure the wizard.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { LAUNCH_TEMPLATES } from '@shorts/spec';
import { templatePosterKey } from '@/lib/templates';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const templates = LAUNCH_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.title,
    compId: t.compositionId,
    engine: t.engine,
    mode: t.mode ?? t.defaultSpec.mode ?? 'tsx',
    language: t.defaultSpec.language ?? 'en',
    rtl: t.defaultSpec.rtl ?? false,
    theme: t.defaultSpec.theme,
    previewUrl: `/media/${templatePosterKey(t.id)}`,
    defaultSpec: t.defaultSpec,
  }));
  return NextResponse.json({ templates });
}
