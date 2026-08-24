// Paper-people kit — soft paper-cutout figures for story shorts (dad & daughter & family).
// The ONE new niche lib for the people-story series. Figures are pure SVG so a character
// stays identical across every beat (no AI drift). Local coords: (0,0) = bottom center
// between the feet; -H is the top of the head. Pose is driven by explicit limb angles
// (degrees, 0 = down, + = figure's right / screen-left when facing=1) so any beat can
// pose the same doll. Extra flags: `cradle` draws a swaddled bundle in the arms,
// `cheer` throws a peace-hand up, `kneel` folds the back leg.
import React from 'react';
import { FONT_DISPLAY } from '../fonts';

export type Pose = {
  armL?: number;
  armR?: number;
  legL?: number;
  legR?: number;
  cradle?: boolean; // arms fold to hold a swaddled bundle (newborn beat)
  cheer?: boolean; //  right arm flings up with a peace hand (graduation beat)
  kneel?: boolean; //  back leg folds, figure drops (first-steps dad)
};

const deg = (d: number) => (d * Math.PI) / 180;
const rot = (x: number, y: number, d: number) => {
  const r = deg(d);
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
};

export const Person: React.FC<{
  x: number; // center-bottom x in parent coords
  y: number; // ground y in parent coords
  h: number; // total height px
  facing?: 1 | -1;
  body: string; // sweater color
  sleeve?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  bow?: string; // hair-bow color (daughter identity mark)
  pose?: Pose;
  breath?: number; // -1..1 subtle breathing sway
  shadowO?: number; // ground-shadow opacity
}> = ({
  x,
  y,
  h,
  facing = 1,
  body,
  sleeve,
  pants = '#3a3a4e',
  skin = '#f2c9a0',
  hair = '#4a3226',
  bow,
  pose = {},
  breath = 0,
  shadowO = 0.2,
}) => {
  const H = h;
  const HEAD = H * 0.16;
  const TORSO = H * 0.38;
  const LEG = H * 0.46;
  const SHOULDER_W = H * 0.3;
  const ARM = H * 0.36;
  const kneel = !!pose.kneel;
  const dropY = kneel ? H * 0.22 : 0;

  // legs (hip at -LEG)
  const legA = (a: number) => rot(0, LEG, a);
  const lL = legA(pose.legL ?? 6);
  const lR = legA(kneel ? -62 : pose.legR ?? -6);
  const kneeR = kneel ? { x: lR.x * 0.55, y: lR.y * 0.42 } : null;
  const lRend = kneeR ? { x: kneeR.x + rot(-LEG * 0.52, 0, 0).x, y: kneeR.y } : lR;

  // arms (shoulder at -(LEG+TORSO))
  const cradle = !!pose.cradle;
  const aLd = cradle ? 74 : pose.armL ?? 12;
  const aRd = cradle ? -74 : pose.cheer ? -158 : pose.armR ?? -12;
  const armP = (a: number) => rot(0, ARM, a);
  const aL = armP(aLd);
  const aR = armP(aRd);
  const sy = -(LEG + TORSO) - dropY;

  // bundle in cradled arms
  const bundle = cradle
    ? { x: (aL.x + aR.x) / 2, y: sy + (aL.y + aR.y) / 2 - H * 0.02 }
    : null;

  const stroke = (c: string, w: number) => ({ stroke: c, strokeWidth: w, strokeLinecap: 'round' as const });
  const legW = H * 0.085;
  const armW = H * 0.075;

  return (
    <g transform={`translate(${x},${y + breath * H * 0.008}) scale(${facing},1) rotate(${breath * 1.2})`}>
      {/* ground shadow */}
      <ellipse cx={0} cy={0} rx={H * 0.3} ry={H * 0.045} fill={`rgba(60,40,30,${shadowO})`} />
      {/* legs */}
      <line x1={-SHOULDER_W * 0.16} y1={-LEG - dropY} x2={-SHOULDER_W * 0.16 + lL.x} y2={-LEG - dropY + lL.y} {...stroke(pants, legW)} />
      {kneeR ? (
        <>
          <line x1={SHOULDER_W * 0.16} y1={-LEG - dropY} x2={SHOULDER_W * 0.16 + kneeR.x} y2={-LEG - dropY + kneeR.y} {...stroke(pants, legW)} />
          <line x1={SHOULDER_W * 0.16 + kneeR.x} y1={-LEG - dropY + kneeR.y} x2={SHOULDER_W * 0.16 + lRend.x} y2={-dropY + Math.max(-H * 0.02, -LEG - dropY + lR.y)} {...stroke(pants, legW)} />
        </>
      ) : (
        <line x1={SHOULDER_W * 0.16} y1={-LEG - dropY} x2={SHOULDER_W * 0.16 + lR.x} y2={-LEG - dropY + lR.y} {...stroke(pants, legW)} />
      )}
      {/* torso */}
      <rect x={-SHOULDER_W / 2} y={-(LEG + TORSO) - dropY} width={SHOULDER_W} height={TORSO + H * 0.05} rx={H * 0.09} fill={body} />
      {/* arms */}
      <line x1={-SHOULDER_W * 0.42} y1={sy + H * 0.05} x2={-SHOULDER_W * 0.42 + aL.x} y2={sy + H * 0.05 + aL.y} {...stroke(sleeve ?? body, armW)} />
      <line x1={SHOULDER_W * 0.42} y1={sy + H * 0.05} x2={SHOULDER_W * 0.42 + aR.x} y2={sy + H * 0.05 + aR.y} {...stroke(sleeve ?? body, armW)} />
      {/* hands */}
      {pose.cheer ? (
        <g transform={`translate(${SHOULDER_W * 0.42 + aR.x},${sy + H * 0.05 + aR.y})`}>
          <circle r={H * 0.055} fill={skin} />
          <line x1={-H * 0.02} y1={-H * 0.03} x2={-H * 0.05} y2={-H * 0.1} {...stroke(skin, H * 0.03)} />
          <line x1={H * 0.02} y1={-H * 0.03} x2={H * 0.05} y2={-H * 0.1} {...stroke(skin, H * 0.03)} />
        </g>
      ) : (
        <circle cx={SHOULDER_W * 0.42 + aR.x} cy={sy + H * 0.05 + aR.y} r={H * 0.05} fill={skin} />
      )}
      {!cradle && <circle cx={-SHOULDER_W * 0.42 + aL.x} cy={sy + H * 0.05 + aL.y} r={H * 0.05} fill={skin} />}
      {/* cradled bundle */}
      {bundle && (
        <g transform={`translate(${bundle.x},${bundle.y}) rotate(-12)`}>
          <rect x={-H * 0.17} y={-H * 0.09} width={H * 0.34} height={H * 0.18} rx={H * 0.09} fill="#f7f1e3" stroke="#e8dcc4" strokeWidth={3} />
          <circle cx={-H * 0.1} cy={0} r={H * 0.062} fill={skin} />
          <path d={`M ${-H * 0.15} ${-H * 0.02} A ${H * 0.07} ${H * 0.07} 0 0 1 ${-H * 0.05} ${-H * 0.055}`} fill="none" stroke={hair} strokeWidth={4} />
        </g>
      )}
      {/* head */}
      <g transform={`translate(0,${-(LEG + TORSO + HEAD * 0.9) - dropY})`}>
        <circle r={HEAD / 2} fill={skin} />
        {/* hair cap */}
        <path d={`M ${-HEAD / 2} 0 A ${HEAD / 2} ${HEAD / 2} 0 0 1 ${HEAD / 2} 0 L ${HEAD / 2} ${-HEAD * 0.08} A ${HEAD / 2} ${HEAD / 2} 0 0 0 ${-HEAD / 2} ${-HEAD * 0.08} Z`} fill={hair} />
        {/* eyes + smile (face toward +x of the figure) */}
        <circle cx={HEAD * 0.12} cy={HEAD * 0.02} r={HEAD * 0.045} fill="#2b2230" />
        <circle cx={HEAD * 0.3} cy={HEAD * 0.02} r={HEAD * 0.045} fill="#2b2230" />
        <path d={`M ${HEAD * 0.1} ${HEAD * 0.17} Q ${HEAD * 0.21} ${HEAD * 0.26} ${HEAD * 0.32} ${HEAD * 0.16}`} fill="none" stroke="#2b2230" strokeWidth={HEAD * 0.045} strokeLinecap="round" />
        {/* bow (daughter's identity mark) */}
        {bow && (
          <g transform={`translate(${-HEAD * 0.18},${-HEAD * 0.46})`}>
            <path d={`M 0 0 L ${-HEAD * 0.22} ${-HEAD * 0.12} L ${-HEAD * 0.2} ${HEAD * 0.12} Z`} fill={bow} />
            <path d={`M 0 0 L ${HEAD * 0.22} ${-HEAD * 0.12} L ${HEAD * 0.2} ${HEAD * 0.12} Z`} fill={bow} />
            <circle r={HEAD * 0.07} fill={bow} />
          </g>
        )}
      </g>
    </g>
  );
};

// Paper heart — the series' recurring motif.
export const PaperHeart: React.FC<{
  x: number;
  y: number;
  size: number;
  color?: string;
  beat?: number; // 0..1 pulse phase (0 = rest)
  opacity?: number;
  rotate?: number;
}> = ({ x, y, size, color = '#e8879f', beat = 0, opacity = 1, rotate = 0 }) => {
  const s = size * (1 + 0.16 * Math.sin(beat * Math.PI));
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${s / 100})`} opacity={opacity}>
      <path
        d="M 0 28 C -52 -8 -32 -52 0 -26 C 32 -52 52 -8 0 28 Z"
        fill={color}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={5}
      />
    </g>
  );
};

// Floating dust/paper motes — seeded, deterministic across renders.
export const Motes: React.FC<{
  seed?: number;
  count?: number;
  w: number;
  h: number;
  frame: number;
  color?: string;
}> = ({ seed = 7, count = 16, w, h, frame, color = 'rgba(214,164,102,0.5)' }) => {
  const rnd = (i: number, k: number) => {
    const v = Math.sin(seed * 999 + i * 37.7 + k * 11.3) * 10000;
    return v - Math.floor(v);
  };
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const bx = rnd(i, 1) * w;
        const by = rnd(i, 2) * h;
        const sp = 0.15 + rnd(i, 3) * 0.35;
        const ph = rnd(i, 4) * Math.PI * 2;
        const x = bx + Math.sin(frame * 0.008 * sp + ph) * 30;
        const y = by + Math.cos(frame * 0.006 * sp + ph * 1.7) * 22;
        const r = 2.5 + rnd(i, 5) * 4;
        return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.25 + rnd(i, 6) * 0.5} />;
      })}
    </g>
  );
};

// Memory paper — a pinned polaroid-ish card with a taped top edge.
export const MemoryPaper: React.FC<{
  w: number;
  h: number;
  rotate?: number;
  children: React.ReactNode;
}> = ({ w, h, rotate = 0, children }) => (
  <div
    style={{
      width: w,
      height: h,
      transform: `rotate(${rotate}deg)`,
      background: '#fffef7',
      borderRadius: 10,
      boxShadow: '0 18px 60px rgba(60,35,20,0.35), 0 2px 8px rgba(60,35,20,0.25)',
      border: '1px solid rgba(214,164,102,0.5)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* washi tape */}
    <div
      style={{
        position: 'absolute',
        top: -14,
        left: '50%',
        transform: 'translateX(-50%) rotate(-2deg)',
        width: w * 0.36,
        height: 34,
        background: 'rgba(245,215,110,0.85)',
        borderLeft: '2px dashed rgba(120,90,30,0.35)',
        borderRight: '2px dashed rgba(120,90,30,0.35)',
        zIndex: 5,
      }}
    />
    {children}
  </div>
);

// Hand-lettered style label used on memory papers.
export const PaperLabel: React.FC<{ text: string; color?: string; size?: number }> = ({ text, color = '#6b5844', size = 34 }) => (
  <div
    style={{
      fontFamily: FONT_DISPLAY,
      fontWeight: 600,
      fontSize: size,
      color,
      textAlign: 'center',
      letterSpacing: 1,
    }}
  >
    {text}
  </div>
);
