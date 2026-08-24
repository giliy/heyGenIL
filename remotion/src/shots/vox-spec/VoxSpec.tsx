import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Spec, VoxLayer, VoxCamKey } from '@shorts/spec';
import { Captions, ProgressBar, captionModeFromPreset } from '../../lib/shorts';
import {
  ArchivalPhoto,
  CollageBoard,
  Cutout,
  Grain,
  LabelChip,
  PaperBG,
  RubberStamp,
  VOX,
} from '../../lib/collage';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';

// =============================================================================
// COMPOSITION CONFIG (legacy fallback — render-all.mjs uses this when metadata isn't wired)
// =============================================================================
export const compositionConfig = {
  id: 'VoxSpec',
  durationInSeconds: 30,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ACCENT = VOX.red;

// Local prog (spec-renderer's copy isn't exported as a named value here for Sequence math).
const prog = (frame: number, start: number, end: number): number => {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
};

// Strip a leading /media/ so staticFile resolves against the bundle's publicDir (media/).
// Web serves /media/...; on disk it's media/projects/<proj>/layer.png.
const mediaPath = (src?: string): string => {
  if (!src) return '';
  return src.replace(/^\/media\//, '');
};

// -----------------------------------------------------------------------------
// The generic vox launch template. A paper-collage explainer: a warm paper board, a
// virtual camera that pushes/pans between anchors, and per-scene layer stacks (cutouts,
// archival photos, labels, stamps). The worker's collage-layers job mints the layer PNGs
// into media/projects/<proj>/ at generate time; this default carries NO generated layers
// (only text labels + a flat cream board) so the template is renderable immediately.
// -----------------------------------------------------------------------------
export const defaultProps: Spec = {
  id: 'vox-spec',
  title: 'Paper-Collage Explainer',
  template: 'VoxSpec',
  engine: 'vox',
  mode: 'vox',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: ACCENT, font: 'editorial' },
  voice: {
    engine: 'edge',
    voiceId: 'en-US-ChristopherNeural',
    lines: [
      { text: 'A paper-collage explainer.', start: 0.3, end: 3.2 },
      { text: 'Layers assemble on the board.', start: 3.4, end: 6.4 },
      { text: 'The camera narrates the story.', start: 6.6, end: 10.2 },
      { text: 'Every layer carries depth.', start: 10.4, end: 14.0 },
      { text: 'Built for the vox track.', start: 14.2, end: 17.8 },
    ],
  },
  captions: { preset: 'pill', burnIn: true },
  vox: {
    paper: {},
    grain: 0.055,
    cam: [
      { f: 0, x: 540, y: 960, z: 1 },
      { f: 540, x: 540, y: 960, z: 1 },
    ],
  },
  scenes: [
    {
      id: 's1', durationSec: 3.6, beatId: 's1', visual: 'the paper board and title',
      vox: {
        layers: [
          { id: 't1', type: 'label', text: 'PAPER-COLLAGE', x: 540, y: 420, w: 700, at: 6, enter: 'pop', accent: VOX.red, size: 40 },
          { id: 't2', type: 'label', text: 'A story told in layers', x: 540, y: 1560, w: 900, at: 20, enter: 'rise', accent: VOX.teal, size: 34 },
        ],
      },
      overlays: [],
    },
    {
      id: 's2', durationSec: 3.6, beatId: 's2', visual: 'cutout subject on the paper',
      vox: {
        layers: [
          { id: 'l1', type: 'label', text: 'Cutouts are die-cut subjects', x: 540, y: 420, w: 900, at: 6, enter: 'pop', accent: VOX.yellow, kickerColor: VOX.inkSoft, size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's3', durationSec: 3.6, beatId: 's3', visual: 'an archival photo print',
      vox: {
        layers: [
          { id: 'l2', type: 'label', text: 'Photos get an archival border', x: 540, y: 1520, w: 950, at: 10, enter: 'rise', accent: VOX.teal, size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's4', durationSec: 3.6, beatId: 's4', visual: 'annotations on the board',
      vox: {
        layers: [
          { id: 'l3', type: 'label', text: 'Labels annotate the scene', x: 540, y: 420, w: 900, at: 6, enter: 'pop', accent: VOX.red, size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's5', durationSec: 3.6, beatId: 's5', visual: 'the board loops back',
      vox: {
        layers: [
          { id: 'l4', type: 'label', text: 'A seamless paper loop', x: 540, y: 1560, w: 900, at: 8, enter: 'rise', accent: VOX.teal, size: 36 },
        ],
      },
      overlays: [],
    },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
};

// -----------------------------------------------------------------------------
// VoxLayerRenderer — maps one spec VoxLayer onto the collage kit. `at` is LOCAL frames
// within the scene's <Sequence>. The kit's Layer/Cutout/etc. all read useCurrentFrame(),
// which is the Sequence-local frame — exactly what we want for scene-relative entrances.
// -----------------------------------------------------------------------------
const VoxLayerView: React.FC<{ layer: VoxLayer; sceneStartFrame: number }> = ({ layer }) => {
  const common = {
    x: layer.x,
    y: layer.y,
    w: layer.w,
    at: layer.at ?? 0,
    dur: layer.dur ?? 14,
    enter: layer.enter ?? ('place' as const),
    rotate: layer.rotate,
    depth: layer.depth,
    drift: layer.drift,
    z: layer.z,
  };
  switch (layer.type) {
    case 'cutout': {
      // src is optional until the pixel stage mints it — skip gracefully (render nothing)
      // rather than staticFile('') which would 404 / error the frame.
      if (!layer.src) return null;
      return (
        <Cutout
          src={staticFile(mediaPath(layer.src))}
          {...common}
          sticker={layer.sticker}
          shadow={layer.shadow}
          style={layer.style}
        />
      );
    }
    case 'photo': {
      if (!layer.src) return null;
      return (
        <ArchivalPhoto
          src={staticFile(mediaPath(layer.src))}
          {...common}
          treatment={layer.treatment}
          caption={layer.caption}
          style={layer.style}
        />
      );
    }
    case 'label':
      return (
        <LabelChip
          text={layer.text}
          x={layer.x}
          y={layer.y}
          at={layer.at ?? 0}
          size={layer.size ?? 30}
          accent={layer.accent}
          kicker={layer.kicker}
          kickerColor={layer.kickerColor}
          rotate={layer.rotate}
          depth={layer.depth}
          z={layer.z}
        />
      );
    case 'stamp':
      return (
        <RubberStamp
          text={layer.text}
          x={layer.x}
          y={layer.y}
          at={layer.at ?? 0}
          size={layer.size ?? 72}
          color={layer.color}
          rotate={layer.rotate}
          depth={layer.depth}
          z={layer.z}
        />
      );
  }
};

// -----------------------------------------------------------------------------
// MAIN — spec-driven. One shared CollageBoard (the whole spec), camera from spec.vox.cam,
// PaperBG from spec.vox.paper, each scene's layer stack in its own <Sequence>, generic
// text overlays via RenderSpecOverlays, captions + progress restored at the loop.
// -----------------------------------------------------------------------------
const VoxSpec: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const F = (s: number) => Math.round(s * fps);

  const totalSec = getDurationSec(spec);
  const lastScene = spec.scenes[spec.scenes.length - 1];
  const loopStartSec = totalSec - lastScene.durationSec;
  const loopEndSec = totalSec;
  const loopRestore = prog(frame, F(loopStartSec), F(loopEndSec));
  const captionFrame = loopRestore > 0 ? 0 : frame;

  const captionY = spec.format.height - 360;
  const accent = spec.theme.accent ?? ACCENT;
  const grainOpacity = spec.vox?.grain ?? 0.055;

  // Global start frame per scene (back-to-back).
  const starts: number[] = [];
  {
    let acc = 0;
    for (const s of spec.scenes) {
      starts.push(acc);
      acc += Math.round(s.durationSec * fps);
    }
  }

  // Camera keyframes: use spec.vox.cam when present, else a single static anchor.
  const cam: VoxCamKey[] =
    spec.vox?.cam && spec.vox.cam.length > 0
      ? spec.vox.cam
      : [{ f: 0, x: spec.format.width / 2, y: spec.format.height / 2, z: 1 }];

  // The paper texture (a generated layer) or flat cream.
  const paperSrc = spec.vox?.paper?.src ? staticFile(mediaPath(spec.vox.paper.src)) : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: VOX.paper }}>
      <CollageBoard cam={cam}>
        <PaperBG src={paperSrc} w={spec.format.width} h={spec.format.height} />

        {/* Per-scene layer stacks, back-to-back. */}
        {spec.scenes.map((scene, i) => (
          <Sequence
            key={scene.id}
            from={starts[i]}
            durationInFrames={Math.max(1, Math.round(scene.durationSec * fps))}
            layout="none"
          >
            {(scene.vox?.layers ?? []).map((layer) => (
              <VoxLayerView key={layer.id} layer={layer} sceneStartFrame={starts[i]} />
            ))}
          </Sequence>
        ))}

        {/* Generic spec text overlays (headlines, kickers — mode:'vox' has no CTA outro). */}
        <RenderSpecOverlays spec={spec} />
      </CollageBoard>

      {/* Film grain over everything (a vox signature). */}
      {grainOpacity > 0 ? <Grain opacity={grainOpacity} /> : null}

      {/* Pill captions + progress, restored at the loop. */}
      <div style={{ position: 'absolute', inset: 0, opacity: loopRestore > 0 ? loopRestore : 1 }}>
        <Captions
          lines={spec.voice?.lines ?? []}
          mode={captionModeFromPreset(spec.captions?.preset)}
          y={captionY}
          accent={accent}
          frameOverride={captionFrame}
        />
      </div>
      <ProgressBar color={accent} resetAt={F(loopStartSec)} />
    </AbsoluteFill>
  );
};

export const calculateMetadata = async ({ props }: { props: { spec?: Spec } }) => {
  const spec = props.spec ?? defaultProps;
  return {
    durationInFrames: specDurationFrames(spec),
    fps: spec.format.fps,
    ...specDimensions(spec),
  };
};

export default VoxSpec;
