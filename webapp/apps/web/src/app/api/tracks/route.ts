// GET /api/tracks — the content-track catalog for the wizard's Step-0 track picker.
// Reads the single source of truth (@shorts/spec TRACKS) and annotates each track with
// whether it is renderable today (has a registered composition) and its launch templates.
// The picker uses mode/language/rtl/exposesCta to configure the later wizard steps.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { TRACKS, LAUNCH_TEMPLATES } from '@shorts/spec';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const tracks = TRACKS.map((t) => ({
    id: t.id,
    name: t.name,
    blurb: t.blurb,
    language: t.language,
    rtl: t.rtl,
    exposesCta: t.exposesCta,
    minTier: t.minTier,
    creditBand: t.creditBand,
    // Renderable only when a registered template points at one of its compositions.
    ready: t.compositionIds.length > 0,
    templates: LAUNCH_TEMPLATES.filter((lt) => (lt.mode ?? 'tsx') === t.id).map((lt) => ({
      id: lt.id,
      name: lt.title,
      compId: lt.compositionId,
    })),
  }));
  return NextResponse.json({ tracks });
}
