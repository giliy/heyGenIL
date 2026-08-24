@# 05 — Execution Plan: Hebrew Kids' Shorts with an Original Character

Synthesized from `01`–`04`. This is the actionable plan to harness the factory for Hebrew kids' shorts.

---

## The strategy (one paragraph)

Build an **original** recurring character using the decoded "Stitch appeal recipe" (baby-schema
proportions + one weird signature feature + mischievous-but-kind chaos + vulnerability + a signature
Hebrew catchphrase). Produce with `make-ai-short`'s locked-character mechanism, voiced in Hebrew via
edge-tts. Target the unclaimed gap: **premium, calm, Hebrew-native short-form** teaching
אותיות/מספרים/צבעים + chagim/Shabbat cultural content — positioned to parents as "the Shorts you
don't have to feel guilty about." YouTube-only, marked Made-for-Kids, with a real narrative arc per
episode. Shorts = top-of-funnel; the business = owned character IP.

---

## Phase 0 — Character design gate (USER DECISION before any pixel)

Design an original mascot on the recipe. **Do not generate anything until the user picks a concept.**

Recipe constraints (from `01`):
- Head ≈ ⅓–½ of body height; large low-set wide-spaced eyes; high forehead; chubby cheeks; plump
  round body; short stubby limbs; zero sharp silhouette angles
- Exactly ONE "cute but weird" signature feature (the memorability hook)
- Mischievous-but-kind personality; errs like a child, loved anyway
- Periodically vulnerable (scared/sad/lost) — child viewer gets the caretaker role
- ONE saturated body color
- 2–3 signature non-word sounds + ONE short imitable Hebrew catchphrase + one signature gesture

Deliverable for the user: 2–3 named character concepts (name, species/creature, the one weird
feature, color, catchphrase in Hebrew, personality one-liner), each as a `character.json` draft.

Candidate directions (to be refined — NOT final):
- A small Israeli-animal-inspired creature (e.g., a hyrax / שפן סלע — native, cute, unclaimed)
- A gentle monster/alien in the Stitch/Grogu lineage
- A personified object in the TuTiTu lineage but with a face + personality + Hebrew voice

**Open question for the user: target age band** — 2–4 (songs, colors, letters, call-and-response)
vs 4–6 (mini-stories with moral + participation). Recommendation: **3–5 sweet spot** — old enough
for the mini-story format (which satisfies the "inauthentic content" narrative-arc rule), young
enough for the baby-schema appeal to dominate.

---

## Phase 1 — Close the pipeline gaps (from `04` §c)

In priority order:

1. **Hard-wire the Hebrew voice path** into the kids flow: edge-tts `he-IL-HilaNeural` (female,
   warmer) as default via `gen_voice_edge.py`; document `--model eleven_multilingual_v3 --lang he`
   as the emotional upgrade. (Neither make-short Stage 4 nor make-ai-short Stage 2 documents this.)
2. **Kids' music + SFX palette extension:** grow `media/library/music/` with playful/ukulele/cartoon
   beds via `gen_music.py --force_instrumental`; extend `sfx/palette.json` with cartoon boings,
   giggles, pops, splats, animal sounds, toy sounds (currently zero). Requires a documented
   **brand-taste override**.
3. **Brand-mode override** for kids: permit the currently-banned bouncy/cartoon motion, overshoot,
   sticker-pop; enable **nikkud** (kids' exception already in brand.md:48-50 — bump caption
   lineHeight to ~1.5). Document as a `mode:"kids"` analogous to `mode:"ad"`.
4. **Child-directed Hebrew linguistic research:** simplified vocabulary, repetition, diminutives,
   warm register; extends `research/hebrew-ads/` into a kids' register.
5. **Nursery-rhyme licensing note:** only pre-1954 folk songs / original compositions in the style
   of the canon (see `02` §b — Gen-1 safe, Gen-2/3 copyrighted).

Optional new skill: a `/make-kids-short` skill wrapping make-ai-short with the kids defaults —
or a documented mode on the existing skills. (Decide after the pilot proves the format.)

---

## Phase 2 — Pilot batch (prove the format)

Produce **3–5 pilot shorts** with the locked character, each 20–40s:

1. **An אותיות (aleph-bet) short** — one letter, character interacts with objects starting with it.
   The clearest market gap.
2. **A צבעים (colors) or מספרים (numbers) short** — call-and-response with engineered pauses
   (Ms. Rachel method): character asks, holds 2–4s, answers warmly.
3. **A mini-story short** — problem → chaos → warm belonging resolution (ohana logic). Satisfies the
   "complete narrative" monetization rule.
4. (Optional) **A chagim/Shabbat song short** — original melody, Gen-1-style folk feel; the cultural
   moat content.

Each pilot gets the full pipeline: character.json lock → beats.json (subtype image-story or ai-clip)
→ Hebrew edge-tts voice → RTL captions with nikkud → playful SFX → QA at phone scale (bidi-check
digits, nikkud lineHeight) → seamless loop check (frame-0 == last-frame).

---

## Format rules baked into every short (from `01`)

- **Hook inside ~2 seconds** — character's big baby-schema face fills frame, already moving/reacting.
  No intros/logos/establishing shots.
- **Singable:** one repeated 2–6-word Hebrew phrase; action synced to musical beats; tempo
  speech-paced (singable by a 4-year-old).
- **Repetition ≥3×** per short; rigidly formulaic series structure so the child predicts & participates.
- **Call-and-response:** character addresses viewer; question → genuine 2–4s pause → warm answer.
- **Pacing:** action/reaction beats every 2–4s, but scene stable (no cuts faster than ~10s —
  Lillard & Peterson). One setting, one continuous event per ≤60s short. **Calm = differentiator.**
- **One idea, resolved warmly.** Chaos resolves into belonging/comfort.
- **Seamless loop** (frame-0 == last-frame) — serves the toddler rewatch drive.
- **Parent-safe:** no startling cuts, no mean humor, no uncanny AI weirdness. Warm color palette.

---

## Compliance guardrails (from `03`)

- ✅ Mark every video **"Made for Kids"** (COPPA) — accept the disabled-features + contextual-ads tradeoff.
- 🚫 **Never use famous IP** (Stitch/Disney/etc.) — Content ID revenue diversion + 3-strikes channel
  termination + "strange use of children's characters" quality violation.
- ✅ **Real narrative arc per episode** (character development, plot, resolution) — survives the
  July-2025 "inauthentic content" anti-mass-production rule AND is the anti-"AI slop" positioning.
- ✅ **Original songs** in the style of the canon; pre-1954 folk only if adapting; never the
  copyrighted Gen-2/3 songs without licensing.
- ✅ Aim for the rewarded quality principles: kindness/friendship, learning/curiosity, creativity/play,
  life-skills narrative, relatable character.

---

## Business model (from `03` §e)

- YouTube Shorts = **top-of-funnel only**. MFK RPM is near-negligible (~$30–70 per million views,
  kids at the bottom).
- The asset is the **owned character IP** → Cocomelon/Moonbug playbook: songs on Spotify Kids,
  licensing, merch. Build the character to be ownable and lovable, not to maximize per-view ad cents.
- YPP path: 1,000 subs + 10M Shorts views/90 days for ad sharing (45%). Fan-funding tier is useless
  for MFK (Supers/Memberships disabled) — ignore it.

---

## Decisions locked (user, 2026-08-23)

1. **Target age band: ages 3–5** — the sweet spot: old enough for mini-stories (satisfies YouTube's
   narrative-arc monetization rule), young enough for the baby-schema appeal to dominate. Mix of
   songs + simple stories.
2. **Primary format: mix across the pilot batch** — one aleph-bet, one colors/numbers, one
   mini-story, one song. Data tells us which wins.
3. **Character direction: see all three concepts** (Israeli-native animal / gentle monster-alien /
   personified object) → `06-character-concepts.md`.
4. **Production track: storybook pilot first** — `make-short` + `lib/story.tsx` (AI stills +
   Ken-Burns). Cheapest, fastest iteration, already proven on a kids' story (short-7). Validate the
   format in Hebrew, then upgrade to `make-ai-short` generative motion if it works.

## Status (2026-08-23)

- **Phase 0 — DONE.** Character picked: **בּוּ (bu-koala)**, the user's own yellow koala art
  (`photos/cute-kuala.jpg`), locked verbatim as `ai-shorts/bu-koala/character.jpg`
  (`character.json` — voice `he-IL-HilaNeural`, catchphrase "בּוּ בּוּ — אוֹהֵב אוֹתְךָ!",
  identity marker = the fluffy round ears). See `08-character-concepts-v2.md`.
- **Phase 1 — DONE (5/5).**
  1. ✅ Hebrew voice path wired into `make-short` Stage 4 + `make-ai-short` Step 2 (edge-tts
     `he-IL-HilaNeural` motherese default; ElevenLabs `eleven_multilingual_v3 --lang he` upgrade).
  2. ✅ Kids music palette extended + generated: `kids-play-ukulele`, `kids-lullaby-musicbox`,
     `kids-curious-pizzicato` (acestep, $0.024, cataloged).
  3. ✅ Kids SFX palette extended (6 recipes: pop/boing/giggle/toy-squeak/sparkle-magic/animal-coo)
     — config in `palette.json`; generation deferred (user held the ~$1 ElevenLabs spend).
  4. ✅ `mode:"kids"` brand override added to `brand.md` §5 (bouncy motion, nikkud, playful SFX).
  5. ✅ Child-directed Hebrew research = `07-hebrew-language-kids.md`; song licensing note = `02` §b.
- **Phase 2 — IN PROGRESS.** Pilot #1 (`short-18-bu-aleph`, "בּוּ וְהָאוֹת א") PRODUCED
  end-to-end (2026-08-23): script approved → Hebrew edge-tts voice (`he-IL-HilaNeural`
  motherese, real word timings in `vo.gen.ts`) → 8 storybook stills derived from the locked
  character.jpg (gemini-3.1-flash-image, ~$0.30) → shot `Short18BuAleph.tsx` (Ken-burns +
  crossfades, `rtl kidsNikkud` captions, Bu-yellow `#ffd45e`) → registered → phone-scale frame
  QA (8/8 beats pass: character consistent, letter א correct, nikkud legible, captions in safe
  area) → full render → voice muxed (`ffw`) → `kids-play-ukulele` bed ducked under voice →
  **audio gate PASS (RMS −21.2 dB)**. Output: `shorts/short-18-bu-aleph/output/Short18BuAleph-final.mp4` (36s).
  Library addition this pilot: `kidsNikkud` caption prop in `lib/shorts.tsx` (opt-in nikkud +
  lineHeight 1.5; default off = zero regression).
  Remaining pilots: #2, #3 (…). Optional polish backlog: kids SFX recipes (still ungenerated),
  seamless-loop hardening (frame 0 vs last currently a soft character match, not pixel-exact).

## Next steps

- **Phase 2 (next):** produce pilot #2 (colors or a second letter) reusing the now-proven
  short-18 pipeline. First watch pilot #1 with fresh eyes / a child if possible before batching.
