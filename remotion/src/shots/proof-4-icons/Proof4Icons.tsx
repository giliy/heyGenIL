import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../../brand';
import { FONT_BODY } from '../../fonts';
import { TIcon, type TablerIconName } from '../../lib/icons';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Proof4Icons',
  durationInSeconds: 3,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ROWS: TablerIconName[] = [
  'whatsapp',
  'instagram',
  'tiktok',
  'phone',
  'mapPin',
  'shekel',
  'discount',
  'gift',
  'shieldCheck',
  'award',
];

const Proof4Icons: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.paper, justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 52, fontWeight: 600, color: COLORS.ink, marginBottom: 50 }}>
        Tabler curated set
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        {ROWS.map((name) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 200 }}>
            <TIcon name={name} size={84} color={COLORS.accent} />
            <div style={{ fontFamily: FONT_BODY, fontSize: 30, color: COLORS.ink }}>{name}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default Proof4Icons;
