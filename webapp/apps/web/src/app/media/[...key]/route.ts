import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { resolveKey, contentTypeFor, stat } from '@/lib/storage';
import { auth } from '@/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  // Require a session (posters/outputs are user-private on localhost).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { key } = await params;
  const storageKey = key.join('/');

  let abs: string;
  try {
    abs = resolveKey(storageKey);
  } catch (e) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }

  let st;
  try {
    st = await stat(storageKey);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (!st.isFile()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const type = contentTypeFor(storageKey);
  const isVideo = type === 'video/mp4' || type === 'video/quicktime';
  const filename = storageKey.split('/').pop() ?? 'file';

  // Stream the file body.
  const data = await fs.readFile(abs);

  const headers: Record<string, string> = {
    'Content-Type': type,
    'Content-Length': String(st.size),
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  if (isVideo) {
    // mp4 -> attachment per _shared-decisions.md
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(data, { status: 200, headers });
}
