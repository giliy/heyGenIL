// render.ts — stage 7: finalize.
//
// The build stage already rendered a poster still alongside the silent master; the mix stage
// produced the final voiced mp4. Here we copy the final mp4 + poster into STORAGE_DIR
// (the Phase-1 layout: <STORAGE_DIR>/<projectId>/<assetId>.mp4), write outputKey/posterKey,
// and set the project 'ready' + job 'done' with resultJson.
import path from 'path';
import { promises as fs } from 'fs';
import { getDb, projects, jobs, type Db } from '@shorts/db';
import { eq } from 'drizzle-orm';
import type { Spec } from '@shorts/spec';
import { storageDir } from '../py';
import { keyFor, copyIntoStorage, fileExists } from '../../storage';
import type { GenerateResult, StageReport } from '../types';
import type { StageWriter } from '../writer';

export interface RenderOutcome {
  outputKey: string;
  posterKey: string | null;
}

/**
 * Finalize the generate pipeline: copy the final mp4 + poster into storage and update the
 * project + job. `finalMp4` is the mix-stage output; `posterPath` the build-stage still
 * (frame 0). `stages` is the accumulated per-stage report for resultJson.
 */
export async function runRenderStage(
  db: Db,
  jobId: string,
  projectId: string,
  spec: Spec,
  finalMp4: string,
  posterPath: string | null,
  durationSec: number,
  stages: StageReport[],
  writer: StageWriter
): Promise<RenderOutcome> {
  await writer.begin('render');

  const outputKey = keyFor(projectId, `${projectId}.mp4`);
  const posterKey = keyFor(projectId, 'poster.jpg');

  await copyIntoStorage(outputKey, finalMp4);

  let posterWritten: string | null = null;
  if (posterPath && (await fileExists(posterPath))) {
    await copyIntoStorage(posterKey, posterPath);
    posterWritten = posterKey;
  }

  const resultJson: GenerateResult = {
    spec,
    projectId,
    outputKey,
    posterKey: posterWritten,
    durationSec,
    width: spec.format.width,
    height: spec.format.height,
    fps: spec.format.fps,
    stages,
  };

  await db
    .update(jobs)
    .set({
      status: 'done',
      stage: 'render',
      progress: 1,
      resultJson,
      finishedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));

  await db
    .update(projects)
    .set({
      status: 'ready',
      outputKey,
      posterKey: posterWritten ?? undefined,
      durationSec,
      width: spec.format.width,
      height: spec.format.height,
      fps: spec.format.fps,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  await writer.flush('render', 1);
  return { outputKey, posterKey: posterWritten };
}
