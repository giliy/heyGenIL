// GET /api/projects/[id]/beats — the beat metadata for the project's music bed.
// Library-first: reads the music_beats cache (written by the worker's deriveBeats during a
// render or a prior sync). For a bed with no cached row we return the honest 'none' source
// (ambient pads have no beats — verified) + the default grid, so the client can offer the
// grid fallback. Never fakes beats.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, musicBeats } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, type BeatInfo } from '@shorts/spec';

const db = getDb();

const DEFAULT_GRID_BPM = Number(process.env.BEAT_SYNC_GRID_BPM ?? 120) || 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'stored spec invalid' }, { status: 500 });
  }

  // The music bed id: the spec's audio.music.id (library key) if present.
  const bedId: string | null = v.data.audio?.music?.id ?? null;
  if (!bedId) {
    // No music bed -> nothing to sync to. Honest 'none' + grid fallback.
    const beats: BeatInfo = {
      bpm: null,
      times: null,
      gridMs: 60000 / DEFAULT_GRID_BPM / 2, // 8th-note grid at the default BPM
      source: 'none',
    };
    return NextResponse.json({ projectId: id, bedId: null, beats });
  }

  const cached = await db.query.musicBeats.findFirst({ where: eq(musicBeats.bedId, bedId) });
  if (cached) {
    const beats: BeatInfo = {
      bpm: cached.bpm ?? null,
      times: cached.times ?? null,
      gridMs: cached.gridMs ?? 60000 / DEFAULT_GRID_BPM / 2,
      source: cached.source,
    };
    return NextResponse.json({ projectId: id, bedId, beats, cached: true });
  }

  // No cached row yet. Honest fallback: 'none' + default grid. The worker's deriveBeats will
  // persist a real row (bpm-analyzed/bpm-grid/none) on the next render or sync.
  const beats: BeatInfo = {
    bpm: null,
    times: null,
    gridMs: 60000 / DEFAULT_GRID_BPM / 2,
    source: 'none',
  };
  return NextResponse.json({ projectId: id, bedId, beats, cached: false });
}
