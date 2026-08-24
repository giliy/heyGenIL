import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Spec, OverlayText } from '@shorts/spec';
import { Captions, prog, SAFE } from '../../lib/shorts';
import { COLORS } from '../../brand';
import { ShortsBackdrop, GlowReveal } from '../../lib/polish';
import { FONT_BODY_H, FONT_DISPLAY_H } from '../../fonts';
import { AdEndCard, Logo, PriceBadge } from '../../lib/ads';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG — Ad2Noa, the /make-ad engine test (demo business).
// A 30s Hebrew RTL commercial for נועה גלילי יופי (beauty vertical, feminine register).
// Mirrors Ad1Liat: PriceBadge (offer beat), AdEndCard (holds to last frame),
// Logo watermark, RTL pill captions on edge-tts word times.
// =============================================================================
export const compositionConfig = {
  id: 'Ad2Noa',
  durationInSeconds: 16.5,
  fps: 30,
  width: 1080,
  height: 1920,
};

const AD_ACCENT = '#A8342B'; // warm ad accent (badge red) — matches beats.json brand.accent

// Scene durations (seconds) — speech-driven, NO VO overlap: each beat window fully clears the
// prior line's speech before the next VO starts. Video ends ~2.5s after the CTA VO (no dead tail).
// hook 3.0 + offer 4.2 + proof 3.9 + cta 5.4 = 16.5s.
const DUR = { hook: 3.0, offer: 4.2, proof: 3.9, cta: 5.4 } as const;

const txt = (
  id: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  start: number,
  end: number,
  opts?: Partial<OverlayText['style']> & { animation?: OverlayText['animation'] }
): OverlayText => ({
  id, type: 'text', content, x, y, w, h, start, end,
  animation: opts?.animation ?? 'rise',
  style: { font: 'hebrew', size: 64, color: '#ffffff', weight: 700, align: 'center', ...(opts ?? {}) },
});

export const defaultProps: Spec = {
  id: 'ad-2-noa',
  title: 'נועה גלילי יופי — טיפול פנים החודש',
  template: 'Ad2Noa',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: AD_ACCENT, font: 'hebrew' },
  voice: { engine: 'edge', voiceId: 'he-IL-HilaNeural', lines: [] }, // captions fill from vo.gen at runtime
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    {
      id: 'hook', durationSec: DUR.hook, beatId: 'hook', visual: 'hook',
      overlays: [
        txt('hook-line-1', 'מתקפת בקמטוטים סביב העיניים?', 40, 250, 1000, 160, 0, DUR.hook, { size: 74, weight: 700, color: '#ffffff', font: 'hebrew' }),
      ],
    },
    {
      id: 'offer', durationSec: DUR.offer, beatId: 'offer', visual: 'offer',
      overlays: [
        txt('offer-line', 'החודש בלבד', 330, 1300, 420, 70, 0, DUR.offer, { size: 34, weight: 600, color: AD_ACCENT, font: 'hebrew' }),
      ],
    },
    {
      id: 'proof', durationSec: DUR.proof, beatId: 'proof', visual: 'proof',
      overlays: [
        txt('proof-line', 'אבחון עור אישי. תוצאות שרואים.', 40, 250, 1000, 140, 0, DUR.proof, { size: 64, weight: 700, color: '#ffffff', font: 'hebrew' }),
      ],
    },
    {
      id: 'cta', durationSec: DUR.cta, beatId: 'cta', visual: 'cta',
      overlays: [],
    },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
};

const Ad2Noa: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const F = (s: number) => Math.round(s * fps);
  const totalSec = getDurationSec(spec);
  const captionY = spec.format.height - 360;

  // Scene global start frames (back-to-back).
  const sceneStart: Record<string, number> = {};
  {
    let acc = 0;
    for (const s of spec.scenes) { sceneStart[s.beatId ?? s.id] = acc; acc += F(s.durationSec); }
  }
  const offerStart = sceneStart['offer'] ?? 0;
  const proofStart = sceneStart['proof'] ?? 0;
  const ctaStart = sceneStart['cta'] ?? 0;

  return (
    <AbsoluteFill>
      <ShortsBackdrop base={COLORS.d900} intensity={1} grain={0.04} grid />

      {/* Brand watermark, top-left safe area (clear of right 160px rail). */}
      <Logo text="נועה גלילי יופי" accent={AD_ACCENT} />

      {/* OFFER beat — the PriceBadge pops with the real numbers (freier-proof math). */}
      <Sequence from={0} durationInFrames={F(DUR.hook + DUR.offer + DUR.proof)}>
        {frame >= offerStart && frame < proofStart ? (
          <PriceBadge price={249} oldPrice={350} at={F(0.2)} accent={AD_ACCENT} y={820} />
        ) : null}
      </Sequence>

      {/* PROOF beat — a clean narrative line (overlay text) + a soft emphasis marker. */}
      {frame >= proofStart && frame < ctaStart ? (
        <div style={{ position: 'absolute', top: 1080, left: 0, right: 0, textAlign: 'center' }}>
          <GlowReveal progress={prog(frame, proofStart + F(0.3), proofStart + F(0.9))} color={AD_ACCENT} glowRadius={24}>
            <div style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 30, color: '#fff' }}>✓ אבחון אישי · פרוטוקול מדויק · חיפה</div>
          </GlowReveal>
        </div>
      ) : null}

      {/* CTA beat — the AdEndCard HOLDS to the last frame (the conversion payoff). */}
      <Sequence from={ctaStart} durationInFrames={F(DUR.cta)}>
        <AdEndCard
          businessName="נועה גלילי יופי"
          tagline="טיפול פנים · אבחון עור · חיפה"
          ctaText="להזמנת תור בוואטסאפ"
          whatsapp="052-9876543"
          phoneDisplay="052-987-6543"
          website="noa-beauty.co.il"
          price={249}
          oldPrice={350}
          at={F(0.2)}
          durSec={DUR.cta}
          accent={AD_ACCENT}
        />
      </Sequence>

      {/* Generic spec overlays (hook + offer + proof text). */}
      <RenderSpecOverlays spec={spec} />

      {/* RTL pill captions + progress at the root (global time). */}
      <Captions lines={VO} mode="pill" rtl y={captionY} accent={AD_ACCENT} />
    </AbsoluteFill>
  );
};

export const calculateMetadata = async ({ props }: { props: { spec?: Spec } }) => {
  const s = props.spec ?? defaultProps;
  return { durationInFrames: specDurationFrames(s), fps: s.format.fps, ...specDimensions(s) };
};

export default Ad2Noa;
