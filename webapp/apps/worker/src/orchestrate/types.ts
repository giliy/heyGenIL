// orchestrate/types.ts — shared types + stage constants for the generate pipeline.
// The canonical stage strings live in @shorts/spec (GENERATE_STAGES) — re-exported here.
import { GENERATE_STAGES, type GeneratePayload, type Spec } from '@shorts/spec';

export { GENERATE_STAGES };
export type { GeneratePayload };

/** Per-stage report, written into jobs.resultJson.stages on done. */
export interface StageReport {
  stage: string;
  ok: boolean;
  detail?: string;
  /** Files produced by this stage (repo-relative or storage-key), for the cost/log seam. */
  outputs?: string[];
}

/** The worker-side result payload written to jobs.resultJson on done. */
export interface GenerateResult {
  spec: Spec;
  projectId: string;
  outputKey: string;
  posterKey?: string | null;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  stages: StageReport[];
}
