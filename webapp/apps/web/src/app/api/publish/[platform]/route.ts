// POST /api/publish/[platform] — direct-publish STUB (TikTok / YouTube), flag-gated.
// platform = 'tiktok' | 'youtube'. No real OAuth/publish flow — this is the documented
// integration surface. When the per-platform flag is OFF (default) -> 501 { message, flag }.
// When ON -> a dry-run echo (no network call, no upload) so the UI can exercise the path.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PLATFORMS = ['tiktok', 'youtube'] as const;
type Platform = (typeof PLATFORMS)[number];

function flagFor(platform: Platform): string {
  return platform === 'tiktok' ? 'PUBLISH_TIKTOK_ENABLED' : 'PUBLISH_YOUTUBE_ENABLED';
}

export async function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json(
      { error: `platform must be one of ${PLATFORMS.join(', ')}` },
      { status: 400 }
    );
  }
  const p = platform as Platform;
  const flag = flagFor(p);
  const enabled = process.env[flag] === 'true';

  if (!enabled) {
    return NextResponse.json(
      { message: 'not implemented', flag, platform: p },
      { status: 501 }
    );
  }

  // Dry-run echo (flag ON). No real publish — just acknowledge the request payload.
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return NextResponse.json(
    { platform: p, dryRun: true, received: body, message: 'publish stub (dry run)' },
    { status: 200 }
  );
}
