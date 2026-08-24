# short-15 · Emergence — "The Traffic Jam With No Cause"

A phantom traffic jam. No crash, no red light, no merge — 22 cars on a ring road, one
driver taps the brakes for a second, and a jam crystallises out of nothing and travels
*backward* through the traffic. Real experiment: Sugiyama et al. 2008.

**Why TSX wins here:** the content's native representation IS the drawing — a top-down
ring road with independently simulated cars. The motion cannot be keyframed: the jam is
*emergent*. We run a real intelligent-driver car-following model (Treiber IDM) so the
jam forms because the math forms it, not because we drew a blob. Same ethos as
`montyTrials`, Mercator, and velocity-Verlet orbit.

**New engine:** `lib/agents.tsx` — agent-based model. 22 cars, each following only the
car ahead. First time this channel renders mass independent motion.

## Fact base (verified before scripting — see `physics` in beats.json)

- Car-following model: **Intelligent Driver Model** (Treiber, Hennecke & Helbing 2000).
  Each car accelerates toward a desired speed, brakes to keep a safe gap that grows with
  speed and with closing rate.
- The trigger is tiny: **one car taps its brakes for ~1.2 s** (5.0–6.2 s in the sim),
  dipping from ~25 to ~16 m/s. Nothing else touches the traffic.
- The jam **travels backward** — against the direction of the cars. In our ring the
  slowest-car index walks 0 → 19 → 15 → 12 → 9 → 6 → 3 → 0 … i.e. upstream.
- Cars *inside* the jam crawl at ~16–18 m/s while cars away from it run ~19–20 m/s.
  The jam is a *wave*, not a place: each car passes through it and comes out the front.
- This is the **Sugiyama 2008** result: real drivers on a real circular road produced a
  stop-and-go wave with no bottleneck.

## Beat sheet (time | on screen | VO)

| time | on screen | VO |
|---|---|---|
| 0–4.9 | **HOOK** — ring road fully composed, 22 cars flowing, one car highlighted, the jam already faintly visible as a red cluster on the far side. Punch-in settles 1.05→1. | "There's a traffic jam on this road. Nothing caused it." |
| 4.9–13.6 | **SETUP** — the ring; every car just follows the one ahead. One car (highlighted) taps its brakes — a red pulse. | "No crash. No red light. Twenty-two drivers, each one just following the car in front." + "Watch this one. A single tap of the brakes." |
| 13.6–17.4 | **QUIZ** — PauseCard over the still-flowing ring. | "Pause. What do you think happens next?" |
| 17.4–29.6 | **REVEAL** — the ripple grows, cars behind the tapper bunch up, the red jam cluster forms — and it *moves backward* while every car keeps driving forward. Backward-wave arrow draws. | "The car behind brakes a little harder. Then the next one. The bunching grows into a jam. And the jam travels backward, against the traffic." |
| 29.6–40.7 | **TWIST** — chip: "each car passes through the jam and out the front." The jam is a wave, not a place. Live readout of cars-in-jam. | "Every driver escapes it. But the jam stays. It's a wave, and you are the water." |
| 40.7–42 | **LOOP** — chip + arrows fade, title fades back over the flowing ring → last frame == frame 0. NO CTA. | — |

## Production notes

- One persistent canvas: the ring road + cars live in ONE component across every beat;
  beats are `<Sequence>` overlays, not cuts to a new scene. Interior beats joined by
  `sceneCut()` (T07) — but NEVER across the frame-0↔last seam.
- `mode="pill"` captions (T08), `ShortsBackdrop` (T07), `brandSpring` entrances (T09),
  `GlowReveal` on the backward-wave arrow + the jam stat (T07).
- One source of truth: `lib/agents.tsx` runs the IDM and reports car positions/speeds
  per frame; the composition ONLY draws what the sim returns. The jam readout and the
  backward arrow are *measured* off the sim, never asserted.
- VO is kokoro (`.venv-voice312`) — real word times drive the pill captions.
