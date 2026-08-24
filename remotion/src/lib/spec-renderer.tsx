// Generic spec-driven overlay renderer. Maps a Spec's Scene[]/Overlay[] to absolutely-
// positioned Remotion elements, reusing brand motion + RTL helpers from lib/shorts.tsx.
// Scene-relative timing invariant: each scene lives in its own <Sequence>; inside, an
// overlay's localFrame window is [round(start*fps), round(end*fps)) — never global frames.
//
// Per plan decision: zod runtime validation stays in the worker/web (Node), NOT bundled
// here. Runtime helpers (getDurationSec, prog) are duplicated locally to avoid a hard
// build-order coupling with the @shorts/spec package — types are imported type-only.
import React from 'react';
import { AbsoluteFill, Img, Sequence, useCurrentFrame, staticFile } from 'remotion';
import type { Spec, Scene, Overlay, OverlayText, OverlayImage } from '@shorts/spec';
import { prog, EASE_OUT, stripNikkud, anchorRtl } from './shorts';
import { FONT_DISPLAY_H, FONT_BODY_H, FONT_MONO, FONT_HEBREW, FONT_HEBREW_CAPTION } from '../fonts';

// Pure local helper — total spec duration in seconds (back-to-back scenes, no gaps).
const getDurationSec = (spec: Pick<Spec, 'scenes'>): number =>
  spec.scenes.reduce((a, s) => a + s.durationSec, 0);

// Map a style.font token to a concrete face. Default: Hebrew-capable display face so
// any overlay can render Hebrew without a missing-glyph box, offline.
const resolveFont = (font?: string): string => {
  switch (font) {
    case 'body':
      return FONT_BODY_H;
    case 'mono':
      return FONT_MONO;
    case 'hebrew':
      return FONT_HEBREW;
    case 'caption':
      return FONT_HEBREW_CAPTION;
    case 'display':
    default:
      return FONT_DISPLAY_H;
  }
};

const isRtl = (o: OverlayText): boolean => o.style?.align === 'right' || o.style?.font === 'hebrew';

// Entrance animation over ~7–8 frames keyed to local frame — deterministic, repeat-safe.
// PRE-ROLL invariant: an overlay at the composition's frame 0 (first scene, local frame 0)
// renders fully composed — the frame-0-is-a-thumbnail rule. Overlays starting later still
// animate in, as do frame-0 overlays of NON-first scenes (their scene starts after 0).
const enterStyle = (
  animation: Overlay['animation'] | undefined,
  localFrame: number,
  startFrame: number,
  preRoll: boolean
): { opacity: number; transform: string } => {
  const kind = animation ?? 'rise';
  if (kind === 'none') return { opacity: 1, transform: 'none' };
  if (preRoll) return { opacity: 1, transform: 'none' }; // frame 0 fully composed
  if (kind === 'pop') {
    const p = EASE_OUT(prog(localFrame, startFrame, startFrame + 8));
    return { opacity: p, transform: `scale(${0.94 + 0.06 * p})` }; // max 1.06 per brand
  }
  if (kind === 'fade') {
    const p = EASE_OUT(prog(localFrame, startFrame, startFrame + 7));
    return { opacity: p, transform: 'none' };
  }
  // 'rise' (default): opacity + translateY 24px -> 0 over ~7 frames, ease-out.
  const p = EASE_OUT(prog(localFrame, startFrame, startFrame + 7));
  return { opacity: p, transform: `translateY(${(1 - p) * 24}px)` };
};

// One text overlay. RTL renders the FULL line (never token-split) with stripNikkud +
// anchorRtl + unicodeBidi:'isolate'.
const TextOverlay: React.FC<{ overlay: OverlayText; localFrame: number; fps: number; preRoll: boolean }> = ({
  overlay,
  localFrame,
  fps,
  preRoll,
}) => {
  const startF = Math.round(overlay.start * fps);
  const endF = Math.round(overlay.end * fps);
  if (localFrame < startF || localFrame >= endF) return null;
  const enter = enterStyle(overlay.animation, localFrame, startF, preRoll && startF === 0);
  const style = overlay.style ?? {};
  const rtl = isRtl(overlay);
  const baseOpacity = overlay.opacity ?? 1;
  const content = rtl ? anchorRtl(stripNikkud(overlay.content)) : overlay.content;
  return (
    <div
      style={{
        position: 'absolute',
        left: overlay.x,
        top: overlay.y,
        width: overlay.w,
        height: overlay.h,
        transform: `${enter.transform} rotate(${overlay.rotation ?? 0}deg)`,
        opacity: enter.opacity * baseOpacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
        direction: rtl ? 'rtl' : 'ltr',
      }}
    >
      <div
        style={{
          width: '100%',
          textAlign: (style.align as 'left' | 'center' | 'right') ?? 'center',
          fontFamily: resolveFont(style.font),
          fontWeight: style.weight ?? 700,
          fontSize: style.size ?? 64,
          color: style.color ?? '#ffffff',
          lineHeight: 1.1,
          unicodeBidi: 'isolate',
          textShadow: '0 4px 30px rgba(0,0,0,0.5)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
};

// One image overlay. src required at render time; missing src renders nothing + warn.
const ImageOverlay: React.FC<{ overlay: OverlayImage; localFrame: number; fps: number; preRoll: boolean }> = ({
  overlay,
  localFrame,
  fps,
  preRoll,
}) => {
  const startF = Math.round(overlay.start * fps);
  const endF = Math.round(overlay.end * fps);
  if (localFrame < startF || localFrame >= endF) return null;
  if (!overlay.src) {
    if (typeof console !== 'undefined')
      console.warn(`image overlay ${overlay.id}: no src (asset resolution is a later phase)`);
    return null;
  }
  const enter = enterStyle(overlay.animation, localFrame, startF, preRoll && startF === 0);
  const baseOpacity = overlay.opacity ?? 1;
  // Relative paths resolve against the bundle's publicDir (media/); absolute URLs pass through.
  const src = /^https?:\/\//.test(overlay.src) ? overlay.src : staticFile(overlay.src);
  return (
    <div
      style={{
        position: 'absolute',
        left: overlay.x,
        top: overlay.y,
        width: overlay.w,
        height: overlay.h,
        transform: `${enter.transform} rotate(${overlay.rotation ?? 0}deg)`,
        opacity: enter.opacity * baseOpacity,
      }}
    >
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};

export const OverlayLayer: React.FC<{ overlay: Overlay; localFrame: number; fps: number; preRoll?: boolean }> = ({
  overlay,
  localFrame,
  fps,
  preRoll = false,
}) =>
  overlay.type === 'text' ? (
    <TextOverlay overlay={overlay as OverlayText} localFrame={localFrame} fps={fps} preRoll={preRoll} />
  ) : (
    <ImageOverlay overlay={overlay as OverlayImage} localFrame={localFrame} fps={fps} preRoll={preRoll} />
  );

// All overlays of ONE scene, laid out over the full composition. Reads its own local
// frame (the parent wraps it in a scene <Sequence>).
const SceneOverlayLayer: React.FC<{ scene: Scene; fps: number; preRoll: boolean }> = ({ scene, fps, preRoll }) => {
  const localFrame = useCurrentFrame(); // LOCAL within the scene's Sequence
  return (
    <AbsoluteFill>
      {scene.overlays.map((ov) => (
        <OverlayLayer key={ov.id} overlay={ov} localFrame={localFrame} fps={fps} preRoll={preRoll} />
      ))}
    </AbsoluteFill>
  );
};

// Wraps one scene's overlays in its own <Sequence> at the correct global start frame.
// preRoll=true only for the first scene (its frame 0 is the composition's frame 0).
export const SceneOverlays: React.FC<{ scene: Scene; sceneStartFrame: number; fps: number; preRoll?: boolean }> = ({
  scene,
  sceneStartFrame,
  fps,
  preRoll = false,
}) => {
  const dur = Math.max(1, Math.round(scene.durationSec * fps));
  return (
    <Sequence from={sceneStartFrame} durationInFrames={dur} premountFor={fps}>
      <SceneOverlayLayer scene={scene} fps={fps} preRoll={preRoll} />
    </Sequence>
  );
};

// Maps spec.scenes[] to back-to-back <Sequence>s + their overlays. Renders OVERLAYS ONLY —
// a template composes this above its own niche visuals/backdrops.
export const RenderSpecOverlays: React.FC<{ spec: Spec }> = ({ spec }) => {
  const { fps } = spec.format;
  // Precompute each scene's global start frame (back-to-back).
  const starts: number[] = [];
  let acc = 0;
  for (const s of spec.scenes) {
    starts.push(acc);
    acc += Math.round(s.durationSec * fps);
  }
  return (
    <>
      {spec.scenes.map((scene, i) => (
        <SceneOverlays key={scene.id} scene={scene} sceneStartFrame={starts[i]} fps={fps} preRoll={i === 0} />
      ))}
    </>
  );
};

// Re-export the local duration helper so templates can share it.
export { getDurationSec };
