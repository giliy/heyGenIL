import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../../brand';
import { FONT_BODY } from '../../fonts';
import { SketchLineDrawOn, SketchShape } from '../../lib/sketch';
import { FreehandDrawOn } from '../../lib/freehand';
import { AnnotateHighlight, AnnotateUnderline, AnnotateCircle, AnnotateBox } from '../../lib/annotation';
import { DrawOn } from '../../lib/motion';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof2Sketch',
  durationInSeconds: 4,
  fps: 30,
  width: 1080,
  height: 1920,
};

const VB = { w: 1080, h: 1920 };

/**
 * QA shot for the P0 sketch/annotation/freehand kit. Every element below is a
 * deterministic pure-function-of-frame primitive; the byte-compare + non-
 * monotonic seek gate (frames.mjs run twice) proves it.
 */
const Proof2Sketch: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <div style={{ position: 'absolute', top: 120, left: 60, right: 60, fontFamily: FONT_BODY, color: COLORS.ink }}>
        <div style={{ fontSize: 56, fontWeight: 600 }}>
          Sketch / annotate kit
        </div>

        {/* rough-notation: highlight sweep on a word */}
        <div style={{ marginTop: 80, fontSize: 72, fontWeight: 700 }}>
          This is{' '}
          <AnnotateHighlight at={10} dur={16} color={COLORS.warn}>
            highlighted
          </AnnotateHighlight>{' '}
          text
        </div>

        {/* rough-notation: hand-drawn underline */}
        <div style={{ marginTop: 60, fontSize: 64, fontWeight: 600 }}>
          <AnnotateUnderline at={30} dur={14} color={COLORS.danger} strokeWidth={5}>
            underlined
          </AnnotateUnderline>
        </div>

        {/* rough-notation: circle + box call-outs */}
        <div style={{ marginTop: 60, fontSize: 64, fontWeight: 600 }}>
          <AnnotateCircle at={50} dur={16} color={COLORS.accent}>
            circled
          </AnnotateCircle>
          {'  and  '}
          <AnnotateBox at={70} dur={16} color={COLORS.signal}>
            boxed
          </AnnotateBox>
        </div>
      </div>

      {/* rough-js: hand-drawn sketch line that draws on */}
      <SketchLineDrawOn vb={VB} x1={120} y1={980} x2={960} y2={940} at={90} dur={24} options={{ stroke: COLORS.accent, strokeWidth: 6, roughness: 2.2 }} />

      {/* rough-js: frozen sketch box + circle */}
      <SketchShape kind="box" geom={{ x: 120, y: 1080, w: 380, h: 220 }} options={{ stroke: COLORS.ink, strokeWidth: 4, roughness: 1.8 }} vb={VB} />
      <SketchShape kind="circle" geom={{ x: 620, y: 1120, w: 180 }} options={{ stroke: COLORS.danger, strokeWidth: 4 }} vb={VB} />

      {/* perfect-freehand: pressure-varying stroke that reveals */}
      <FreehandDrawOn
        vb={VB}
        color={COLORS.accent}
        at={100}
        dur={26}
        points={[
          [140, 1500],
          [300, 1440],
          [520, 1520],
          [760, 1450],
          [940, 1540],
        ]}
      />

      {/* DrawOn pressure prop (perfect-freehand under the hood) — a swoosh path */}
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <DrawOn
          d="M 140 1700 C 400 1620 700 1780 960 1680"
          durationInFrames={30}
          delay={110}
          stroke={COLORS.signal}
          strokeWidth={5}
          pressure
        />
      </svg>
    </AbsoluteFill>
  );
};

export default Proof2Sketch;
