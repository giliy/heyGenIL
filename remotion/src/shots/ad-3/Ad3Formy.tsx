import React from 'react';
import { AbsoluteFill, Easing, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Spec, OverlayText } from '@shorts/spec';
import { Captions, prog } from '../../lib/shorts';
import { COLORS } from '../../brand';
import { ShortsBackdrop, GlowReveal } from '../../lib/polish';
import { FONT_BODY_H, FONT_DISPLAY_H, FONT_HEBREW } from '../../fonts';
import { AdEndCard, AdGrade, Logo, PriceBadge, AdSceneIn } from '../../lib/ads';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG — Ad3Formy, the Formy FREE-PLAN ad (formy.co.il).
// ~19s Hebrew RTL commercial for פורמי (saas vertical, neutral-plural register).
// Hook "חתימה דיגיטלית בחינם" (free-trial) → intro → build → sign → WhatsApp end card.
// mode:"ad": the conversion CTA IS the payoff — PriceBadge(₪0) + AdEndCard HOLDS.
// Timing is SPEECH-DRIVEN off edge-tts real word-times (see DUR below). No VO overlap,
// no dead tail (last word 17.77s + ~1.2s hold = 19.0s).
// =============================================================================
export const compositionConfig = {
  id: 'Ad3Formy',
  durationInSeconds: 19.0,
  fps: 30,
  width: 1080,
  height: 1920,
};

const ACCENT = COLORS.accent;   // indigo — Formy's signature gradient root
const SIGNAL = COLORS.signal;   // teal — "free" / success
const ACCENT2 = COLORS.accent2; // violet

// Scene durations (seconds) — back-to-back, speech-driven from the REAL edge-tts word
// times in vo.gen.ts. Each scene's window fully clears the prior line's speech before the
// next VO starts (no VO overlap). Video ends 17.77s (last word) + ~1.2s CTA hold = 19.0s.
const DUR = { hook: 2.5, intro: 3.8, build: 3.6, sign: 4.2, cta: 4.9 } as const;

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
  id: 'ad-3-formy',
  title: 'פורמי — חתימה דיגיטלית בחינם',
  template: 'Ad3Formy',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: ACCENT, font: 'hebrew' },
  voice: { engine: 'edge', voiceId: 'he-IL-AvriNeural', lines: [] }, // captions read vo.gen at runtime
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    // HOOK — the payoff fully composed at FRAME 0 (no entrance animation). "חתימה דיגיטלית"
    // in white over "בחינם." in teal — the free plan up front.
    {
      id: 'hook', durationSec: DUR.hook, beatId: 'hook', visual: 'hook',
      overlays: [
        txt('hook-1', 'חתימה דיגיטלית', 40, 600, 1000, 120, 0, DUR.hook, { size: 96, weight: 800, color: '#ffffff', font: 'hebrew', animation: 'none' }),
        txt('hook-2', 'בחינם.', 40, 740, 1000, 130, 0, DUR.hook, { size: 110, weight: 800, color: SIGNAL, font: 'hebrew', animation: 'none' }),
      ],
    },
    // INTRO — wordmark + tagline (chrome renders the gradient wordmark; overlay carries the tagline).
    {
      id: 'intro', durationSec: DUR.intro, beatId: 'intro', visual: 'intro',
      overlays: [
        txt('intro-tagline', 'פלטפורמת הטפסים של ישראל', 40, 470, 1000, 70, 0.2, DUR.intro, { size: 44, weight: 500, color: 'rgba(255,255,255,0.85)', font: 'hebrew', animation: 'fade' }),
      ],
    },
    // BUILD — kicker only; the form fields render as niche chrome (see FormCard).
    {
      id: 'build', durationSec: DUR.build, beatId: 'build', visual: 'build',
      overlays: [
        txt('kicker-build', 'בונים בכמה לחיצות', 300, 190, 480, 60, 0.0, DUR.build, { size: 30, weight: 600, color: ACCENT, font: 'hebrew' }),
      ],
    },
    // SIGN — kicker only; the signature stroke + seal render as niche chrome.
    {
      id: 'sign', durationSec: DUR.sign, beatId: 'sign', visual: 'sign',
      overlays: [
        txt('kicker-sign', 'חתימה דיגיטלית חוקית', 300, 190, 480, 60, 0.0, DUR.sign, { size: 30, weight: 600, color: SIGNAL, font: 'hebrew' }),
      ],
    },
    // CTA — the AdEndCard holds to the last frame (the conversion payoff). No overlays.
    { id: 'cta', durationSec: DUR.cta, beatId: 'cta', visual: 'cta', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
};

// =============================================================================
// FORM-CARD CHROME — a paper-white Hebrew form. On build it fills (name/email/checkbox);
// on sign an ink stroke draws + a "✓ מאומת" seal stamps. Reused from short-16's visual
// language, retimed to this ad's scenes.
// =============================================================================
const EASE_INOUT = Easing.bezier(0.37, 0, 0.63, 1);

const Field: React.FC<{ label: string; at: number; kind?: 'text' | 'check' | 'select'; filled?: boolean; fillAt?: number; y: number }> = ({ label, at, kind = 'text', filled = false, fillAt = 0, y }) => {
  const frame = useCurrentFrame();
  const enter = prog(frame, at, at + 12);
  if (enter <= 0.01) return null;
  const fill = filled ? EASE_INOUT(prog(frame, fillAt, fillAt + 16)) : 0;
  return (
    <div style={{ position: 'absolute', top: y, right: 60, left: 60, direction: 'rtl', opacity: enter, transform: `translateX(${(1 - enter) * 30}px)` }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${fill > 0.5 ? SIGNAL : COLORS.d600}`, borderRadius: 14, padding: '16px 24px' }}>
        <span style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 28, color: COLORS.d300 }}>{label}</span>
        {kind === 'text' ? (
          <div style={{ width: 280, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: SIGNAL, opacity: 0.9 }} />
          </div>
        ) : null}
        {kind === 'check' ? (
          <div style={{ width: 32, height: 32, borderRadius: 9, border: `2.5px solid ${fill > 0.5 ? SIGNAL : COLORS.d400}`, background: fill > 0.5 ? SIGNAL : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fill > 0.5 ? (
              <svg width={20} height={20} viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#0d1117" strokeWidth={3.4} strokeLinecap="round" /></svg>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SignatureStroke: React.FC<{ at: number; y: number }> = ({ at, y }) => {
  const frame = useCurrentFrame();
  const p = EASE_INOUT(prog(frame, at, at + 24));
  if (p <= 0.01) return null;
  const d = 'M 0 40 C 30 5, 45 60, 70 30 S 110 55, 135 25 S 175 50, 200 30 S 235 48, 255 30';
  const LEN = 620;
  return (
    <svg width={280} height={80} viewBox="0 0 260 70" style={{ position: 'absolute', top: y, left: 90 }}>
      <path d={d} fill="none" stroke={COLORS.ink} strokeWidth={5} strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - p)} />
    </svg>
  );
};

const VerifiedSeal: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 8);
  if (p <= 0.01) return null;
  const scale = 1.5 - 0.5 * EASE_INOUT(p);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${scale}) rotate(-8deg)`, opacity: p, fontFamily: FONT_HEBREW, fontWeight: 700, fontSize: 26, color: SIGNAL, border: `3px solid ${SIGNAL}`, borderRadius: 999, padding: '6px 20px', background: 'rgba(13,17,23,0.7)', whiteSpace: 'nowrap' }}>
      ✓ מאומת
    </div>
  );
};

const EvidenceChip: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 10);
  if (p <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: p, fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 22, color: COLORS.d300, border: `1.5px solid ${COLORS.d600}`, borderRadius: 999, padding: '4px 18px', background: 'rgba(13,17,23,0.6)', whiteSpace: 'nowrap' }}>
      שרשרת ראיות
    </div>
  );
};

// The persistent form card. Visible intro→sign, retimed to this ad's scene starts.
const FormCard: React.FC<{
  frame: number; fps: number; cardInAt: number; buildStart: number; signStart: number; cardOutAt: number;
}> = ({ frame, fps, cardInAt, buildStart, signStart, cardOutAt }) => {
  const F = (s: number) => Math.round(s * fps);
  const cardIn = prog(frame, cardInAt, cardInAt + F(0.7));
  const out = 1 - prog(frame, cardOutAt, cardOutAt + F(0.4));
  const o = cardIn * out;
  if (o <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: 620, left: 130, right: 130, height: 560, opacity: o, transform: `translateY(${(1 - cardIn) * 40}px)`, background: COLORS.paper, borderRadius: 26, boxShadow: '0 30px 90px rgba(0,0,0,0.5)', overflow: 'hidden', direction: 'rtl' }}>
      <div style={{ padding: '24px 36px 18px', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 32, color: COLORS.ink }}>טופס הרשמה</span>
        <span style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 20, color: ACCENT, background: `${ACCENT}18`, borderRadius: 999, padding: '4px 16px' }}>פורמי</span>
      </div>

      {/* BUILD fields — fill in sequence during the build beat */}
      <div style={{ position: 'relative', height: 0 }}>
        <Field label="שם מלא" kind="text" at={buildStart + F(0.2)} filled fillAt={buildStart + F(0.7)} y={90} />
        <Field label="אימייל" kind="text" at={buildStart + F(1.0)} filled fillAt={buildStart + F(1.5)} y={180} />
        <Field label="אני מאשר/ת את התנאים" kind="check" at={buildStart + F(1.9)} filled fillAt={buildStart + F(2.3)} y={270} />
      </div>

      {/* SIGN beat — signature box + ink stroke + verified seal + evidence chip */}
      {frame >= signStart ? (
        <div style={{ position: 'absolute', top: 400, left: 50, right: 50, height: 130, border: `2px dashed ${COLORS.d400}`, borderRadius: 16, background: '#fff' }}>
          <span style={{ position: 'absolute', top: 6, right: 16, fontFamily: FONT_BODY_H, fontWeight: 500, fontSize: 20, color: COLORS.muted }}>חתימה</span>
          <SignatureStroke at={signStart + F(0.3)} y={400} />
          <VerifiedSeal at={signStart + F(1.9)} x={760} y={452} />
          <EvidenceChip at={signStart + F(2.8)} x={560} y={490} />
        </div>
      ) : null}
    </div>
  );
};

// Gradient Formy wordmark for the intro beat.
const IntroWordMark: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const p = prog(frame, at, at + 14);
  if (p <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: 240, left: 0, right: 0, textAlign: 'center' }}>
      <GlowReveal progress={p} color={ACCENT} glowRadius={40}>
        <div style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 150, lineHeight: 1, background: `linear-gradient(120deg, ${ACCENT}, ${ACCENT2}, ${SIGNAL})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: 2 }}>
          פורמי
        </div>
      </GlowReveal>
    </div>
  );
};

const ProgressBarLocal: React.FC<{ color?: string }> = ({ color = ACCENT }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fill = frame / Math.max(1, durationInFrames - 1);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.12)' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', background: color }} />
    </div>
  );
};

// =============================================================================
// MAIN — spec-driven scenes; niche chrome (form card / signature); ad components
// (PriceBadge ₪0 on the offer moment, AdEndCard on the CTA hold).
// =============================================================================
const Ad3Formy: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const F = (s: number) => Math.round(s * fps);

  const captionY = spec.format.height - 360;

  // Scene global start frames (back-to-back).
  const sceneStart: Record<string, number> = {};
  {
    let acc = 0;
    for (const s of spec.scenes) { sceneStart[s.beatId ?? s.id] = acc; acc += F(s.durationSec); }
  }
  const introStart = sceneStart['intro'] ?? 0;
  const buildStart = sceneStart['build'] ?? 0;
  const signStart = sceneStart['sign'] ?? 0;
  const ctaStart = sceneStart['cta'] ?? 0;

  return (
    <AbsoluteFill>
      <ShortsBackdrop base={COLORS.d900} intensity={1} grain={0.04} grid />
      <AdGrade />

      {/* Brand watermark, top-left safe area. */}
      <Logo text="פורמי" accent={ACCENT} />

      {/* INTRO wordmark (gradient) */}
      {frame >= introStart - F(0.3) && frame < buildStart ? <IntroWordMark frame={frame} at={introStart} /> : null}

      {/* The persistent form card (intro → sign) */}
      {frame >= introStart && frame < ctaStart ? (
        <FormCard
          frame={frame}
          fps={fps}
          cardInAt={introStart + F(0.6)}
          buildStart={buildStart}
          signStart={signStart}
          cardOutAt={ctaStart - F(0.4)}
        />
      ) : null}

      {/* The FREE-offer moment — ₪0 PriceBadge pops as the sign beat resolves. Freier-proof:
          the "price" IS 0 (no fake discount math). */}
      {frame >= signStart + F(2.4) && frame < ctaStart ? (
        <PriceBadge price={0} at={signStart + F(2.4)} accent={SIGNAL} y={1230} />
      ) : null}

      {/* CTA beat — the AdEndCard HOLDS to the last frame (the WhatsApp conversion payoff). */}
      <Sequence from={ctaStart} durationInFrames={F(DUR.cta)}>
        <AdEndCard
          businessName="פורמי"
          tagline="טפסים דיגיטליים בעברית — בחינם"
          ctaText="דברו איתנו בוואטסאפ"
          whatsapp="050-679-3057"
          phoneDisplay="050-679-3057"
          website="formy.co.il"
          price={0}
          at={F(0.2)}
          durSec={DUR.cta}
          accent={ACCENT}
        />
      </Sequence>

      {/* Generic spec overlays (hook + tagline + kickers). */}
      <RenderSpecOverlays spec={spec} />

      {/* RTL pill captions (word-exact edge-tts) + progress, at the root (global time). */}
      <Captions lines={VO} mode="pill" rtl y={captionY} accent={ACCENT} />
      <ProgressBarLocal color={ACCENT} />
    </AbsoluteFill>
  );
};

export const calculateMetadata = async ({ props }: { props: { spec?: Spec } }) => {
  const s = props.spec ?? defaultProps;
  return { durationInFrames: specDurationFrames(s), fps: s.format.fps, ...specDimensions(s) };
};

export default Ad3Formy;
