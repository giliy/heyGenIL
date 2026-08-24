import React from 'react';
import { AbsoluteFill, Easing, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Spec, OverlayText, OverlayImage } from '@shorts/spec';
import {
  Captions,
  prog,
  captionModeFromPreset,
} from '../../lib/shorts';
import { COLORS } from '../../brand';
import { ShortsBackdrop, GlowReveal } from '../../lib/polish';
import { FONT_BODY_H, FONT_DISPLAY_H, FONT_HEBREW } from '../../fonts';
import { RenderSpecOverlays, getDurationSec } from '../../lib/spec-renderer';
import { specDurationFrames, specDimensions } from '../../lib/template-utils';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG (legacy fallback — render-all.mjs uses this when metadata isn't wired)
// =============================================================================
export const compositionConfig = {
  id: 'Short16Formy',
  durationInSeconds: 36,
  fps: 30,
  width: 1080,
  height: 1920,
};

const EASE_INOUT = Easing.bezier(0.37, 0, 0.63, 1);

// =============================================================================
// defaultProps — the Spec this template renders when no inputProps are supplied.
// Built from shorts/short-16-formy/beats.json: one Scene per beat (back-to-back, in
// order), every user-visible string + timing expressed as text overlays. Voice lines
// come from the generated VO (the same data captions read).
//
// Timing is SCENE-RELATIVE: an overlay's start/end are seconds within its scene.
// =============================================================================
const ACCENT = COLORS.accent;
const SIGNAL = COLORS.signal;
const ACCENT2 = COLORS.accent2;

// Scene durations (seconds) — derived from the original beat windows, back-to-back.
const DUR = { hook: 3.3, pain: 4.5, intro: 5.03, builder: 3.1, signature: 5.34, logic: 3.96, integrations: 2.82, proof: 2.77, cta: 4.8, loop: 0.38 } as const;

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
  id,
  type: 'text',
  content,
  x, y, w, h, start, end,
  animation: opts?.animation ?? 'rise',
  style: { font: 'hebrew', size: 64, color: '#ffffff', weight: 700, align: 'center', ...(opts ?? {}) },
});

export const defaultProps: Spec = {
  id: 'short-16-formy',
  title: 'Formy — טופס דיגיטלי בעברית',
  template: 'Short16Formy',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: ACCENT, font: 'hebrew' },
  voice: { engine: 'edge', voiceId: 'he-IL-AvriNeural', lines: VO },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    // HOOK — pain headline (frame 0 must be fully composed -> start 0).
    {
      id: 'hook', durationSec: DUR.hook, beatId: 'hook', visual: 'hook',
      overlays: [
        txt('hook-title-1', 'צריך להחתים', 40, 240, 1000, 100, 0, DUR.hook, { size: 88, weight: 700, font: 'hebrew' }),
        txt('hook-title-2', 'הרבה לקוחות?', 40, 340, 1000, 110, 0, DUR.hook, { size: 88, weight: 700, color: ACCENT, font: 'hebrew' }),
      ],
    },
    // PAIN — paper form + red X + pain line.
    {
      id: 'pain', durationSec: DUR.pain, beatId: 'pain', visual: 'pain',
      overlays: [
        txt('pain-line', 'טפסים על נייר. חתימות בדואר.', 40, 1250, 1000, 100, 0.0, DUR.pain, { size: 70, color: COLORS.warn, font: 'hebrew' }),
      ],
    },
    // INTRO — Formy wordmark + tagline.
    {
      id: 'intro', durationSec: DUR.intro, beatId: 'intro', visual: 'intro',
      overlays: [
        txt('intro-tagline', 'פלטפורמת הטפסים הדיגיטליים של ישראל', 40, 1430, 1000, 90, 0.0, DUR.intro, { size: 40, weight: 500, color: 'rgba(255,255,255,0.85)', font: 'hebrew', animation: 'fade' }),
      ],
    },
    // BUILDER — kicker only; the field rows render as niche visual chrome (see FormCard).
    {
      id: 'builder', durationSec: DUR.builder, beatId: 'builder', visual: 'builder',
      overlays: [
        txt('kicker-builder', 'גרירה ויזואלית', 340, 190, 400, 60, 0.0, DUR.builder, { size: 30, weight: 600, color: ACCENT, font: 'hebrew' }),
      ],
    },
    // SIGNATURE — kicker only; signature box/stroke/seal render as niche chrome.
    {
      id: 'signature', durationSec: DUR.signature, beatId: 'signature', visual: 'signature',
      overlays: [
        txt('kicker-sign', 'חתימה דיגיטלית חוקית', 300, 190, 480, 60, 0.0, DUR.signature, { size: 30, weight: 600, color: SIGNAL, font: 'hebrew' }),
      ],
    },
    // LOGIC — kicker only; branch diagram renders as niche chrome.
    {
      id: 'logic', durationSec: DUR.logic, beatId: 'logic', visual: 'logic',
      overlays: [
        txt('kicker-logic', 'לוגיקה מותנית', 340, 190, 400, 60, 0.0, DUR.logic, { size: 30, weight: 600, color: ACCENT2, font: 'hebrew' }),
      ],
    },
    // INTEGRATIONS — chips pop in around the card.
    {
      id: 'integrations', durationSec: DUR.integrations, beatId: 'integrations', visual: 'integrations',
      overlays: [
        txt('integ-slack', 'Slack', 190, 560, 180, 70, 0.0, DUR.integrations, { size: 28, weight: 600, color: ACCENT2, font: 'body', animation: 'pop' }),
        txt('integ-gsheets', 'Google Sheets', 700, 580, 260, 70, 0.2, DUR.integrations, { size: 28, weight: 600, color: SIGNAL, font: 'body', animation: 'pop' }),
        txt('integ-webhooks', 'Webhooks', 180, 1240, 220, 70, 0.4, DUR.integrations, { size: 28, weight: 600, color: ACCENT, font: 'body', animation: 'pop' }),
        txt('integ-zapier', 'Zapier', 740, 1240, 200, 70, 0.6, DUR.integrations, { size: 28, weight: 600, color: COLORS.warn, font: 'body', animation: 'pop' }),
        txt('integ-notion', 'Notion', 440, 600, 200, 70, 0.8, DUR.integrations, { size: 28, weight: 600, color: COLORS.d300, font: 'body', animation: 'pop' }),
      ],
    },
    // PROOF — niche response counter (chrome), no text overlays needed.
    { id: 'proof', durationSec: DUR.proof, beatId: 'proof', visual: 'proof', overlays: [] },
    // CTA — wordmark centers + free-start CTA + no-credit-card badge + url.
    {
      id: 'cta', durationSec: DUR.cta, beatId: 'cta', visual: 'cta',
      overlays: [
        txt('cta-button', 'מתחילים בחינם', 240, 720, 600, 130, 0.0, DUR.cta, { size: 54, weight: 700, color: '#0d1117', font: 'hebrew', animation: 'pop' }),
        txt('cta-badge', 'בלי כרטיס אשראי', 290, 880, 500, 70, 0.0, DUR.cta, { size: 34, weight: 500, color: 'rgba(255,255,255,0.8)', font: 'hebrew', animation: 'fade' }),
        txt('cta-url', 'formy.co.il', 390, 1020, 300, 60, 0.0, DUR.cta, { size: 30, weight: 500, color: 'rgba(255,255,255,0.5)', font: 'body', align: 'center', animation: 'fade' }),
      ],
    },
    // LOOP — restore window (empty; the last scene's end drives the rollback).
    { id: 'loop', durationSec: DUR.loop, beatId: 'loop', visual: 'loop', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-22' },
};

// =============================================================================
// THE FORM CARD — the persistent hero element. A paper-white Hebrew form that
// ASSEMBLES across the video. Niche chrome (fields, signature, branch, counter) stays
// in TSX; user-editable strings/timings live in the spec overlays above.
// =============================================================================
const Field: React.FC<{ label: string; at: number; kind?: 'text' | 'check' | 'select' | 'date'; filled?: boolean; fillAt?: number; y: number }> = ({ label, at, kind = 'text', filled = false, fillAt = 0, y }) => {
  const frame = useCurrentFrame();
  const enter = prog(frame, at, at + 14);
  if (enter <= 0.01) return null;
  const fill = filled ? EASE_INOUT(prog(frame, fillAt, fillAt + 20)) : 0;
  return (
    <div style={{ position: 'absolute', top: y, right: 70, left: 70, direction: 'rtl', opacity: enter, transform: `translateX(${(1 - enter) * 40}px)` }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${fill > 0.5 ? COLORS.signal : COLORS.d600}`, borderRadius: 14, padding: '18px 26px' }}>
        <span style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 30, color: COLORS.d300 }}>{label}</span>
        {kind === 'text' ? (
          <div style={{ width: 300, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: COLORS.signal, opacity: 0.9 }} />
          </div>
        ) : null}
        {kind === 'select' ? (
          <div style={{ width: 300, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0 14px' }}>
            <span style={{ color: COLORS.d400, fontSize: 22 }}>▾</span>
          </div>
        ) : null}
        {kind === 'check' ? (
          <div style={{ width: 34, height: 34, borderRadius: 9, border: `2.5px solid ${fill > 0.5 ? COLORS.signal : COLORS.d400}`, background: fill > 0.5 ? COLORS.signal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fill > 0.5 ? (
              <svg width={22} height={22} viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#0d1117" strokeWidth={3.4} strokeLinecap="round" /></svg>
            ) : null}
          </div>
        ) : null}
        {kind === 'date' ? (<div style={{ width: 300, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }} />) : null}
      </div>
    </div>
  );
};

const SignatureStroke: React.FC<{ at: number; y: number }> = ({ at, y }) => {
  const frame = useCurrentFrame();
  const p = EASE_INOUT(prog(frame, at, at + 26));
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
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${scale}) rotate(-8deg)`, opacity: p, fontFamily: FONT_HEBREW, fontWeight: 700, fontSize: 26, color: COLORS.signal, border: `3px solid ${COLORS.signal}`, borderRadius: 999, padding: '6px 20px', background: 'rgba(13,17,23,0.7)', whiteSpace: 'nowrap' }}>
      ✓ מאומת
    </div>
  );
};

// Branch diagram for the conditional-logic beat (RTL: root on the right).
const BranchLines: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const p = EASE_INOUT(prog(frame, at, at + 22));
  const draw = (len: number) => len * p;
  return (
    <g>
      <rect x={600} y={30} width={170} height={56} rx={12} fill={COLORS.accent} opacity={p} />
      <text x={685} y={66} textAnchor="middle" fill="#fff" fontSize={26} fontFamily={FONT_BODY_H} opacity={p}>אם כן</text>
      <path d={`M 685 86 C 685 150, 480 150, 480 200`} fill="none" stroke={COLORS.accent} strokeWidth={4} strokeDasharray={300} strokeDashoffset={300 - draw(300)} />
      <rect x={380} y={200} width={200} height={56} rx={12} fill="none" stroke={COLORS.accent} strokeWidth={3} opacity={p} />
      <text x={480} y={236} textAnchor="middle" fill={COLORS.ink} fontSize={24} fontFamily={FONT_BODY_H} opacity={p}>שדה המשך</text>
      <path d={`M 685 86 C 685 150, 200 150, 200 200`} fill="none" stroke={COLORS.d400} strokeWidth={4} strokeDasharray={340} strokeDashoffset={340 - draw(340)} />
      <rect x={110} y={200} width={180} height={56} rx={12} fill="none" stroke={COLORS.d400} strokeWidth={3} opacity={p} />
      <text x={200} y={236} textAnchor="middle" fill={COLORS.muted} fontSize={24} fontFamily={FONT_BODY_H} opacity={p}>דלג</text>
    </g>
  );
};

// Live responses counter (ticks up during the proof beat).
const ResponseCounter: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 40);
  const n = Math.round(0 + (1284 - 0) * EASE_INOUT(prog(frame, at, at + 55)));
  const enter = prog(frame, at, at + 10);
  if (enter <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: 560, left: 0, right: 0, textAlign: 'center', opacity: enter }}>
      <div style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 26, color: COLORS.muted, letterSpacing: 2 }}>תגובות התקבלו</div>
      <div style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 96, color: COLORS.signal, lineHeight: 1.1 }}>{n.toLocaleString('en-US')}</div>
      <svg width={300} height={80} viewBox="0 0 300 80" style={{ marginTop: 12 }}>
        {[0.3, 0.45, 0.6, 0.75, 1.0].map((h, i) => (
          <rect key={i} x={i * 62} y={80 - h * 78 * p} width={44} height={h * 78 * p} rx={6} fill={COLORS.accent} opacity={0.85} />
        ))}
      </svg>
    </div>
  );
};

// =============================================================================
// MAIN — spec-driven. Scenes/timings from spec.scenes; text overlays via the generic
// renderer; captions from spec.voice.lines; loop-restore from the LAST scene's end.
// =============================================================================
const Short16Formy: React.FC<{ spec?: Spec }> = ({ spec = defaultProps }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const F = (s: number) => Math.round(s * fps);

  const totalSec = getDurationSec(spec);
  const lastScene = spec.scenes[spec.scenes.length - 1];
  const loopStartSec = totalSec - lastScene.durationSec; // start of the loop scene
  const loopEndSec = totalSec; // end of the loop scene == total duration
  const loopRestore = prog(frame, F(loopStartSec), F(loopEndSec));
  const captionFrame = loopRestore > 0 ? 0 : frame;

  // Caption y derived from the format (not a hardcoded 1560): sit just above the
  // bottom safe zone. bottomSafe = 500 (SAFE.bottom) -> caption center ~ h - 360.
  const captionY = spec.format.height - 360;

  // Scene global start frames (back-to-back).
  const sceneStart: Record<string, number> = {};
  {
    let acc = 0;
    for (const s of spec.scenes) {
      sceneStart[s.beatId ?? s.id] = acc;
      acc += F(s.durationSec);
    }
  }
  const introStart = sceneStart['intro'] ?? F(7.8);
  const builderStart = sceneStart['builder'] ?? F(12.83);
  const signatureStart = sceneStart['signature'] ?? F(15.93);
  const logicStart = sceneStart['logic'] ?? F(21.27);
  const integrationsStart = sceneStart['integrations'] ?? F(25.23);
  const proofStart = sceneStart['proof'] ?? F(28.05);

  return (
    <AbsoluteFill>
      <ShortsBackdrop base={COLORS.d900} intensity={1} grain={0.04} grid />

      {/* INTRO wordmark (gradient) — niche chrome, appears over the intro scene */}
      {frame >= introStart - F(0.5) && frame < builderStart ? <IntroWordMark frame={frame} at={introStart} /> : null}

      {/* Persistent form card (assembles across builder/signature/logic/proof) */}
      <FormCard
        frame={frame}
        fps={fps}
        cardInAt={introStart}
        builderStart={builderStart}
        signatureStart={signatureStart}
        logicStart={logicStart}
        integrationsStart={integrationsStart}
        proofStart={proofStart}
        loopStart={F(loopStartSec)}
        totalFrames={durationInFrames}
      />

      {/* CTA wordmark + button chrome (gradient wordmark; copy text comes from overlays) */}
      {frame >= (sceneStart['cta'] ?? 0) ? <CtaChrome frame={frame} at={sceneStart['cta'] ?? 0} loopStart={F(loopStartSec)} totalFrames={durationInFrames} /> : null}

      {/* Generic spec overlays (hook title, kickers, integration chips, CTA copy, …) */}
      <RenderSpecOverlays spec={spec} />

      {/* Global overlays: RTL pill captions + progress, restored at the loop */}
      <div style={{ position: 'absolute', inset: 0, opacity: loopRestore > 0 ? loopRestore : 1 }}>
        <Captions
          lines={spec.voice?.lines ?? []}
          mode={captionModeFromPreset(spec.captions?.preset)}
          rtl
          y={captionY}
          accent={spec.theme.accent ?? ACCENT}
          frameOverride={captionFrame}
        />
      </div>
      <ProgressBarLocal color={spec.theme.accent ?? ACCENT} resetAt={F(loopStartSec)} />
    </AbsoluteFill>
  );
};

// Gradient Formy wordmark used at intro + CTA (niche chrome — not user copy).
const IntroWordMark: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const p = prog(frame, at, at + 16);
  return (
    <div style={{ position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center' }}>
      <GlowReveal progress={p} color={COLORS.accent} glowRadius={40}>
        <div style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 150, lineHeight: 1, background: `linear-gradient(120deg, ${COLORS.accent}, ${COLORS.accent2}, ${COLORS.signal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: 2 }}>
          פורמי
        </div>
      </GlowReveal>
    </div>
  );
};

const CtaChrome: React.FC<{ frame: number; at: number; loopStart: number; totalFrames: number }> = ({ frame, at, loopStart, totalFrames }) => {
  const enter = prog(frame, at, at + 30);
  const fadeForLoop = 1 - prog(frame, loopStart, totalFrames);
  const o = enter * fadeForLoop;
  if (o <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: 320, left: 0, right: 0, textAlign: 'center', opacity: o }}>
      <GlowReveal progress={enter} color={COLORS.accent} glowRadius={40}>
        <div style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 160, lineHeight: 1, background: `linear-gradient(120deg, ${COLORS.accent}, ${COLORS.accent2}, ${COLORS.signal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          פורמי
        </div>
      </GlowReveal>
    </div>
  );
};

// The persistent form card. Niche chrome; timings derive from the scene boundaries.
const FormCard: React.FC<{
  frame: number; fps: number; cardInAt: number; builderStart: number; signatureStart: number; logicStart: number; integrationsStart: number; proofStart: number; loopStart: number; totalFrames: number;
}> = ({ frame, fps, cardInAt, builderStart, signatureStart, logicStart, integrationsStart, proofStart, loopStart, totalFrames }) => {
  const F = (s: number) => Math.round(s * fps);
  const cardIn = prog(frame, cardInAt, cardInAt + F(1));
  const loopOut = 1 - prog(frame, loopStart, totalFrames);
  const o = cardIn * loopOut;
  if (o <= 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: 470, left: 130, right: 130, bottom: 470, opacity: o, transform: `translateY(${(1 - cardIn) * 40}px)`, background: COLORS.paper, borderRadius: 26, boxShadow: '0 30px 90px rgba(0,0,0,0.5)', overflow: 'hidden', direction: 'rtl' }}>
      <div style={{ padding: '30px 40px 22px', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 34, color: COLORS.ink }}>טופס הרשמה</span>
        <span style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 22, color: COLORS.accent, background: `${COLORS.accent}18`, borderRadius: 999, padding: '4px 16px' }}>פורמי</span>
      </div>

      {/* BUILDER fields */}
      <div style={{ position: 'relative', height: 0 }}>
        <Field label="שם מלא" kind="text" at={builderStart + F(0.3)} filled fillAt={builderStart + F(1.0)} y={110} />
        <Field label="אימייל" kind="text" at={builderStart + F(1.2)} filled fillAt={builderStart + F(1.9)} y={210} />
        <Field label="תאריך" kind="select" at={builderStart + F(2.1)} y={310} />
        <Field label="אני מאשר/ת את התנאים" kind="check" at={builderStart + F(2.8)} filled fillAt={builderStart + F(3.3)} y={410} />
      </div>

      {/* SIGNATURE beat */}
      {frame >= signatureStart && frame < logicStart ? (
        <div style={{ position: 'absolute', top: 540, left: 60, right: 60, height: 150, border: `2px dashed ${COLORS.d400}`, borderRadius: 16, background: '#fff' }}>
          <span style={{ position: 'absolute', top: 8, right: 18, fontFamily: FONT_BODY_H, fontWeight: 500, fontSize: 22, color: COLORS.muted }}>חתימה</span>
          <SignatureStroke at={signatureStart + F(0.3)} y={540} />
          <VerifiedSeal at={signatureStart + F(2.0)} x={830} y={600} />
        </div>
      ) : null}

      {/* LOGIC beat */}
      {frame >= logicStart && frame < integrationsStart ? (
        <svg width={820} height={360} viewBox="0 0 820 360" style={{ position: 'absolute', top: 540, left: 0 }}>
          <BranchLines frame={frame} at={logicStart + F(0.3)} />
        </svg>
      ) : null}

      {/* PROOF beat */}
      {frame >= proofStart && frame < loopStart ? <ResponseCounter at={proofStart + F(0.2)} /> : null}
    </div>
  );
};

// Thin wrapper so resetAt can come from the loop scene start (not a baked F(35.6)).
const ProgressBarLocal: React.FC<{ color?: string; resetAt?: number }> = ({ color = ACCENT, resetAt }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const base = frame / Math.max(1, durationInFrames - 1);
  const resetP = resetAt === undefined ? 0 : prog(frame, resetAt, durationInFrames - 1);
  const fill = Math.max(0, base * (1 - resetP));
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.12)' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', background: color }} />
    </div>
  );
};

// =============================================================================
// calculateMetadata — duration/fps/size derive from the spec's scenes + format.
// =============================================================================
export const calculateMetadata = async ({ props }: { props: { spec?: Spec } }) => {
  const spec = props.spec ?? defaultProps;
  return {
    durationInFrames: specDurationFrames(spec),
    fps: spec.format.fps,
    ...specDimensions(spec),
  };
};

export default Short16Formy;
