// calculateMetadata helpers for spec-driven templates. Reused by both launch templates.
import type { Spec } from '@shorts/spec';

// Total render length in frames from the spec's scenes (back-to-back, no gaps).
export const specDurationFrames = (spec: Spec): number =>
  Math.round(spec.scenes.reduce((a, s) => a + s.durationSec, 0) * spec.format.fps);

// Composition dimensions from the spec format block.
export const specDimensions = (spec: Spec): { width: number; height: number } => ({
  width: spec.format.width,
  height: spec.format.height,
});
