// short-13 — "The Photo on the Wall" (dad & daughter). Fully TSX paper storybook,
// Word-exact captions driven by Edge-TTS transcript timings (./vo.gen.ts).
// One persistent stage; memories pin onto a clothesline; the photo on the wall is the
// continuity — the loop's last frame lands exactly on frame 0.
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { BigTitle, Captions, Kicker, ProgressBar, prog, EASE_OUT, EASE_INOUT } from '../../lib/shorts';
import { MemoryPaper, Motes, PaperHeart, PaperLabel, Person } from '../../lib/people';
import { VO } from './vo.gen';

// =============================================================================
// COMPOSITION CONFIG
// =============================================================================
export const compositionConfig = {
  id: 'Short13DadDaughter',
  durationInSeconds: 38,
  fps: 30,
  width: 1080,
  height: 1920,
};

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
const PAPER = '#faf3e7';
const PAPER2 = '#f4e8d3';
const PAPER_NOISE =
  'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22>%3Cfilter id=%22n%22>%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/>%3C/filter>%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.5%22/>%3C/svg>")';
const INK = '#3a2e26';
const GOLD = '#f5d76e';
const ROSE = '#e8879f';
const RUST = '#c96f4a';
const TEAL = '#4db8a8';
const INDIGO = '#6366f1';
const FRAME_WOOD = '#a97743';
const FRAME_DARK = '#7c5426';
const NIGHT = '#566282';

// Dad + daughter identity — NEVER changes across beats.
const DAD = { body: RUST, sleeve: '#b85f3d', pants: '#4a4038', hair: '#4a3226', skin: '#f2c9a0' };
const GIRL = { body: ROSE, sleeve: '#d9778f', pants: '#5c4a5e', hair: '#33241c', skin: '#f6d3ab', bow: GOLD };

// =============================================================================
// STAGE — warm paper backdrop, sun glow, floor; slight vignette.
// =============================================================================
const Stage: React.FC<{ frame: number; night?: number }> = ({ frame, night = 0 }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: PAPER }} />
    {/* night wash for the storm beat */}
    <AbsoluteFill style={{ background: NIGHT, opacity: night * 0.85 }} />
    {/* sun glow */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 80% 46% at 50% 30%, rgba(245,215,110,${0.5 - night * 0.34}) 0%, transparent 68%)`,
      }}
    />
    {/* warm window-light godray sweeping down the wall */}
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(100deg, transparent 34%, rgba(255,246,214,0.30) 45%, rgba(255,246,214,0.06) 55%, transparent 66%)',
        opacity: 1 - night * 0.8,
      }}
    />
    {/* paper grain — deterministic fractal noise at low opacity */}
    <AbsoluteFill style={{ backgroundImage: PAPER_NOISE, opacity: 0.06, mixBlendMode: 'multiply' }} />
    {/* floor */}
    <AbsoluteFill
      style={{
        top: 1560,
        background: `linear-gradient(180deg, ${PAPER2} 0%, #e9d9bf 100%)`,
        opacity: 1 - night * 0.4,
      }}
    />
    <AbsoluteFill style={{ top: 1560, height: 3, background: 'rgba(120,90,50,0.25)' }} />
    {/* drifting motes */}
    <svg width={1080} height={1920} style={{ position: 'absolute' }}>
      <Motes frame={frame} w={1080} h={1920} count={18} seed={13} />
    </svg>
    {/* gentle vignette */}
    <AbsoluteFill
      style={{ background: 'radial-gradient(ellipse 118% 92% at 50% 46%, transparent 58%, rgba(88,58,30,0.30) 100%)' }}
    />
    {/* soft top-lit falloff so the wall never feels flat */}
    <AbsoluteFill
      style={{ background: 'linear-gradient(180deg, rgba(120,80,40,0.10) 0%, transparent 18%)' }}
    />
  </AbsoluteFill>
);

// =============================================================================
// PHOTO FRAME — the payoff object. `content` selects what's inside.
// =============================================================================
const PhotoFrame: React.FC<{
  x: number;
  y: number;
  w: number;
  glow?: number; // 0..1 halo when empty
  children: React.ReactNode;
}> = ({ x, y, w, glow = 0, children }) => {
  const bw = Math.round(w * 0.085);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: w * 1.22 }}>
      {glow > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: -40,
            borderRadius: 40,
            background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(245,215,110,${0.55 * glow}) 0%, transparent 70%)`,
          }}
        />
      )}
      {/* hanging nail + wire on top of the frame */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 32%, #e8e3d6 0%, #a99e88 45%, #7d7563 100%)',
          boxShadow: '0 3px 6px rgba(40,25,10,0.5), inset 0 -2px 3px rgba(0,0,0,0.35)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -14,
          left: '18%',
          width: '64%',
          height: 0,
          borderTop: '2px solid rgba(90,70,50,0.55)',
          transform: 'rotate(2deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${FRAME_WOOD} 0%, ${FRAME_DARK} 100%)`,
          borderRadius: 18,
          boxShadow:
            '0 30px 80px rgba(60,35,15,0.50), 0 6px 18px rgba(60,35,15,0.35), inset 0 2px 0 rgba(255,255,255,0.30), inset 0 -3px 6px rgba(0,0,0,0.30)',
        }}
      />
      {/* wood grain sheen across the frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.10) 38%, transparent 55%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: bw,
          background: '#fffdf6',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow:
            'inset 0 0 0 2px rgba(120,80,40,0.25), inset 0 8px 24px rgba(80,50,20,0.14), inset 0 -6px 16px rgba(80,50,20,0.10)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// The photo's contents: dad + daughter + heart on a tiny paper scene. `grown` swaps the
// small daughter for the grown one (used in the payoff re-hang).
const PhotoScene: React.FC<{ grown?: boolean }> = ({ grown = false }) => (
  <svg viewBox="0 0 400 488" width="100%" height="100%">
    <rect width={400} height={488} fill="#fdf3df" />
    <circle cx={200} cy={120} r={150} fill="rgba(245,215,110,0.4)" />
    <rect y={400} width={400} height={88} fill="#f0e0c4" />
    <Person x={150} y={410} h={240} facing={1} {...DAD} pose={{ armL: 30, armR: -30 }} />
    <Person x={265} y={410} h={grown ? 205 : 132} facing={-1} {...GIRL} pose={{ armL: 58, armR: -46 }} />
    <PaperHeart x={208} y={grown ? 168 : 190} size={grown ? 52 : 44} />
  </svg>
);

// =============================================================================
// HOOK (frames 0..104) and LOOP (1110..1140) — the SAME composed wall shot.
// mode 'settle' = punch-in 1.05→1 (hook); mode 'grow' = 1→1.05 (loop rewind).
// 'still' = exactly frame 0's look (scale 1, warm title) — used for the loop overlay
// so the fully-faded last frame == frame 0 (a moving loop read as a mismatch).
// =============================================================================
const HookShot: React.FC<{ mode: 'settle' | 'grow' | 'still'; local: number }> = ({ mode, local }) => {
  const p = EASE_INOUT(prog(local, 0, 30));
  const scale = mode === 'settle' ? 1.05 - 0.05 * p : mode === 'grow' ? 1 + 0.05 * p : 1;
  const heartBeat = prog(local, 18, 30);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <BigTitle
        warm={mode !== 'grow'}
        y={200}
        size={86}
        lines={[
          { text: 'ONE PHOTO', color: INK },
          { text: 'ON THE WALL', color: RUST },
        ]}
        subtitle="a dad. a daughter. a whole childhood."
        subtitleColor="rgba(74,54,36,0.9)"
        subtitleShadow="0 2px 14px rgba(255,246,214,0.55)"
      />
      <PhotoFrame x={300} y={640} w={480}>
        <PhotoScene />
      </PhotoFrame>
      {/* heartbeat pulse over the frame */}
      <svg width={1080} height={1920} style={{ position: 'absolute', pointerEvents: 'none' }}>
        <PaperHeart x={540} y={880} size={150} beat={mode === 'settle' ? heartBeat : 0} opacity={0.9} color={ROSE} />
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================
// MEMORY PAPERS — six beats. Each is the interior of one big MemoryPaper.
// Shared geometry: viewBox 0 0 760 980; floor line at y 780.
// =============================================================================
const Sky: React.FC<{ night?: number; sunset?: number }> = ({ night = 0, sunset = 0 }) => (
  <>
    <rect width={760} height={980} fill={night > 0 ? '#6a7590' : sunset > 0 ? '#f7cf9a' : '#fdf3df'} />
    {sunset > 0 && <rect y={500} width={760} height={280} fill="#f2a86b" opacity={0.55} />}
    <circle cx={380} cy={sunset > 0 ? 420 : 230} r={sunset > 0 ? 130 : 170} fill={`rgba(245,215,110,${sunset > 0 ? 0.8 : 0.5})`} />
    <rect y={780} width={760} height={200} fill={night > 0 ? '#525d78' : sunset > 0 ? '#e0b184' : '#f0e0c4'} />
  </>
);

const MemNewborn: React.FC<{ t: number }> = ({ t }) => (
  <svg viewBox="0 0 760 980" width="100%" height="100%">
    <Sky />
    {/* mobile stars */}
    {[150, 300, 470, 610].map((x, i) => (
      <g key={i} transform={`translate(${x},${120 + Math.sin(t * 2 + i) * 10})`}>
        <line x1={0} y1={-80} x2={0} y2={0} stroke="#c9b490" strokeWidth={3} />
        <path d="M 0 -14 L 4 -4 L 15 -4 L 6 3 L 9 14 L 0 8 L -9 14 L -6 3 L -15 -4 L -4 -4 Z" fill={GOLD} />
      </g>
    ))}
    <Person x={380} y={790} h={430} facing={1} {...DAD} pose={{ cradle: true, armL: 74, armR: -74 }} breath={Math.sin(t * 1.6)} />
    <PaperHeart x={380} y={240} size={54} beat={prog(t, 0.5, 1)} />
  </svg>
);

const MemSteps: React.FC<{ t: number }> = ({ t }) => {
  // toddler waddles toward dad: progress across the beat
  const walk = EASE_INOUT(prog(t, 0.15, 0.95));
  const tx = 560 - 250 * walk;
  const wobble = Math.sin(t * 10) * 4 * (1 - walk);
  return (
    <svg viewBox="0 0 760 980" width="100%" height="100%">
      <Sky />
      {/* dad kneeling, arms wide */}
      <Person x={230} y={790} h={400} facing={1} {...DAD} pose={{ kneel: true, armL: 68, armR: -68 }} breath={Math.sin(t * 1.4)} />
      {/* toddler */}
      <g transform={`rotate(${wobble} ${tx} 790)`}>
        <Person x={tx} y={790} h={190} facing={-1} {...GIRL} pose={{ armL: 80, armR: -80, legL: 16, legR: -16 }} />
      </g>
      {/* step dots */}
      {[500, 440, 380, 320].map((x, i) => (
        <ellipse key={i} cx={x} cy={795} rx={16} ry={7} fill="#d9c39a" opacity={prog(t, 0.2 + i * 0.18, 0.35 + i * 0.18)} />
      ))}
      <PaperHeart x={250} y={330} size={50} beat={prog(t, 0.8, 1)} opacity={prog(t, 0.75, 0.9)} />
    </svg>
  );
};

const MemBike: React.FC<{ t: number }> = ({ t }) => {
  const wob = Math.sin(t * 6) * 3 * (1 - prog(t, 0.6, 1));
  const spin = t * 300;
  return (
    <svg viewBox="0 0 760 980" width="100%" height="100%">
      <Sky />
      <g transform={`rotate(${wob} 400 640)`}>
        {/* bike */}
        <g stroke={INK} strokeWidth={10} strokeLinecap="round">
          <line x1={290} y1={640} x2={380} y2={520} />
          <line x1={510} y1={640} x2={430} y2={520} />
          <line x1={380} y1={520} x2={455} y2={520} />
          <line x1={455} y1={520} x2={510} y2={470} />
          <line x1={380} y1={520} x2={350} y2={468} />
        </g>
        {/* wheels */}
        {[290, 510].map((cx) => (
          <g key={cx} transform={`translate(${cx},640)`}>
            <circle r={62} fill="none" stroke={INK} strokeWidth={11} />
            <g transform={`rotate(${spin})`} stroke="#8a7657" strokeWidth={5}>
              <line x1={-50} y1={0} x2={50} y2={0} />
              <line x1={0} y1={-50} x2={0} y2={50} />
            </g>
          </g>
        ))}
        {/* daughter on the seat */}
        <Person x={400} y={560} h={210} facing={1} {...GIRL} pose={{ armL: 40, armR: -40, legL: 40, legR: -30 }} />
        {/* dad running behind, hand on the seat */}
        <Person x={170} y={790} h={400} facing={1} {...DAD} pose={{ armL: 12, armR: -66, legL: 26, legR: -34 }} breath={Math.sin(t * 8) * 0.5} />
      </g>
      {/* band-aid on her knee */}
      <rect x={438} y={470} width={34} height={16} rx={8} fill={GOLD} transform={`rotate(-18 455 478)`} />
      <PaperHeart x={190} y={300} size={48} beat={prog(t, 0.55, 0.95)} opacity={prog(t, 0.5, 0.8)} />
    </svg>
  );
};

const MemStorm: React.FC<{ t: number }> = ({ t }) => {
  const rainSeed = (i: number, k: number) => {
    const v = Math.sin(i * 91.7 + k * 31.3) * 10000;
    return v - Math.floor(v);
  };
  const drops = Array.from({ length: 46 }, (_, i) => {
    const bx = rainSeed(i, 1) * 760;
    const speed = 620 + rainSeed(i, 2) * 260;
    const y = ((t * speed + rainSeed(i, 3) * 980) % 1080) - 60;
    return { x: bx, y, len: 34 + rainSeed(i, 4) * 26 };
  });
  return (
    <svg viewBox="0 0 760 980" width="100%" height="100%">
      <Sky night={1} />
      {/* rain */}
      <g stroke="#aeb9d4" strokeWidth={5} strokeLinecap="round" opacity={0.75}>
        {drops.map((d, i) => (
          <line key={i} x1={d.x} y1={d.y} x2={d.x - 8} y2={d.y + d.len} />
        ))}
      </g>
      {/* umbrella held over HER */}
      <g transform={`translate(420,${330 + Math.sin(t * 1.5) * 6}) rotate(-8)`}>
        <path d="M -240 30 A 240 240 0 0 1 240 30 Z" fill={ROSE} stroke="#c96f85" strokeWidth={6} />
        <path d="M -240 30 A 240 240 0 0 1 -120 30 A 120 120 0 0 1 0 30 A 120 120 0 0 1 120 30 A 120 120 0 0 1 240 30" fill="none" stroke="#c96f85" strokeWidth={5} />
        <line x1={0} y1={30} x2={0} y2={260} stroke={INK} strokeWidth={9} strokeLinecap="round" />
        <path d="M 0 260 q 0 34 -30 30" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      </g>
      {/* dad holds it over her; his own shoulder in the rain */}
      <Person x={430} y={790} h={400} facing={-1} {...DAD} pose={{ armL: 100, armR: -16 }} />
      <Person x={480} y={790} h={210} facing={-1} {...GIRL} pose={{ armL: 24, armR: -24 }} />
      {/* rain splashes on dad's side only */}
      {[140, 190, 240].map((x, i) => (
        <path key={i} d={`M ${x} 800 q 8 -18 16 0`} stroke="#aeb9d4" strokeWidth={4} fill="none" opacity={0.5 + 0.5 * Math.sin(t * 7 + i * 2)} />
      ))}
    </svg>
  );
};

const MemGrad: React.FC<{ t: number }> = ({ t }) => {
  // cap arcs up then spins; confetti bursts late
  const up = prog(t, 0.1, 0.75);
  const capY = 330 - EASE_OUT(up) * 190;
  const capRot = -20 + up * 160;
  const confetti = Array.from({ length: 40 }, (_, i) => {
    const r = (k: number) => {
      const v = Math.sin(i * 57.3 + k * 17.9) * 10000;
      return v - Math.floor(v);
    };
    const burst = prog(t, 0.55, 1);
    const ang = r(1) * Math.PI * 2;
    const dist = burst * (90 + r(2) * 320);
    return {
      x: 380 + Math.cos(ang) * dist,
      y: 260 + Math.sin(ang) * dist * 0.8 + burst * burst * 220,
      c: [GOLD, ROSE, TEAL, INDIGO][i % 4],
      o: 1 - burst * 0.4,
      s: 8 + r(3) * 10,
      rot: r(4) * 360 + t * 120,
    };
  });
  return (
    <svg viewBox="0 0 760 980" width="100%" height="100%">
      <Sky />
      {/* confetti */}
      {confetti.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.s} height={c.s * 0.6} fill={c.c} opacity={c.o} transform={`rotate(${c.rot} ${c.x} ${c.y})`} />
      ))}
      {/* dad cheering BIG */}
      <Person x={210} y={790} h={410} facing={1} {...DAD} pose={{ cheer: true, armL: 150, legL: 14, legR: -14 }} breath={Math.sin(t * 5)} />
      {/* graduate daughter (grown-ish, gown) */}
      <g>
        <Person x={480} y={790} h={290} facing={-1} {...{ ...GIRL, body: INDIGO, sleeve: '#5258d6' }} pose={{ armL: 140, armR: -140 }} />
        {/* gown skirt */}
        <path d="M 400 790 L 445 560 L 515 560 L 560 790 Z" fill="#5258d6" opacity={0.9} />
      </g>
      {/* the tossed cap */}
      <g transform={`translate(${480 + up * 60},${capY}) rotate(${capRot})`}>
        <rect x={-52} y={-12} width={104} height={24} rx={6} fill={INK} />
        <rect x={-30} y={-30} width={60} height={24} rx={6} fill="#2b2230" />
        <line x1={52} y1={0} x2={86} y2={26} stroke={GOLD} strokeWidth={6} />
        <circle cx={88} cy={30} r={8} fill={GOLD} />
      </g>
      <PaperHeart x={220} y={300} size={52} beat={prog(t, 0.55, 1)} opacity={prog(t, 0.5, 0.85)} />
    </svg>
  );
};

const MemGrown: React.FC<{ t: number }> = ({ t }) => {
  const steam = (dx: number, ph: number) => {
    const rise = prog((t * 0.5 + ph) % 1, 0, 1);
    return { y: -rise * 90, o: Math.sin(rise * Math.PI) * 0.8, x: dx + Math.sin(t * 2 + ph * 6) * 6 };
  };
  const s1 = steam(0, 0);
  const s2 = steam(0, 0.45);
  return (
    <svg viewBox="0 0 760 980" width="100%" height="100%">
      <Sky sunset={1} />
      {/* window frame behind them */}
      <rect x={110} y={140} width={540} height={420} rx={18} fill="none" stroke="#c9a86a" strokeWidth={10} opacity={0.8} />
      <line x1={380} y1={140} x2={380} y2={560} stroke="#c9a86a" strokeWidth={8} opacity={0.8} />
      {/* table */}
      <rect x={190} y={640} width={380} height={26} rx={10} fill={FRAME_WOOD} />
      <rect x={230} y={666} width={22} height={124} fill={FRAME_DARK} />
      <rect x={508} y={666} width={22} height={124} fill={FRAME_DARK} />
      {/* mugs */}
      {[300, 460].map((x) => (
        <g key={x}>
          <rect x={x - 26} y={592} width={52} height={50} rx={10} fill={x === 300 ? RUST : TEAL} />
          <path d={`M ${x + 26} 604 q 22 6 0 26`} fill="none" stroke={x === 300 ? RUST : TEAL} strokeWidth={8} />
        </g>
      ))}
      {/* steam over the left mug (dad's) */}
      <g stroke="#fff" strokeWidth={6} strokeLinecap="round" fill="none">
        <path d={`M ${300 + s1.x} ${586 + s1.y} q 8 -14 0 -26`} opacity={s1.o} />
        <path d={`M ${300 + s2.x} ${586 + s2.y} q -8 -14 0 -26`} opacity={s2.o} />
      </g>
      {/* sitting side by side — dad taller, daughter grown (no bow -> grown) */}
      <Person x={285} y={620} h={330} facing={1} {...DAD} pose={{ armL: 52, armR: -20, legL: 78, legR: -78 }} />
      <Person x={475} y={620} h={290} facing={-1} {...{ ...GIRL, bow: undefined }} pose={{ armL: 20, armR: -52, legL: 78, legR: -78 }} />
      <PaperHeart x={380} y={240} size={54} beat={prog(t, 0.4, 0.9)} opacity={0.9} />
    </svg>
  );
};

// =============================================================================
// MEMORY SCENE — the era 3.5s..31s: one big paper swaps through the six memories,
// then empties for the payoff approach. Small pinned polaroids fill up along a line.
// =============================================================================
const MEMS = [
  { at: 105, label: 'the beginning', Comp: MemNewborn },
  { at: 225, label: 'first steps', Comp: MemSteps },
  { at: 345, label: 'scraped knees', Comp: MemBike },
  { at: 465, label: 'every storm', Comp: MemStorm },
  { at: 585, label: 'cap toss', Comp: MemGrad },
  { at: 705, label: 'side by side', Comp: MemGrown },
] as const;

const MemoryScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global - 105 (era starts at 3.5s)
  // active memory index
  const active = MEMS.reduce((acc, m, i) => (frame >= m.at - 105 ? i : acc), 0);
  const m = MEMS[active];
  const mLocal = frame - (m.at - 105);
  const swapIn = EASE_OUT(prog(mLocal, 0, 14));
  const t = mLocal / 30;

  return (
    <AbsoluteFill>
      {/* kicker */}
      <Kicker text="ASK MY DAD" color={RUST} y={170} at={0} until={100} />
      <Kicker text="HE REMEMBERS EVERYTHING" color={RUST} y={170} at={100} until={730} />

      {/* big memory paper */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 420,
          transform: `scale(${0.92 + 0.08 * swapIn}) rotate(${(1 - swapIn) * -3}deg)`,
          opacity: 0.4 + 0.6 * swapIn,
        }}
      >
        <MemoryPaper w={800} h={1030} rotate={Math.sin(frame * 0.01) * 0.6}>
          <m.Comp t={t} />
          <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }}>
            <PaperLabel text={m.label} />
          </div>
        </MemoryPaper>
      </div>

      {/* timeline of pinned mini-polaroids along the bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1560, display: 'flex', justifyContent: 'center', gap: 26 }}>
        {MEMS.map((mm, i) => {
          const on = prog(frame, mm.at - 105 + 8, mm.at - 105 + 20);
          const isActive = i === active;
          return (
            <div
              key={i}
              style={{
                width: 118,
                height: 142,
                opacity: on,
                transform: `translateY(${(1 - EASE_OUT(on)) * 30}px) scale(${isActive ? 1.12 : 1}) rotate(${(i % 2 ? 1 : -1) * 3}deg)`,
                background: '#fffef7',
                borderRadius: 6,
                border: `3px solid ${isActive ? RUST : 'rgba(120,90,50,0.35)'}`,
                boxShadow: '0 10px 30px rgba(60,35,20,0.3)',
                overflow: 'hidden',
              }}
            >
              <svg viewBox="0 0 760 980" width="100%" height="100%">
                <mm.Comp t={1} />
              </svg>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// PAYOFF (31s..36.5s) — grown daughter & dad hang the photo TOGETHER.
// =============================================================================
const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame(); // local: global - 930 (starts 31.0s)
  const enter = EASE_OUT(prog(frame, 0, 18));
  const lift = EASE_INOUT(prog(frame, 20, 62)); // frame rises onto the wall
  const beat = prog(frame, 78, 100);
  const fy = 1080 - lift * 440; // frame travels 1080 -> 640
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <Kicker text="SO WE HUNG IT TOGETHER" color={RUST} y={170} at={6} />
      {/* the photo being hung */}
      <PhotoFrame x={300} y={fy} w={480} glow={1 - lift * 0.6}>
        <PhotoScene grown />
      </PhotoFrame>
      {/* the two of them, arms up, steadying it */}
      <svg width={1080} height={1920} style={{ position: 'absolute' }}>
        <Person x={180} y={1500} h={430} facing={1} {...DAD} pose={{ armL: 26, armR: -118 }} breath={Math.sin(frame * 0.06)} />
        <Person x={880} y={1500} h={360} facing={-1} {...{ ...GIRL, bow: undefined }} pose={{ armL: 118, armR: -26 }} breath={Math.sin(frame * 0.06 + 1)} />
        <PaperHeart x={540} y={fy + 250} size={170} beat={beat} opacity={0.9} />
      </svg>
    </AbsoluteFill>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const Short13DadDaughter: React.FC = () => {
  const frame = useCurrentFrame();
  // storm night wash peaks during memory 4 (global 19..23s => frames 570..690)
  const night = prog(frame, 555, 585) * (1 - prog(frame, 690, 720));
  // loop crossfade: payoff fades into hook over the last 30 frames (1139 is the
  // last frame — the crossfade must land at 1.0 exactly there so frame 1139 == frame 0)
  const loopIn = prog(frame, 1110, 1139);

  return (
    <AbsoluteFill>
      <Stage frame={frame} night={night} />

      {/* HOOK 0..105 */}
      <Sequence from={0} durationInFrames={105}>
        <HookScene />
      </Sequence>

      {/* MEMORIES 105..930 (3.5s..31s) */}
      <Sequence from={105} durationInFrames={825}>
        <MemoryScene />
      </Sequence>

      {/* PAYOFF 930..1110 (31s..37s) */}
      <Sequence from={930} durationInFrames={180}>
        <PayoffScene />
      </Sequence>

      {/* LOOP dissolve: last 30 frames crossfade to the exact frame-0 look.
          LoopShot renders HookShot 'settle' at local 0 (scale 1.05) — identical to
          frame 0's HookScene — so the fully-faded frame 1139 == frame 0. */}
      {loopIn > 0 && (
        <AbsoluteFill style={{ opacity: loopIn }}>
          <LoopShot />
        </AbsoluteFill>
      )}

      <Captions lines={VO} y={1360} accent={ROSE} plate />
      <ProgressBar color={ROSE} />
    </AbsoluteFill>
  );
};

// HookScene wraps HookShot in settle mode (Sequence makes its frames local 0..104).
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  return <HookShot mode="settle" local={frame} />;
};

// LoopShot reproduces frame 0 EXACTLY. Frame 0 is HookScene at its first frame —
// HookShot in 'settle' mode at local 0 => scale 1.05, warm title, no heart pulse.
// The crossfade lands fully at frame 1139, so the last frame == the first frame.
const LoopShot: React.FC = () => {
  return <HookShot mode="settle" local={0} />;
};

export default Short13DadDaughter;
