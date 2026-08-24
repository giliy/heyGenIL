import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Spec, Scene } from '@shorts/spec';
import { Captions, ProgressBar, captionModeFromPreset } from '../../lib/shorts';
import { COLORS } from '../../brand';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';

// =============================================================================
// COMPOSITION CONFIG (legacy fallback — render-all.mjs uses this when metadata isn't wired)
// =============================================================================
export const compositionConfig = {
  id: 'AiSpec',
  durationInSeconds: 30,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ACCENT = '#d2a854'; // the scarf yellow (blue-man character.json)
const TAIL = 8; // frames each shot under-laps the next for the crossfade

// Local prog (spec-renderer's copy isn't exported as a named value here for Sequence math).
const prog = (frame: number, start: number, end: number): number => {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
};

// The spec-driven AI-video default: a generic locked-character short. Scenes reference
// clips by absolute /media/ url (the worker's pixel stage fills these in at render time);
// the default carries NO clips so it renders as a placeholder caption-only loop until a
// real project supplies clips. A launch template built on this comp is "ready" (registered)
// from the start — clips arrive when the generate pipeline runs its fal pixel stage.
// Loop closure is the PIPELINE's job (clip-0's loop-return ends on frame-0's pixels) — the
// QA contract (Phase 4d) structurally requires every scene to carry a clip; the dissolve is
// not done here (P1). mode:'ai' has NO CTA outro and NO extra tail — the last clip plays out.
export const defaultProps: Spec = {
  id: 'ai-spec',
  title: 'AI Video Short',
  template: 'AiSpec',
  engine: 'ai',
  mode: 'ai',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: ACCENT, font: 'display' },
  voice: {
    engine: 'edge',
    voiceId: 'en-US-ChristopherNeural',
    lines: [
      { text: 'A locked recurring character.', start: 0.3, end: 3.2 },
      { text: 'Generated scene by scene.', start: 3.4, end: 6.4 },
      { text: 'Every shot keeps the same face.', start: 6.6, end: 10.2 },
      { text: 'Seamless loop, end to end.', start: 10.4, end: 14.0 },
      { text: 'Built for the AI-video track.', start: 14.2, end: 17.8 },
    ],
  },
  captions: { preset: 'pill', burnIn: true },
  scenes: [
    { id: 's1', durationSec: 3.6, beatId: 's1', visual: 'the recurring character appears', overlays: [] },
    { id: 's2', durationSec: 3.6, beatId: 's2', visual: 'the recurring character walks forward', overlays: [] },
    { id: 's3', durationSec: 3.6, beatId: 's3', visual: 'the recurring character reacts', overlays: [] },
    { id: 's4', durationSec: 3.6, beatId: 's4', visual: 'the recurring character looks at camera', overlays: [] },
    { id: 's5', durationSec: 3.6, beatId: 's5', visual: 'the recurring character loops back', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
};

// Strip a leading /media/ from a clip url so staticFile resolves it against the bundle's
// publicDir (media root). Web serves /media/...; on disk it's media/projects/<proj>/clip.mp4,
// so the staticFile path is projects/<proj>/clip.mp4.
const clipStaticPath = (src?: string): string => {
  if (!src) return '';
  return src.replace(/^\/media\//, '');
};

// A scene's backing clip, crossfaded with its neighbours (underlap of TAIL frames).
const SceneClip: React.FC<{ scene: Scene; clipStartFrame: number; fadeIn: number }> = ({ scene, clipStartFrame, fadeIn }) => {
  const frame = useCurrentFrame();
  const dur = Math.max(1, Math.round(scene.durationSec * 30));
  const src = clipStaticPath(scene.clip?.src);
  if (!src) {
    // No clip yet (placeholder default): render a dark plate + the scene's visual as text.
    return (
      <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#333', fontFamily: 'Arial', fontSize: 40, textAlign: 'center', padding: 40 }}>
          {(scene.visual ?? scene.id) ?? ''}
        </div>
      </AbsoluteFill>
    );
  }
  const opacity = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};

const AiSpec: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
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

  // Global start frame per scene (back-to-back), + the last scene's loop window.
  const starts: number[] = [];
  {
    let acc = 0;
    for (const s of spec.scenes) {
      starts.push(acc);
      acc += Math.round(s.durationSec * fps);
    }
  }

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Backing clips, back-to-back with TAIL crossfades. */}
      {spec.scenes.map((scene, i) => {
        const fadeIn = i === 0 ? 0 : TAIL;
        const from = i === 0 ? 0 : starts[i] - TAIL;
        const dur = (starts[i] + Math.round(scene.durationSec * fps)) - from;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur} premountFor={fps}>
            <SceneClip scene={scene} clipStartFrame={starts[i]} fadeIn={fadeIn} />
          </Sequence>
        );
      })}

      {/* Generic spec overlays (titles, kickers, CTA copy — mode:'ai' has no CTA outro). */}
      <RenderSpecOverlays spec={spec} />

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

export default AiSpec;
