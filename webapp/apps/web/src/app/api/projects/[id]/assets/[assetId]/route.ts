import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects, assets } from '@shorts/db';
import { eq, and } from 'drizzle-orm';
import { validateSpec } from '@shorts/spec';

const db = getDb();

/**
 * DELETE /api/projects/[id]/assets/[assetId] — remove an upload.
 * Fails with 409 if any overlay still references the asset (so undo stays valid and we
 * never break a placed overlay's pixels).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id, assetId } = await params;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.projectId, id)),
  });
  if (!asset) return NextResponse.json({ error: 'asset not found' }, { status: 404 });

  // Refuse to delete an asset still referenced by an overlay.
  if (project.specJson) {
    const parsed = validateSpec(project.specJson);
    if (parsed.ok) {
      for (const scene of parsed.data.scenes) {
        const ref = scene.overlays.find((o) => o.type === 'image' && o.assetId === assetId);
        if (ref) {
          return NextResponse.json(
            { error: 'asset is in use by an overlay; remove the overlay first', conflict: true },
            { status: 409 }
          );
        }
      }
    }
  }

  await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.projectId, id)));
  return NextResponse.json({ ok: true });
}
