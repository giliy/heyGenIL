# The Photo on the Wall — vox-2 layered-collage rebuild (dad & daughter)

**Type:** vox layered-collage rebuild of Short13DadDaughter. Same story, same voice
(Edge-TTS, word-exact), same music/SFX mix — but every beat becomes a **painted
watercolor collage scene** instead of hand-coded TSX vectors.

- Format: 1080×1920 @30, 38s (1140 frames).
- **Visual language (locked):** soft watercolor storybook on warm cream paper; die-cut
  characters with sticker edge + soft shadow; a slow virtual camera; label chips; one
  serif headline per memory; film grain + vignette. Vox grammar — see `vox/DESIGN.md`.
- **Emotional engine (unchanged):** one framed photo holds a whole childhood — open on
  the payoff (the frame on the wall), rewind through 7 memories, land back on the photo
  as dad and grown daughter hang it *together*, then loop seamlessly.
- **Character consistency:** EVERY character prompt repeats the same style-lock phrase
  (see below) so the family reads as the same people across all 9 painted scenes.
- **Loop rule:** the hook wall scene and the payoff wall scene share the SAME painted
  wall-frame artwork + geometry; hook frame 0 == loop frame 1139.

## Style lock (repeat in EVERY image prompt)

> "Soft watercolor storybook illustration, warm cream paper, gentle washes and fine ink
> outlines, cozy and tender, warm light. Dad is a tall man in a rust-orange sweater with
> dark hair. His daughter is small with a sunny yellow bow in her hair. No text, no
> letters, no words, no watermark."

## Beat sheet → scenes

| # | Beat | VO frame (word start) | Scene |
|---|------|-----------------------|-------|
| 1 | hook | 0.4s f12 | **Wall** — framed photo (dad+daughter+heart) hangs in a warm hallway; label chip "ONE PHOTO". Camera slow push. |
| 2 | setup | 4.0s f120 | Title settles over the wall: "ONE PHOTO ON THE WALL" + subtitle "a dad. a daughter. a whole childhood." |
| 3 | beginning | 7.2s f216 | **Newborn** — dad cradles a swaddled bundle; chip "the beginning". Camera drifts. |
| 4 | steps | 11.2s f336 | **First steps** — dad kneels, arms out, small girl walking to him; chip "first steps". |
| 5 | bike | 15.2s f456 | **Bike** — small bike, scraped knees, dad steadying; chip "scraped knees". |
| 6 | storm | 19.2s f576 | **Storm** — umbrella held over her, rain; chip "quietly carried". |
| 7 | grad | 23.2s f696 | **Graduation** — cap in the air, dad cheering; chip "the sky clapped". |
| 8 | grown | 27.2s f816 | **Grown** — two adults, tea, sunset; chip "coffee stays hot". |
| 9 | payoff | 31.4s f942 | **Wall again** — grown daughter + dad hang the photo TOGETHER; heart; dissolve to frame 0. |

## Scene dissections (layers per scene + camera)

Camera journey: slow push on hook wall → pull back for title → a gentle dive through
each memory card (each memory is its own small paper board at a different x on the big
board, camera settles on each) → final push back to the wall at the same framing as
frame 0 for the loop. Board is oversized (wide); memories sit side-by-side horizontally
so the camera can travel left-to-right across them and come home.

### Scene 1 — WALL (hook + payoff, SHARED artwork, f0–f~1140)
- Layer: painted wall scene (framed photo of dad+daughter+heart in a warm hallway) —
  a full painted scene, NOT a die-cut (it is the board art). Centered ~540/960, ~900w.
- Chip: LabelChip "ONE PHOTO" (hook, f~40) → fade before payoff replaces it with
  "HIS WHOLE WORLD".
- Camera: push z 1.0→1.12 across the hook; settle back to 1.0 by f1139 for the loop.
- **Loop:** this scene persists under everything as the destination. Hook layers (chip,
  title) are short Sequences inside it; they must be fully gone/composed by f1139.

### Scene 2 — NEWBORN (f216–292)
- Layers: painted scene "dad cradling a swaddled newborn baby, warm nursery, watercolor"
  as a memory card (paper photo card ~760w with tape). Die-cut caption chip.
- Camera settles ~3s then moves on.

### Scene 3 — FIRST STEPS (f336–410)
- Card: "dad kneeling with arms outstretched, a small toddler taking first steps toward
  him".
- Chip "first steps".

### Scene 4 — BIKE (f456–536)
- Card: "small child on a little red bike with training wheels, dad steadying it,
  bandaged knee".
- Chip "scraped knees".

### Scene 5 — STORM (f576–669)
- Card: "dad holding a big umbrella over a small girl in the rain, warm light".
- Chip "quietly carried".

### Scene 6 — GRADUATION (f696–777)
- Card: "graduation cap tossed in the air, dad cheering, confetti".
- Chip "the sky clapped".

### Scene 7 — GROWN (f816–918)
- Card: "grown daughter and older dad side by side, two cups of tea, golden sunset".
- Chip "coffee stays hot".

### Scene 8 — PAYOFF (f942–1075)
- Back on the WALL scene. Grown daughter and dad (die-cut figures) stand in front of the
  wall hanging the photo together; heart accents. Title dissolves into the loop.
- Chip "HIS WHOLE WORLD".

## Annotations
- One serif headline per memory card (the caption line), with `backing` over the card
  (contrast rule — cards are busy watercolor).
- Small kicker chips (kicker="chapter 1..8") optional, sparse.

## Voice / audio
- Voice already generated (Edge-TTS, word-exact, `vo.gen.ts`). Mix (voice + lullaby
  music bed + 9 SFX) already assembled at `shorts/short-13-dad-daughter/voice/mix.wav`,
  38.000s. Re-mux onto the new render unchanged.
- Captions: word-exact from `vo.gen.ts` (import VO into the shot), driven by the actual
  timings — NOT the hand estimator.

## Production notes
- Layers → `media/projects/vox-2-dad-daughter/layers/` via `gen_image.py` (Gemini).
- Composition: `remotion/src/shots/vox-2/Vox2DadDaughter.tsx` + `npm run gen`.
- QA: frames at hook, every entrance, every camera arrival, loop end; READ each PNG;
  contrast rule checked; then full render + mux.
