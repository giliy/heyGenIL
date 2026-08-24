import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getDb, projects, jobs } from '@shorts/db';
import { eq, desc } from 'drizzle-orm';
import { ProjectCard, type ProjectCardData } from '@/components/ProjectCard';
import { TemplatesDialog, type TemplateOption } from '@/components/TemplatesDialog';
import { listTemplateCards } from '@/lib/templates';
import { FolderOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');

  const db = getDb();
  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
    orderBy: [desc(projects.createdAt)],
  });

  // Attach the latest job per project (any type: render or generate) for live progress polling.
  const cards: ProjectCardData[] = [];
  for (const p of userProjects) {
    const latest = await db.query.jobs.findFirst({
      where: eq(jobs.projectId, p.id),
      orderBy: [desc(jobs.createdAt)],
    });
    cards.push({
      id: p.id,
      title: p.title,
      template: p.template,
      engine: p.engine,
      status: p.status,
      posterKey: p.posterKey,
      outputKey: p.outputKey,
      durationSec: p.durationSec,
      updatedAt: p.updatedAt.toISOString(),
      latestJobId: latest?.id ?? null,
      latestJobStatus: latest?.status ?? null,
      latestJobProgress: latest?.progress ?? null,
      latestJobError: latest?.error ?? null,
    });
  }

  const templates: TemplateOption[] = listTemplateCards().map((t) => ({
    id: t.id,
    title: t.title,
    engine: t.engine,
    posterUrl: t.posterUrl,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Your shorts</h1>
          <p className="text-sm text-muted">Render a template and download the finished short.</p>
        </div>
        <TemplatesDialog templates={templates} />
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-cream/50 py-20 text-center">
          <FolderOpen className="mb-3 text-muted" size={40} />
          <p className="font-display font-medium text-ink">No projects yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Click “Render a template” to seed a project and kick off a render.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
