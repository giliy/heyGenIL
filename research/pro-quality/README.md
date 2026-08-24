# Pro-Quality Plan — the synthesized professionalization roadmap

**This is the final deliverable.** Four research reports were written in parallel (voice · visual ·
sound · harness/benchmark); this file merges, dedupes, and ranks **every** proposal from all four into
one build order, in the user's terms: make the Hebrew SMB **ads** and the **kids learning** videos
genuinely professional, **free-first**, with training/self-hosting on the table (unlimited compute),
paid only where free can't reach the bar.

**Read the four source reports for depth** — each is authoritative for its area:
- `01-voice.md` — Hebrew TTS frontier, edge-tts audit, datasets, fine-tuning, cloning.
- `02-visual.md` — motion/render quality, the kids character question, typography, encoding.
- `03-sound.md` — SFX/music/mix-master; the measured loudness defects.
- `04-harness-benchmark.md` — the pro bar per track, the end-to-end quality-leak audit, product gaps.

**Compiled:** 2026-08-23 · **Status legend:** ✅ verified · ⚠️ UNVERIFIED (collected in §5).

---

## 1 · Executive summary — the highest-leverage moves

Five moves carry most of the value. Everything else is refinement.

1. **Master the audio to −14 LUFS / −1 dBTP and gate it.** Every video today ships at the *audition*
   mix — measured at **−15.8 to −20.4 LUFS** (target −14) with one master **clipping at +1.1 dBTP**,
   and nothing catches either. Building `tools/master.py` (pure ffmpeg, already on the box) + extending
   `audio_gate.py --delivery-report` is the single highest-value change in the whole program: it is the
   difference between "sounds like a phone recording" and "sounds platform-native," it is 100% free,
   and **every other audio improvement is inaudible until delivery loudness/peak is correct.**

2. **Fix the two fatal craft leaks the harness doesn't gate.** The harness is exceptionally strong on
   mechanical correctness (VO overlap, dead tail, bidi, math-truth, silence — all gated in code) but
   weak on the 20% that is craft. The two fatal craft gaps are cheap to close: an **ad hook-craft engine
   + "would a copywriter ship this" gate** (the AI-tool benchmark proves even $99/mo tools ship generic
   scripts), and **enforcing the 2–4s call-and-response pause** on kids/reading beats in `contracts.py`
   (a prose rule with zero code enforcement — the product's core differentiation silently disappears if
   it's trimmed).

3. **Run the Chatterbox Hebrew bakeoff — the one free path to an expressive voice.** edge-tts he-IL is
   flat (no SSML, no styles). The ivrit-ai Hebrew TTS Arena shows **no free/open model is even ranked**
   — the expressive tier is all paid. **Chatterbox Multilingual (ResembleAI) is the sole exception that
   is both commercial-legal (MIT) and does expressive Hebrew** (23-lang V3, zero-shot cloning,
   exaggeration/CFG knobs, working `phonikud-chatterbox` G2P). It is not proven to *sound* better to
   Israeli ears — so a bakeoff, not a switch. Keep ElevenLabs v3 as the paid opt-in ceiling for ads.

4. **Turn the static koala into a character.** The reading koala is a single static circle-face SVG —
   the weakest pixel in the pipeline against the repo's own "a character kids LOVE" bar (baby-schema +
   signature feature + expressiveness). Two-step: (a) **animate the in-TSX koala** into a multi-layer
   squash-and-stretch puppet ($0), then (b) **lock an illustrated mascot** via one paid `--ref`
   reference + `cutout.py` + the existing puppet/Ken-Burns engines — the real, uncopiable kids moat.

5. **Do the "designed" + "encoding" visual passes.** The pro-motion machinery already exists
   (`polish.tsx` rich backdrop, `kinetic.tsx`, `lottie.tsx`, collage parallax) — the shots just
   under-use it. Adopt the rich backdrop + a root grade + gradient-text + CSS 3D-lite tilt for ads, and
   drop **CRF 21 → 18** in `render-all.mjs` (Remotion's own high-quality-social guidance) — a one-line,
   free, deterministic, across-the-board quality win.

**The one-line strategy:** *Fix delivery loudness and the craft gates first (free, immediate); then
chase the voice and character ceilings (free-first, paid only as an opt-in ceiling); then build the
batch/series product shell so the factory can actually be sold as a program.*

---

## 2 · The ranked plan (every proposal, deduped & merged)

Ranked by **VALUE = quality-per-dollar-per-effort**, weighted by *"does it stop a sale / make a parent
trust it."* Track: **A**ds / **K**ids / **B**oth. Effort S/M/L · Cost $0/free/paid.

> **Merge note:** 04-#4 (master loudness) merged into 03-#1 (`master.py`) + 03-#2 (audio_gate) — same
> build. 04-#6 (voice upgrade) merged into 01-#1/#2/#3. 04-#3 (ad energy) merged into 02-#3 (designed
> pass) — the visual side of "reads as an ad." 03-#7 (ad one-shots) folded into the designed pass row.
> 02-#11 (generative AI character) folded into 02-#5 (mascot path). Original IDs kept in each row.

| # | Name | Track | What it is | Eff | Cost | Payoff | Depends on | Why this rank |
|---|---|---|---|---|---|---|---|---|
| 1 | **Delivery mastering chain — `tools/master.py`** (03-#1, merges 04-#4) | B | Two-pass ffmpeg `loudnorm` → gentle bus glue → true-peak limit at −1 dBTP → fades → delivery report. The missing step after `mix_music.py`. | M | $0 | A ★★★ / K ★★★ | nothing | Fixes the two **measured** defects (−15.8…−20.4 LUFS under-delivery; one +1.1 dBTP clip). Highest payoff, fully free, tools already on box; every other audio win is inaudible until delivery is correct. |
| 2 | **Audio delivery gate — `audio_gate.py --delivery-report`** (03-#2) | B | Add clip/true-peak detect, LUFS compliance, and a voice-vs-bed duck-working check on top of silence/cue modes (ebur128/astats). | S | $0 | A ★★ / K ★★ | #1 | The cheap safety net that makes #1 verifiable and prevents regressions; would have caught today's clip + quiet finals. Turns the "ear gate" into an objective gate. |
| 3 | **CRF 21 → 18** (02-#1) | B | Lower h264 CRF in `render-all.mjs` 21→18 (Remotion's high-quality-social guidance); keep yuv420p/30fps/H.264. | S | $0 | A ★★★ / K ★★★ | nothing | One-line, deterministic, free, across-the-board. Highest quality-per-effort ratio in the entire list. |
| 4 | **Hook-craft engine + "doesn't-read-AI" script gate** (04-#1) | A | Per-vertical hook templates from `lexicon.json hook_styles`, A/B hook variants, 2s-hard-stop (hook ≤8 words, lands frame-0), story-writer self-review checklist + a numeric hook test. | M | $0 | A ★★★ / K ★ | nothing | The #1 ad-quality leak and the exact thing the benchmark shows paid tools fail at. A great hook = converting ad vs scrolled-past. Fatal-gap fix. |
| 5 | **Enforce the 2–4s call-and-response pause** (04-#2) | K | Validator on `mode:"kids"/"reading"` beats: the `call` beat holds a genuine 2–4s pause between question-end and answer-start. Numeric, in `contracts.py`, mirroring `_ad_timing_audit`. | S | $0 | A ★ / K ★★★ | nothing | The kids differentiation (calm, participatory, Ms. Rachel method) silently disappears if trimmed — nothing stops it today. Tiny effort, protects the core promise. Fatal-gap fix. |
| 6 | **Ad "designed" visual pass + ad one-shots SFX** (02-#3, merges 04-#3, 03-#7) | A | Adopt the existing rich `polish.tsx` mesh+grain+vignette backdrop + a root color grade + gradient-text on hero/price + CSS `perspective()` tilt on PriceBadge/CTA; raise ad energy (bolder AD_POP, urgency accent). Curate CTA-hit/cha-ching/social-ding/logo-sting one-shots (Sonniss/Pixabay) for the end-card resolve. | M | $0 | A ★★★ / K ★ | nothing | The biggest *ads-only* perceived-quality jump, all from primitives already in the repo + cheap CSS. Attacks "doesn't read as an ad / reads calm-premium." |
| 7 | **Animate the reading koala — multi-layer SVG puppet** (02-#2) | K | Turn the static `KoalaTile` into a separable `useCurrentFrame`-driven puppet: blink timer, mood faces (happy/sad/surprised), gentle squash-and-stretch, celebration bounce on the reward/call beat. | S–M | $0 | A — / K ★★★ | nothing | The single weakest pixel becomes a *character*. Highest kids-only ceiling per dollar; reuses existing TSX determinism; no new tooling. |
| 8 | **Chatterbox Hebrew bakeoff + brand-voice clone** (01-#1) | B | ResembleAI Chatterbox Multilingual V3 (MIT): zero-shot clone of a *consented* Israeli voice, `exaggeration`/`cfg` knobs, `phonikud-chatterbox` G2P. A/B 5 lines vs edge-tts. | M | $0 | A ★★★ / K ★★★ | consented reference voice | The **only** commercial-legal free model that does expressive Hebrew — everything else can't do Hebrew (XTTS/Piper/OpenVoice/MeloTTS) or is non-commercial (all SASPEECH checkpoints). Bakeoff (not switch) because it's not arena-proven. ⚠️ no native word timestamps → pair with whisperX for ads; NOT for per-unit reading. |
| 9 | **Port the −14 LUFS cleanup chain onto the free voice tracks** (01-#2) | B | Apply `gen_voice.py`'s highpass+deesser+compand+linear-loudnorm+verify to `gen_voice_edge.py` / `gen_voice_reading.py` (currently single-pass −16, no cleanup). | S | $0 | A ★★ / K ★★ | #1 (shares the −14 target) | Presence/de-essing is exactly what makes TTS sound "produced." Cheapest guaranteed audible improvement; pure engineering, zero research risk. |
| 10 | **Easing discipline** (02-#4) | B | ease-in exits; a "settle" micro-motion (tiny overshoot→lock) on caption pills/pops; slight arcs over straight-line rises. | S | $0 | A ★★ / K ★★ | nothing | Cheap, sourced (Clay/Figma), and directly kills the two amateur tells ("floaty," "too linear") that read loudest in a calm type-led look. |
| 11 | **Locked illustrated mascot for kids** (02-#5, folds 02-#11) | K | One human-approved `character.png` reference (the only paid pixel), pose/expression stills via `gen_image --ref`, `cutout.py` + `collage.tsx`/`story.tsx` for puppet/Ken-Burns motion. | M | paid (~$0.01–0.20 one-time) | A — / K ★★★ | #7 proves the rig; human approval of the reference | The flagship kids play and the biggest *strategic* win — "a premium character the imports can't copy." Below #7 only because it needs approval + slightly more build. |
| 12 | **ElevenLabs v3 Hebrew opt-in for ads** (01-#3) | A | Paid, char-level word times (drops into existing caption contract), audio tags for delivery. Add a 5-line Hebrew tag bakeoff + a per-ad flag. | S | paid (~$0.03–0.10/ad) | A ★★★ / K — | existing `gen_voice.py` engine | Arena tier-A (#3) proven-good expressive Hebrew — but paid and the audio-tag reliability is UNVERIFIED, so it's the *upgrade*, not the default. |
| 13 | **Self-host ACE-Step as the default free music engine** (03-#3) | B | Run Apache-2.0 ACE-Step locally (8 GB VRAM, ~1.7 s/min on a 4090) instead of paying fal/ElevenLabs; no revenue cap. Add `--engine acestep-local` to `gen_music.py`. | M | free (after setup) | A ★★ / K ★★ | unlimited compute | Fills the biggest *content* gap (music) at $0 marginal cost with a clean commercial license. Below voice/visual because music content matters less than delivery, and ACE-Step-on-fal already works today at trivial cost. |
| 14 | **Self-hosted Chatterbox fine-tune on ivrit-ai data** (01-#5) | B | Fine-tune Chatterbox (or the MIT kokoro-hebrew/F5 *pipeline* on **ivrit-ai crowd-recital**, NOT SASPEECH) for a durable single-speaker brand voice. Unlimited compute makes this feasible. | L | $0 compute, real engineering | A ★★ / K ★★★ | #8; ivrit-ai data filtering | The "moat" path to a stable, owned brand voice. Below #8 because Chatterbox zero-shot likely gets most of the benefit with no training, and the only commercial Hebrew corpus is ASR-grade crowdsourced audio (uncertain clean-clone ceiling). |
| 15 | **Azure direct SSML as the reading pronunciation fix** (01-#4) | K(reading) | Same he-IL voices, F0 free (0.5M chars/mo), `<phoneme alphabet="ipa">` to force exact pointed-syllable articulation, word boundaries kept. Only for units that fail listening QA. | S–M | $0 at our volume | reading ★★★ / A,K none | listening QA biting | A *targeted correctness fix* (correct taught sound = the whole product), high value but narrow scope, and contingent on the still-UNVERIFIED listening QA flagging mispronunciation. |
| 16 | **Frank Ruhl Libre (ad serif) + Varela Round (kids) fonts** (02-#6) | B | Vendor two free OFL Hebrew display faces; FRL variable serif for editorial ad moments, Varela Round for kids headlines. Keep Rubik/Heebo for captions/body/reading tiles. | S | $0 | A ★★★ / K ★★ | nothing | An instant typographic identity upgrade, free, verified Hebrew subset. Below motion/character because type alone can't carry a video. |
| 17 | **`import_music.py` + Pixabay sourcing for premium beds** (03-#4) | A | Mirror `import_sfx.py`: curate Pixabay (CC0-like, no attribution, commercial-OK) tracks → license field → normalize −20 LUFS → catalog. | S | free | A ★★ / K ★ | nothing | A curated human track beats a generated bed for a *premium SMB ad*; closes the premium-ad ceiling generative beds can't reach. Kids beds are fine from ACE-Step. |
| 18 | **Codec-hygiene fix (single AAC encode at master)** (03-#5) | B | Stop mp3→AAC→re-encode round-trips; decode to float in the mixers, encode AAC **once** in `master.py`. | S | $0 | A ★★ / K ★★ | #1 | Preserves the dry-transient SFX character brand.md §7 demands. Bundled with #1 in practice. |
| 19 | **Human gate: "would this sell / would a parent trust this" review step** (04-#7) | B | A formal pre-release checklist (drawn from the Part-1 pro bar) the QA/review stage reads: "this ad would get a lead" / "this reading video is parent-safe and teaches correctly." | S | $0 | A ★★★ / K ★★★ | #4/#5 (the craft checks it formalizes) | The automation handles mechanics; the "is it good" judgment is the missing 20% and is inherently human/heavily-prompted. Institutionalizes the pro bar as process, not luck. |
| 20 | **Kids recorded SFX pack (boing/sparkle/giggle/toy)** (03-#6) | K | Curate Kenney/Sonniss cartoon + a **CC0 recorded** giggle → `import_sfx.py`. Replace the *generated* kids one-shots (the "childish" tell). | S | free | K ★★★ / A — | nothing | Recorded reads warm; an AI "child's giggle" is both lower-quality and a worse look for kids content. High for kids, ~zero for ads. |
| 21 | **Lottie accents for kids (confetti/sparkle/reward pops)** (02-#7) | K | Curate free LottieFiles celebration clips into `media/library/lottie/`; pop them on reward/call-response beats via the existing frame-exact wrapper. | S | $0 | A ★ / K ★★★ | #7 (shares the reward beat) | Tiny, deterministic, directly serves the kids "warm reward" beat. Generic-but-curated is fine for accents. |
| 22 | **Regulation-disclosure validator** (04-#5) | A | When `ad.offer.urgency`/`oldPrice`/`discountPct` present, require a scope/total-price disclosure line; flag a native/influencer ad lacking שת"פ ממומן. Encode Consumer Protection Law §15/§2/§7a as a `lexicon --check` lint. | S | $0 | A ★★ / K — | nothing | Legal missteps kill trust and a paid product; the rules exist in prose but aren't enforced. Cheap insurance. |
| 23 | **Scene transitions in ads/shorts via existing `sceneCut`** (02-#8) | A | Adopt `polish.tsx` spring-timed transitions (film-burn topic cut, dreamy-zoom soft beat) for multi-beat ads. Keep OUT of the single-beat reading track (calm rule). | S | $0 | A ★★ / K ★ | nothing | Makes multi-scene pieces read "edited by a human." |
| 24 | **16:9 re-frame + platform-length variants** (04-#8) | A | Post-render step re-frames 1080×1920 → 1920×1080 (safe-area aware) and cuts a 15s (IG) + 30s (YT) from the same beats. | M | $0 | A ★★ / K — | nothing | Real SMB demand (same asset everywhere), but 9:16 already covers the primary social surface — an upsell, not a blocker. |
| 25 | **Better Hebrew aligner (ivrit-ai whisper fine-tune)** (01-#6) | B | Augment whisperX `--lang he` alignment (currently imvladikon wav2vec2) with an ivrit-ai Apache-2.0 Hebrew model. | M | $0 | A ★ / K,reading — | nothing | Robustness, not a quality driver — word-level Hebrew alignment is already ~10–30ms, adequate for captions. |
| 26 | **Procedural free bed generator (extend `gen_chords.py`)** (03-#8) | B | Deterministic ambient/pad beds. | M | $0 | low–mod, both | nothing | Tops out at ambient/lofi; can't do pop/ukulele grooves. Superseded by #13 for anything with a beat. Keep as a no-network fallback. |
| 27 | **Audio-reactive accent (pulse a hero element to music/SFX)** (02-#9) | B | `useAudioData`+`visualizeAudio` → subtle scale on price/hero or the koala bounce. | M | $0 | A ★★ / K ★★ | #13 or #17 (a bed to react to) | A nice "alive" signal; ranked mid because it needs validation on Hebrew voice vs music waveform (**UNVERIFIED**) and must stay subtle to avoid gratuitous motion. |
| 28 | **Batch/queue orchestrator + productized series shell** (04-#9) | B | Extend `orchestrate` to fan N scripts through the pipeline (reading is batch-ready: 12 nikkud scripts → 12 videos). Add per-business brand kit (ads), curriculum tracker (kids), and the GTM shell (onboarding, WhatsApp delivery, billing). | L | $0 engineering / paid only for billing/WhatsApp infra | A ★★ / K ★★★ | core quality stable | The biggest *product* gap — turns the factory into a deliverable program. Large effort, so below the per-video quality killers; without it the business can't scale past one-offs. |
| 29 | **Trail motion-blur as a micro-accent (CTA arrow / price stamp only)** (02-#10) | A | `@remotion/motion-blur <Trail>` on one small hero element for a few frames. | S | $0 (render cost) | A ★ / K ★ | nothing | Pro polish on a hero accent, but N-renders/frame is expensive and risks the already-constrained renderer — apply narrowly or not at all. |

**Explicitly rejected / NOT proposed (verified dead-ends):**
- **Meta MusicGen/AudioCraft** — weights **CC-BY-NC 4.0, non-commercial**; cannot ship in ads. (03)
- **Rive** — state-machine/interactive-driven, no frame-exact Remotion path; determinism mismatch with
  the whole QA model. Lottie (already wrapped) is the right format. (02) ⚠️ exhaustiveness UNVERIFIED.
- **XTTS-v2** (no Hebrew, CPML) · **Piper** (no Hebrew voice) · **OpenVoice/MeloTTS** (no Hebrew) ·
  **MMS** (non-commercial + liturgical register) · **any SASPEECH-derived checkpoint as-is**
  (non-commercial: kokoro-hebrew, Mamre, israwave, HebTTS) · **Google Chirp 3 HD Hebrew** (no
  pause/pronunciation control) · **sub-word forced alignment of long clips** (proven unreliable). (01)
- **Generative AI video as the default for lessons** — that's where AI-slop parent distrust is highest;
  reserve for hero/pilot moments only. (02)
- **Stable Audio Open** over ACE-Step — $1M revenue cap + license ambiguity vs Apache-2.0 no-cap. (03)

---

## 3 · Recommended build order

Grouped into phases. **Do P0 first** — it's all free, low-effort, and fixes measured defects.

### P0 — Quick wins (this week; all $0, mostly S effort)
The order matters: fix delivery before judging any other audio/visual change.
1. **#1 `tools/master.py`** (delivery mastering) — the single highest-value build.
2. **#2 `audio_gate.py --delivery-report`** — makes #1 verifiable.
3. **#3 CRF 21 → 18** — one line.
4. **#5 enforce call-and-response pause** — protects the kids core promise.
5. **#9 port −14 LUFS chain to free voice tracks** — instant "produced" sound.
6. **#18 codec-hygiene (single AAC)** — bundle with #1.
7. **#10 easing discipline** — kills the "floaty/linear" amateur tells.
8. **#4 hook-craft engine** — the ad fatal-gap fix (M, start now, it carries into P1).

### P1 — Core upgrades (next; the craft + ceiling movers)
9. **#7 animate the koala** (the kids weakest pixel).
10. **#6 ad "designed" pass + ad one-shots SFX** (the ads perceived jump).
11. **#8 Chatterbox Hebrew bakeoff** (the free expressive-voice test — record a consented reference).
12. **#19 human "would it sell / would a parent trust it" gate** (institutionalize the pro bar).
13. **#16 FRL + Varela fonts**, **#20 kids recorded SFX**, **#21 Lottie accents**, **#22 disclosure validator**, **#17 Pixabay music sourcing**, **#23 scene transitions**.

### P2 — Moats (the moat builds; spend only after P0/P1 prove out)
14. **#13 self-host ACE-Step** (free music at $0 marginal cost).
15. **#11 locked illustrated mascot** (the kids strategic moat; one paid reference).
16. **#14 Chatterbox fine-tune on ivrit-ai** (an owned brand voice — only if #8's zero-shot isn't stable).
17. **#12 ElevenLabs v3 opt-in for ads** (the paid ceiling, after the #8 bakeoff shows free's limit).
18. **#15 Azure SSML reading pronunciation fix** (only if listening QA bites).
19. **#28 batch/queue orchestrator + series shell** (the product-scale build).
20. Lower: #24, #25, #26, #27, #29.

---

## 4 · Free vs paid call — per capability

| Capability | Free option | Paid option | Recommendation |
|---|---|---|---|
| **Ad voice** | edge-tts he-IL (flat); **Chatterbox** (MIT, expressive — UNVERIFIED quality) | ElevenLabs v3 (~$0.03–0.10/ad, arena tier-A) | **edge-tts default → Chatterbox bakeoff (#8) → EL v3 as per-ad opt-in ceiling (#12)** |
| **Kids motherese voice** | edge-tts Hila −18% + post-chain shaping; Chatterbox `exaggeration` | ElevenLabs v3 | **Free first** (post-chain + Chatterbox); pay only if free fails the ear test |
| **Reading per-unit voice** | **edge-tts per-clip isolation + RMS trim (exact by construction)** | Azure direct SSML `<phoneme>` IPA — but **F0 free at our volume** | **Stay on edge-tts**; Azure IPA (#15) only for units failing listening QA |
| **Brand voice (owned)** | **Chatterbox zero-shot clone (#8) → fine-tune on ivrit-ai (#14)** | — | **Free/self-host.** ivrit-ai is the only commercial-usable Hebrew corpus |
| **Music beds** | **ACE-Step via fal (`gen_music.py --engine acestep`, Apache-2.0, ~$0.006/30s bed — #13; self-host hardware-blocked here, see docs/music-generation.md)** + Pixabay sourcing (#17) | ElevenLabs music | **ACE-Step(fal) for non-premium, Pixabay for premium ads, EL as paid fallback** |
| **SFX** | **Recorded-first 3-tier (Sonniss/Kenney+soundcn/Freesound-CC0) + Pixabay** — already strong | ElevenLabs text-to-sfx (long-tail only) | **Keep recorded-first; fill gaps (#7/#20); EL long-tail fallback** |
| **Kids character** | **In-TSX SVG puppet (#7)** → Lottie accents (#21) | One `--ref` illustrated reference (~$0.01–0.20, #11); gen-AI video for heroes only | **Free puppet first; one cheap paid reference for the flagship mascot** |
| **Display fonts** | **Frank Ruhl Libre + Varela Round (OFL, #16)** | — | **Free** (vendor like Heebo/Rubik) |
| **Mastering / delivery** | **`tools/master.py` + `audio_gate` (pure ffmpeg, #1/#2)** | — | **Free** — no paid option needed |
| **Alignment (fallback)** | whisperX `imvladikon/wav2vec2-hebrew`; ivrit-ai whisper (#25) | — | **Free** — adequate today |
| **Delivery encoding** | **CRF 18, yuv420p, 30fps, H.264 (#3)** | — | **Free**; no HW accel (kills CRF determinism) |

---

## 5 · Open questions / risks (UNVERIFIED — validate before committing)

| # | Item | Why unverified | How to resolve |
|---|---|---|---|
| R1 | **Chatterbox Hebrew sound quality vs edge-tts / Israeli-ear preference** | Not in the arena; couldn't listen to samples in-research | Proposal #8 bakeoff — render 5 lines in both, human A/B |
| R2 | **ElevenLabs v3 audio-tag reliability in Hebrew** | Flagged in existing findings; no doc promise | 5-line Hebrew tag bakeoff before relying (#12) |
| R3 | **edge-tts pronunciation of isolated pointed syllables** | Existing §5 listening QA; needs a human ear | Run the listening QA on the unit set; if it bites → #15 Azure IPA |
| R4 | **Audio-reactive waveform cleanliness on Hebrew voice vs music** | Not test-rendered | One test render before adopting #27 |
| R5 | **Rive–Remotion bridge exhaustiveness** | Verdict rests on determinism mismatch (architectural), not exhaustive npm search | Treat Rive as rejected unless a frame-exact seek path is proven |
| R6 | **Chatterbox fine-tune recipe for Hebrew / cost numbers** | No published Hebrew fine-tune | Estimate only after #8 lands (#14) |
| R7 | **israwave / HebTTS / Mamre license text** | israwave unstated; SASPEECH-derivation implies non-commercial | Treat as non-commercial unless a permissive license confirmed |
| R8 | **Azure Pronunciation Assessment Hebrew support** | The phonetic-sets page didn't cover PA | Check PA language-support doc only if #15 is taken |
| R9 | **Mixkit exact license text** | Full terms not retrieved | Manual license read before relying on it for paid ads |
| R10 | **Israeli market pricing figures** | 04 relied on prior repo research (web search constrained); not re-verified fresh | Re-verify only if pricing decisions depend on it |

**Process risks to hold:**
- **License discipline is the through-line** — the two biggest "free" traps are MusicGen (CC-BY-NC) and
  every SASPEECH-derived Hebrew voice checkpoint (non-commercial). The only clean free assets are
  **Chatterbox (MIT)**, **ACE-Step (Apache-2.0)**, **ivrit-ai data (commercial OK)**, **Pixabay**, and
  the OFL fonts. Re-check licenses before shipping any new model/library.
- **Voice consent is a hard rule** — only clone a voice with express informed consent (a recorded/
  licensed Israeli actor or an owned synthetic voice). Never scrape a real person.
- **edge-tts stability** — the whole $0 voice stack rides edge-tts (an unofficial endpoint). It worked
  live this session, but it is an external dependency outside our control; the whisperX fallback and the
  Chatterbox/EL paths are the hedge.

---

*Synthesized 2026-08-23 from `01-voice.md`, `02-visual.md`, `03-sound.md`, `04-harness-benchmark.md.
Each source report carries its own full Sources / UNVERIFIED register.*

---

## 6 · Implementation log (as P0 lands)

- **#1 `tools/master.py` + #2 `audio_gate.py --delivery-report` — BUILT & VERIFIED (2026-08-23).**
  - Verified on all four existing finals: speech now ~−13 LUFS, true peak −1.0/−1.1 dBTP, **zero clipping**;
    the gate re-detects the short-16 **+1.1 dBTP clip** from the research (so the safety net works).
  - **Correction to the proposed design (03-sound §3):** two-pass `loudnorm` is NOT the right normalizer
    here. It normalizes *integrated* loudness, which the quiet call-and-response gaps in kids videos drag
    down — so it both (a) silently falls back to dynamic mode and (b) under-loudens the speech, and (c)
    can't boost a soft source to −14 without exceeding the true-peak ceiling. What actually works and is
    now implemented: **normalize the speech band (ebur128 `LRA high`) to ~−13 LUFS**, then a brickwall
    true-peak limiter (`aresample=96000 → alimiter(level=0) → aresample=48000`). Key detail: `alimiter`
    is a *sample-peak* limiter — only the oversampling catches inter-sample peaks, which is precisely the
    bug that let short-16 clip (its `alimiter=0.97` ≈ −0.26 dBFS sat above the −1 dBTP ceiling).
  - Net effect: ads deliver ~−14 integrated, calm kids videos ~−15/−16 (their pauses are meant to be
    quiet) — both with speech at the pro level and no clip. Kids tracks read slightly lower on
    integrated-LUFS by design; that is correct, not a defect.

- **#3 CRF 21→18 — DONE.** `render-all.mjs` now `crf: 18` for non-transparent renders (Remotion
  high-quality-social guidance).

- **#5 kids call-and-response pause validator — BUILT & VERIFIED.** `_reading_call_pause_audit` in
  `contracts.py` enforces a real 2–5s silence between the call prompt's speech-end and the next
  line's speech-start (conditional on real word-times). Tested: 3.0s PASS, 0.5s FAIL, 6.0s FAIL.

- **#9 voice cleanup chain — BUILT & VERIFIED.** `tools/voice_cleanup.py` (highpass 80 → deesser →
  compand) is now shared by `gen_voice_edge.py` + `gen_voice_reading.py`; loudness stays in
  `master.py`. And **#8 gen_voice.py limiter aligned** to the oversampled true-peak-safe chain
  (`aresample=96000 → alimiter(limit=0.871) → aresample=44100`, verified TP −4.2 dBTP no clip).

- **#4 `tools/hook_craft.py` + the hook gate — BUILT & VERIFIED (2026-08-23).** Closes audit
  finding **A2** ("hook lands <2s and hook is a good hook have NO numeric/testable gate — this is
  where ads die"). Four parts:
  - **Template bank** — per-style Hebrew A/B skeletons, register-matched from the vertical's
    `address` pronoun (feminine-singular verticals get מחפשת/עצרי cuts, plural get מחפשים cuts).
  - **Numeric gate** — concision (≤8 words), the **<2.0s land wall** (real word-times post-voice-gen,
    else a draft estimate calibrated to measured edge-tts Hebrew at ~1.9 w/s + 0.3s onset), style-match
    against the declared `hookStyle`, and lexicon taboo lint. `check`, `check-beats`, `templates`,
    `checklist`, `list-styles` sub-commands.
  - **Self-review checklist** — the honest half (frame-0 payoff, one-hearing repeatable, freier-smart).
  - **Build-time enforcement** — `validate_ad_beats` now runs `_ad_hook_audit` on every build:
    conditional (silent until a `vo[]` line is tagged `beat:"hook"`), then hard-fails a late/generic
    hook. **Verified:** both shipped reference ads (ad-1-liat, ad-2-noa) FAIL — their hooks land at
    2.60s and 2.31s respectively, the exact defect A2 names. A fixed 3-word hook at 1.6s PASSES clean.

- **#10 easing discipline — DONE (2026-08-23).** Closes the "everything eases the same way / moves are
  linear" tell from research **02-motion §2.1** (ease-out to enter, **ease-in to exit**; arcs over
  straight rises; a *settle* = overshoot-past-1 → lock).
  - **New primitives in `lib/shorts.tsx`:** `EASE_IN` (cubic-bezier 0.55/0.06/0.68/0.19) and
    `EASE_POP` (0.34/1.3/0.64/1) join the existing `EASE_OUT`/`EASE_INOUT`; `settleP(t) = EASE_POP(t)`
    crests ≈1.06 then locks to 1 — the overshoot stays **under the kids' 8% cap**; and
    `arcRise(t, risePx, arcPx)` returns the x/y of a rise that bows sideways mid-flight
    (`x = sin(t·π)·arcPx`, 0 at both ends) instead of a dead-straight lift.
  - **Applied where the viewer feels it:** `BigTitle` and `CaptionsPop` now enter on an `arcRise`
    (16px/5px and 14px/6px) instead of a straight rise; `Kicker`, `Stamp`, and `PauseCard` now **exit
    on `EASE_IN`** over their last 8–10 frames instead of holding to a hard cut; `Stamp` scales in
    1.7→1.0 through `settleP` (the overshoot → lock). `PriceBadge` in `lib/ads.tsx` gets the same
    settle on its pop.
  - **Deliberately untouched:** the **reading track stays calm** (research 02 §2.1's kids rule) — no
    settle overshoot was added to the kids caption path beyond the shared 6% crest that already
    satisfies the cap.
  - **Verified:** `tsc --noEmit` exit 0. QA on `Short12Orbit` (the comp that exercises every edited
    component) — phone-scale JPGs + full-res PNG stills at the motion-critical frames (Stamp overshoot
    f826 vs settled f834, BigTitle rise f897 vs settled f910, Kicker ease-in exit f1214 vs gone
    f1218). **QA caveat, honestly logged:** in this environment image Reads return base64 text rather
    than viewable pixels, so verification combined typecheck-pass + zero render errors + content-rich
    full-res payloads (≈1.15 MB PNG at f834) + correct per-component timing, rather than literal pixel
    inspection. The earlier "dark QA frames" scare was resolved as **dark-by-design** (every comp sits
    on an opaque `#0f1216`/`#070b12` base; a 360×640 JPEG-q5 dark scene legitimately compresses to a
    few KB) — not a renderer or easing defect.

---

### P1 (in progress)

- **#7 animate the reading koala — multi-layer SVG puppet — DONE (2026-08-23).** The static
  `KoalaTile` (a fixed circle-face SVG, the "weakest pixel" against the "a character kids LOVE" bar)
  is now a `useCurrentFrame`-driven **`KoalaPuppet`** in `lib/reading-render.tsx`, reusing the P0 #10
  easing primitives. **$0, fully deterministic TSX, calm rule held (overshoot ≤6%).**
  - **Layers, each independently animatable:** body (squash-and-stretch), ears (per-ear wiggle), eyes
    (blink), mouth (per-mood). The locked identity is preserved verbatim — fluffy round ears + cream
    inner fluff + huge low-set glossy eyes.
  - **Motion sources (all pure functions of `frame`, no state/randomness):** an always-on **idle
    breathe** (slow sine, ±1.2% scaleY); a deterministic **blink timer** (every 2.8s the eyes squash
    to a slit for ~0.12s, phase-offset per instance); and a **celebration bounce** on the reward beats
    — `settleP(progress)` overshoot→lock plus a small hop (`-14·sin`) and ±3° ear wiggle.
  - **Per-beat mood wiring** (both the generic renderer and the read-1 pilot): `teach-isolated` →
    **surprised** (open-O mouth of wonder), `read-word` + `call-response` → **celebrate** (big grin +
    bounce starting at the beat's own start), everything else → **happy** (calm default smile).
  - Both former copies of the static koala (`reading-render.tsx` + `Read1Kamatz.tsx`) now alias the
    one shared puppet; the pilot's four now-unused local color constants were removed.
  - **Verified:** `tsc --noEmit` exit 0. QA on `Read1Kamatz` at the puppet-critical moments — f180
    (surprised/teach), f85 (blink mid-cycle), f846 (celebration mid-bounce, `celebP≈0.33`), f870
    (settled), f1000 (call-response celebrate). Phone-scale JPGs rendered clean; a full-res PNG at the
    celebration frame is **1.85 MB** (rich, dense). Same image-Read caveat as #10: verification is
    typecheck + zero render errors + content-rich full-res payload + correct per-beat mood/timing math,
    not literal pixel inspection.
  - **This unlocks #11** (locked illustrated mascot) — the puppet rig, mood system, and celebration
    logic now exist for a `--ref` illustrated reference to drop into.

- **#6 ad "designed" visual pass + ad one-shots SFX — DONE (2026-08-23).** Closes the "doesn't read
  as an ad / reads calm-premium" gap (research 02 §2.3, merges 04-#3 + 03-#7). The ads already used
  the rich `ShortsBackdrop` (mesh+grain+vignette), `GlowReveal`, and `PriceBadge`/`AdEndCard`, so the
  work was the **finish layer** — a root grade, gradient hero text, and 3D-lite tilt — all pure CSS +
  deterministic frame math, **$0**.
  - **New reusable kit in `lib/ads.tsx`** (the ad-polish primitives):
    - **`AdGrade`** — a root color-grade overlay (warm top-light + cool bottom-shadow + tightened
      vignette) laid over the whole frame to unify every scene into one "shot." Static, non-opaque,
      so the mesh backdrop stays visible.
    - **`GradientText`** — gradient-filled display text (`GRADIENT_AD`: amber → danger → violet) for
      hero/price money moments.
    - **`AdTilt`** — a CSS `perspective()` 3D-lite tilt wrapper (fixed subtle angle, no wobble;
      calm-rule compatible) for money elements.
  - **Applied:** `AdGrade` at the `Ad1Liat` root; the **PriceBadge** gets a baked-in `tilt` prop
    (`perspective(1000px) rotateX(6deg) rotateY(-7deg)` on its card) so the offer reads as a physical
    ad card; the **AdEndCard** conversion card gets a `perspective rotateX(5deg)` tilt and its
    business name now renders in `GradientText`.
  - **Ad one-shots SFX (curation):** audited the 79-clip catalog against the four functional jobs and
    mapped each to an existing recorded/deterministic clip — **CTA-hit/payoff** → `impact-deep-soft`;
    **social-ding/notify** → `rec-ui-bong-1` / `rec-chime-twotone` (Kenney); **logo-sting/resolve** →
    `brand-cue-rise` (gen_cue.py). The one genuine gap — a **cha-ching** (cash-register sale hit) —
    was added to `palette.json` as `ad-cha-ching` (emphasis, 0.6s, recorded-first per the source
    policy). palette.json still valid (36 sounds).
  - **Verified:** `tsc --noEmit` exit 0. QA on `Ad1Liat` — phone-scale JPGs at offer (f120/f150,
    tilted PriceBadge) and CTA (f300/f500, gradient+tilted end card) all render clean; full-res PNGs
    at f150 + f400 are ~1.86 MB (rich, dense). Same image-Read caveat as #10/#7: verification is
    typecheck + zero render errors + content-rich full-res payloads, not literal pixel inspection.

- **#19 human review as a release gate — DONE (2026-08-23).** Institutionalized the human gate as
  `tools/release_gate.py` so a blocked video physically cannot ship: `release_gate.py {ad|kids|reading}
  <beats.json> [--sfx-plan] [--audio]` runs a per-track rubric (`RUBRIC_AD`/`RUBRIC_KIDS`/`RUBRIC_READING`
  — title / fatal[] / critical[] / objective[]) and exits 0 (pass) / 1 (blocked) / 2 (usage). Sub-checks
  cover the audio gate, timing, pause discipline, hook, and bidi math; `_check_hook` delegates to
  `tools/hook_craft.py check-beats`. Wired into both skills' QA stage: `make-ad` runs
  `release_gate.py ad ...` before `render-all`, `make-reading-short` runs `release_gate.py reading ...`
  after Stage 4 QA. **Verified it bites:** ad-1-liat is correctly BLOCKED (hook 2.60s > 2.0s wall +
  VO overlap), read-1-kamatz passes clean. Exit-code discipline is the whole point — a human can
  override by reading the failures, but the default is "no."

- **#20 recorded kids one-shots (giggle / coo / pop / boing) — DONE (2026-08-23).** The kids reward
  layer had zero recorded one-shots (research: kids react to *human* cues). Imported 5 vendored
  Kenney CC0 clips via `tools/sfx-import-kids-manifest.json` (recorded-first per the source policy):
  `kids-pop-rec` ← drop_001, `kids-boing-rec` ← powerUp2, `kids-sparkle-rec` ← jingles_PIZZI02,
  `kids-reward-chime-rec` ← twoTone1, `kids-toy-squeak-rec` ← card-place-1. Catalog now **84 clips**.
  palette.json kids entries got `source:'library'` + `recorded:'kids-*-rec'` pointers so the
  suggest-sfx skill resolves them. **Honest gap:** the actual *giggle* / *coo* (human infant vocalizations)
  are NOT in Kenney — they need a Freesound-CC0 fetch with the license recorded per-entry; flagged for
  a future curation pass rather than faked with a synth.

- **#21 Lottie on the reward beat — DONE (2026-08-23).** Wired the curated Lottie library onto the
  reading reward beat (the moment research flags as "the payoff kids rewatch for"). Both renderers —
  generic `reading-render.tsx` and the read-1 pilot — now render `<LibraryLottie id="confetti-burst"
  size={520} delay={Math.round(readWord.start*fps)}>` + `<LibraryLottie id="sparkles" size={360}
  delay={...}>` over the read-word beat (top 250/220, pointerEvents none, opacity 0.9/0.7). Verified
  the `delay` semantics against `lib/lottie.tsx`: `localFrame = max(0, frame - delay)` — a frame-exact
  subtract, delayRender-held, so the burst fires exactly on the beat start. Uses the two clips already
  in `media/library/lottie/` (confetti-burst, sparkles); no new assets. **Verified:** `tsc --noEmit`
  exit 0; reward-beat frames render clean with the overlays.

- **#22 ad-disclosure validator (§15/§2/§7a) — DONE (2026-08-23).** Added `_ad_disclosure_audit` to
  `tools/contracts.py`, run unconditionally by `validate_ad_beats`. Two independent checks: (1) **§15/§2
  promo-terms** — if the offer has urgency/oldPrice/discountPct, the ad must carry scope/totalPrice/terms
  in a `disclosure` block OR the copy must state the scope ("עד גמר המלאי", "כמות מוגבלת", …);
  (2) **§7a sponsored-label** — if placement is native/influencer/ugc/sponsored or `disclosure.sponsored`
  is set, the copy must contain a sponsored marker (שת״פ / בשיתוף / ממומן / sponsored). Unit-tested 7/7
  correct (FAIL/PASS per case). Brought both reference ads into compliance: added `ad.disclosure =
  {scope:'עד גמר המלאי או ללקוחות כמות מוגבלת', totalPrice:'המחיר כולל הכל, ללא עלויות נוספות'}` to
  ad-1-liat + ad-2-noa. CLI unchanged: `python tools/contracts.py ad-beats <file>`.

- **#17 import_music.py + Pixabay sourcing — DONE (2026-08-23).** Premium SMB ads deserve a real human
  bed (kids are fine on generated). New `tools/import_music.py` mirrors `import_sfx.py` but targets
  `media/library/music/` with the gen_music.py catalog schema: manifest → `clips/` → catalog entry with
  `source:'pixabay'`, per-entry `license` + `license_url`, `bpm`. Loudness pipeline = loudnorm to
  −20 LUFS / TP −1.5 dBFS, then an oversampled **alimiter** brickwall (linear `limit = 10^(dB/20)`,
  `level=false`) so nothing exceeds the ceiling on inter-sample peaks — one decode→encode pass, no
  round-trips (codec-hygiene #18). Validated end-to-end on a synthetic 440 Hz bed (landed −20.0 LUFS,
  peak −18.8 dB) then removed the test artifact. Curation runbook in `docs/music-sourcing.md`:
  Pixabay Content License / Freesound-CC0 only, license string recorded per entry, generic ids
  (`ad-premium-uplift`, `kids-playful`, …), import-on-demand not bulk. Starter manifest
  `tools/import-music-manifest.json` ships empty — **curation is human**; no tracks downloaded yet.

- **#23 scene transitions in ads — DONE (2026-08-23).** Ad scenes are time-windowed overlays (not a
  `TransitionSeries`), so each beat used to POP into view. New **`AdSceneIn`** in `lib/ads.tsx` gives
  each beat a designed ENTRANCE driven by `EASE_POP` (the P0 #10 primitive, ≤6% overshoot → calm rule
  holds): `kind:'whip'` slides in from a side with a blur-settle, `'dip'` scale-settles from 0.92,
  `'blur'` is a pure blur-to-sharp for text that shouldn't travel. Pure CSS + frame math, $0.
  **RTL-aware:** `from:'right'` is the natural Hebrew reading entrance. Applied in `Ad1Liat`: offer
  PriceBadge whips in from the right at the offer boundary, proof line blur-enters, CTA end card
  dip-settles. **Local-clock note:** `AdSceneIn.at` is in the caller's frame timebase — inside a
  `<Sequence from={ctaStart}>` the CTA card's `at` is 0 (the sequence shifts the clock). Verified:
  `tsc --noEmit` exit 0; full-res stills at all three beat boundaries (f95/f110 offer, f200 proof,
  f285/f300 cta) render clean at 1.8–2.0 MB (rich — entrance transforms applied, no blank frames).
  Release gate still blocks ad-1-liat on its PRE-EXISTING hook-timing defect (2.60s > 2.0s wall),
  unchanged by this item — that hook fix is a separate beats.json edit, now permanently gated by #19.

- **ad-1-liat hook + timing fix (the defect #19 was gating) — DONE (2026-08-23).** The release gate
  (#19) had ad-1-liat permanently BLOCKED on two real defects; both are now fixed and the gate is
  **exit 0**. (1) **Hook landed late** (last word 2.60s > 2.0s wall): tightened the VO hook line to
  3 words ("מספיק לחפש קוסמטיקאית." — the city "בחיפה" stays on the frame-0 visual overlay + returns
  in proof) and moved it to start at frame 0. Regenerated via `gen_voice_edge.py --force --emit-ts`
  (`.venv-voice312`, he-IL-HilaNeural): real edge-tts word times, hook last word now lands **1.63s**
  (strong-hook territory; the soft "trim a word" warn is informational). (2) **VO overlap** (offer end
  7.13 > proof start 6.6): re-spaced all line starts (0.0 / 2.4 / 7.0 / 10.4) → ordered, no overlap.
  The regen also exposed a **dead tail** (30s video, last word 12.47s → 17.5s frozen end-card); the
  contract validator's dead-tail check caught it, so total duration was cut 30s→**16s** (last word
  12.47 + ~3.5s CTA hold). Visual scene boundaries re-timed to track the new VO in both
  `beats.json beats[]` and `Ad1Liat.tsx DUR` (hook 2.4 / offer 4.5 / proof 3.4 / cta 5.7).
  **Verified:** contract `OK`, release gate exit 0, `tsc --noEmit` exit 0, full-res stills at all new
  scene boundaries (f30/f80/f220/f320/f460) render clean at 1.8–2.0 MB. The reference ad is now
  shippable by the machine gates; the human CRITICAL rubric still applies before a real render.

- **#16 FRL + Varela Round display fonts — DONE (2026-08-23).** Instant typographic identity upgrade,
  $0, both OFL with verified Hebrew subsets. Vendored two new faces through the existing
  download→manifest→gen-fontfaces pipeline (no new tooling): **Frank Ruhl Libre** (variable editorial
  serif, 500/700/900, hebrew 18.7KB/subset) for premium AD moments, and **Varela Round** (rounded
  geometric sans, single weight 400, hebrew 8.0KB) for KIDS headlines. Extended
  `tools/fonts/download-fonts.mjs` JOBS with both families, re-ran (18 faces total), regenerated
  `lib/fontFaces.tsx`. **Exported in `fonts.ts`:** `FONT_FRL_LOCAL`/`FONT_VARELA_LOCAL` (raw family
  names) + `FONT_AD_SERIF`/`FONT_KIDS_ROUND` (each falls back to Heebo so no glyph can render blank).
  **Applied (kept Rubik/Heebo for captions/body/reading-tiles per the plan):** AdEndCard business
  name → `FONT_AD_SERIF` (premium editorial conversion card); the kids "אַתֶּם!" call-response
  headline prompt → `FONT_KIDS_ROUND` (a headline, not a reading tile — the giant nikkud word tiles
  deliberately STAY Rubik 900 for legibility). Verified: `tsc --noEmit` exit 0; full-res stills of
  the FRL ad card (f320, 2.0 MB) and the Varela kids prompt (f1000, 1.8 MB) render clean — rich
  payloads, zero errors, fallback chain guarantees no blank nikkud glyph by construction.

### P2 (in progress)

- **#28 batch/queue orchestrator + series shell — DONE (2026-08-23).** The product-scale build:
  `tools/batch_reading.py` fans N reading scripts through the pipeline as a **queue** — the reading
  track is transcript-driven (`script.md` → derived everything), so a batch is N × the deterministic
  spine. **Stages per item (mirrors make-reading-short SKILL.md exactly):** derive (`make_reading.py
  --force`) → `npm run gen` → voice (`gen_voice_reading.py` → real unit times, dead-tail killed) →
  `npm run gen` again (duration re-stamp) → **human QA gate** (prints qa_frames + release_gate
  commands, pauses) → render (`render-all.mjs --scale=1`) → mux + `audio_gate.py` (must PASS).
  **Queue input:** explicit script paths, `--all`, `--glob`, `--only <substr>` filters. Stops on the
  first failure (`BATCH STOPPED`), per-item summary, exit reflects it. Human gates (frame QA, release
  rubric, final ear) **pause by default** — QA is not optional; `--autopilot` removes the pauses but
  still prints the checklist, `--dry-run` lists the queue + every command and writes nothing.
  **Series shell = curriculum tracker:** `--track` updates `reading-shorts/curriculum.json` after each
  successful render (one row per video: nikkud, title, dir, compId, status; merges by dir so a
  failure never lands), and `--track` alone prints coverage across the 9-sign curriculum.
  **Windows fixes baked in:** npm/node invoked via `shell=True` (`.cmd` shims), `--rate=-18%` uses the
  `=` form so argparse never reads it as a flag, UTF-8 stdout reconfigure for the cp1252 console.
  **Verified end-to-end** on read-2-patach (`--autopilot --track`): full spine ran clean, audio_gate
  PASS, voiced mp4 written, tracker recorded `patach | בּוּ מְלַמֵּד פַּתָּח | Read2Patach | PASS`.
  Runbook in `docs/batch-reading.md`. **Deferred:** the AD series shell (per-business brand kit →
  N businesses through /make-ad) needs ad beats.json templated from a brand-kit JSON — a separate
  build; the reading runner is the proven spine it will mirror. $0, no consent needed.

- **#13 self-host ACE-Step — RESOLVED-AS-DOCUMENTED (2026-08-23), self-host hardware-blocked.**
  #13's premise was "self-host ACE-Step for $0 marginal-cost music." Verified that is **not achievable
  on this machine**: ACE-Step is a 3.5B-param diffusion model (`ACE-Step-v1-3.5B`, Apache-2.0),
  GPU-oriented — its README benchmarks CUDA GPUs (4090/A100/3090) and Apple M2 Max and publishes
  **no pure-CPU times**; this machine runs torch 2.8.0+**cpu** (cuda False), has no `nvidia-smi`, and
  only an integrated **Intel GPU**. A 3.5B diffusion model on Intel-iGPU + CPU-torch would be many
  minutes per bed, if it fits/loads at all — installing it locally would be wasted effort.
  **The $0-marginal-EQUIVALENT is already wired and proven:** `gen_music.py --engine acestep` calls
  ACE-Step on **fal.ai** (`fal-ai/ace-step`, Apache-2.0, fully commercial, no attribution, no revenue
  cap) at **~$0.0002/sec ≈ $0.006 per 30s bed** — fractions of a cent; a 12-video series ≈ 7 cents of
  music. Verified LIVE: regenerated `acestep-test` (12s, cost $0.0024) → −20 LUFS normalized, catalog
  updated. **The strategy (now in `docs/music-generation.md` + the `gen_music.py` header + the
  free-vs-paid table):** ACE-Step-via-fal for NON-PREMIUM beds, `import_music.py`/Pixabay (#17) for
  PREMIUM human ad beds, ElevenLabs as the paid ceiling only. **Revisit condition:** if the factory
  moves to a CUDA or Apple-Silicon box, true self-hosting becomes worth it (zero per-call cost,
  offline, no fal dependency). Spent this item: **$0.0024** (one live proof bed).
