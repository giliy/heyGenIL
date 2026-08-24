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
import type { Spec } from '@shorts/spec';
import { Captions, ProgressBar } from '../../lib/shorts';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';

// =============================================================================
// COMPOSITION CONFIG (legacy fallback — render-all.mjs uses this when metadata isn't wired)
// =============================================================================
export const compositionConfig = {
  id: 'AvatarSpec',
  durationInSeconds: 10,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ACCENT = '#0b6ce0'; // the Hebrew avatar track's brand blue

// Local prog (spec-renderer's copy isn't exported as a named value here for Sequence math).
const prog = (frame: number, start: number, end: number): number => {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
};

// Strip a leading /media/ from a clip url so staticFile resolves it against the bundle's
// publicDir (media root). Web serves /media/...; on disk it's media/projects/<proj>/talk.mp4.
const clipStaticPath = (src?: string): string => {
  if (!src) return '';
  return src.replace(/^\/media\//, '');
};

// -----------------------------------------------------------------------------
// The HeyGen-IL talking-head spec-driven comp. The worker's TALK stage (between voice and
// pixel) mints ONE lip-synced clip of the locked avatar speaking the whole Hebrew script and
// sets scene.clip on scenes[0]. This comp renders that clip full-bleed (9:16, face-focused)
// with RTL pill captions + a progress bar. The default carries a placeholder dark plate +
// the sample Hebrew lines so the launch template is renderable BEFORE a real generate run.
//
// No CTA outro, no seamless loop requirement here — a talking-head short is a continuous
// single-shot; mode:'avatar' is a declared track with RTL captions. Scenes beyond the first
// (if a spec ever carries them) just extend the same clip across the full duration.
// -----------------------------------------------------------------------------
export const defaultProps: Spec = {
  id: 'avatar-talk',
  title: 'אווטאר מדבר — HeyGen-IL',
  template: 'AvatarSpec',
  engine: 'avatar',
  mode: 'avatar',
  language: 'he',
  rtl: true,
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: ACCENT, font: 'hebrew' },
  voice: {
    engine: 'edge',
    voiceId: 'he-IL-HilaNeural',
    lines: [
      { text: 'שלום! אני האווטאר הדיגיטלי שלך.', start: 0.4, end: 2.6 },
      { text: 'כותבים תסריט, והאווטאר מדבר אותו בעברית.', start: 2.8, end: 6.2 },
      { text: 'מושלם לפרסום, להדרכה, ולמכירות.', start: 6.4, end: 9.6 },
    ],
  },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    { id: 's1', durationSec: 2.6, beatId: 's1', visual: 'avatar greets', overlays: [] },
    { id: 's2', durationSec: 3.4, beatId: 's2', visual: 'avatar explains the flow', overlays: [] },
    { id: 's3', durationSec: 3.2, beatId: 's3', visual: 'avatar calls to action', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-24' },
};

// The talking-head clip: the talk stage sets scene.clip.src on scenes[0]; render that ONE
// video across the full spec duration (it already lipsyncs the whole script). If no clip yet
// (placeholder default), show a dark plate + the first scene's visual text.
const TalkingHead: React.FC<{ spec: Spec }> = ({ spec }) => {
  const src = clipStaticPath(spec.scenes[0]?.clip?.src);
  const frame = useCurrentFrame();
  if (!src) {
    return (
      <AbsoluteFill style={{ background: '#0a0f1e', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#556', fontFamily: 'Arial', fontSize: 40, textAlign: 'center', padding: 60 }}>
          {(spec.scenes[0]?.visual ?? 'talking avatar') ?? ''}
        </div>
      </AbsoluteFill>
    );
  }
  // Gentle Ken-Burns: a slow zoom keeps the face from feeling static over a long take.
  const zoom = interpolate(frame, [0, spec.format.fps * getDurationSec(spec)], [1, 1.04]);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};

const AvatarSpec: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalSec = getDurationSec(spec);
  const loopStartSec = Math.max(0, totalSec - (spec.scenes[spec.scenes.length - 1]?.durationSec ?? 0));
  const loopEndSec = totalSec;
  const loopRestore = prog(frame, Math.round(loopStartSec * fps), Math.round(loopEndSec * fps));
  const captionFrame = loopRestore > 0 ? 0 : frame;

  const captionY = spec.format.height - 360;
  const accent = spec.theme.accent ?? ACCENT;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* The talking-head clip, full-bleed across the whole spec. */}
      <TalkingHead spec={spec} />

      {/* Generic spec overlays (Hebrew titles/kickers — declared, language-driven). */}
      <RenderSpecOverlays spec={spec} />

      {/* RTL pill captions + progress. */}
      <div style={{ position: 'absolute', inset: 0, opacity: loopRestore > 0 ? loopRestore : 1 }}>
        <Captions
          lines={spec.voice?.lines ?? []}
          mode="pill"
          y={captionY}
          accent={accent}
          frameOverride={captionFrame}
        />
      </div>
      <ProgressBar color={accent} resetAt={Math.round(loopStartSec * fps)} />
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

export default AvatarSpec;
