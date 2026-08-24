// Worker SRT formatter. The pure logic lives in @shorts/spec (buildSrt) so web + worker share
// ONE implementation and cannot drift. This module re-exports it at the worker's canonical path
// (phase-5-polish.md §Worker/C) and adds worker-only conveniences.
export { buildSrt, formatSrtTimestamp } from '@shorts/spec';
export type { SrtOptions } from '@shorts/spec';
