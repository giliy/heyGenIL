# 02 — Animation / Graphics / Render Visual Quality

**Area:** raising the visual bar of both tracks (Track A ads, Track B kids/reading) to
"indistinguishable from professionally-produced Israeli social ads and high-end kids content."

**Method:** audited the full current visual stack (brand.md, lib/shorts.tsx, lib/ads.tsx,
lib/reading.tsx, lib/reading-render.tsx, lib/collage.tsx, lib/story.tsx, lib/kinetic.tsx,
lib/polish.tsx, lib/motion.tsx, lib/lottie.tsx, the make-short/make-ad/make-reading-short/
vidtsx-2d-generator skills, render-all.mjs, ffw.py, gen_image/gen_clip/gen_vox2_layers), read the
existing research it must build on (hebrew-kids/01,02,04,06,08; hebrew-reading/02), then did web
research on pro motion design, Remotion technique, kids character animation, Hebrew typography,
and delivery encoding. Every web claim is flagged; anything I could not verify is marked
**UNVERIFIED** in the proposals.

---

## 1. Current state — what the visual stack actually is

### 1.1 The house look (brand.md + lib/shorts.tsx)
- **Positioning:** clean AI-studio — Linear / Vercel / Anthropic. Light, airy, whitespace, soft depth,
  tasteful motion. Palette = indigo `#6366F1` → violet `#9b7cc4` → teal `#4db8a8` on paper/ink.
- **Motion language (brand.md §5):** entrances = fade + rise (`opacity 0→1`, `translateY 24px→0` over
  ~7 frames at 30fps, ease-out or the brand spring). **`brandSpring` = damping 200, mass 0.8,
  stiffness 120, overshootClamped:true** — deliberately NO overshoot, NO bounce. Stagger = 3–4 frames
  between list items. Emphasis = indigo underline wipe + scale pop max 1.03–1.06. Backdrops = slow
  drifting gradient blobs + faint dotted grid + vignette.
- **kids mode:** the declared exception — gentle squash-and-stretch, soft overshoot, sticker-pop
  allowed; overshoot ≤ ~8%; no dizzying spins; calm pacing (<10s scene cuts); nikkud on; warm palette.
- **Captions:** `CaptionsPop` (fade+scale word-pop) and `CaptionsPill` (TikTok karaoke pill, via
  `@remotion/captions`), plus a newer `kinetic.tsx` (per-word spring with a gentle overshoot).
- **Ads (lib/ads.tsx):** punchier `AD_POP = 1.14` scale, PriceBadge, WhatsApp CTA end card, bidi-safe
  ₪/phone/%. RTL throughout.
- **Reading (lib/reading.tsx + reading-render.tsx):** the **in-TSX koala** = a single static SVG
  (circles for ears/head/eyes/nose + a smile path), plus huge pointed nikkud `GraphemeTile`/`SyllableTile`
  with exact-sync color+scale pop. Warm indigo/violet backdrop.

### 1.2 What pro-motion machinery ALREADY exists (don't rebuild — reuse)
The repo is far ahead of a naive TSX generator. Already built and deterministic:
- **`spring()`** everywhere, with the no-overshoot brand config.
- **`polish.tsx`** — `<Grain>` (deterministic per-frame film grain via `@remotion/noise`), a rich
  `<ShortsBackdrop>` (drifting mesh blobs + grid + vignette + grain), `SceneTransition` (spring-timed
  film-burn / dreamy-zoom / fade), `GlowReveal` (WebGL glow with CSS fallback).
- **`kinetic.tsx`** — kinetic word-entrance with a controlled overshoot curve.
- **`motion.tsx`** — `<DrawOn>` (path stroke draw-on), `<Morph>` (path morph), `moveAlongPath`.
- **`lottie.tsx`** — a **frame-exact** Lottie wrapper (`goToAndStop` per frame, deterministic). This is
  the key asset for richer animation: it already solves deterministic playback.
- **`collage.tsx`** (vox) — layered paper-collage with a **parallax virtual camera**, torn-paper layers,
  cutouts (via `cutout.py` + `gen_vox2_layers.py`). A real puppet-ish layer engine exists.
- **`story.tsx`** — Ken-Burns over full-bleed AI stills (proven on `short-7-kids`).
- **Encoding:** `render-all.mjs` → h264, **CRF 21**, yuv420p, 30fps; `ffw.py` resolves a full ffmpeg.

**Gap diagnosis in one line:** the stack is *technically* pro (all the right primitives exist) but the
*shots* under-use them — most ads/shorts render a flat dark stage + big type + word-pop, with little
micro-motion, no 3D-lite, no parallax, no real typography flourish, and the reading koala is a static
circle-face. The biggest visual wins are (a) *using* what exists with pro choreography, (b) closing the
specific gaps below, not building new engines.

---

## 2. What separates pro motion graphics from ours (research-grounded)

### 2.1 Timing / easing — the single highest-leverage fix
Concrete, sourced numbers (Clay "Motion Design Principles", Figma "Principles in Motion"):
- **Durations should be distance-scaled, not arbitrary:** ~120–160ms for micro feedback; **200–240ms
  for short translations** (chips, captions, pills); 300–400ms for full-screen transitions. Clamp between
  ~160–420ms. **Ours animates captions over ~0.14s (~4–7 frames at 30fps ≈ 133–233ms) — already in the
  right band**; BigTitle/StatChip use 12–14 frames (~400–470ms) — at the top end, fine.
- **Ease-out to ENTER (fast start, soft landing); ease-in to EXIT.** Ours uses ease-out for both
  entrances and (via prog) a symmetric-ish exit — **exits should get ease-in**, a cheap, high-visibility fix.
- **Stagger by ~80ms** to communicate grouping (ours: 3–4 frames = 100–133ms — close; good).
- **Arcs over straight lines** — the eye tracks curved paths better than linear ones. Ours does pure
  `translateY` rises; a slight arc (add a small x-drift during the rise) reads more pro.
- **Follow-through / overlapping action** — secondary motion that continues after the main motion stops
  (e.g. a highlight underline that overshoots then settles; a shadow that trails the pop). This is the
  "settle" step most flat TSX shots skip — the payoff feels mechanical because nothing settles.
- **Limit concurrency:** ≤3 authored animations per viewport, total active duration per animation
  ≤ ~800ms. And the Figma team's "do/don't" shorthands are a useful self-audit: **"feels floaty"
  (lacks weight/physics) and "too linear" (mechanical) are the two amateur tells** — both are real
  risks in our current ease-out-everything + linear-translatey approach.
- **Avoid gratuitous motion:** "If it's just moving, you're adding a filter." Motion must encode intent.

### 2.2 Remotion-specific cheap wins (frame-based, deterministic)
- **`spring()` over `interpolate()` for entrances** — already done; the win is *config*: for the kids
  mode, an underdamped spring (lower damping, `overshootClamping:false`) gives the allowed gentle
  overshoot with zero extra code.
- **Arithmetic on springs** (the docs' "enter − exit" pattern) to build seamless loop entrances/exits —
  exactly the seam the repo already cares about (frame-0 == last-frame).
- **`@remotion/transitions`** — already wrapped in `polish.tsx` (`SceneTransition`/`sceneCut`). Using
  spring-timed interior cuts (film-burn for topic cuts, dreamy-zoom for soft beats) instantly raises the
  "edited by a human" feel. **Adopt in ads/shorts scenes**; keep it OUT of the reading track (calm pacing
  is the differentiator there, brand kids rule).
- **Audio-reactive** (`@remotion/media-utils`: `useAudioData` + `visualizeAudio`) — a *cheap* way to make
  an element pulse/scale with the music bed or SFX. For ads this reads "professionally timed"; for kids
  it reads "alive." Deterministic per frame. Low risk. **UNVERIFIED for how clean the waveform is on
  Hebrew voice vs music — validate on a test render.**
- **Parallax layers** — the collage engine already proves the camera technique; a 2-layer parallax
  (foreground blob/card vs background mesh) on ads/shorts adds depth cheaply. Figma warns parallax must
  be subtle ("very subtle or none") — keep drift tiny.

### 2.3 Motion blur / Trail — where it helps and where it costs
- **`@remotion/motion-blur` `<Trail>`** (layers / lagInFrames / trailOpacity) duplicates its children N×
  per frame — **expensive** (layers=50 → 50 renders/frame). For a 40s full-frame short this is a heavy
  render-cost multiplier; only worth it on a *small* hero element (a logo, a word, a character) for a
  few frames, not the whole canvas.
- **Recommendation:** use Trail as a **micro-accent** (e.g. the PriceBadge stamp, the CTA arrow), not a
  global filter. The repo's `render-all.mjs` renders with concurrency 75% and has already hit timeout
  cliffs at 4K — a global Trail would be the fastest way to reintroduce render starvation.
- Simpler motion-blur feel without cost: **CSS blur that resolves on motion stop** (already used in the
  pill word-entrance) + a trailing `box-shadow`/drop-shadow. Good enough for most type moves.

### 2.4 3D-lite / liquid-text (the "wow" that separates premium)
- **CSS 3D-lite (perspective + rotateX/rotateY on cards/type, no three.js)** is a big free visual jump for
  ads — a price badge or headline that tilts in on a subtle `perspective(1000px)` reads "designed."
  Fully frame-based, deterministic, cheap. vidtsx-2d-generator explicitly scopes OUT `@remotion/three`,
  so stay with CSS transforms.
- **Liquid / gradient text:** animated indigo→violet→teal gradient on a headline word (background-clip:
  text) is already on-brand (the signature gradient) and cheap. Use sparingly on the hero word/price.
- **Layered shadows for depth** (two soft shadows: tight + wide) — the collage `PAPER_LIFT` pattern; the
  flat shorts backdrop currently has only one shadow level. Reuse the technique for cards/CTA.

---

## 3. KIDS track — the character question (the highest-stakes call)

### 3.1 Audit: the in-TSX koala vs the research bar
The reading koala (`KoalaTile` in reading-render.tsx) is a **static SVG of circles**: two ears, a round
head, a cream face, two dark glossy eyes, a nose ellipse, a smile path, two blush circles. It is NOT
animated — it sits still while the pointed tiles pop.

The repo's own character research (hebrew-kids/01 + 06 + 08) sets a much higher bar for "a character kids
LOVE": **baby-schema proportions** (head ≈ ⅓–½ of total height, huge low-set eyes, chubby cheeks, stubby
limbs), **"cute but a little weird"** (one exaggerated signature feature — buck teeth, a tuft, an antenna),
**mischievous-but-kind personality**, **vulnerability**, a **signature catchphrase + gesture**, and a
**recognizable saturated color identity**. It also flags the current market opportunity precisely because
incumbents (TopKids, Tzofi) are **low-budget / enthusiast-grade** — a premium character is the moat.

**Verdict: a static circle-koala does NOT clear that bar.** It reads as clip-art, not a character — it has
no personality axis, no motion, no signature feature, and it's a generic koala (a "look," not a "position").
For a paid kids product this is the single weakest pixel in the whole pipeline. BUT — the fix does not
require AI video.

### 3.2 The cheapest path to a character kids love — ranked
The repo already has every tool needed; the gap is *rigging/motion*, not *rendering*.

**Path A — Upgrade the in-TSX koala to a multi-layer, squash-and-stretch SVG "puppet" ($0, S effort).**
Turn the single static SVG into a component with separable parts (head, ears, eyes with a blink timer,
mouth states for happy/sad/surprised, a signature tuft, little arms/paws) and drive gentle
squash-and-stretch + overshoot from `useCurrentFrame()` (allowed by brand kids mode). This is the
**cheapest** way to make the existing character feel alive, and it stays 100% deterministic + free.
- **Effort:** S–M. **Payoff:** large for kids (a koala that blinks, bounces, and reacts on the reward beat
  is a *different product* from a static face). **Limit:** still a simple shape — won't match a
  hand-illustrated mascot's appeal ceiling.
- This also directly serves the reading track's **call-and-response** beat: the koala can visibly
  "celebrate" (bounce ×3, per the Bu/Shfofon signature-gesture pattern) when the child would answer.

**Path B — a locked illustrated mascot via layered AI stills + cutout/puppet motion (cheap → mid, M effort).**
The repo already has the exact machinery: `gen_image.py --ref` for a **locked character reference**
(the 06/08 iron rule: never regenerate from text), `cutout.py` for die-cut layers, and the
`collage.tsx` parallax/puppet layer engine (proven on vox-2-dad-daughter). The play:
1. One paid, human-approved `character.png` (per 06/08) — the **only** paid pixel.
2. Generate a small set of pose/expression stills off that reference.
3. Cutout into layers; rig them in a `collage.tsx`-style puppet (head/eyes/arms as separately-moving
   cutout layers) OR Ken-Burns (`story.tsx`) between beats.
- **Payoff:** a *true* mascot with real appeal (baby-schema + signature feature + saturated color), which
  is what the market research says wins. **Effort M.** **Cost ~$0.01–0.20 one-time** (1–5 Gemini images).
- This is the "best-value" middle path and the one the repo is structurally best positioned for.

**Path C — Lottie character ($0, M effort).** The `lottie.tsx` wrapper already does **frame-exact
deterministic** playback — Lottie is the *right* format for Remotion (unlike Rive, below). Two sub-options:
- Curate existing LottieFiles kid characters (Lottie Simple License) into `media/library/lottie/` — free
  but generic characters (not your brand, not Hebrew-native, hard to lock as an original mascot).
- Commission/author a custom Lottie character — the only paid option that keeps a unique mascot, but
  authoring a good character rig in After Effects/Bodymovin is real effort and not self-hostable-design.
- **Best use:** *augment* Path A/B with Lottie *accents* (confetti, sparkle, reward pops) — not the mascot
  itself.

**Path D — generative AI video character (make-ai-short, paid ~$2–3/short).** The `character.json` lock
is proven. Gives true limb motion + the strongest consistency story, at real per-render cost (~$0.29/5s
clip + re-roll risk + ElevenLabs-Hebrew-only voice). Per 04-pipeline-fit this is the "premium" option —
**reserve it for hero/pilot episodes, not the default**, because the reading track's whole pitch is
**$0 and free/self-hostable**.

### 3.3 Why NOT Rive (honest negative finding)
Rive is a beautiful tool, but it is **a poor fit for this repo's render model**. The repo's QA is
strictly **frame-deterministic** (`useCurrentFrame` drives everything; `goToAndStop` on Lottie). Rive's
runtime is **state-machine / interactive-driven** and I could find **no official or mature Remotion
integration** (only Angular / React-Native runtimes; no frame-exact seek path surfaced in research). Wiring
a state-machine animation into a headless frame-exact render is a determinism risk the repo has
systematically engineered *against*. **Do not adopt Rive here.** **UNVERIFIED** that no community bridge
exists — I found none, but did not exhaustively search npm.

### 3.4 Nikkud legibility at tile size — already solved, just keep the QA gate
hebrew-reading/02 establishes: **Rubik 700/900 is pointed-safe** (explicit OpenType mark positioning by
Meir Sadan, zero nikkud bug reports), Heebo is Hebrew-primary and fine for grade-school nikkud, and **no
new display font is needed for the reading tiles** — the classic book faces (SBL Hebrew, Frank-Rühl CLM,
Keter YG) are for dense vocalized prose, worse than a big heavy Rubik for one huge on-screen grapheme.
The per-mark pixel QA gate (read-0-test) + `lineHeight 1.5` already enforce it. **Do not churn the
reading font.** The one real trap to keep in mind: חולם-over-ש collision and קמץ קטן disambiguation — a
curriculum/content matter, not a font fix (already flagged in 02 §D).

---

## 4. HEBREW typography at pro level

### 4.1 Display fonts: Heebo/Rubik are correct for reading; ADS can go bolder
- **Reading/kids:** keep Rubik-900 (tiles) + Heebo (body). Verified pointed-safe; don't touch.
- **Ads/shorts (the "clean AI-studio" look):** Heebo is a competent neutral sans but **has no
  character** — for headlines that need presence, several **free (OFL) Hebrew display faces exist and are
  verified** (via google/fonts METADATA):
  - **Frank Ruhl Libre** — a **variable serif** (wght 300–900, `FrankRuhlLibre[wght].ttf`, Hebrew subset,
    OFL, by Yanek Iontef). An editorial serif headline (Publico-ish) instantly reads "premium brand" on an
    ad — the strongest display upgrade for the ad end card / hook. **Variable** = one file, many weights.
  - **Karantina** — a condensed **display** face (Light/Regular/Bold, Hebrew, OFL, Rony Koch). Bold
    condensed Hebrew = high-contrast poster energy for offers.
  - **Secular One** — a geometric-ish display sans (Hebrew-primary, OFL, Michal Sahar). Cleaner/bolder
    than Heebo for big statements.
  - **Varela Round** — a rounded sans (Hebrew, OFL). **Warm/kid-friendly** — a better headline for the
    kids/reading track than Heebo if you want roundness to echo the character.
- All four are free and can be vendored offline the same way Heebo/Rubik are (woff2 into
  `media/library/fonts/`, @font-face in `fontFaces.tsx`). **Effort S, cost $0.**
- **Recommendation:** add Frank Ruhl Libre (variable) for the ad track's premium/editorial moments and
  Varela Round for kids headlines. Keep Rubik/Heebo as the captions/body workhorses and the reading tiles.

### 4.2 Nikkud / RTL caption animation — the repo is already best-in-class
- The RTL caption machinery (`direction:rtl`, `unicodeBidi:isolate`, `anchorRtl`/RLM, `stripNikkud`,
  bidi-safe ₪/phone in ads.tsx) is **production-proven** (short-16-formy shipped). Do not re-derive.
- **Word-by-word highlight / karaoke:** `CaptionsPill` (via `@remotion/captions`) + the reading track's
  **per-grapheme** `units[]` highlight (color + scale pop, never color alone — per SLS/PlanetRead
  research in hebrew-reading/02 §C) is exactly the right pattern. The reading track already colors the
  active grapheme in exact sync with the spoken unit — that IS pro-level karaoke, one level finer than
  most content.
- **One upgrade worth doing:** give the active caption word a **settle** (a tiny overshoot then lock) and
  a gradient/highlight "sweep" rather than a hard pill swap — the pill snap is the one place the captions
  can still read as "template." Small, free.

---

## 5. RENDER / POST polish + delivery encoding

### 5.1 What's already there and what's missing
- **Present:** vignette (in `ShortsBackdrop`), deterministic film grain (`polish.tsx <Grain>` — but the
  *flat* `ShortsBackdrop` in shorts.tsx used by most ads/shorts has NO grain/mesh), glow reveal, scene
  transitions, drop-shadows. **The rich backdrop exists but is opt-in and under-used** — most shots use
  the flat radial-gradient version.
- **Missing (free, high-value):** an actual **color grade** pass (a subtle teal-shadow / warm-highlight
  split-tone or a gentle contrast+lift), a **top-and-bottom letterbox/vignette** to seat phone UI, and a
  consistent **post grain+grade** applied at the composition root rather than per-shot.

### 5.2 Frame rate: stay at 30, don't chase 60
For this content (speech-driven type, gentle motion, phone delivery) **30fps is correct** — it matches the
repo's whole timing model (7-frame entrances, 4-frame staggers) and YouTube/Shorts handle 30 fine. 60fps
doubles render cost and buys nothing for calm type animation; it only matters for fast camera moves we
don't do. **Keep 30.** (No source needed; standard for Shorts/Reels is 30.)

### 5.3 Delivery encoding — one concrete, verified win
- `render-all.mjs` renders at **CRF 21**. Remotion's own encoding docs say **high-quality social output
  = CRF 18 or below** (range 1–51, lower = better). **Dropping CRF 21 → 18 is a free, deterministic
  quality win** at a modest file-size cost. Keep `yuv420p` (phone compatibility), H.264 (fast, universal),
  30fps.
- **Bitrate:** for 1080×1920 motion graphics, ~6–12 Mbps H.264 is ample; CRF-based (not CBR) is fine —
  social platforms re-encode anyway, so over-bitrating wastes size. No change needed beyond CRF.
- **Hardware-acceleration caveat** (Remotion docs): if you enable HW acceleration you cannot set CRF —
  keep CRF and software encoding for consistency (the repo pins the Chrome shell for identical
  rasterization; HW-encode would break the determinism the QA relies on).

---

## 6. AI-generated B-roll / layers — when it upgrades vs when it's a tell

### 6.1 What exists
`gen_image.py` (Gemini image: pro/fast/lite presets, `--ref` for consistency, 9:16 default),
`gen_clip.py` (fal video: any model, image-to-video from a locked frame), `gen_vox2_layers.py`
(style-locked painted layers + cutouts). Plus `story.tsx` (Ken-Burns over AI stills, proven on
short-7-kids) and the `collage.tsx` parallax engine.

### 6.2 When AI b-roll is an UPGRADE
- **Illustrative stills as *layers/atmosphere*, not as "live footage":** a soft AI-generated background
  plate (product on a shelf, a kitchen, a classroom) under the type/characters adds production value the
  flat gradient can't. Because it's *under* deterministic TSX type, an imperfect image is cropped/veiled —
  the tell hides.
- **Locked-character stills for kids (Path B above):** image-to-image consistency via `--ref` is exactly
  how you get a unique mascot cheaply.
- **Product/context stills for ads** (e.g. the restaurant dish, the salon chair) as Ken-Burns or collage
  layers — far more "produced" than type-only.
- **Keys to not-looking-AI:** consistency (`--ref`), cohesive style-lock phrase in every prompt (the
  vox pattern), die-cut isolation via `cutout.py`, and **imperfect images must be cropped, duotone'd, or
  veiled** so their artifacts don't read.

### 6.3 When it's a TELL (avoid)
- **Generative *video* as the whole frame** (make-ai-short) for a reading lesson — synthetic character
  motion under a *teaching* task is where AI's uncanny/parent-flagged "slop" risk is highest (hebrew-kids/02
  documents the Feb-2026 NYT AI-kids-slop backlash and the parental distrust). Reserve generative clips
  for hero moments, not the default pedagogy.
- **AI stills with anatomy/text errors in a *legibility-critical* spot** (a letter being taught, a word).
- **Mixed art styles across beats** — inconsistent style-lock is the #1 amateur tell.

### 6.4 Net
For **ads**: AI b-roll (as veiled layers) is a strong, cheap upgrade. For **kids/reading**: AI *stills*
for a locked mascot (Path B) is the upgrade; AI *video* is the last resort (cost + parent-trust).

---

## 7. Highest-impact recommendations (ads vs kids, summary)

**For ADS (Track A) — the "designed" pass:**
1. Use the already-built rich `polish.tsx` backdrop (mesh+grain+vignette) + a root color grade.
2. Add CSS 3D-lite perspective tilt on the PriceBadge/CTA + gradient-text on the hero word/price.
3. Drop CRF 21→18; keep 30fps/yuv420p.
4. Add Frank Ruhl Libre (variable serif) for the ad end card/hook — instant "premium brand" signal.
5. Ease-in exits, add "settle" micro-motion, and use `sceneCut` interior transitions.
6. Optionally add Trail motion-blur as a micro-accent on the CTA arrow only.

**For KIDS / READING (Track B) — the character pass:**
1. **Animate the koala** (Path A: multi-layer SVG puppet with squash-and-stretch, blink, mood faces,
   celebration bounce on the reward beat) — $0, S–M, immediately raises it from clip-art to character.
2. **Upgrade to a locked illustrated mascot** (Path B: one paid reference + cutout puppet/Ken-Burns)
   as the series' flagship — the market moat.
3. Keep Rubik-900 tiles (pointed-safe); optionally add Varela Round for kid headlines.
4. Keep the per-grapheme highlight + the 1.5 lineHeight nikkud gate; add a "settle" to the caption pill.
5. Do NOT adopt Rive (determinism mismatch). Do NOT default to generative video for lessons.

---

## Proposals (ranked)

Ranked by (effort × cost → quality payoff for ads vs kids). "Free/self-hostable" is a stated preference;
paid only where free can't reach the bar.

**1. CRF 21 → 18 (delivery encoding)**
- *What:* lower the h264 CRF in `render-all.mjs` from 21 to 18 (Remotion's own high-quality-social
  guidance). *Effort:* S. *Cost:* $0/free. *Payoff:* ads ★★★, kids ★★★ (both get visibly cleaner
  gradients/grain/noise; a tiny size increase, re-encode-friendly). *Why #1:* a one-line, deterministic,
  free, across-the-board quality win with zero risk — the highest quality-per-effort ratio in the whole
  list.

**2. Animate the reading koala — multi-layer SVG puppet (squash-and-stretch, blink, mood, celebration)**
- *What:* turn the static `KoalaTile` into a separable, `useCurrentFrame`-driven puppet with gentle
  overshoot (allowed by brand kids mode); celebrate on the call-response/reward beat. *Effort:* S–M.
  *Cost:* $0. *Payoff:* ads —, kids ★★★ (the single weakest pixel in the pipeline becomes a *character*).
  *Why #2:* highest *kids-only* ceiling per dollar; reuses existing TSX determinism; no new tooling.

**3. Ad "designed" pass: use the rich `polish.tsx` backdrop + root color grade + gradient-text + 3D-lite tilt on PriceBadge/CTA**
- *What:* adopt the existing mesh+grain+vignette backdrop for ads/shorts, add a subtle grade, animated
  indigo→violet→teal gradient text on the hero/price, and a `perspective()` tilt-in on the price/CTA
  card. *Effort:* M. *Cost:* $0. *Payoff:* ads ★★★, kids ★★ (the grade/mesh help kids too). *Why #3:*
  the biggest *ads-only* perceived-quality jump, all from primitives already in the repo + cheap CSS.

**4. Easing discipline: ease-in exits, "settle" micro-motion, arcs over straight lines**
- *What:* exits ease-in; add a settle step (tiny overshoot→lock) to caption pills/pops; slight arc on
  rises. *Effort:* S. *Cost:* $0. *Payoff:* ads ★★, kids ★★. *Why #4:* cheap, sourced (Clay/Figma), and
  directly kills the two amateur tells ("floaty", "too linear") that read most loudly in a calm, type-led
  look.

**5. Locked illustrated mascot for kids (one paid reference → cutout puppet / Ken-Burns layers)**
- *What:* Path B — one human-approved `character.png`, pose/expression stills via `gen_image --ref`,
  `cutout.py` + `collage.tsx`/`story.tsx` for motion. *Effort:* M. *Cost:* ~$0.01–0.20 one-time (paid,
  tiny). *Payoff:* ads —, kids ★★★ (the real market moat; "a premium character the imports can't copy").
  *Why #5:* the flagship kids play once the koala-animation (2) proves the rig; the biggest *strategic*
  win even though it costs a few cents. Ranks below 2 only because it needs human approval on the
  reference + slightly more build effort.

**6. Frank Ruhl Libre (variable serif) for ad headlines/end card + Varela Round for kids headlines**
- *What:* vendor two free OFL Hebrew display faces; use FRL for editorial ad moments, Varela for kids.
  *Effort:* S. *Cost:* $0. *Payoff:* ads ★★★, kids ★★. *Why #6:* an instant typographic identity upgrade,
  free, verified to exist with Hebrew subset — but ranked below motion/character because type alone
  can't carry a video.

**7. Lottie accents for kids (confetti/sparkle/reward pops) — reuse the existing frame-exact wrapper**
- *What:* curate a few free LottieFiles celebration clips into `media/library/lottie/`; pop them on the
  reward/call-response beats. *Effort:* S. *Cost:* $0. *Payoff:* ads ★, kids ★★★ (joy on the payoff).
  *Why #7:* tiny, deterministic, and directly serves the kids "warm reward" beat; generic-but-curated is
  fine for accents.

**8. Scene transitions (spring-timed interior cuts) in ads/shorts via the existing `sceneCut`**
- *What:* adopt `polish.tsx` scene transitions for multi-beat ads/shorts (film-burn topic cut, dreamy-zoom
  soft beat). *Effort:* S. *Cost:* $0. *Payoff:* ads ★★, kids ★. *Why #8:* makes multi-scene pieces read
  "edited"; keep out of the single-beat reading track (calm rule).

**9. Audio-reactive accent (pulse a hero element to the music/SFX)**
- *What:* `useAudioData`+`visualizeAudio` to drive a subtle scale on the price/hero or the koala's bounce.
  *Effort:* M. *Cost:* $0. *Payoff:* ads ★★, kids ★★. *Why #9:* a nice "alive" signal; ranked mid because
  it needs validation on Hebrew voice vs music waveform (**UNVERIFIED** how clean it is) and must stay
  subtle to avoid the "gratuitous motion" trap.

**10. Trail motion-blur as a micro-accent (CTA arrow, price stamp only)**
- *What:* `@remotion/motion-blur <Trail>` on one small hero element for a few frames. *Effort:* S. *Cost:*
  $0 (render cost). *Payoff:* ads ★, kids ★. *Why #10:* pro polish on a hero accent, but expensive per
  frame and risky for the already-constrained renderer — apply narrowly or not at all.

**11. (Optional, paid) Generative AI video character for hero/pilot kids episodes**
- *What:* `make-ai-short` with a locked character for flagship moments. *Effort:* M. *Cost:* paid
  (~$2–3/short + ElevenLabs-Hebrew-only voice). *Payoff:* kids ★★★ (true motion) but high parent-trust +
  cost risk. *Why last for default production:* the reading track's pitch is $0/self-hostable, and
  generative video under a *teaching* task is where AI-slop distrust is highest; reserve for pilots/heroes,
  not the series default.

---

## Sources
- https://clay.global/blog/web-design-guide/motion-design-principles (timing/duration scale, easing, stagger ~80ms, arcs, concurrency limits)
- https://www.figma.com/blog/principles-in-motion/ (easing, anticipation, overshoot, follow-through, hold, settle; "floaty/linear" amateur tells)
- https://www.remotion.dev/docs/spring (spring config: damping/mass/stiffness/overshootClamping)
- https://www.remotion.dev/docs/animation-math (enter/exit spring arithmetic pattern)
- https://www.remotion.dev/docs/transitions/ (@remotion/transitions, TransitionSeries)
- https://www.remotion.dev/docs/motion-blur/ + /motion-blur/trail (Trail props; N-renders-per-frame cost)
- https://www.remotion.dev/docs/use-audio-data (@remotion/media-utils audio-reactive APIs)
- https://www.remotion.dev/docs/encoding (CRF 18-or-below for high-quality social; HW-accel disables CRF)
- https://rive.app/ + rive docs via Seznam (Rive runtimes; state-machine model; no Remotion integration found)
- https://github.com/google/fonts/tree/main/ofl (Hebrew font METADATA: Frank Ruhl Libre variable serif wght 300–900; Karantina display; Secular One; Varela Round — all OFL + hebrew subset)
- Repo-internal: brand.md, remotion/src/lib/{shorts,ads,reading,reading-render,collage,story,kinetic,polish,motion,lottie}.tsx, remotion/src/fonts.ts, lib/fontFaces.tsx, scripts/render-all.mjs, tools/{ffw,gen_image,gen_clip,gen_vox2_layers,cutout}.py, research/hebrew-kids/{01,02,04,06,08}, research/hebrew-reading/02 (the source-grounding for Rubik/Heebo pointed-safety and RTL/highlight patterns)

## Blocked / not verified in this environment
- Google/Brave rate-limited or blocked for most queries; used Seznam + direct font-METADATA fetches + repo-internal research instead.
- Rive–Remotion integration: none found (**UNVERIFIED** exhaustively; verdict rests on determinism mismatch, which is repo-architectural, not search-dependent).
- Audio-reactive waveform cleanliness on Hebrew voice vs music: **UNVERIFIED** (recommend a test render before committing).
