# Brand — the house style the example shorts ship with

> Style contract for every short this repo produces. The skills (make-short, vidtsx-2d-generator,
> suggest-sfx) read this file so all videos feel like one channel. **This is the look the 12 example
> shorts were built in — keep it, tweak it, or replace it wholesale with your own brand. If you
> change it, also update `remotion/src/brand.ts` (the same palette, as code).**

## 1. Identity & voice

- **Positioning:** modern **AI-studio** aesthetic — light, airy, whitespace, soft depth, tasteful
  motion. Reference polish: **Linear / Vercel / Anthropic**. Premium and calm, never loud or cluttered.
- **Voice:** direct, confident, no hype-filler. On-screen text avoids em-dashes.
- **Energy:** clean and premium, not MrBeast-loud. Motion is *tasteful*, not bouncy/cartoonish.
  (No hard offset shadows, thick black borders, or sticker-pop "Memphis" looks.)

## 2. Color palette (exact hex)

| Role | Name | Hex | Use in video |
|---|---|---|---|
| **Primary accent** | indigo | `#6366F1` | key words, highlights, active state, progress |
| Secondary accent | violet | `#9b7cc4` | pairs with indigo in gradients, secondary emphasis |
| Success / positive | teal | `#4db8a8` | "free", confirms, checkmarks, positive callouts |
| Success alt | green | `#4ecdc4` | teal companion for gradients/success |
| Warn / attention | yellow | `#f5d76e` | highlight sweeps, "watch this", attention pops |
| Danger / contrast | pink | `#e8879f` | errors, "the hard/expensive way", negative contrast |
| Ink (text/dark) | ink | `#1a1a2e` | primary text on light; base dark bg |
| Muted text | muted | `#6b6b7b` | secondary text, captions |
| Surface (paper) | paper | `#fffef7` | light full-screen bg, cards |
| Surface 2 (cream) | cream | `#faf8f5` | alt light band |

**Dark UI / terminal scale** (GitHub-ink — for terminal & code mockups):
`#0d1117` (bg) · `#161b22` (panel) · `#30363d` (border) · `#8b949e` (dim text) · `#c9d1d9` (text).

**Signature gradient:** indigo → violet → teal (`#6366F1 → #9b7cc4 → #4db8a8`). Used for dividers and
full-screen animated backgrounds.

## 3. Typography (3-font system)

| Role | Font | Weights | Use |
|---|---|---|---|
| **Display / headlines** | **Space Grotesk** | 500 / 600 / 700 | titles, big statements, kickers |
| **Body / UI** | **Inter** | 400 / 500 / 600 | subtitles, labels, captions |
| **Code / mono** | **JetBrains Mono** | 400 / 500 / 700 | terminal mockups, code, stats, tech labels |

All three load from `@remotion/google-fonts` (see `remotion/src/fonts.ts`) — nothing to install.
Headlines tight tracking; body normal; mono for anything literally code/terminal/numbers.

**Hebrew captions:** default to **ktiv maleh (no nikkud)** — `stripNikkud()` in
`remotion/src/lib/shorts.tsx` removes U+0591–U+05C7 at the caption boundary. Use nikkud only for
liturgy or children's content; if used, bump caption lineHeight to ~1.5 so the points don't clip.

## 4. Shape & depth

- **Radius:** ~14px (cards/panels), pills fully rounded. Terminal/code windows: ~10px with a title bar.
- **Depth:** soft shadows (e.g. `0 8px 32px rgba(0,0,0,.10)`), 1px light borders. Airy.
- **Never:** hard offset shadows (`4px 4px 0 #000`), 3px black borders, sticker/pop look.
- **Window chrome** (browser/terminal mockups): rounded panel, top bar with 3 traffic-light dots
  + a mono label; content on the dark ink scale.

## 5. Motion language — calm & premium

- **Entrances:** fade + rise. `opacity 0→1` and `translateY 24px→0` over ~7 frames at the shorts'
  30fps, ease-out (or spring: damping 200, mass 0.8, stiffness 120). No overshoot, no bounce.
- **Exits:** fade + fall, a bit faster than entrances.
- **Emphasis:** indigo highlight/underline wipe behind a key word; scale pop max 1.03–1.06.
- **Stagger:** 3–4 frames between list items / lines.
- **Backgrounds:** slow drifting indigo/violet/teal gradient blobs + a faint dotted grid, 8–20s loops.
- **Feel:** premium, restrained, "Linear/Anthropic." No spins, no elastic, no hard snaps.

### mode:"kids" — the declared exception (Hebrew children's shorts)

Like `mode:"ad"`, a short/project may declare `mode:"kids"` (in beats.json / character.json) to
override specific defaults above. Everything not listed here still applies. Research basis:
`research/hebrew-kids/` (esp. `01-character-appeal.md`, `07-hebrew-language-kids.md`).

- **Motion:** gentle squash-and-stretch, soft overshoot, and sticker-pop entrances ARE allowed —
  the default "no bounce" rule is lifted for kids. Keep it warm and slow: overshoot ≤ ~8%, no
  dizzying spins, no hard snap cuts faster than ~10s (calm pacing is the differentiator).
- **Typography:** nikkud ON (the brand.md:48-50 children's exception) — bump caption lineHeight
  to ~1.5 so the points don't clip. Use Heebo/Rubik from `media/library/fonts`, not the EN fonts.
- **Color:** the warm brand palette still grounds it, but the CHARACTER's saturated body color
  (e.g. bu-koala yellow) leads key moments; brighter/cheerier than the premium default is fine.
- **Sound:** playful/cartoon SFX (boing, pop, giggle, toy, sparkle) are allowed and expected —
  sourced from the kids ids in `media/library/sfx/palette.json`. Still under the voice, never loud.
- **Structure (hard rules, not style):** hook <2s with the face filling frame; repetition ≥3×;
  call-and-response with a genuine 2–4s pause; one idea resolved warmly; seamless loop
  (frame-0 == last-frame); NO CTA outro; parent-safe (no startling cuts, no mean humor).
- **Voice:** Hebrew edge-tts `he-IL-HilaNeural` warmed to motherese (`--rate -8% --pitch +4Hz`);
  see the make-short Hebrew routing note.

## 6. Delivery specs (shorts)

- **Canvas:** 1080×1920 (vertical), **30 fps**, ~38–42s.
- **Safe areas:** captions block centered ~y1500; nothing critical in the bottom 340px (YouTube UI)
  or the right 160px (like/share rail). Keep text ≥ 5% from edges.
- **Frame 0 is the thumbnail** — fully composed, payoff visible, no fade-from-black.

## 7. Sound design — SFX

Same energy as the motion: **calm/premium, felt-not-heard.** SFX are seasoning on the edit, never
the show. Choose every cue by its FUNCTION (3+1 foundational sounds do the heavy lifting):

| Function | Sound | Its job | Calm sub-types |
|---|---|---|---|
| **Motion** | whoosh | direction/speed; carry one beat into the next | `whoosh-soft`, `whoosh-wind` |
| **Tension** | riser | "something is coming"; hold before a reveal | `riser-soft` (NO cymbal-urgency) |
| **Emphasis** | impact / pop | "this moment matters"; lands on the reveal | `impact-soft`, `impact-deep-soft`, `pop-reveal` |
| **Snap** | click | small, satisfying, alive | `ui-click-soft`, `ui-toggle-on`, `ui-send` |

Plus extras like `page-flip` (storybook) and `chime-reward` (the gift moment).

- **Under the voice, always.** Quiet, tasteful, never louder than the narration. Silence is part of
  the mix; never wall-to-wall.
- **Layer the big moments (build-and-drop):** riser → impact on a scripted reveal, whoosh → pop on a
  cut. A layer is two events at the same/adjacent `at_s`. Reserve for the 2–3 hero beats.
- **Density:** score key transitions, reveals, and one-gesture click-sequences — not every sub-frame.
  Everything genuinely deniable is `"optional": true`.
- **Sync to the VISUAL beat and often the exact word.** Off-by-100ms reads as sloppy — use real frame
  and word times, never guesses.
- **Levels.** Library clips are normalized to ~−20 LUFS with a −1.5 dBFS peak ceiling, so per-cue
  `gain_db` is perceptually meaningful. **Shorts calibration:** under a short's near-continuous
  narration a conservative gain table runs 4–8 dB too quiet — start at transitions/whooshes **−3**,
  story pops/impacts **0..+3**, stamps/snaps **0..+7**, layered-hero risers **0..+2**.
- **No static/glitch textures under narration** — they read as NOISE over the voice at any gain.
  Error/delete moments during speech get silence or one clean mechanical snap; save glitch textures
  for gaps where the voice is silent.
- **Diegetic action sounds are the content** in a fully-synthetic short (piece thocks, digit pops) and
  may exceed long-form density.
- **Source.** **Recorded-first.** Professional recorded clips (Sonniss GDC, Kenney, soundcn,
  Freesound-CC0 — imported by `tools/import_sfx.py`, kept in the catalog) are the default;
  ElevenLabs text-to-sfx is the long-tail fallback for sounds the library genuinely lacks
  (AI one-shots read synthetic/childish next to performed foley). Two license tiers: CC0/MIT
  clips commit to `clips/`; Sonniss/99Sounds (no raw redistribution) stay in the gitignored
  `pro/` dir, fetched per-machine by `tools/fetch_pro_sfx.py`. Every clip's `source` +
  `license` is recorded in the catalog. See `docs/sfx-sources.md`.
- **Character.** Premium = **short, dry, transient-clean.** Taps/clicks 80–150ms, whooshes
  300–1000ms; no wet/ringy tails (reverb is the cartoon tell). On import every clip is
  trimmed to the transient, high-passed at 80 Hz, de-harshed 3–6 kHz, limited to the ceiling.
- **Library is the durable asset** — shared, cross-project at `media/library/sfx/` (`catalog.json` +
  `clips/`), seeded from `palette.json`. It grows with every video; reuse before generating.
