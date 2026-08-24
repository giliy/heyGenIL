// ads.tsx — ad-mode components for /make-ad: RTL-safe CTA end card, bidi-safe ₪ price
// badge, and a business logo/watermark. These OVERRIDE brand.md's "no CTA outros" and
// calm-energy rules for ads ONLY (mode:"ad") — an ad's payoff IS the conversion CTA, and
// the end card must HOLD so the phone/WhatsApp stays tappable. Non-ad shorts never import
// this file, so their style stays untouched.
//
// Everything renders direction:'rtl' with unicodeBidi:'isolate' on price/phone tokens, and
// all displayed strings run through the formatIL* helpers below so Hebrew+digit and
// Latin tokens never bidi-reorder inside an RTL line. Fonts: Heebo display / Rubik body,
// both vendored (hebrew+latin incl. ₪ U+20AA) — see fonts.ts.
import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from 'remotion';
import { EASE_IN, EASE_POP, prog, RLM, SAFE, settleP, stripNikkud } from './shorts';
import { FONT_AD_SERIF, FONT_BODY_H, FONT_DISPLAY_H } from '../fonts';
import { COLORS } from '../brand';

// ─── bidi-safe formatting ────────────────────────────────────────────────────
// RTL + trailing punctuation or a pure numeric/Latin run is where bidi breaks. A shekel
// amount, a %, or a phone number sits at the START of an RTL run; without an anchor it can
// drift to the wrong side of the next word. We re-anchor with RLM so each token stays glued
// to the RTL side.

// ₪ before the number, grouped, RLM-anchored. Intl 'he-IL' already emits "₪1,234"; we only
// re-anchor so the group can't reorder against neighboring Hebrew words.
export const formatILPrice = (n: number): string => {
  const s = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
  return stripNikkud(s) + RLM;
};

// A bare number with the ₪ AFTER it ("199 ₪") — the form Israeli ad copy usually writes.
export const formatILNum = (n: number, withShekel = true): string => {
  const s = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(n);
  return (withShekel ? `${s} ₪` : s) + RLM;
};

// "31%−" — percent sign pinned after the digits, minus leading, RLM-anchored.
export const formatILPct = (pct: number): string => `${pct}%−${RLM}`;

// Phone number, digit-groups isolated and RLM-anchored so "050-123-4567" never flips.
export const formatILPhone = (digits: string): string => {
  const clean = digits.replace(/[^0-9]/g, '');
  const grouped =
    clean.length === 10 ? `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`
    : clean.length === 9 ? `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`
    : clean;
  return grouped + RLM;
};

// WhatsApp deep link from an Israeli local number ("050-1234567" -> "972501234567").
export const waLink = (phone: string): string => {
  const clean = phone.replace(/[^0-9]/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  return `https://wa.me/${intl}`;
};

const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
// Ad-mode energy: punchier scale than the calm 1.03–1.06 — but still clamped (no cartoon).
const AD_POP = 1.14;

// ─── PriceBadge ──────────────────────────────────────────────────────────────
// Now-price (big), struck old-price, and a % discount stamp. The discount is DERIVED from
// oldPrice/price when discountPct isn't given, so the on-screen math is always true
// (freier-proof: the numbers must add up). RTL row; every number RLM-anchored.
// inline=true renders in normal flow (for use inside AdEndCard); otherwise absolutely placed.
export const PriceBadge: React.FC<{
  price: number;
  oldPrice?: number;
  discountPct?: number;
  at?: number; // frames (scene-local) to pop in
  accent?: string;
  x?: number; // left px; centered if omitted
  y?: number; // top px
  inline?: boolean; // render in normal flow (inside an end card) instead of absolutely placed
  scaleFont?: number; // shrink the whole badge (e.g. 0.7 inside an end card)
  tilt?: boolean; // P1 #6: 3D-lite perspective on the card so it reads as a physical ad card
}> = ({ price, oldPrice, discountPct, at = 0, accent = COLORS.danger, x, y = 700, inline = false, scaleFont = 1, tilt = false }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 10);
  if (p <= 0.01) return null;
  // Settle the price pop (research 02 §2.1): AD_POP (1.14) in, then settleP's gentle
  // overshoot-then-lock instead of landing mechanically at rest. Money moments SLAM + settle.
  const scale = (1 + (AD_POP - 1) * (1 - settleP(p))) * scaleFont;
  const pct = discountPct ?? (oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0);
  // P1 #6: a fixed 3D-lite tilt on the money card (rotateX lean + slight Y turn), so the
  // offer reads as a physical ad card, not a flat box. RTL mirrors the Y angle negative.
  const tiltTransform = tilt ? ' perspective(1000px) rotateX(6deg) rotateY(-7deg)' : '';
  const inner = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 18,
        background: 'rgba(13,17,23,0.9)',
        border: `3px solid ${accent}`,
        borderRadius: 22,
        padding: '18px 30px',
        boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
        transform: tiltTransform,
        transformStyle: 'preserve-3d',
      }}
    >
      <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 900, fontSize: 92 * scaleFont, color: '#fff', lineHeight: 1, unicodeBidi: 'isolate' }}>
        {formatILNum(price)}
      </span>
      {oldPrice ? (
        <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 52 * scaleFont, color: COLORS.d400, textDecoration: 'line-through', unicodeBidi: 'isolate' }}>
          {formatILNum(oldPrice)}
        </span>
      ) : null}
      {pct > 0 ? (
        <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 900, fontSize: 34 * scaleFont, color: '#0d1117', background: accent, borderRadius: 12, padding: '6px 14px', unicodeBidi: 'isolate' }}>
          {formatILPct(pct)}
        </span>
      ) : null}
    </div>
  );
  if (inline) return <div style={{ direction: 'rtl', opacity: p, transform: `scale(${scale})` }}>{inner}</div>;
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x ?? 0,
        right: x === undefined ? 0 : undefined,
        display: 'flex',
        justifyContent: x === undefined ? 'center' : 'flex-start',
        direction: 'rtl',
        opacity: p,
        transform: `scale(${scale})`,
      }}
    >
      {inner}
    </div>
  );
};

// ─── Logo / Watermark ────────────────────────────────────────────────────────
// Business mark pinned to a safe-area-clear corner. Default bottom-LEFT (x=SAFE.left),
// which keeps it off the right 160px like/share rail and out of the bottom 500px UI zone.
// text = a plain text wordmark; src = an image logo (staticFile path).
export const Logo: React.FC<{
  text?: string;
  src?: string;
  x?: number;
  y?: number;
  accent?: string;
}> = ({ text, src, x = SAFE.left, y = SAFE.top + 6, accent = COLORS.accent }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      direction: 'rtl',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      opacity: 0.92,
    }}
  >
    {src ? (
      <img src={src} style={{ height: 44, width: 'auto', display: 'block' }} alt={text ?? ''} />
    ) : (
      <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 800, fontSize: 34, color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,0.6)', unicodeBidi: 'isolate' }}>
        {text}
        <span style={{ color: accent }}>.</span>
      </span>
    )}
  </div>
);

// ─── Ad polish kit (P1 #6 "designed" pass) ───────────────────────────────────
// Three reusable finish primitives that attack "doesn't read as an ad / reads
// calm-premium" (research 02 §2.3) — all pure CSS + deterministic frame math, $0.
//   AdGrade       — a root color-grade + vignette-boost overlay that unifies every ad
//                   scene into one "shot" (the missing finish over the mesh backdrop).
//   GradientText  — gradient-filled display text for hero/price money moments.
//   AdTilt        — a CSS perspective() 3D-lite tilt for the money elements (PriceBadge,
//                   CTA), so they read as physical ad cards, not flat boxes.
// Applied at the ad-shot root (AdGrade) and around money/hero elements (the others).
// Calm-rule-compatible: AdTilt is a FIXED subtle angle (no wobble), grade is static.

// Root color grade: a soft warm top-light + cool bottom shadow + tightened vignette
// layered over the whole frame. Pure overlays — never a full-screen opaque wash, so the
// mesh backdrop stays visible. Static (no frame), safe to place once at the ad root.
export const AdGrade: React.FC<{
  tint?: string; // warm top-light hue (default brand amber-ish)
  top?: number; // 0..1 top-light strength
  bottom?: number; // 0..1 bottom-cool strength
  vignette?: number; // 0..1 extra vignette gain
}> = ({ tint = '#ffd9a0', top = 0.10, bottom = 0.14, vignette = 0.18 }) => (
  <>
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${hexA2(tint, top)} 0%, rgba(0,0,0,0) 45%, rgba(12,18,32,${bottom}) 100%)`,
        pointerEvents: 'none',
      }}
    />
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 130% 95% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,${vignette}) 100%)`,
        pointerEvents: 'none',
      }}
    />
  </>
);

// Gradient display text for a hero/price money moment. Fill = brand GRADIENT with a
// subtle text-shadow lift. Replaces a flat hero color on the most important line.
export const GradientText: React.FC<{
  children: React.ReactNode;
  font?: string;
  size?: number;
  weight?: number;
  grad?: string; // CSS gradient; default = brand GRADIENT
  style?: React.CSSProperties;
}> = ({ children, font = FONT_DISPLAY_H, size = 92, weight = 900, grad, style }) => (
  <span
    style={{
      fontFamily: font,
      fontWeight: weight,
      fontSize: size,
      lineHeight: 1.05,
      background: grad ?? GRADIENT_AD,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))',
      unicodeBidi: 'isolate',
      ...style,
    }}
  >
    {children}
  </span>
);

// 3D-lite tilt: wraps a money element in a CSS perspective with a gentle fixed
// rotateX/rotateY so PriceBadge / CTA read as physical ad cards. Deterministic (fixed
// angle — no motion), RTL-safe (mirrors the horizontal angle for Hebrew).
export const AdTilt: React.FC<{
  children: React.ReactNode;
  x?: number; // rotateX degrees (vertical lean)
  y?: number; // rotateY degrees (horizontal lean); mirrored for RTL
  scale?: number;
  perspective?: number;
  style?: React.CSSProperties;
}> = ({ children, x = 6, y = -8, scale = 1.03, perspective = 1000, style }) => (
  <div
    style={{
      perspective,
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      ...style,
    }}
  >
    <div
      style={{
        transform: `rotateX(${x}deg) rotateY(${y}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
        filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.35))',
      }}
    >
      {children}
    </div>
  </div>
);

const hexA2 = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const GRADIENT_AD = `linear-gradient(120deg, #f0b04a 0%, ${COLORS.danger} 55%, ${COLORS.accent2} 100%)`;

// ─── AdSceneIn ───────────────────────────────────────────────────────────────
// P1 #23 — scene transitions in ads. The ad scenes are time-windowed overlays (not a
// TransitionSeries), so each beat used to POP into view. AdSceneIn gives each beat a
// "designed" ENTRANCE: a short whip-slide in from one side with a blur-settle + fade,
// driven by EASE_POP (the P0 #10 primitive) so it crests and locks with ≤6% overshoot
// (the calm rule). Pure CSS + frame math, deterministic, $0.
//
// kind:
//   'whip'  — slide in from `from` side, mild blur that settles (offer/proof reveal).
//   'dip'   — quick scale-settle from slightly under size + fade (soft beat change).
//   'blur'  — pure blur-to-sharp + fade (gentlest; for text that shouldn't move).
// `at` is the GLOBAL frame the entrance starts; content is fully settled by at+`dur`.
// RTL note: `from:'left'` slides in from the LEFT (translateX negative→0). For RTL
// Hebrew copy the natural reading entrance is from the RIGHT — pass from:'right'.
export const AdSceneIn: React.FC<{
  at: number;                 // global frame the entrance begins
  dur?: number;               // entrance length in frames (default ~0.4s feel)
  kind?: 'whip' | 'dip' | 'blur';
  from?: 'left' | 'right' | 'up' | 'down';
  distance?: number;          // px travel for whip
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, dur = 12, kind = 'whip', from = 'right', distance = 60, children, style }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + dur);         // 0..1
  if (p <= 0) return null;                     // not yet entered — render nothing
  const e = EASE_POP(p);                       // crests ~1.06 then locks at 1
  const opacity = Math.min(1, p * 2);          // fade leads the move (first half)

  let transform = '';
  let filter: string | undefined;
  if (kind === 'whip') {
    const d = distance * (1 - e);
    const axis: Record<string, [number, number]> = {
      left: [-d, 0], right: [d, 0], up: [0, -d], down: [0, d],
    };
    const [tx, ty] = axis[from];
    transform = `translate(${tx}px, ${ty}px)`;
    const blurPx = (1 - Math.min(1, e)) * 8;   // blur settles as it lands
    filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(2)}px)` : undefined;
  } else if (kind === 'dip') {
    const s = 0.92 + 0.08 * e;                 // 0.92 → 1.0 (overshoot ≤ 1.06 via EASE_POP)
    transform = `scale(${s.toFixed(4)})`;
    const blurPx = (1 - Math.min(1, e)) * 5;
    filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(2)}px)` : undefined;
  } else {                                      // blur
    const blurPx = (1 - Math.min(1, e)) * 10;
    filter = blurPx > 0.1 ? `blur(${blurPx.toFixed(2)}px)` : undefined;
  }

  return (
    <div
      style={{
        opacity,
        transform: transform || undefined,
        filter,
        willChange: 'transform, opacity, filter',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── AdEndCard ───────────────────────────────────────────────────────────────
// The conversion payoff — the reason mode:"ad" exists. Holds the FULL `durSec` (no fade-out):
// the phone / WhatsApp button must stay on screen long enough to tap. RTL throughout; the
// WhatsApp CTA is the primary button (the Israeli commerce layer); the phone number is the
// secondary action. Business name + tagline on top.
export const AdEndCard: React.FC<{
  businessName: string;
  tagline?: string;
  ctaText: string;
  phoneDisplay?: string; // "050-123-4567"
  whatsapp?: string; // local number; converted via waLink
  website?: string;
  price?: number;
  oldPrice?: number;
  at?: number; // frames (scene-local) when the card pops in
  durSec: number;
  accent?: string;
}> = ({
  businessName,
  tagline,
  ctaText,
  phoneDisplay,
  whatsapp,
  website,
  price,
  oldPrice,
  at = 0,
  durSec,
  accent = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = EASE_OUT(prog(frame, at, at + 14));
  if (enter <= 0.01) return null;
  const scale = 0.94 + 0.06 * enter;
  const WA_GREEN = '#25D366';
  const showWa = whatsapp || phoneDisplay;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        direction: 'rtl',
        opacity: enter,
        transform: `scale(${scale})`,
        paddingLeft: SAFE.right,
        paddingRight: SAFE.left,
      }}
    >
      <div
        style={{
          width: '100%',
          background: 'rgba(13,17,23,0.94)',
          border: `2px solid ${accent}55`,
          borderRadius: 30,
          padding: '54px 48px',
          boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
          // P1 #6: a gentle fixed 3D-lite tilt on the conversion card — physical ad card.
          transform: 'perspective(1200px) rotateX(5deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* P1 #16: Frank Ruhl Libre editorial serif for the business name — the premium
            typographic moment (the conversion payoff reads as a designed brand card). */}
        <GradientText size={66} weight={800} grad={GRADIENT_AD} font={FONT_AD_SERIF}>
          {stripNikkud(businessName)}
        </GradientText>
        {tagline ? (
          <div style={{ fontFamily: FONT_BODY_H, fontWeight: 500, fontSize: 36, color: COLORS.d300, unicodeBidi: 'isolate' }}>
            {stripNikkud(tagline)}
          </div>
        ) : null}

        {price !== undefined ? (
          <div style={{ marginTop: 6 }}>
            <PriceBadge price={price} oldPrice={oldPrice} at={0} inline scaleFont={0.7} accent={COLORS.danger} />
          </div>
        ) : null}

        {/* Primary CTA — WhatsApp (the commerce layer). */}
        {showWa ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              background: WA_GREEN,
              color: '#06301A',
              borderRadius: 18,
              padding: '24px 40px',
              marginTop: 12,
              width: '100%',
            }}
          >
            <svg width={40} height={40} viewBox="0 0 24 24" style={{ flex: '0 0 auto' }}>
              <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8.9-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3z" />
            </svg>
            <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 800, fontSize: 46, unicodeBidi: 'isolate' }}>{stripNikkud(ctaText)}</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: accent,
              color: '#fff',
              borderRadius: 18,
              padding: '24px 40px',
              marginTop: 12,
              width: '100%',
            }}
          >
            <span style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 800, fontSize: 46, unicodeBidi: 'isolate' }}>{stripNikkud(ctaText)}</span>
          </div>
        )}

        {/* Secondary actions. */}
        {phoneDisplay ? (
          <div style={{ fontFamily: FONT_DISPLAY_H, fontWeight: 700, fontSize: 52, color: '#fff', letterSpacing: 1, unicodeBidi: 'isolate' }}>
            {formatILPhone(phoneDisplay)}
          </div>
        ) : null}
        {website ? (
          <div style={{ fontFamily: FONT_BODY_H, fontWeight: 600, fontSize: 32, color: accent, unicodeBidi: 'isolate' }}>
            {website + RLM}
          </div>
        ) : null}
      </div>
    </div>
  );
};
