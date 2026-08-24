// versions.ts — record a completed render as an immutable render_versions row + point the
// project's lastRenderedVersionId at it. Called from the render `done` path (render.ts), AFTER
// the atomic deduct+done. Phase 5.
//
// INVARIANTS (phase-5-polish.md §Data model): a version row is NEVER mutated; specJson is the
// FROZEN spec that actually rendered; UNIQUE(projectId, revision) means one version per rendered
// revision (a re-render bumps revision first). "Restore" writes a NEW revision, never reuses one.
import { projects, renderVersions, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import type { Spec } from '@shorts/spec';

export interface RecordVersionInput {
  projectId: string;
  jobId: string;
  /** The frozen spec that rendered (specJson snapshot). */
  spec: Spec;
  outputKey: string | null;
  posterKey: string | null;
  durationSec: number | null;
  format: { width: number; height: number; fps: number };
}

/**
 * Insert the render_versions row and set projects.lastRenderedVersionId. Uses an upsert keyed on
 * (projectId, revision) so a re-run of the SAME revision (retry after a mid-flight crash) updates
 * in place rather than violating the unique index — but the row is otherwise immutable to callers.
 */
export async function recordRenderVersion(db: Db, input: RecordVersionInput): Promise<string | null> {
  const revision = input.spec.meta?.revision ?? 0;

  // Upsert on (projectId, revision). A version row is conceptually immutable; this only guards
  // a crashed-then-retried render of the SAME revision (the spec is identical, so this is safe).
  const [row] = await db
    .insert(renderVersions)
    .values({
      projectId: input.projectId,
      revision,
      format: input.format,
      outputKey: input.outputKey,
      posterKey: input.posterKey,
      durationSec: input.durationSec,
      specJson: input.spec,
      jobId: input.jobId,
    })
    .onConflictDoUpdate({
      target: [renderVersions.projectId, renderVersions.revision],
      set: {
        // format MUST be in the set list: a same-revision retry (crash-then-rerun) can carry a
        // different pixel format than the row's first insert (e.g. a resize), and the row's
        // format must stay consistent with its frozen specJson + actual rendered output.
        format: input.format,
        outputKey: input.outputKey,
        posterKey: input.posterKey,
        durationSec: input.durationSec,
        specJson: input.spec,
        jobId: input.jobId,
      },
    })
    .returning({ id: renderVersions.id });

  const versionId = row?.id ?? null;
  if (versionId) {
    await db
      .update(projects)
      .set({ lastRenderedVersionId: versionId })
      .where(eq(projects.id, input.projectId));
  }
  return versionId;
}
