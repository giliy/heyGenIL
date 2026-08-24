// GET /api/generate/voices — the voice list, grouped for the track picker.
// Phase 1: adds the Hebrew edge-tts personas (they take any --voice id in gen_voice_edge.py)
// and a motherese kids persona, each tagged with language so the wizard's language toggle
// filters them. ElevenLabs rows are tier-locked (engine accepted by the schema, paid gate
// enforced server-side at generate/render).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const voices = [
    // --- English (free) ---
    { id: 'af_bella', engine: 'kokoro', name: 'Bella (Kokoro)', language: 'en', tier: 'free' },
    { id: 'af_nicole', engine: 'kokoro', name: 'Nicole (Kokoro)', language: 'en', tier: 'free' },
    { id: 'am_michael', engine: 'kokoro', name: 'Michael (Kokoro)', language: 'en', tier: 'free' },
    { id: 'en-US-AriaNeural', engine: 'edge', name: 'Aria (Edge)', language: 'en', tier: 'free' },
    { id: 'en-US-GuyNeural', engine: 'edge', name: 'Guy (Edge)', language: 'en', tier: 'free' },
    { id: 'en-US-JennyNeural', engine: 'edge', name: 'Jenny (Edge)', language: 'en', tier: 'free' },
    // --- Hebrew (free, edge-tts) — the ads + kids tracks default to these. ---
    // (gen_voice_edge.py accepts any --voice id; these are the two shipped Hebrew personas.)
    { id: 'he-IL-HilaNeural', engine: 'edge', name: 'הילה (עברית)', language: 'he', tier: 'free' },
    { id: 'he-IL-AvriNeural', engine: 'edge', name: 'אברי (עברית)', language: 'he', tier: 'free' },
    // --- ElevenLabs (paid; tier-locked server-side) ---
    { id: 'eleven-default', engine: 'elevenlabs', name: 'ElevenLabs (premium)', language: 'en', tier: 'paid' },
  ];
  return NextResponse.json({ voices });
}
