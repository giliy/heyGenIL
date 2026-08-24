# Harness plan — turning the shorts factory into a Hebrew ad generator for Israeli SMBs

Companion to `hebrew-ads-deep-dive.md`. This is the concrete build order: what to add to the repo,
in what order, to get from "one-off Hebrew commercial" to "a repeatable ad product."

## The thesis

Let an Israeli business owner go from a 3-line WhatsApp brief ("business, offer, contact") to a
finished 20–45s vertical Hebrew ad — natural Hebrew voice, correct RTL burned captions, a price badge,
and a phone/WhatsApp CTA card — in one `/make-ad` pass, at zero marginal COGS.

## What already exists (do not rebuild)

- **Hebrew voice, $0:** `tools/gen_voice_edge.py --voice he-IL-AvriNeural / he-IL-HilaNeural` —
  native WordBoundary per-word timestamps. Proven by `shorts/short-16-formy` (a 36s Hebrew RTL
  commercial) and `vox-3-dor-sever`.
- **Hebrew alignment fallback:** whisperX resolves `he` → `imvladikon/wav2vec2-xls-r-300m-hebrew`
  via `--lang he`, already threaded through `tools/gen_voice.py` → `tools/align_words.py`.
- **RTL captions:** `remotion/src/lib/shorts.tsx` — `direction:'rtl'`, `unicodeBidi:'isolate'` per
  word, `anchorRtl()` (RLM suffix on numeric/Latin tokens), `stripNikkud()`, `rtl` prop on
  `CaptionsPop`/`CaptionsPill`, `KineticCaptions`.
- **Hebrew fonts, vendored offline:** Heebo 500/600/700 + Rubik 700/900 with `hebrew+latin`
  unicode-ranges (incl. ₪ U+20AA), injected via `remotion/src/lib/fontFaces.tsx`.
- **The ad `beats.json` contract** (designed in the audit): `mode:"ad"`, `language:"he"`, and an
  `ad{}` block — `business{name,vertical,phone,whatsapp,website,city}`, `offer{headline,price,
  currency:"₪",oldPrice,discountPct,urgency}`, `cta{type,text,phoneDisplay}`, `brand{colors,logo,hookStyle}`.

## Build order

> ✅ **Status 2026-08-23:** items **1, 2, 3, 4, 7** are DONE. Proven by the reference production
> `Ad1Liat` (`shorts/ad-1-liat/` + `remotion/src/shots/ad-1/` + `remotion/out/Ad1Liat-sfx.mp4`,
> 30s Hebrew RTL ad: hook → offer/PriceBadge → proof → AdEndCard that holds to the last frame,
> female Hila voice, 7 SFX cues, all gates green; bidi tokens eyeballed correct by the user via
> `research/hebrew-ads/ad1-proof.html`). Item **4** landed as `tools/lexicons.json` +
> `tools/lexicon.py` (per-vertical register/voice/offer/proof/CTA/never-CTA/urgency/magic-phrases/
> taboos, with a `--check` lint); `contracts.py` now derives its vertical list from the lexicon so
> they can't drift. Remaining: 5 (holiday engine), 6 (brand ad-variant).

1. **`/make-ad` skill** (`.claude/skills/make-ad/SKILL.md`) — mirrors `make-short`; routes
   "make an ad for <business>" / "Hebrew ad". Pipeline: brief → interrogation for missing
   `business{}` fields → hook selection per vertical → Hebrew script.md + beats.json (register per
   line via `vo[].tone`) → edge-tts voice → RTL captions → CTA end card → phone-scale QA →
   SFX/music → cost report.
2. **Three ad components** (new `remotion/src/lib/ads.tsx`):
   - `AdEndCard` — dir="rtl", phone + wa.me button, `phoneDisplay`, website, logo, safe-area-correct,
     holds ~3s. WhatsApp green `#25D366` or brand accent.
   - `PriceBadge` — bidi-safe ₪ amount, optional struck `oldPrice`, `discountPct` stamp.
   - `Logo`/`Watermark` — image or styled wordmark, preset safe-area placement (clear of the right
     160px like/share rail and bottom 500px UI).
3. **Bidi-safe numbers helper** — `formatILPrice()` (Intl.NumberFormat('he-IL') + re-anchor) and an
   isolated-digit formatter for phone numbers, so `50%`, `12,345 ₪`, `050-123-4567` never reorder
   inside a Hebrew caption token. Fix the mixed-token intra-token bidi gap the audit found in the
   pill pager.
4. **Per-vertical lexicon + offer templates** — bake the sector research into the skill: each
   vertical loads its own vocabulary, register (feminine-singular for beauty, masculine-plural for
   trades), offer structure (restaurant package price-anchoring, fitness trial class, trades
   emergency/trust), CTA (`הזמנת שולחן` for restaurants — NOT `תפוס מקום`), and proof type.
5. **Holiday-aware template engine** — pick the ad angle from today's date on the Israeli calendar
   (Rosh Hashana family/gifts, Passover, Hanukkah+Black Friday, Purim, Independence Day mangal,
   Tu B'Av, back-to-school, summer clearance); pre-load campaigns 1–2 weeks ahead.
6. **Ad style variant** — an explicit `mode:"ad"` override in `brand.md`/`brand.ts`: louder energy,
   higher-contrast stroke for legibility over bright backgrounds, bolder scale-pop, an urgency accent,
   and a defined CTA-card ending. Keep the calm premium base for non-ad shorts.
7. **Contract validation** — extend `tools/contracts.py` with `validate_ad_beats()`: `mode=="ad"` ⇒
   required `ad.business/offer/cta`, numeric price, `currency` defaulting to ₪, a `phoneDisplay` or
   wa.me link, `cta.type ∈ {phone, whatsapp, both, visit}`.

## The two deliberate rule overrides (ads ≠ shorts)

- **Drop the seamless loop.** Ads are one-shot linear persuasion; the end card must hold so the
  phone/WhatsApp is tappable. Document as an ad-mode exception, not style drift.
- **Override the no-CTA rule.** The conversion CTA *is* the payoff for an ad — the end card replaces
  the "end on the payoff line" rule for `mode:"ad"` only.

## What stays (hard rules)

Phone-scale QA (price badge + phone number readable at 33% and inside safe areas) · library-first
SFX · cost reporting before any paid generation (state ElevenLabs/logo cost up front) · never
regenerate a locked business logo.

## Voice decision

- **Default: edge-tts** `he-IL-AvriNeural` (male) / `he-IL-HilaNeural` (female) — free, unlimited,
  native word boundaries, already proven. The economically correct default for a per-ad product.
- **Optional upgrade: ElevenLabs** only with `--model eleven_multilingual_v3 --lang he` + a Hebrew
  voice ID (v2/flash have NO Hebrew — the current default v2 would silently produce broken Hebrew).
  ~$0.03–0.10 per 20–45s ad.
- **Exclude kokoro** for Hebrew entirely — no Hebrew voice exists in the model.

## Product & GTM shape (from the market research)

- **WhatsApp-native**: onboarding, drafts, revision, and "your video got X views" all over WhatsApp
  (99% of Israelis, 98% daily). One-tap "forward to a fellow business owner" referral.
- **Price**: ₪49–59/mo starter (impulse-buy band, card-on-file), ₪99 popular (no watermark, brand
  kit, WhatsApp delivery), ₪399–499 agency. 14-day free trial, no card. 15% annual discount. Fight
  the 8.6%-monthly churn of the <$50 band with habit loops (weekly WhatsApp video prompts, saved
  brand assets, visible view counters).
- **Channels**: accountants/bookkeepers (every SMB files VAT monthly — the iCount/GreenInvoice
  playbook), active Hebrew Facebook SMB groups (niche > mega), Lahav + the SBA/Maof network,
  bank/credit-card SMB hubs (Leumi/Hapoalim/Isracard).
- **Legal**: bake in the Consumer Protection Law (Sec. 2 no-mislead, Sec. 15 sale disclosure, total
  price), influencer `שת"פ ממומן` label, and ACUM music licensing.

See `hebrew-ads-deep-dive.md` for the evidence behind every line above.
