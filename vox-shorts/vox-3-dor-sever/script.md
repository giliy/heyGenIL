# דור סבר — קיצורי הדרך הארוכים (vox-3 layered-collage, from user photos)

**Type:** vox layered-collage short built from 4 uploaded photos of the subject
(Dor Sever). Full Hebrew: on-screen text RTL + Hebrew voiceover (Edge-TTS
`he-IL-AvriNeural`, male, word-exact).

- Format: 1080×1920 @30, ~34s (~1020 frames).
- **The story (user brief):** "Dor Sever, a poor man that always tried to make short
  cuts but eventually ended up in the long way. A poor failure guy but a lesson for all
  of us — shortcuts will make you a dor sever." → Hebrew moral: קיצורי דרך יהפכו אותך
  לדור סבר.
- **Visual language (vox grammar — see `vox/DESIGN.md`):** a paper collage board, die-cut
  stickers with white sticker-edge + soft shadow, one full-bleed landscape background
  (the river where Dor stands), label chips, one big editorial headline per beat, film
  grain + vignette, a slow virtual camera.
- **Loop rule:** frame 0 == last frame (seamless). The final beat settles back onto the
  opening framing.

## Photo roles (assets already in `media/projects/vox-3-dor-sever/layers/`)

| file | size | role |
|------|------|------|
| `dor-02.png` (578×1024) | wide full-body by a river | **full-bleed BACKGROUND** layer — the landscape Dor lives in (cover the board at max zoom-out) |
| `dor-01-cut.png` (392×926) | thoughtful portrait, plants | **cutout sticker** — "the shortcut dreamer" |
| `dor-03-cut.png` (746×1096) | grinning close-up | **cutout sticker** — gag (the exam cheat) |
| `dor-04-cut.png` (1063×916) | mustache smile | **cutout sticker** — gag (the loan) |

## Beat sheet → VO (Hebrew) + scene

| # | Beat | VO (Hebrew) | Scene |
|---|------|-------------|-------|
| 1 | hook | "דור סבר תמיד חיפש קיצורי דרך." | Background river + title settles. Camera slow push. |
| 2 | meet | "זה דור סבר. איש עני, שתמיד ניסה לחסוך בדרך." | dor-01 cutout drops in. Chip "דור סבר". |
| 3 | gag-1 | "במקום להרוויח ביושר? הוא קנה לוטו." | dor-03 cutout (grin). Chip "הלוטו". |
| 4 | gag-2 | "במקום ללמוד למבחן? הוא סימן תשובות." | dor-03 close-up again or dor-04. Chip "המבחן". |
| 5 | gag-3 | "במקום לחסוך? הוא לקח הלוואה." | dor-04 cutout (mustache smile). Chip "ההלוואה". |
| 6 | moral | "כל קיצור דרך הוביל אותו לדרך הארוכה." | Camera pulls back to the river background. |
| 7 | punchline | "כי בסוף — קיצורי דרך יהפכו אותך לדור סבר." | Rubber stamp slams "קיצור דרך". Settle to frame 0. |

## Composition notes
- `remotion/src/shots/vox-3/Vox3DorSever.tsx`, `CollageBoard` camera over the board.
- Background `dor-02` sized to cover the board at the widest camera zoom-out (DESIGN.md
  rule #7 — QA the widest keyframe for seams).
- All text RTL: `rtl` on `LabelChip`, `SerifStatement`, `Captions` (Heebo font).
- `Captions` at bottom safe zone (`y` ≈ 1650, plate for contrast over the photo layers).
- Stamps: `RubberStamp` "קיצור דרך" (Hebrew, no uppercase transform effect).

## Production
- Voice: `python tools/gen_voice_edge.py --beats vox-shorts/vox-3-dor-sever/beats.json
  --voice he-IL-AvriNeural --emit-ts remotion/src/shots/vox-3/vo.gen.ts`.
- Music bed + library SFX via `/suggest-sfx` / `mix_music`.
- QA frames at phone scale, READ each (esp. widest camera per rule #7), then render + mux
  with explicit `-map 0:v:0 -map 1:a:0`.
