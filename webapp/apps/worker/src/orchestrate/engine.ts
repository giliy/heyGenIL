// engine.ts — the worker's wrapper over @remotion/renderer, reusing render-spec.mjs.
//
// render-spec.mjs (Phase 0/1) already owns: zod-validate-first, cached bundle per
// template+version, selectComposition with inputProps={spec}, renderMedia with the pinned
// headless-shell Chrome + concurrency + onProgress, and a frame-0 poster still. We import
// it here (dynamic import so tsx's loader hooks the transitive '@shorts/spec' import —
// see render.ts) and reuse it for the generate pipeline's silent master + QA frames.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

interface RenderSpecModule {
  renderSpec: (
    templateId: string,
    spec: unknown,
    opts: {
      outputLocation?: string;
      posterLocation?: string;
      scale?: number;
      onProgress?: (p: { progress: number }) => void;
    }
  ) => Promise<{
    outputPath: string;
    posterPath: string;
    durationSec: number;
    durationInFrames: number;
    width: number;
    height: number;
    fps: number;
  }>;
}

let _mod: RenderSpecModule | null = null;

async function loadRenderSpec(): Promise<RenderSpecModule> {
  if (_mod) return _mod;
  // here = worker/src/orchestrate -> render-spec.mjs lives at worker/render-spec.mjs (../../).
  _mod = (await import(
    pathToFileURL(path.resolve(here, '..', '..', 'render-spec.mjs')).href
  )) as RenderSpecModule;
  return _mod;
}

/**
 * Render a silent master (the build stage's output). The TSX has no <Audio>, so the
 * produced mp4 is silent; the voice track is muxed in the mix stage.
 */
export async function renderSilentMaster(
  templateId: string,
  spec: unknown,
  outputLocation: string,
  onProgress: (p: { progress: number }) => void
): Promise<{
  outputPath: string;
  durationSec: number;
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
}> {
  const mod = await loadRenderSpec();
  return mod.renderSpec(templateId, spec, {
    outputLocation,
    scale: 1,
    onProgress,
  });
}
