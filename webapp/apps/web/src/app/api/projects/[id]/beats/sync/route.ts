// POST /api/projects/[id]/beats/sync — quantize scene durations to the music bed's beats
// (mode 'nearest') or the honest grid fallback (mode 'grid', forced when the bed is beatless).
// Bumps meta.revision, persists the new spec, returns { spec, revision, diff } for the UI toast.
// INVARIANTS: a scene's end never moves earlier than its VO floor + 0.05s (never cuts speech);
// overlay scene-relative windows are clamped; never fakes beats (source:'none' -> grid).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, musicBeats } from '@shorts/db';
import { eq } from 'drizzle-orm';
import {
  validateSpec,
  normalizeSpec,
  getDurationSec,
  quantizeScenes,
  type BeatInfo,
  type BeatSyncMode,
} from '@shorts/spec';

const db = getDb();

const DEFAULT_GRID_BPM = Number(process.env.BEAT_SYNC_GRID_BPM ?? 120) || 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: { mode?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode: BeatSyncMode = body.mode === 'grid' ? 'grid' : 'nearest';

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const v = validateSpec(project.specJson);
  if (!v.ok) {
    return NextResponse.json({ error: 'stored spec invalid' }, { status: 500 });
  }

  // Resolve the beat info (library-first cache; honest 'none' fallback).
  const bedId: string | null = v.data.audio?.music?.id ?? null;
  let beats: BeatInfo = {
    bpm: null,
    times: null,
    gridMs: 60000 / DEFAULT_GRID_BPM / 2,
    source: 'none',
  };
  if (bedId) {
    const cached = await db.query.musicBeats.findFirst({ where: eq(musicBeats.bedId, bedId) });
    if (cached) {
      beats = {
        bpm: cached.bpm ?? null,
        times: cached.times ?? null,
        gridMs: cached.gridMs ?? 60000 / DEFAULT_GRID_BPM / 2,
        source: cached.source,
      };
    }
  }

  const { spec: quantized, diff } = quantizeScenes(v.data, beats, mode);
  const normalized = normalizeSpec(quantized);
  const newRevision = project.revision + 1;
  const now = new Date();
  normalized.meta = { revision: newRevision, updatedAt: now.toISOString() };

  await db
    .update(projects)
    .set({
      specJson: normalized,
      revision: newRevision,
      durationSec: getDurationSec(normalized),
      updatedAt: now,
    })
    .where(eq(projects.id, id));

  return NextResponse.json({
    projectId: id,
    spec: normalized,
    revision: newRevision,
    mode,
    beatSource: beats.source, // 'none' tells the UI to say "no beats — grid" honestly
    diff,
  });
}
