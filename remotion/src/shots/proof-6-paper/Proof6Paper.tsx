import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../../brand';
import { GrainGradient } from '@paper-design/shaders-react';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof6Paper',
  durationInSeconds: 3,
  fps: 30,
  width: 1080,
  height: 1920,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const Proof6Paper: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* Paper-Design shader as the backdrop: a grain-gradient driven by `frame`.
          frame is the DETERMINISM lever — the shader animates on frame index,
          not wall-clock, so two renders of the same frame are pixel-identical
          IF headless Chrome rasterizes the WebGL canvas deterministically. */}
      <GrainGradient
        colorBack={COLORS.d900}
        colors={[COLORS.accent, COLORS.accent2, COLORS.signal]}
        softness={0.9}
        intensity={0.4}
        noise={0.25}
        speed={0}
        frame={frame * 12}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Overlay text so we can read the frame + eyeball the backdrop */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          width: '100%',
          textAlign: 'center',
          color: COLORS.paper,
          fontFamily: 'sans-serif',
          fontSize: 54,
          fontWeight: 800,
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        paper shader (frame {frame})
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          width: '100%',
          textAlign: 'center',
          color: COLORS.paper,
          fontFamily: 'monospace',
          fontSize: 30,
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        GrainGradient · seeded by frame
      </div>
    </AbsoluteFill>
  );
};

export default Proof6Paper;
