// Ad5NoaStudio.tsx — SCAFFOLDED by tools/new_ad.py. Compile-ready stub for the /make-ad
// pipeline: scenes over one persistent canvas, RTL Captions at the root, PriceBadge on the
// offer beat, AdEndCard on the cta beat (holds to the last frame). The FILL-ME markers are the
// craft — per-beat visuals follow vidtsx-2d-generator's hard rules (frame-based, monotonic).
// Register with: cd remotion && npm run gen
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Captions, SAFE } from '../../lib/shorts';
import { AdEndCard, PriceBadge } from '../../lib/ads';
import { VO } from './vo.gen';

export const compositionConfig = {
  id: 'Ad5NoaStudio',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInSeconds: 17.11,
  defaultProps: {
    scenes: [
    { id: 'hook', durationSec: 2.0, beatId: 'hook', visual: 'HOOK fully composed at frame 0 — the payoff visible on the first frame (no build-up).', overlays: [] },
    { id: 'intro', durationSec: 2.0, beatId: 'intro', visual: 'the business name + what it is, one line, brand accent.', overlays: [] },
    { id: 'offer', durationSec: 2.45, beatId: 'offer', visual: 'the PriceBadge pops with the real numbers; oldPrice struck through if a sale.', overlays: [] },
    { id: 'proof', durationSec: 3.5599999999999996, beatId: 'proof', visual: 'the freier-proof: show the math / a concrete reason this is smart, not just cheap.', overlays: [] },
    { id: 'cta', durationSec: 5.1, beatId: 'cta', visual: 'the AdEndCard pops and HOLDS to the last frame — WhatsApp/phone + website, tappable.', overlays: [] }
    ],
  },
};

export const Ad5NoaStudio: React.FC<{ scenes: any[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#C026D3' }}>
      {/* FILL-ME: per-scene visuals. frames inside a <Sequence> are LOCAL:
          local_f = global_s * fps - sequence_from. Check every cue twice. */}
      {scenes.map((s, i) => {
        const from = scenes.slice(0, i).reduce((a, x) => a + x.durationSec, 0) * 30;
        return (
          <Sequence key={s.id} from={from} durationInFrames={Math.round(s.durationSec * 30)}>
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
              {/* FILL-ME: the {s.id} visual */}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Captions lines={VO} rtl />
    </AbsoluteFill>
  );
};
export default Ad5NoaStudio;
