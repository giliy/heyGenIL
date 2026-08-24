// lib/agents.tsx — agent-based engine: a ring of self-driving cars following the
// Intelligent Driver Model (Treiber, Hennecke & Helbing 2000). The first engine on
// this channel that renders MASS INDEPENDENT MOTION: a phantom jam crystallises out
// of one brake tap and travels backward through the traffic. Emergent, not keyframed.
//
// Determinism contract (CLAUDE.md): the sim is seeded and stepped off the FRAME, never
// the wall clock. advanceTo(frame) is idempotent — it integrates from a cached
// checkpoint up to the requested frame and no further, so re-rendering a frame gives
// the identical state. No Date.now(), no Math.random() after seeding.
//
// One-source-of-truth contract (IDEAS.md): the composition ONLY draws what
// advanceTo() returns. The jam cluster, the backward arrow and the stat chip are all
// measured off this state — never asserted.

// --- IDM parameters (the same set verified in the offline sweep) -------------------
export const IDM = {
  A: 1.5, // max acceleration m/s^2
  B: 2.0, // comfortable deceleration m/s^2
  V: 30.0, // desired speed m/s
  T: 1.5, // desired time headway s
  s0: 2.0, // minimum gap m
  carLen: 4.5, // m
} as const;

export const RING = {
  cars: 22,
  lengthM: 800, // closed ring, no merge / light / exit (Sugiyama 2008 setup)
  dt: 0.05, // integration step s
  fps: 30,
} as const;

// The single brake tap that is the ENTIRE cause of the jam.
export const TRIGGER = { car: 0, fromS: 5.0, toS: 6.2, brake: -4.5 } as const;

export type CarState = { x: number; v: number }; // x in metres along the ring
export type SimState = {
  t: number; // seconds
  cars: CarState[];
  // measured, not asserted:
  slowestIdx: number; // index of the slowest car (the walking jam)
  minV: number; // slowest speed
  maxV: number; // fastest speed
  jamSize: number; // how many cars are currently below the free-flow band
  jamCenterM: number; // ring-metre position of the slow cluster centroid
};

const FREE_BAND = 18.5; // m/s — cars slower than this count as "in the jam"

// Deterministic initial condition: uniform spacing + a tiny seeded speed jitter (the
// "phantom" seed). mulberry32 so the jitter is reproducible across every render.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const initialCars = (): CarState[] => {
  const rnd = mulberry32(7);
  const n = RING.cars;
  const gap = RING.lengthM / n;
  const cars: CarState[] = [];
  for (let i = 0; i < n; i++) {
    cars.push({ x: i * gap, v: IDM.V * 0.85 + (rnd() * 1.0 - 0.5) });
  }
  return cars;
};

const sStar = (v: number, dv: number) =>
  IDM.s0 + v * IDM.T + (v * dv) / (2 * Math.sqrt(IDM.A * IDM.B));

const accel = (v: number, gap: number, dv: number) =>
  IDM.A * (1 - Math.pow(v / IDM.V, 4) - Math.pow(sStar(v, dv) / Math.max(gap, 0.1), 2));

// --- frame-stepped integrator ------------------------------------------------------
// We integrate in whole IDM steps and cache the latest computed state; advanceTo(t)
// integrates forward from the cache to the requested time. Semi-implicit Euler:
// update v from the field, then x from the NEW v. Positions wrap mod ring length.
class RingSim {
  private t = 0;
  private cars: CarState[] = initialCars();

  private step() {
    const n = RING.cars;
    const L = RING.lengthM;
    const dt = RING.dt;
    const nextV = new Array<number>(n);
    const nextX = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; // leader
      let gap = (this.cars[j].x - this.cars[i].x) % L;
      if (gap < 0) gap += L;
      gap -= IDM.carLen;
      const dv = this.cars[i].v - this.cars[j].v;
      let a = accel(this.cars[i].v, gap, dv);
      if (i === TRIGGER.car && this.t >= TRIGGER.fromS && this.t <= TRIGGER.toS) {
        a = TRIGGER.brake;
      }
      nextV[i] = Math.max(0, this.cars[i].v + a * dt);
      nextX[i] = (this.cars[i].x + nextV[i] * dt) % L;
    }
    for (let i = 0; i < n; i++) {
      this.cars[i] = { x: nextX[i], v: nextV[i] };
    }
    this.t += dt;
  }

  // Advance (only ever forward) to absolute time tSec and return a measured snapshot.
  advanceTo(tSec: number): SimState {
    while (this.t < tSec - 1e-9) this.step();
    return this.measure();
  }

  private measure(): SimState {
    const n = RING.cars;
    let slowestIdx = 0;
    let minV = Infinity;
    let maxV = -Infinity;
    let jamSize = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      const v = this.cars[i].v;
      if (v < minV) {
        minV = v;
        slowestIdx = i;
      }
      if (v > maxV) maxV = v;
      if (v < FREE_BAND) jamSize++;
      // circular centroid of the slow cluster (angle on the ring)
      const ang = (this.cars[i].x / RING.lengthM) * Math.PI * 2;
      const w = v < FREE_BAND ? 1 : 0.05; // weight slow cars heavily
      sx += Math.cos(ang) * w;
      sy += Math.sin(ang) * w;
    }
    const jamCenterM =
      ((Math.atan2(sy, sx) / (Math.PI * 2)) * RING.lengthM + RING.lengthM) % RING.lengthM;
    return { t: this.t, cars: this.cars.map((c) => ({ ...c })), slowestIdx, minV, maxV, jamSize, jamCenterM };
  }
}

// One module-level sim per render worker. Remotion re-instantiates the bundle per
// frame in some modes, so the sim is rebuilt and advanced deterministically each time
// — idempotent by construction (always integrates 0 -> frame, seeded identically).
let _sim: RingSim | null = null;
const sim = () => (_sim ??= new RingSim());

// Public API: the state of the ring at absolute second tSec.
export const ringAt = (tSec: number): SimState => sim().advanceTo(Math.max(0, tSec));

// --- drawing helpers (pure; map ring metres -> screen) -----------------------------
// Ring road as a circle on the canvas. metreToPoint maps a ring position to an (x,y)
// on a circle of radius r centred (cx,cy), angle 0 at 12 o'clock, clockwise forward.
export const metreToPoint = (m: number, cx: number, cy: number, r: number) => {
  const ang = (m / RING.lengthM) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), ang };
};

// Colour a car by speed: free-flow teal -> slowing warn -> jammed danger pink.
export const speedColor = (v: number, free: string, slow: string, jam: string) => {
  if (v >= FREE_BAND) return free;
  if (v >= 16.5) return slow;
  return jam;
};
