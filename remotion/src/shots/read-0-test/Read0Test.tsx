import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TileMark } from '../../lib/reading';
import { COLORS } from '../../brand';

// =============================================================================
// READ-0-TEST — the Phase 1 per-mark PIXEL QA fixture (NOT the pilot).
// Renders every קמץ-family mark + the tricky confusables (חיריק/סגול/צירי, חולם,
// דגש, pointed שׁ+חולם) at REAL tile size in BOTH candidate display faces — Rubik-900
// (FONT_HEBREW_CAPTION, the default) and Heebo-700 — so the QA agent can READ them at
// phone scale and judge the per-mark gate (research/hebrew-reading/00-findings.md §4).
//
// PASS = marks distinguishable at a glance (esp. חיריק vs סגול vs צירי; חולם's top-left
// dot clear of the tile top; דגש centered; pointed שׁ+חולם not merged). FAIL → the
// SBL-Hebrew fallback is triggered (conditional §2.3 — not built here on spec).
//
// layout: each ROW is one mark on two side-by-side cells — Rubik-900 (left) and Heebo-700
// (right) — with the Hebrew sign-name under each cell and a muted English label between
// the columns. Pure static renders (no VO, no pop); every mark shows its nikkud in the
// stable accent so the sign itself is what the gate judges. Sampled head/mid/tail for QA.
// =============================================================================
export const compositionConfig = {
  id: 'Read0Test',
  durationInSeconds: 10,
  fps: 30,
  width: 1080,
  height: 1920,
};

// Each row: the pointed mark(s) + the Hebrew name of the sign + an English gate label.
// The three-way chirik/segol/tzere confusable sits FIRST so the eye lands on it; cholam and
// the cholam/shin-dot collision get their own rows (the gate's named traps, findings §4).
const ROWS: { mark: string; he: string; label: string }[] = [
  // BUG-1 regression rows: the reported word + a maqaf-stretched syllable. These prove the
  // marks stay anchored to their base letters in the tile renderer (the אבא screenshot defect).
  { mark: 'אַבָּא', he: 'אַבָּא', label: 'ABA — the reported word' },
  { mark: 'רוֹן', he: 'רוֹן', label: 'RON — maqaf syllable (o + coda)' },
  { mark: 'בִּ', he: 'חִירִיק', label: 'CHIRIK (i) — one dot below' },
  { mark: 'בֶּ', he: 'סֶגּוֹל', label: 'SEGOL (e) — three dots triangle' },
  { mark: 'בֵּ', he: 'צֵירֵי', label: 'TZERE (e) — two dots horizontal' },
  { mark: 'בָּ', he: 'קָמָץ', label: 'KAMATZ (a) — pilot sign' },
  { mark: 'שָׁ', he: 'שִׁין קָמָץ', label: 'SHIN+KAMATZ — dot + sign' },
  { mark: 'בֹּ', he: 'חוֹלָם', label: 'CHOLAM (o) — dot top-left, clear of top' },
  { mark: 'שֹׁ', he: 'שִׁין חוֹלָם', label: 'SHIN+CHOLAM — must NOT merge' },
  { mark: 'בּ', he: 'דָּגֵשׁ', label: 'DAGESH — centered dot' },
];

const CELL_W = 340;
const ROW_H = 200;
const TOP = 200;
const TILE_SIZE = 128; // real-tile stress size: large enough to read the mark, small enough to
// fit 8 rows on one phone-scale frame. The pilot hero renders larger; this is the legibility floor.

const Read0Test: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.d900, direction: 'rtl' }}>
      {/* header */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'sans-serif',
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        READ-0-TEST · per-mark pixel gate
      </div>
      {/* column headers */}
      <div style={{ position: 'absolute', top: 128, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: CELL_W, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif', fontSize: 26, marginRight: 24 }}>
          Rubik-900
        </div>
        <div style={{ width: 220 }} />
        <div style={{ width: CELL_W, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif', fontSize: 26, marginLeft: 24 }}>
          Heebo-700
        </div>
      </div>

      {ROWS.map((row, ri) => (
        <div
          key={ri}
          style={{
            position: 'absolute',
            top: TOP + ri * ROW_H,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            direction: 'ltr',
          }}
        >
          {/* Rubik-900 cell */}
          <div style={{ width: CELL_W, display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 24 }}>
            <TileMark g={row.mark} size={TILE_SIZE} font="rubik" nikkudColor={COLORS.accent} />
            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: 24, direction: 'rtl' }}>{row.he}</div>
          </div>
          {/* English gate label between columns */}
          <div style={{ width: 220, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif', fontSize: 21, lineHeight: 1.2 }}>
            {row.label}
          </div>
          {/* Heebo-700 cell */}
          <div style={{ width: CELL_W, display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: 24 }}>
            <TileMark g={row.mark} size={TILE_SIZE} font="heebo" nikkudColor={COLORS.accent} />
            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: 24, direction: 'rtl' }}>{row.he}</div>
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export default Read0Test;
