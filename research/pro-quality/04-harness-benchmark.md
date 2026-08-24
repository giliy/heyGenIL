# 04 — Harness audit + professional benchmark

**Assignment:** Harness audit + professional benchmark.
**Scope:** (1) define the "pro bar" for Track A (Israeli SMB ads) and Track B (kids learning), (2) audit the
current pipeline end-to-end for every place quality can leak and whether a guard exists, (3) product gaps
beyond per-video quality, (4) rank gaps by "does this stop a sale."

**Date:** 2026-08-23. **Companions:** this file sits in `research/pro-quality/` alongside the voice/visual/sound
tool reports (04-* siblings cover those tools). This file is the *benchmark* and *gap audit* — it does NOT
re-derive tool research (voice/visual/sound are covered by the other three agents).

**What I read (the harness):** `.claude/skills/{make-ad,make-reading-short,make-short,orchestrate}/*.md`,
`.claude/agents/{story-writer,voice,pixel,build,qa,mix}.md`, `tools/{contracts,audio_gate,lexicon,make_reading,
gen_voice_edge,gen_voice_reading,mix_sfx,mix_music,gen_music}.py`, `remotion/scripts/{qa_frames,render-all}.mjs`,
`remotion/src/lib/ads.tsx`, `brand.md`, the reference productions (`shorts/ad-1-liat`, `shorts/short-16-formy`,
`reading-shorts/read-1-kamatz`, `read-2-patach`), the SFX/music catalogs, and the prior research:
`research/hebrew-ads/{hebrew-ads-deep-dive,harness-plan}.md`, `research/hebrew-kids/{01,02,04,07}.md`,
`research/hebrew-reading/00-findings.md`.

**Verification honesty:** Brave returned HTTP 429 on every attempt this session (8+ tries over ~40 min); Bing
degraded to junk on topical queries; Seznam/Yahoo cannot process Hebrew; Bing News returned zero for the
Hebrew ad queries. I therefore did NOT independently re-verify Israeli market pricing — I build on the
well-sourced figures in `hebrew-ads-deep-dive.md` (which ran 17 agents / 871 tool calls in a prior session).
What I DID verify fresh on the web: the competing AI-ad tools (Quickads, Creatify, AdCreative) — their formats,
pricing, languages, and quality ceilings. Anything resting only on prior repo research is labeled `(repo)`.
Anything I could not verify at all is `UNVERIFIED`.

---

# PART 1 — The pro bar

## 1a. Track A — Israeli SMB ads: what "professional" means

### What Israeli business owners actually pay (repo-sourced, `hebrew-ads-deep-dive.md` §2)
- **Produced promo video (סרטון תדמית):** ₪1,200–2,800 for a simple 30–60s; ₪3,000–5,500 mid; ₪12,000–25,000+
  for complex/brand work.
- **Social-media management agencies:** ₪3,000–5,000/mo typical SMB retainer.
- **AI-content tool subscriptions:** ₪109–1,399/mo (ActiveTrail anchors the SMB SaaS market at ₪50–60/mo).
- **The price-sensitivity reality:** <₪100/mo = impulse-buy band (Netflix-tier); ₪100–300 = "real tool" needing ROI;
  ₪400+ = agency tier. The $25–50/mo band has the HIGHEST B2B churn (8.6%/mo) — retention > acquisition.

### What those payments buy — the professional delivery contract (repo + my synthesis)
An Israeli SMB paying ₪2,000–5,500 for a promo expects, concretely:
1. **A conversion surface, not a film.** One offer, one price (in ₪), one CTA (WhatsApp/phone), tappable. The
   repo's `ad{}` contract already models this exactly (business/offer/cta/brand).
2. **Hook in the first 2 seconds.** Frame-0 fully composed, payoff visible — no fade-from-black, no logo intro.
   The repo's "frame 0 FULLY composed" rule matches this.
3. **Correct spoken Hebrew with correct RTL burned captions.** This is the repo's core moat — no competitor ships it.
4. **The math is true** (price/oldPrice/discount all agree) and the **freier-code** is honored (prove the buyer is
   smart, never cheap). The `PriceBadge` derives discount from price/oldPrice so it can't lie.
5. **A name and a face / a business identity** — a named owner speaking dugri out-trusts a faceless brand.
6. **Turnaround.** SMB owners want days, not weeks. An AI pipeline at zero COGS delivers this where a production
   company cannot.

### What the AI-ad tools deliver (VERIFIED fresh this session — the competitive ceiling)
I pulled Quickads, Creatify, and AdCreative.ai directly:

| Tool | Pricing (verified) | Formats | Hebrew? | Quality ceiling |
|---|---|---|---|---|
| **Quickads.ai** | $9 Starter / $39 Small Biz / $99 Agency / $1 trial | Image + 30–60s video ads, templates, AI avatars w/ lip-sync, 100+ avatars, 16M+ stock B-roll | **Hebrew NOT listed** (35+ langs, named: Hindi/Tamil/et al.) | "Template-based creative constraints" — tuned for proven formats, NOT experimental design. Production-ready for feed, not hero |
| **Creatify** | Free (10 cr, watermarked) / $39 Starter / $99 Pro | UGC-style ads from a product URL; 300/1500 AI actors + custom avatars; captions+VO; ad launcher | **Hebrew NOT confirmed** (claims 75+ langs, none listed) | "Actor realism a tier below Arcads' best"; **"scripts serviceable but generic — winning hooks still need human editing"**; feed-testing tool, not hero creative |
| **AdCreative.ai** | agency-tier | Static + video ad creative, product photoshoots, copy | — | creative-first; strategy is on you |

**Three hard conclusions for the benchmark:**
1. **No AI-ad tool ships natural Hebrew + correct RTL burned captions + Israeli cultural context.** Quickads and
   Creatify are the two leading "AI ad" tools in the world and neither documents Hebrew. The repo's lane is still open.
2. **The AI-tool quality ceiling is real and it is "feed-grade, not hero-grade."** Creatify's own reviewers say the
   auto-generated scripts are generic and need human hook editing. This is the *most important benchmark datapoint*:
   **a fully-automated script will read as generic — the repo must make the human hook-craft (or a very strong
   hook-template engine) part of the product, not an afterthought.** Quickads hides this behind 20M+ training ads +
   "Discovery Engine"; the repo's per-vertical lexicon + hook_styles is the honest equivalent.
3. **The bar is "looks produced, not AI."** Both tools pitch "production-ready, not cheap AI-generated." Israeli
   consumers are AI-distrustful (a "Created with AI" label cuts clicks ~31.5%, repo). **The #1 quality gate for a
   sellable ad is: does it look/sound professionally produced, not obviously synthetic.**

### The repo vs. the pro bar for ads — gap summary
| Pro-bar element | Repo status |
|---|---|
| Hook <2s, frame-0 composed | ✅ hard rule (make-ad Stage 1/3) |
| One offer / price / CTA, tappable end card | ✅ `ad{}` contract + `validate_ad_beats` + AdEndCard |
| True math (freier-proof) | ✅ PriceBadge derives discount; QA checklist |
| Correct Hebrew + RTL captions | ✅ edge-tts + ads.tsx bidi formatters |
| Named-owner dugri trust | ⚠️ lexicon supports `דוגרי`/named-owner register but **no per-video "owner" element** — a "from a named owner" CTA is copy, not a branded on-screen identity. NOT a hard gate. |
| **Doesn't look AI** | ⚠️ **The core open risk** — see Proposals #1/#2/#3 |
| Production-grade visuals (not template-slideshow) | ⚠️ TSX animation is premium-brand (Linear/Anthropic aesthetic) but ads need **louder, higher-contrast, more "ad" energy** than the calm base — ad-mode override exists in skill but the actual visuals lean calm-premium. See Proposal #3. |

## 1b. Track B — Kids learning: what "high-end" means

### The global bar (repo-sourced, `hebrew-kids/01` + `hebrew-reading/00-findings.md`)
The best-in-class tier (Blippi, Cocomelon, Ms Rachel, Khan Academy Kids, and Israeli Kan/Hop!) share a
documented production recipe:
1. **A locked, recurring character front-and-center** — one face, one color, one personality, never redesigned.
   The repo's בּוּ koala with `character.json` LOCK is exactly this.
2. **Music or a signature sound in the first seconds** — audio is the hook; toddlers can't read titles.
3. **Hook <2s via character face/motion** filling frame. No intros/logos/establishing shots.
4. **One idea per video, resolved** — never two.
5. **Predictable, formulaic structure + repetition ≥3×** — repetition is HOW 2-5s learn (Cocomelon/Beurkens);
   rewatch-identical loops.
6. **Participation built in** — call-and-response with a **genuine 2-4s engineered pause** (the Ms. Rachel / SLP
   method: pause-and-wait, expand, recast, narrate-like-a-sportscaster).
7. **Calm, not hyper** — Lillard & Peterson: fast-paced cartoons (scene change ~11s) impair executive function;
   calm pacing (change ~34s) is the **differentiator** and the repo's explicit positioning ("the Shorts you don't
   have to feel guilty about," `hebrew-kids/02` gap #4).
8. **Warm resolution / belonging** — chaos without warmth reads scary; warmth without chaos reads boring.
9. **Parent-safe** — no startling cuts, no mean humor, **no uncanny AI weirdness** (the Feb-2026 NYT investigation
   into AI kids' "slop" is pushing parents toward trusted brands — this is the opportunity AND the risk).

### The Hebrew-market bar (repo-sourced, `hebrew-kids/02` + `hebrew-reading/00-findings.md`)
- **The #1 gap:** no dominant Hebrew-first original at the top; imports (Masha, Disney) are dubs, TuTiTu is
  wordless-English. **A premium, calm, Hebrew-native shorts series is best-in-class by default.**
- **Educational short-form is fragmented and enthusiast-grade** (TopKids, Tzofi, EZtoddler). Professional craft
  wins immediately.
- **Parental demand + fear:** parents want Hebrew content but fear Shorts' downsides and are actively blocking
  it. Positioning = **"the Shorts you don't have to feel guilty about": Hebrew, educational, calm-paced, ad-safe.**
- **Reading (ages 5-7):** the curriculum is settled (synthetic phonics on pointed script, one nikkud per video,
  isolated→CV→blend→word ladder). **The gap: sub-word highlight synced to the exact phoneme exists NOWHERE** —
  the repo owns it. Everything today is long-form or name-recitation songs.

### What signals "safe, high-quality, worth paying for" to an Israeli parent
Synthesizing `hebrew-kids/01,02` + `hebrew-reading/00` — the trust signals a parent reads:
1. **Calm pacing** (anti-overstimulation) — the differentiator and the sale.
2. **Correct, warm child-directed Hebrew** (motherese register: `07-hebrew-language-kids.md` — gendered address,
   -י diminutives, repetition, 3-6-word sentences, 2-4s call-and-response pauses).
3. **Educational rigor** — correct nikkud (a wrong vowel is the worst-case bug), a real curriculum ladder,
   SLP-style interaction, not just entertainment.
4. **A consistent, warm original character** (not an uncanny AI avatar, not a dub).
5. **Cultural authenticity** — Shabbat/chagim/public-domain canon, Israeli playground rhymes — that imports
   structurally can't touch.
6. **Production polish** — clean audio (edge-tts motherese at slowed rate), proper music bed, tasteful playful SFX.
7. **Ad-safe / no-CTA** — no creepy tracking, no in-content selling.

### The repo vs. the pro bar for kids — gap summary
| Pro-bar element | Repo status |
|---|---|
| Locked recurring character | ✅ בּוּ koala `character.json` LOCK; in-TSX tile for reading (no AI stills) |
| Hook <2s with face/motion | ✅ mode:"kids" hard rule (hook <2s, face fills frame) |
| One idea / resolved warmly | ✅ 4-beat reading ladder + hook/call |
| Repetition ≥3× + predictable formula | ✅ skill rule (reading repeats the sound, call-and-response) |
| **Engineered 2-4s call-and-response pause** | ⚠️ described as a hard rule in `07` + `brand.md` but **NOT enforced by any validator** — a script that trims the pause ships. The `call` beat exists and the voice pipeline preserves it, but there is no numeric guard that the pause is 2-4s. See Proposals. |
| **Calm pacing** | ✅ `mode:"kids"` + brand.md (no snap cuts <10s); reading uses slowed rate |
| **Correct nikkud** | ✅ nikkud.py + nikkud_data.py lexicon; per-mark pixel QA gate; listening_qa.py |
| **Sub-word highlight sync** | ✅ the moat — per-clip isolation + energy trim, `vo[].units[]` |
| Music / signature sound in first seconds | ⚠️ kids beds exist (kids-play-ukulele etc.) but **no mandatory "signature sound/catchphrase at t=0" gate**; music is an optional Stage-6 step |
| Parent-safe / no uncanny AI | ✅ no-CTA rule; in-TSX tile avoids uncanny avatars |
| **Production polish (audio)** | ⚠️ voice naturalness ceiling = edge-tts adult voices slowed; no true child/animated voice. See voice-agent report + Proposal #6 |

---

# PART 2 — Harness audit (end-to-end quality-leak map)

I traced the full pipeline for both tracks. Here is every place quality can leak, whether a guard/test exists,
and the severity.

Legend: **G** = a guard/test EXISTS (validator, qa_frames, audio_gate, lexicon lint, listening QA). **N** = NO guard.
**P** = partial / human-eye-only / not enforced by a numeric gate.

## Track A — make-ad pipeline (brief → script → TSX → voice → SFX → music → mux)

| # | Stage | Where quality can leak | Guard? | Notes |
|---|---|---|---|---|
| A1 | Interrogation | A business brief with no offer/price/phone ships a hollow ad | **G** | `validate_ad_beats` hard-fails missing `ad.business/offer/cta`; skill pushes until fields are real. Solid. |
| A2 | Script/hook | Hook lands after 2s, or reads generic | **P** | `hook_styles` in lexicon guides selection; frame-0-composed is a QA rule; but **"hook lands <2s" and "hook is a good hook" have NO numeric/testable gate** — it's human-drafted. This is where ads die. (Proposal #1.) |
| A3 | Register/gender/CTA correctness | Wrong gender for beauty, wrong CTA (`תפוס מקום` for a restaurant) | **G** | `lexicon.py --check` lints drafted lines against never-CTA + taboos; per-vertical register is baked. Strong. |
| A4 | Regulation (sale disclosure, influencer label) | A sale ad missing scope/discount/total-price disclosure; undated native ad | **P** | Skill states the rules; **no validator checks that a `sale`/`urgency` offer carries its scope line or a disclosure.** A wrong-discount is caught (PriceBadge), but a legally-required disclosure line is copy-only. Medium risk. |
| A5 | **Timing — VO overlap** (heard defect) | Line N's speech bleeds under line N+1 | **G** | `validate_ad_beats._ad_timing_audit` hard-fails on real word-time overlap. Excellent. |
| A6 | **Timing — dead tail** (heard defect) | Video ends on a frozen silent frame; or cuts before last word | **G** | `_ad_timing_audit` enforces total = last-speech-end + 1.0–4.0s. The two heard defects are BOTH gated in code. Excellent. |
| A7 | **Timing — SFX landing on a spoken word** | A pop/send-click on a word vanishes or gates the voice | **P** | Skill says "place cues in VO gaps"; `audio_gate --cue` can verify a cue's audibility but **does NOT check that a cue does NOT land on speech** — that's human ear in the audition. Partial. |
| A8 | Visual polish / ad energy | Calm-premium base reads low-energy for a sale; PriceBadge math | **P** | PriceBadge math TRUE (G). But **"louder ad energy" is a skill instruction, not a gate** — no objective check the ad reads "energetic" vs. "calm explainer." (Proposal #3.) |
| A9 | Bidi safety (₪, %, phone) | Hebrew+digit tokens reorder | **G** | `ads.tsx` formatILPrice/formatILPhone/formatILPct + RLM; QA bidi checklist. Strong. |
| A10 | **Voice naturalness** | edge-tts flat vs. a persuasive ad read | **P** | edge-tts = free default; ElevenLabs v3 optional. **No objective "does this VO sound persuasive" gate**; edge-tts adult voices are decent but not emotive. Voice-agent report covers this. |
| A11 | Encoding/mux | Silent AAC (the known incident) | **G** | `ffw.py` resolves full ffmpeg; `audio_gate.py` fails loudly on silent track. Excellent. |
| A12 | Loudness/delivery | Inconsistent loudness across platforms; clipping | **P** | SFX normalized ~-20 LUFS; `audio_gate` checks RMS finite; but **no final loudness target gate** (no "master to -14 LUFS" step). Ads/music/SFX have no integrated loudness normalization. (Proposal #4.) |

## Track B — make-reading-short pipeline (script.md → derive → voice → render → mux)

| # | Stage | Where quality can leak | Guard? | Notes |
|---|---|---|---|---|
| B1 | Author transcript | Wrong pointed Hebrew / wrong vowel (worst-case bug) | **P→G** | `make_reading.py` auto-detects nikkud + **hard-errors on a front-matter/vowel mismatch**; per-phoneme cross-check warns; **but non-vetted words ship with a warning (by design), and correctness ultimately rests on the human + listening QA.** Acceptable for a closed teacher-vetted lexicon. |
| B2 | Sub-word highlight sync | Highlight ≠ spoken unit (the product's promise) | **G** | Per-clip isolation + RMS energy trim = exact by construction; `validate_reading_beats` unit audit (sorted, ⊆ span, isolated/CV must carry units). Strong. |
| B3 | Dead tail | Frozen tail after last speech | **G** | `gen_voice_reading.py` re-derives durationSec = last speech + 2.5s; re-stamps wrapper. Strong. |
| B4 | **Call-and-response pause** | The engineered 2-4s expectant pause gets trimmed to nothing | **N** | Described in `07` + brand.md as a hard rule, but **no validator enforces the pause duration** on the `call`/`hook` beat. If a script puts the answer 0.3s after the question, it ships. This is the single biggest kids-quality leak. (Proposal #2.) |
| B5 | Nikkud mark legibility (patach vs kamatz etc.) | Marks confusable at tile size | **G** | Per-mark pixel QA gate (mandatory) + SBL-Hebrew fallback + `listening_qa.py` acoustic profile. Strong. |
| B6 | Voice pronunciation of isolated units | edge-tts mispronounces a צירוף (shuruk vs vav+dagesh etc.) | **P→G** | `listening_qa.py` flags degenerate units (double-onset, no sustained vowel) → surfaces, records. **But it does not verify the CORRECT phoneme, only a clean envelope** — a wrong-but-clean unit passes. Real gate is human listening QA (mandatory). |
| B7 | Voice naturalness / "kids teacher" register | edge-tts adult voice slowed ≠ a warm motherese teacher | **P** | edge-tts Hila at -18% is the locked בּוּ voice. Functional but not a true animated-character/singing voice. Voice-agent report covers upgrade paths. |
| B8 | Captions/nikkud render | Nikkud clipping at caption size | **P** | brand.md bump lineHeight ~1.5 (rule); QA reads frames. No automated check, but visual QA covers it. |
| B9 | Music/SFX quality | Wrong bed energy; music too loud under voice | **P** | `mix_music.py` hard-ducks under voice; kids beds exist; audition is human. Playful-SFX library still thin (`04-pipeline-fit.md` gap #4). Sound-agent report. |
| B10 | Encoding/mux | Silent AAC / bad loudness | **G** | Same ffw + audio_gate chain as ads. Strong. |

## Cross-cutting / orchestration

| # | Leak | Guard? | Notes |
|---|---|---|---|
| C1 | Contract drift between agents | **G** | `contracts.py` validates every handoff (beats/ad-beats/manifest/qa-contract/qa-verdicts/sfx). Excellent — narrow seams are the design. |
| C2 | QA skipped or rubber-stamped | **G** | QA agent is "the gate, not a formality," reads small JPEGs, must PASS; orchestrator routes on verdict. Strong. |
| C3 | **Human gates are where the real QA lives** | **P** | SFX audition, final ear-check, script-draft quality, "does it look AI" — all human. The automation is strong at *mechanical* correctness (timing, bidi, math, silence) and **weak at *artistic/craft* quality** (hook, energy, naturalness, "does this sell/teach"). This is the honest summary of the whole audit. (Proposals #1, #2, #6, #7.) |
| C4 | Fact verification | **G** | story-writer "facts before flair" + unverified-flag discipline. |

### Audit verdict
The harness is **exceptionally strong on mechanical correctness** — the two heard defects (VO overlap, dead tail),
bidi, math-truth, silent-audio, contract drift are all **gated in code**. That is the hard, automatable 80%.

**Where quality actually leaks is the 20% that is inherently craft, not mechanics:**
1. **Script/hook quality** — no gate, and the AI-tool benchmark says even paid tools need human hook editing.
2. **Kids call-and-response pause** — a hard rule in prose, **zero enforcement in code**.
3. **"Doesn't look/sound AI"** — the sale-deciding factor for both tracks, entirely human-judged.
4. **Voice naturalness** (edge-tts ceiling for ads; no child voice for kids).
5. **Ad energy** (calm base vs. loud sale).
6. **Final loudness/delivery** (no master loudness target).

---

# PART 3 — Product gaps (beyond per-video quality)

## 3a. Consistency across a series
- **Ads:** each ad is a standalone unit; no shared "brand kit" beyond the lexicon. A business buying a *series* of
  ads (weekly WhatsApp promos) has no persisted brand identity file — colors/logo re-entered each time. The
  `harness-plan.md` GTM assumes "saved brand assets" as a stickiness loop but **no such asset store exists in the
  harness**. **GAP: a persisted per-business brand/logo/voice kit.**
- **Kids:** the בּוּ koala `character.json` LOCK is the consistency mechanism — **strong and unique**. But there is
  no curriculum tracker (which nikkud taught, in what order, what's next) — the `nikkud_data` order is a reference,
  not a per-viewer/series progress ledger. A parent-facing series needs a **predictable published curriculum map**.
- **Brand voice across tracks:** `brand.md` centralizes style — good. Kids/ad mode-overrides are documented.

## 3b. Scale / throughput (can it batch?)
- **NO batching today.** Each video is one Claude session producing one composition. The `orchestrate` router is
  single-video. A business wanting 10 ads, or a kids series of 12 nikkud videos, runs 12 sequential sessions.
- The **reading track is the most batch-ready** (script-first, generic renderer, $0) — 12 nikkud videos could be
  queued from 12 script.md files. **GAP: a batch/queue orchestrator that fans out N scripts through the pipeline.**
- Cost scales fine (edge-tts $0, in-TSX tiles $0, ACE-Step music ~$0.0002/s) — the bottleneck is session throughput,
  not money. The repo's own "unlimited compute/tokens" makes this purely an orchestration-engineering task.

## 3c. Localization (Arabic? Russian?)
- **Arabic:** Israel has ~2M Arab citizens; Arabic advertising is a real adjacent market; the Ramadan/Eid calendar
  is already in `harness-plan.md`. edge-tts has Arabic voices; RTL caption machinery is shared (Arabic is RTL).
  **Moderate lift, high adjacent-market value.** But NOT this repo's primary focus (Hebrew-first). Secondary.
- **Russian:** ~1M Russian-speaking Israelis; Russian kids' content (Masha dub) already dominates the "Hebrew" kids
  market. **A Russian or Russian+Hebrew kids series is a genuinely large lane** — but it dilutes the Hebrew-first
  moat. Secondary; revisit after Hebrew series is proven.
- **English export:** the kids series' global-by-construction design (gibberish/simple lyrics) means it could
  localize later (Vlad & Niki's 21-language model). Far future.

## 3d. Platform variants (YouTube/TikTok/IG aspect/length)
- **The harness is hard-locked to 1080×1920 / ~30-42s** — confirmed: no 16:9, no 9:16 variants, no length variants.
  Vertical Shorts/Reels/TikTok all accept 9:16, so 1080×1920 covers the primary surface for all three. **But:**
  - YouTube Shorts **recommend 1080×1920** — fine.
  - **IG Reels crop the bottom ~250px for the caption/UI** — the repo's safe-area (bottom 340px clear) already handles this.
  - **TikTok UI covers right rail + bottom** — handled by safe areas.
  - **No horizontal (16:9) version** for a brand's website/Facebook feed/YouTube main channel — a real ask from SMBs
    who want the same ad on their site. **GAP: a 16:9 re-frame of the same comp.**
  - **No platform-length variants** (a 15s version for IG, a 30s for YouTube) — SMBs often want both.
  - **No captions-burned vs. captions-soft delivery** — some platforms/ads want burned (repo does), some want
    clean video + SRT. Minor.

## 3e. A repeatable product package a business would buy
This is the **biggest product gap** — the harness produces great single videos but there is no productized package:
- **Ad pack (ads):** `harness-plan.md` sketches a WhatsApp-native GTM at ₪49-59/mo (starter) / ₪99 (no watermark,
  brand kit) / ₪399-499 (agency). **None of that is built** — no onboarding, no per-business brand store, no
  WhatsApp delivery, no billing. That's a separate product shell around the harness.
- **Kids series subscription (kids):** a "12-week Hebrew reading program" — one nikkud per week, a curriculum map,
  a parent-facing landing page, a locked character. This is the *most productizable* track: $0 COGS, batchable,
  differentiated (sub-word highlight nowhere else). **GAP: the series shell + curriculum tracker + landing page.**
- **The one-sale test:** an SMB pays for *a video that gets them leads*; a parent pays for *a program that teaches
  their kid to read*. The harness makes videos; the product gap is making **outcomes** repeatable.

---

# PART 4 — Rank the gaps: what stops a sale vs. polish

Fatal = the video itself fails to be a sellable artifact, or the product can't be delivered repeatedly.
Polish = improves quality but doesn't block a sale.

### FATAL (blocks a sale)
1. **Doesn't look/sound professionally-produced (reads as "AI slop").** For both tracks, this is the sale-decider.
   Israeli consumers are AI-distrustful; parents are actively fleeing AI kids' slop. A technically-perfect but
   clearly-synthetic ad or reading video does not convert. **This is the #1 gap.** (Proposals #1, #2, #6, #7 attack it.)
2. **Ad hook/script quality.** The AI-tool benchmark proves even $99/mo paid tools produce "generic scripts needing
   human hook editing." A generic ad = no leads = no renewal. Currently no gate. (Proposal #1.)
3. **Kids call-and-response pause not enforced.** The one teaching mechanism that differentiates calm-premium from
   Cocomelon-overstimulation is a prose rule with no code gate. If it's trimmed, the product loses its differentiation
   silently. (Proposal #2.)
4. **No batch/queue + no series product.** Can't deliver "a program" or "a weekly ad pack" if each video is a manual
   session. The *business* can't scale — this blocks the productized package. (Proposal #9.)

### HIGH (materially hurts quality/renewal but a single good video still sells)
5. **Voice naturalness ceiling** (ads: edge-tts flat read; kids: no true child/animated/singing voice). An ad that
   sounds robotic won't convert; a kids series without a warm distinct voice won't hold a toddler. (Voice-agent report;
   Proposal #6.)
6. **Final loudness/delivery normalization.** Inconsistent loudness reads amateur; no master-LUFS target. (Proposal #4.)
7. **Ad energy / visual polish for a sale** — calm-premium base can under-read as "not a sale." (Proposal #3.)

### MEDIUM (nice-to-have / adjacent)
8. **16:9 + length/platform variants** (SMBs want the same ad on their website/feed). (Proposal #8.)
9. **Persisted brand kit / curriculum tracker** (consistency + stickiness; part of the product shell). (Proposal #9.)
10. **Regulation-disclosure validator** (a legally-required sale-disclosure line is copy-only today). (Proposal #5.)
11. **SFX/music library depth for kids** (playful SFX thin). (Sound-agent report.)

### LOW / polish
12. **Localization (Arabic/Russian/English)** — adjacent, not primary. Postpone.
13. **Captions-soft delivery, no-cue-on-speech guard** — polish.

---

# Proposals (ranked)

Ranked by "does this stop a sale" → then value-per-effort. Effort S/M/L · cost $0/free/paid · quality payoff.

### 1 · Hook-craft engine + "doesn't-read-AI" script gate — **ads**
**What:** Move hook selection from human-draft to a structured engine: per-vertical hook templates (from
`lexicon.json` `hook_styles`), A/B hook variants, a 2-second-hard-stop rule (hook text ≤ 8 words, lands frame-0),
and a script self-review checklist the story-writer runs ("would a human ad-copywriter ship this?" — concreteness,
one offer, no filler, no generic lines). Add a numeric hook test: hook line duration ≤ ~3s, first CTA/reveal present.
**Effort:** M · **Cost:** $0/free · **Payoff:** ads ★★★ / kids ★
**Why rank 1:** The single biggest ad-quality leak and the exact thing the benchmark shows paid tools fail at.
A great hook is the difference between a converting ad and a scrolled-past one.

### 2 · Enforce the 2-4s call-and-response pause — **kids/reading**
**What:** A validator on `mode:"kids"/"reading"` beats that the `call` beat (and any question beat) holds a genuine
2-4s expectant pause (no VO, no SFX) between the question's last word and the answer's first word. Numeric, in
`contracts.py`, mirroring the `_ad_timing_audit` pattern.
**Effort:** S · **Cost:** $0/free · **Payoff:** ads ★ / kids ★★★
**Why rank 2:** The kids product's differentiation (calm, participatory, Ms. Rachel-method) silently disappears if
this pause is trimmed, and today nothing stops it. Tiny effort, protects the core promise.

### 3 · Ad-energy visual pass (louder, higher-contrast, "sale" energy) + a "reads-as-ad" check
**What:** Extend the ad-mode override from prose to the actual `ads.tsx`/brand tokens: a louder palette accent for
ads, bolder scale-pop (raise AD_POP), higher-contrast stroke, an urgency accent — so an ad doesn't read as a calm
explainer. Add a QA checklist item (already partially there) to judge "energetic ad, not calm short."
**Effort:** M · **Cost:** $0/free · **Payoff:** ads ★★★ / kids —
**Why rank 3:** Ads that look like calm premium shorts under-convert. This directly attacks "doesn't read as an ad."

### 4 · Master loudness + delivery gate (integrated loudness target)
**What:** A final loudness-normalization step (`mix_music`/`assemble`) that masters the full mux to a target (e.g.
-14 LUFS for social, ±1 LUFS), plus an `audio_gate` assertion on the final file's integrated loudness + true-peak.
Catch clipping and platform-inconsistent levels.
**Effort:** S-M · **Cost:** $0/free · **Payoff:** ads ★★ / kids ★★
**Why rank 4:** Loudness inconsistency reads amateur and hurts both tracks. Cheap, automatable, no art judgment.

### 5 · Regulation-disclosure validator — **ads**
**What:** When `ad.offer.urgency`/`oldPrice`/`discountPct` is present (a "sale"), require a scope/total-price
disclosure string in the script; flag when a native/influencer ad lacks a שת"פ ממומן label. Encode the Consumer
Protection Law §15/§2/§7a requirements as a lint (extend `lexicon --check`).
**Effort:** S · **Cost:** $0/free · **Payoff:** ads ★★ / kids —
**Why rank 5:** Legal missteps kill trust and a paid product; the rules exist in prose but aren't enforced. Cheap insurance.

### 6 · Voice upgrade for the sale-deciding "sounds professional" bar
**What:** A Hebrew voice bakeoff + a decision: keep edge-tts for the $0 default but (a) build a prosody/emotion
wrapper or prompt-engineering layer to make ad reads more persuasive, (b) for kids, evaluate ElevenLabs v3
emotion-tags-in-Hebrew (with a 5-line Hebrew bakeoff — flagged UNVERIFIED in `00-findings.md`) or Azure direct SSML
IPA for exact unit articulation. (Voice-agent report covers this in depth; this is the benchmark's verdict that
voice is a top-5 leak.)
**Effort:** M-L · **Cost:** free default / paid upgrade path · **Payoff:** ads ★★★ / kids ★★★
**Why rank 6:** Voice naturalness is co-#1 with visuals for "doesn't look/sound AI," but it's a *ceiling-raising*
upgrade, not a correctness fix — the free path ships today. Ranks just below the enforce-the-craft gaps because
the current edge-tts output is already serviceable.

### 7 · Human gate: final "would this sell / would a parent trust this" reviewer step (both tracks)
**What:** A formal pre-release step where a human (or a strongly-prompted review agent against a checklist drawn
from Part 1's pro-bar) signs off: "this ad would get a lead" / "this reading video is parent-safe and teaches
correctly." Make the Part-1 benchmark a reusable checklist file the QA/review stage reads.
**Effort:** S · **Cost:** $0/free · **Payoff:** ads ★★★ / kids ★★★
**Why rank 7:** The automation handles mechanics; the "is it good" judgment is the missing 20% and is inherently
human or heavily-prompted. Institutionalizes the pro-bar as a process, not luck.

### 8 · 16:9 re-frame + platform-length variants — **ads**
**What:** A post-render step that re-frames the 1080×1920 master to 1920×1080 (safe-area aware, center-crop or
sides-compose) and generates a 15s cut for IG + a 30s for YouTube from the same beats. SMBs want the same ad on
their website/feed.
**Effort:** M · **Cost:** $0/free · **Payoff:** ads ★★ / kids —
**Why rank 8:** Real SMB demand (same asset everywhere), but the 9:16 vertical already covers the primary social
surface — it's an upsell, not a blocker.

### 9 · Batch/queue orchestrator + productized series shell (ad pack / kids reading program)
**What:** Extend `orchestrate` to accept N script.md/brief inputs and fan them out (reading is batch-ready: 12
nikkud scripts → 12 videos). Add: a persisted per-business brand kit (ads), a curriculum tracker (kids), and the
GTM shell from `harness-plan.md` (onboarding, WhatsApp delivery, billing, view counters).
**Effort:** L · **Cost:** $0/free (engineering) / paid only if billing/WhatsApp infra · **Payoff:** ads ★★ / kids ★★★
**Why rank 9:** The biggest *product* gap — turns the factory into a deliverable program. Large effort, so it ranks
below the per-video quality killers; but without it the business can't scale past bespoke one-offs. The kids
reading-program series is the most productizable (batchable, $0, unique).

---

# Sources

- **Repo research (relied on for Israeli market/kids/reading figures):** `research/hebrew-ads/hebrew-ads-deep-dive.md`
  and `harness-plan.md` · `research/hebrew-kids/{01,02,04,07}.md` · `research/hebrew-reading/00-findings.md`.
- **Web (verified fresh this session):**
  - https://www.quickads.ai/video-ads (Quickads: formats, 50+ voices, Hebrew NOT listed, pricing)
  - https://www.superwebtricks.com/quickads-ai/ (Quickads: template constraints, pricing tiers $9/$39/$99, "production-ready not cheap AI")
  - https://prizmad.com/review/creatify-ai (Creatify: $0/$39/$99 tiers, 1500 actors, "scripts generic — hooks need human editing," "a tier below Arcads")
  - https://www.adcreative.ai/ + toolify/G2 listing (AdCreative: creative-first, agency-tier)
  - https://www.bing.com/news/search (Israeli SMB video ad news — returned zero; noted)
  - Brave, Yahoo, Seznam, Bing search engines — **all returned errors/junk on the Hebrew/topical pricing queries
    (Brave 429 ×8, Bing degraded, Seznam/Yahoo can't handle Hebrew)**; the Israeli pricing above therefore rests on
    the prior repo research, marked `(repo)` and NOT independently re-verified this session. UNVERIFIED fresh.

*Compiled 2026-08-23 by the benchmark/gap-audit researcher (04-harness-benchmark.md). Companion tool reports:
04-* (voice / visual / sound) live in the same `research/pro-quality/` directory.*
