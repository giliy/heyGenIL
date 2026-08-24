// The worker loop: poll for claimable jobs (generate + render), run them, handle errors.
import type { Db } from '@shorts/db';
import { claimNextJob, claimNextGenerateJob, claimNextAiImageJob, claimNextAiClipJob, claimNextCharacterMintJob, claimNextCollageLayersJob, claimNextConsentVerifyJob } from './claim.js';
import { runRenderJob } from './render.js';
import { runGenerate } from './orchestrate/runGenerate.js';
import { runAiImageJob } from './ai-image.js';
import { runAiClipJob } from './ai-clip.js';
import { runCollageLayersJob } from './collage-layers.js';
import { runCharacterMintJob } from './character.js';
import { runConsentVerifyJob } from './consent.js';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';

const POLL_MS = 1000;

export async function runLoop(db: Db, signal: { stop: boolean }): Promise<void> {
  while (!signal.stop) {
    try {
      // 1) AI-image generate jobs (Phase 4) — highest priority (they write spec + deduct).
      const aiJob = await claimNextAiImageJob(db);
      if (aiJob) {
        console.log(`[loop] claimed ai-image job ${aiJob.id} (project ${aiJob.projectId})`);
        await runAiImageJob(db, aiJob.id, aiJob.projectId, aiJob.userId, aiJob.inputJson, aiJob.reservedCredits);
        console.log(`[loop] finished ai-image job ${aiJob.id}`);
        continue;
      }
      // 1b) AI-clip generate jobs (Phase 4) — image-to-video, the top-tier pixel spend.
      const clipJob = await claimNextAiClipJob(db);
      if (clipJob) {
        console.log(`[loop] claimed ai-clip job ${clipJob.id} (project ${clipJob.projectId})`);
        await runAiClipJob(db, clipJob.id, clipJob.projectId, clipJob.userId, clipJob.inputJson, clipJob.reservedCredits);
        console.log(`[loop] finished ai-clip job ${clipJob.id}`);
        continue;
      }
      // 1c) Collage-layers generate jobs (Phase 5) — mint vox paper-collage layers.
      const collageJob = await claimNextCollageLayersJob(db);
      if (collageJob) {
        console.log(`[loop] claimed collage-layers job ${collageJob.id} (project ${collageJob.projectId})`);
        await runCollageLayersJob(db, collageJob.id, collageJob.projectId, collageJob.userId, collageJob.inputJson, collageJob.reservedCredits);
        console.log(`[loop] finished collage-layers job ${collageJob.id}`);
        continue;
      }
      // 1d) Consent-verify jobs (HeyGen-IL) — free trust gate for digital twins.
      const consentJob = await claimNextConsentVerifyJob(db);
      if (consentJob) {
        console.log(`[loop] claimed consent-verify job ${consentJob.id}`);
        await runConsentVerifyJob(db, consentJob.id, consentJob.inputJson);
        console.log(`[loop] finished consent-verify job ${consentJob.id}`);
        continue;
      }
      // 2) Character-mint jobs (Phase 2) — lock the canonical reference, then deduct.
      const mintJob = await claimNextCharacterMintJob(db);
      if (mintJob) {
        console.log(`[loop] claimed character-mint job ${mintJob.id}`);
        await runCharacterMintJob(db, mintJob.id, mintJob.inputJson, mintJob.reservedCredits);
        console.log(`[loop] finished character-mint job ${mintJob.id}`);
        continue;
      }
      // 3) Full generate jobs (Phase 3) — enqueue a render job downstream.
      const genJob = await claimNextGenerateJob(db);
      if (genJob) {
        console.log(`[loop] claimed generate job ${genJob.id} (project ${genJob.projectId})`);
        await runGenerate(db, genJob.id, genJob.projectId, genJob.inputJson, genJob.costCredits ?? 0);
        console.log(`[loop] finished generate job ${genJob.id}`);
        continue;
      }
      // 4) Render jobs.
      const job = await claimNextJob(db);
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      console.log(`[loop] claimed job ${job.id} (project ${job.projectId})`);
      const owner = await projectOwner(db, job.projectId);
      await runRenderJob(db, job.id, job.projectId, job.inputJson, owner, job.reservedCredits ?? 0);
      console.log(`[loop] finished job ${job.id}`);
    } catch (e) {
      console.error('[loop] error:', e);
      await sleep(POLL_MS * 2);
    }
  }
}

async function projectOwner(db: Db, projectId: string): Promise<string> {
  const p = await getDb().query.projects.findFirst({ where: eq(projects.id, projectId) });
  return p?.userId ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
