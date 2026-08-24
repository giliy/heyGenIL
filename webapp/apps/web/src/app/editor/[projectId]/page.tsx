import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, normalizeSpec } from '@shorts/spec';
import { EditorShell } from './_components/EditorShell';
import type { Spec } from '@shorts/spec';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');

  const { projectId } = await params;
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project || project.userId !== session.user.id) notFound();

  const parsed = validateSpec(project.specJson);
  let spec: Spec | null = null;
  if (parsed.ok) spec = normalizeSpec(parsed.data);

  return (
    <EditorShell
      project={{
        id: project.id,
        title: project.title,
        template: project.template,
        engine: project.engine,
        revision: project.revision,
        specJson: spec,
      }}
      initialSpec={spec}
    />
  );
}
