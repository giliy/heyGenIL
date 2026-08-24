# Hebrew Kids' Shorts — Research & Strategy Dossier

Research completed 2026-08-23. Question: how to harness this repo's shorts factory to create
Hebrew-language short videos for kids, given that kids love characters like Stitch.

**The strategy in one paragraph:** Build an **original** recurring character using the
scientifically-decoded "Stitch appeal recipe" (baby-schema proportions + one weird signature
feature + mischievous-but-kind chaos + vulnerability + a signature Hebrew catchphrase). Produce
it with `make-ai-short`'s locked-character mechanism, voiced in Hebrew via edge-tts. Target the
unclaimed gap: **premium, calm, Hebrew-native short-form** teaching אותיות/מספרים/צבעים plus
chagim/Shabbat cultural content — positioned to parents as "the Shorts you don't have to feel
guilty about." YouTube-only, marked Made-for-Kids, with a real narrative arc per episode to
survive the July-2025 "inauthentic content" monetization rule. Treat Shorts as top-of-funnel;
the real business is the owned character IP (songs → Spotify Kids, licensing, merch).

## Files

- `01-character-appeal.md` — the global research: why Stitch/Grogu/Minions/Bluey hook ages 2–8,
  decoded into actionable original-character design traits; format mechanics (repetition,
  call-and-response, pacing, music) with study citations; what billion-view kids' videos share.
- `02-hebrew-market.md` — the Israeli landscape: channel tiers with subscriber data, the
  שירי ילדים canon with copyright status (3 generations), and the gap analysis.
- `03-platform-legal.md` — YouTube Made-for-Kids rules (disabled features, monetization reality),
  the July-2025 inauthentic-content rule, COPPA/FTC, IP red lines (Stitch = hard no), platform
  verdict (YouTube-only), monetization expectations.
- `04-pipeline-fit.md` — repo recon: the Hebrew voice→captions→RTL→fonts chain is already solved
  and battle-tested; track-by-track fit (make-ai-short wins); the concrete gaps to close.
- `05-plan.md` — the phased execution plan: character design gate, pipeline gap fixes, pilot
  batch, format rules, compliance guardrails, business model.
- `06-character-concepts.md` — three original mascot concepts (שפופון the hyrax / בּוּ the creature /
  טיפה the raindrop), each built on the appeal recipe, with draft `character.json` skeletons and a
  comparison table. **Phase 0 decision point.**
- `07-hebrew-language-kids.md` — **the language harness**: child-directed Hebrew register, phrase
  banks, story templates, word banks, rhyme rules, catchphrase-construction rules. Read before
  writing any kids' script or catchphrase.
- `09-reading-decoding.md` — existing Hebrew-**reading/decoding** content & curricula (Kriakala's
  5-stage phonics ladder, IvriTalk's vowel inventory, EZToddler/Hebrew KidTV per-nikkud videos) and
  the gap: per-nikkud, calm, sub-word-synced Shorts hosted by בּוּ. For the teach-reading feature.

## Key conclusions (TL;DR)

1. **Never use Disney's Stitch/Lilo.** Extract the appeal recipe, build an original character.
2. **The Hebrew-native gap is real and unclaimed** — the biggest "Israeli" kids channels are
   wordless-export (TuTiTu) or dubs (Masha); the beloved Hebrew characters predate YouTube.
3. **`make-ai-short` is the production track** — the only one with a locked recurring character.
4. **The Hebrew technical layer is done** — edge-tts + RTL captions + fonts + nikkud exception
   all exist and have shipped a real Hebrew RTL video before.
5. **YouTube-only; Made-for-Kids is mandatory; Shorts RPM is near-zero** — the money is the IP.
6. **Every episode needs a genuine narrative arc** — templated AI mass-production gets demonetized.
