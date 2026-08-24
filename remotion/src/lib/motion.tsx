// Draw-on / path-motion helpers built on @remotion/paths. NOT a shot itself.
// Three primitives:
//   <DrawOn>       — an SVG <path> whose stroke draws itself on over N frames (evolvePath)
//   moveAlongPath  — {x, y} of a point travelling along a path string (getPointAtLength)
//   <Morph>        — a <path> interpolating between two path strings (interpolatePath)
// Frame-based only; all progress is clamped so out-of-range frames stay at the ends.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { evolvePath, getLength, getPointAtLength, interpolatePath } from '@remotion/paths';
import { freehandPath, type FreehandPoint } from './freehand';

const CLAMP = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

/** Progress of the current frame through a window starting at `delay`. */
const useProgress = (durationInFrames: number, delay: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + durationInFrames], [0, 1], CLAMP);
};

export type DrawOnProps = {
  /** SVG path data (the `d` string). */
  d: string;
  /** Frames the draw-on takes, from `delay` to fully drawn. */
  durationInFrames: number;
  /** Frames to wait before the draw starts. Default 0. */
  delay?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  /**
   * Optional: render the stroke as a pressure-varying freehand stroke
   * (perfect-freehand) instead of a constant-width SVG stroke. When set, the
   * path is sampled into points, the outline is computed once (pure), and the
   * draw-on reveal is a clip sweep along the path's x-extent rather than the
   * dash trick. `strokeWidth` is used as the pen `size`.
   */
  pressure?: boolean;
  /** Extra props spread onto the <path> (e.g. transform, opacity). */
  pathProps?: React.SVGProps<SVGPathElement>;
};

/**
 * Renders an SVG <path> whose stroke draws on over `durationInFrames`
 * (dash trick via @remotion/paths' evolvePath). Fill stays 'none' — this is
 * a stroke effect; pass a static sibling <path> if you need a filled shape.
 */
export const DrawOn: React.FC<DrawOnProps> = ({
  d,
  durationInFrames,
  delay = 0,
  stroke = 'currentColor',
  strokeWidth = 4,
  strokeLinecap = 'round',
  pressure = false,
  pathProps,
}) => {
  const progress = useProgress(durationInFrames, delay);
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, d);

  if (pressure) {
    // Pressure mode: sample the path into points, build a pressure-varying
    // outline once (perfect-freehand, pure), and reveal it with a clip sweep
    // along the path's x-extent. Fully deterministic (outline is precomputed).
    const points = samplePathToPoints(d);
    const outline = freehandPath(points, { size: strokeWidth * 2 });
    const xs = points.map((p) => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(1, maxX - minX);
    const clipId = `drawon-p-${Math.round(minX)}-${Math.round(maxX)}`;
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={minX} y={-9999} width={span * progress} height={19998} />
          </clipPath>
        </defs>
        <path d={outline} fill={stroke} clipPath={`url(#${clipId})`} {...pathProps} />
      </g>
    );
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      {...pathProps}
    />
  );
};

/**
 * Sample an SVG path string into [x, y] points (for perfect-freehand). Walks
 * the path by length via @remotion/paths. Pure and deterministic for a fixed d.
 */
const samplePathToPoints = (d: string, count = 96): FreehandPoint[] => {
  const len = getLength(d);
  const pts: FreehandPoint[] = [];
  for (let i = 0; i <= count; i++) {
    const pt = getPointAtLength(d, (i / count) * len);
    if (pt) pts.push([pt.x, pt.y]);
  }
  return pts;
};

/**
 * Position of a point that has travelled `frame`/`durationInFrames` along an
 * SVG path string (linear along the path length; ease by passing a pre-eased
 * frame value). Returns {x, y} in the path's own coordinate space — feed it
 * to a translate() transform. Clamped to the path ends outside the window.
 */
export const moveAlongPath = (
  path: string,
  frame: number,
  durationInFrames: number,
): { x: number; y: number } => {
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], CLAMP);
  const point = getPointAtLength(path, progress * getLength(path));
  // getPointAtLength returns null only on degenerate paths; fall back to origin.
  return point ? { x: point.x, y: point.y } : { x: 0, y: 0 };
};

export type MorphProps = {
  from: string;
  to: string;
  /** Frames the morph takes, from `delay` to fully `to`. */
  durationInFrames: number;
  /** Frames to wait before the morph starts. Default 0. */
  delay?: number;
  /** Extra props spread onto the <path> (fill, stroke, transform, ...). */
  pathProps?: React.SVGProps<SVGPathElement>;
};

/**
 * A <path> that morphs between two path strings over `durationInFrames`,
 * driven by the current frame (via @remotion/paths' interpolatePath).
 * Both paths should describe the same kind of shape for a sane in-between.
 */
export const Morph: React.FC<MorphProps> = ({
  from,
  to,
  durationInFrames,
  delay = 0,
  pathProps,
}) => {
  const progress = useProgress(durationInFrames, delay);
  return <path d={interpolatePath(progress, from, to)} {...pathProps} />;
};
