# The Photo on the Wall — dad & daughter short

**Sub-type:** fully-TSX storybook short, **no voice** (the user has no ElevenLabs key).
The story is told by on-screen caption lines — the standard `Captions` component is fed
hand-timed `VoLine`s, so every word still pops in sync with the beat it narrates.
No SFX / no music: silence is intentional (brand.md — "silence is part of the mix").

- Format: 1080×1920 @30, 38s (1140 frames).
- Emotional engine: **one framed photo holds a whole childhood** — open on the payoff
  (the frame on the wall), rewind through 7 memories, land back on the photo as dad and
  grown daughter hang it *together*, then loop seamlessly.
- Style: warm paper backdrop, one continuous "stage"; paper-cutout figures that never
  change identity (tall rust dad, small rose daughter with a yellow bow). New niche lib:
  `lib/people.tsx` (generic paper-doll family kit, reusable for any story series).
- **No engagement-CTA outro** (locked rule): end on the payoff, dissolve into the loop.

## Beat sheet

| # | Beat | Time | On screen | Caption line |
|---|------|------|-----------|--------------|
| 1 | hook | 0–3.5s | Wall with framed photo (dad + daughter + heart), warm | "One photo hangs in our hallway." |
| 2 | setup | 3.5–7s | The frame empties; title settles | "Ask my dad what's inside it…" |
| 3 | memory: newborn | 7–11s | Dad cradles a swaddled bundle | "…and he'll start at the beginning." |
| 4 | memory: steps | 11–15s | First steps — arms out, dad kneeling | "The day she walked to him." |
| 5 | memory: bike | 15–19s | Bike wobble, dad steadying | "The summer of scraped knees." |
| 6 | memory: storms | 19–23s | Umbrella, rain, held over her | "Every storm he quietly carried." |
| 7 | memory: cap toss | 23–27s | Graduation cap in the air, dad cheering | "The day the whole sky clapped." |
| 8 | memory: grown | 27–31s | Side by side, tea, sunset | "Now the coffee stays hot a little longer." |
| 9 | payoff + loop | 31–38s | Grown daughter hangs the photo WITH dad; heart beats; dissolve to frame 0 | "Ask him what's inside? His whole world." |

## Production notes

- **Continuity:** ONE stage component; memories are papers that pin onto a clothesline /
  swap inside a big "memory card". The hook frame and loop frame share geometry so
  frame 1140 == frame 0.
- **Captions:** `vo.gen.ts` is replaced by a hand-authored `lines.ts` (same `VoLine`
  shape) — words distributed by the kit's `timeWords` estimator.
- **QA:** frames at 0, every beat boundary ±, and 1139; check frame-0 composition,
  caption clearance (bottom 500px UI zone), and loop closure.
