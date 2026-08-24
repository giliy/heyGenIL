---
name: make-ad
description: Build a HEBREW SHORT-VIDEO AD (1080×1920, ~25-35s) for an Israeli SMB end-to-end from a business brief — interrogation, per-vertical Hebrew script + beats.json (mode:"ad"), edge-tts Hebrew voice with word-exact RTL captions, a conversion CTA end card, phone-scale QA, render. Use when the user wants to "make an ad", "make an advertising short", "make a commercial", build a Hebrew promo for a business/product, or continue the ad-N series in this repo. This is the AD track — same TSX backbone as make-short but with the brand's ad-mode overrides (CTA end card allowed, no seamless loop). Defers raw TSX crash rules to vidtsx-2d-generator, RTL ad components to lib/ads.tsx, SFX taste to suggest-sfx + brand §7 (ad variant).
---

# make-ad — Hebrew advertising shorts for Israeli SMBs, end to end

> **Multi-agent mode:** to run this through the pinned specialist agents with a small
> main-session context, defer orchestration to the **`orchestrate`** skill. The stages below are
> the same work done inline when you are NOT using the router.

An ad is **persuasion, not storytelling**: it names a business, prices an offer, and drives one
conversion (phone / WhatsApp / visit). It exists because mode:"ad" deliberately overrides two
of this repo's house rules — the **no-CTA-outro** rule and the **seamless-loop** rule — because
for an ad the conversion CTA *is* the payoff, and the end card must HOLD so it's tappable.
Everything else (RTL captions, phone-scale QA, library-first SFX) is the same discipline as
`/make-short`.

**Hebrew is a first-class language here, not a localization.** The research in
`research/hebrew-ads/` (deep-dive + harness-plan) maps the language, the psychology, the
per-vertical registers, and the regulation. **Read `research/hebrew-ads/harness-plan.md` and
`hebrew-ads-deep-dive.md` before your first ad.** Reference production: `shorts/short-16-formy`
— a real 36s Hebrew RTL commercial, the proof the whole chain works.

Run everything from the **repo root**. `ffmpeg`/`node` on PATH. Voice = edge-tts (free, no key);
ElevenLabs is an optional upgrade (see the voice decision). API keys live in `.env`.

## Artifact contract

```
shorts/ad-N-<business>/
  brief.md         — the interrogation answers (business / offer / CTA / brand), filled from Stage 1
  script.md        — hook, beat table (time | on screen | VO), register + voice notes
  beats.json       — mode:"ad" contract (base beats + ad{} block) — see tools/contracts.py
  voice/           — per-line TTS clips + voice.wav        (gen_voice_edge.py)   [gitignored]
  sfx-plan.json    — cue sheet on the global timeline       (mix_sfx.py)
  output/          — ad-N-sfx.mp4 (+ music auditions)                    [gitignored]
remotion/src/shots/ad-N/
  AdN<Business>.tsx — THE composition (registered by npm run gen)
  vo.gen.ts         — AUTO-GENERATED VO with exact word times (never hand-edit)
```

Shared kit: `remotion/src/lib/shorts.tsx` (Captions RTL, SAFE, fonts) + **`remotion/src/lib/ads.tsx`**
(AdEndCard, PriceBadge, Logo, formatILPrice/formatILPhone/formatILPct, waLink). Add at most ONE
new niche lib per ad.

## Stage 0 — interrogation (the human gate, before any pixels)

An ad is only as good as the brief. **Ask, don't assume.** Collect, in one pass (use
`AskUserQuestion` for the business essentials so the SMB owner can answer in clicks, free-text
for the offer/headline):

- **business:** name, vertical (from the lexicon list), city, and — only if they want a
  tap-to-call end card — phone / WhatsApp number, website.
- **offer:** the ONE thing being sold (headline), price in ₪, old price / discount % if it's a
  sale, any urgency (תקופה, עד גמר המלאי, החודש בלבד).
- **cta:** the single action — WhatsApp message, phone call, or visit/website.
- **brand:** primary color (default a warm ad accent), a logo file path if they have one,
  and the hook style (pain-question / surprise / social-proof / free-trial).

**State what you WILL build before building** — beats, length, voice, and the derived cost
(edge-tts = $0; ElevenLabs v3 ≈ $0.03–0.10/ad). **A brief that names a phone but no offer, or
an offer without a price, is not ready** — push until every ad.business/offer/cta field has a
real value (the validator will fail otherwise).

## Stage 1 — script + beats (mode:"ad")

**Register is per-vertical, not universal.** The per-vertical playbook lives in
**`tools/lexicons.json`** (loaded via `tools/lexicon.py`) — it is the single source of truth for
register, address pronoun, edge-tts voice, offer structure, proof type, CTA (and the CTA to
NEVER use), urgency, magic phrases, and taboos. `tools/contracts.py` derives its valid-vertical
list from the same file, so the two never drift.

Pull the vertical's playbook before drafting a single line:

```
python tools/lexicon.py <vertical>          # the whole playbook, human-readable
python tools/lexicon.py <vertical> --json   # machine-readable (for an agent)
python tools/lexicon.py --list              # the 11 vertical keys
```

Then **lint the drafted headline/VO against the vertical's never-CTA and taboos** before
building (exit 1 = a hit — rewrite):

```
python tools/lexicon.py --check <vertical> "<the drafted Hebrew line>"
```

### The hook is the whole game — gate it, don't hope for it

The harness audit (research/pro-quality/04) calls the hook the fatal ad gap: even paid AI tools
ship "generic scripts needing human hook editing," and a generic hook = no leads = no renewal.
**"Hook lands <2s" and "hook is a good hook" had NO numeric gate — until now.** The hook-craft
engine (`tools/hook_craft.py`) is the gate. Use it in this order, every ad:

1. **Draft from templates, not from scratch.** Get the vertical's register-matched A/B hook
   skeletons and fill the `{slot}` with the specific pain/offer:
   ```
   python tools/hook_craft.py templates <vertical>            # A/B cuts per allowed style
   ```
2. **Lint the drafted hook line** before you write a single beat. It checks concision (≤8
   words), the **<2s land wall** (draft estimate, calibrated to measured edge-tts Hebrew),
   style-match against the declared `hookStyle`, and the lexicon taboos (exit 1 = rewrite):
   ```
   python tools/hook_craft.py check <vertical> <hookStyle> "<the drafted hook line>"
   ```
3. **Self-review against the rubric** (the half of "good hook" no regex can judge — first word
   creates pain, payoff visible at frame 0, repeatable in one hearing, freier-smart):
   ```
   python tools/hook_craft.py checklist <vertical>
   ```
4. **Gate the beats.json** once drafted. The hook MUST be a `vo[]` line tagged `beat:"hook"`;
   this re-checks it against real word-times once voice gen runs (and falls back to the
   estimate before that):
   ```
   python tools/hook_craft.py check-beats shorts/ad-N-<business>/beats.json
   ```
   `contracts.validate_ad_beats` runs this same hook gate automatically on every build, so a
   late/generic/over-long hook **hard-fails the build** — both shipped reference ads land their
   hook at ~2.3–2.6s and would fail today. Aim for a **2–4 word** hook that lands ≤1.6s.

The rules the lexicon encodes (don't re-derive, read the vertical):

- **ISRAELI > ACADEMY.** Semiformal spoken Hebrew, ktiv maleh (no nikkud), Hebrish is expected
  (סייל, דיל, ברנד). Never formal (אנו, הינך), never pure street.
- **Gender is vertical-dependent.** Beauty/clinic/salon (women) → **feminine-singular** (את,
  עצרי, בחרי). Barbershop/trades → masculine. Restaurant/realestate/fitness → neutral/mixed.
  Use the vertical's `address` pronoun — masculine-plural is *actively wrong* for women's beauty.
- **CTA comes from the lexicon,** in plural-imperative — and honor the vertical's `cta_never`
  (restaurants say **הזמנת שולחן**, NEVER תפוס מקום). The magic phrases: בלי מנוי, חד פעמי.
  Prices **always ₪**, never $.
- **The freier code:** every deal must prove the buyer is *smart*, not just cheap — show the
  math. שווה beats cheap. דוגרי, from a named owner.
- **Hooks land before 2s — and the gate enforces it.** Pick from the vertical's `hook_styles`:
  pain-question (מחפשים…? / מספיק…), surprise (רגע, אתם חייבים לראות…), social-proof
  (הלקוחות כבר יודעים…), free-trial (הפעם הראשונה חינם). The hook MUST be a `vo[]` line tagged
  `beat:"hook"` so `hook_craft.py` can gate it (≤8 words, last word lands ≤2.0s from frame 0).
- **Taboos:** no Holocaust, terror, soldiers, army-as-sales, politics/religion as selling
  devices. In wartime: sober or service-oriented. Plus the vertical's own `taboos`.
- **Regulation baked in:** any sale discloses scope + the discount rate + total price (Consumer
  Protection Law §15); nothing misleading (§2); minors protected (§7a); a native/influencer ad is
  labeled שת״פ ממומן / פרסום בשיתוף פעולה.

**Beat grammar (~25–35s):** **HOOK** (0–3s, frame 0 FULLY composed — the payoff visible) →
**PROBLEM/PROOF** in 1–3 short steps (each synced to a VO word) → **OFFER** (the PriceBadge
pops with the real numbers) → **CTA** (the AdEndCard, the last ~6–10s). **No seamless loop** —
an ad is one-shot linear persuasion. **End on the CTA card, holding** (not a fade-out): the
phone/WhatsApp must stay tappable.

**TIMING MODEL (hard rule — the two defects users actually hear):** the schedule is
**speech-driven**, never guessed. Get each line's REAL spoken duration from edge-tts (it writes
per-word times into beats.json `vo[].words[]`), then:

- **No VO overlap, ever.** Line N's scheduled window must END only after line N's real speech
  ends, and line N+1 starts after that. `windowEnd[i] ≥ speechEnd[i]` and
  `windowStart[i+1] > speechEnd[i]`. A window narrower than its own line = the line bleeds into
  the next beat = audible overlap. Verify against `vo[].words[]` end-times, not the estimate.
- **No dead tail.** The video ends **~2.5–3s after the LAST spoken word**, holding the CTA card
  (that hold IS the tappable end card — keep it). What you must NOT ship is a long frozen frame
  after the sound dies. `totalDuration = lastSpeechEnd + ~2.5s` — NOT a round 25/30s. If your
  beats say 30s but speech ends at 13s, cut the comp to ~16s. (Ad1Liat and Ad2Noa both shipped
  this bug: an ~18s frozen last frame.)
- **SFX clear the speech.** Place every cue in a VO gap or under silence (a pop/send-click
  landing on a spoken word either vanishes or gates < the floor). Re-time cues off the REAL word
  times the same way — e.g. the WhatsApp send-click goes AFTER the last CTA word, not on it.

**VO:** ~45–70 words for an ad (shorter than a short — ads are tighter). Estimate line windows at
**~2.7 words/sec** with slack to the next line's start. Write `brief.md` + `script.md` +
`beats.json` — the beats.json uses the **mode:"ad"** shape (base + `ad{}`), validated by
`validate_ad_beats`. Use the canonical `beats[]` keys `name/start_s/end_s`. The **last beat is
always `cta`** and it **holds ≥ 2s** (the validator enforces it).

## Stage 2 — the composition

- One `.tsx` under `remotion/src/shots/ad-N/`, `compositionConfig` 1080×1920 @30, ~30s.
  Follow vidtsx-2d-generator's hard rules (frame-based only, monotonic ranges).
- Beats = `<Sequence>` scenes over ONE persistent canvas. `Captions lines={VO} rtl` +
  `ProgressBar` at the ROOT (global time), scenes beneath.
- **THE recurring bug: frames inside a `<Sequence>` are LOCAL.** `local_f = global_s*fps − sequence_from`.
  Check every cue twice.
- Mount the ad components from `lib/ads.tsx`: **PriceBadge** on the offer beat, **AdEndCard**
  on the CTA beat (it holds to the last frame), **Logo/Watermark** pinned bottom-left clear of
  the right 160px rail / bottom 500px UI zone.
- Safe areas: captions block centered ~y1500; nothing critical in bottom 340px / right 160px.
- **THE truncation bug: the `cta` scene MUST exist in `defaultProps.scenes`.** `specDurationFrames`
  is the SUM of `scenes[].durationSec`. If you build hook/offer/proof and forget the trailing
  `{id:'cta', durationSec: DUR.cta, beatId:'cta', visual:'cta', overlays: []}` scene, the comp
  silently truncates to the partial sum (Ad2Noa shipped at 9.4s instead of 16.5s — frame 899
  clamped to 281). After `npm run gen`, sanity-check the registered duration matches your
  beats.json `durationSec`.

## Stage 3 — QA (do not skip)

```
cd remotion && npm run gen        # frames.mjs does NOT run gen-registry itself
node scripts/qa_frames.mjs AdN<Business> 0,<beat-boundaries+hero-frames>,<last> --scale=0.333
```
READ every small JPG (phone scale). Checklist: frame 0 composed & thumbnail-grade · the PriceBadge
math is TRUE (price/oldPrice/discount all agree — a wrong % is a freier-red-flag) · Hebrew+digit
tokens (199 ₪, 31%−, the phone number) did NOT bidi-reorder · the CTA end card holds to the last
frame and the WhatsApp button + phone are clear · captions clear of UI zones · gender register
consistent. Fix, re-render, only then:

**Timing audit (before render, from beats.json `vo[].words[]` end-times — catch the two heard
defects):** (a) registered `durationInSeconds` ≈ last-speech-end + 2.5–3s, not a round number;
(b) walking lines in order, each window ends ≥ its speech-end and the next window starts after —
no overlap; (c) every SFX cue sits in a speech gap. A quick Python pass over `vo[].words[]` +
`sfx-plan.json` settles all three.

**Release gate (P1 #19 — the human "would this sell / get a lead" review, before the full render):**
```
python tools/release_gate.py ad shorts/ad-N-<business>/beats.json --sfx-plan shorts/ad-N-<business>/sfx-plan.json
```
This prints the Track-A release rubric (FATAL: hook frame-0 / one offer+price+CTA / end card holds;
CRITICAL: stops the scroll, freier-proof math, dugri trust, ad-loud energy, bidi+register) AND runs
the objective sub-checks (hook gate, timing/overlap, audio gate when given `--audio`). It **exits
non-zero if an objective check fails** — fix and re-run before rendering. Then answer the rubric
honestly; any NO = fix first. The automation handles mechanics; this gate is the craft judgment.

```
node scripts/render-all.mjs AdN<Business> --scale=1     # -> remotion/out/AdN<Business>.mp4
```

## Stage 4 — voice (edge-tts default, word-exact RTL captions)

**Voice decision — default to edge-tts (free, unlimited, native word boundaries):**
```
.venv-voice312\Scripts\python.exe tools/gen_voice_edge.py --beats shorts/ad-N-<business>/beats.json \
    --voice he-IL-AvriNeural --emit-ts remotion/src/shots/ad-N/vo.gen.ts
```
- **Voice comes from the lexicon** (`python tools/lexicon.py <vertical> --json` → `.voice`):
  feminine-singular verticals (beauty/salon/clinic) → `he-IL-HilaNeural`; the rest →
  `he-IL-AvriNeural` (Formy's voice). Don't pick by taste — the register drives the voice.
- Hebrew reads with `boundary="WordBoundary"` — REAL per-word times written into beats.json and
  vo.gen.ts. Captions sync to the exact spoken word, RTL.
- **BREAKAGE DRILL (edge-tts is an unofficial endpoint):** `pip install -U edge-tts` first; if
  still down, synthesize locally and recover word times via `tools/align_words.py --lang he`
  (WhisperX, Hebrew aligner resolves automatically).
- **Optional upgrade — ElevenLabs (ONLY v3):** Hebrew exists ONLY on `eleven_multilingual_v3`
  (`--voice <your v3 voice> --lang he`); **v2 and flash v2.5 have NO Hebrew** — a wrong model
  silently produces garbage/non-Hebrew. ~$0.03–0.10/ad. **Exclude kokoro entirely** (no Hebrew).
- Re-render (captions retimed) and mux via the resolved ffmpeg wrapper (bare `ffmpeg` can
  silently produce a SILENT track):
  `python -c "import sys,os;sys.path.insert(0,'tools');import ffw;ffw.ffmpeg('-y','-i','remotion/out/<Id>.mp4','-i','shorts/.../voice/voice.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-shortest','remotion/out/<Id>-voiced.mp4')"`
- **Then the audio gate — a mux is not done until it passes:**
  `python tools/audio_gate.py remotion/out/<Id>-voiced.mp4`
- **Finally MASTER for delivery (Stage 6's music mix output too — always the last audio step).**
  The voiced/SFX/music mix is an *audition* mix; `tools/master.py` is the delivery master —
  it normalizes the speech band to ~−13 LUFS and brickwall-limits the true peak to −1 dBTP
  (this is what stops the under-loud −16..−20 LUFS finals and the +1.1 dBTP clip):
  `python tools/master.py <final-mix.mp4>` then gate it:
  `python tools/audio_gate.py --delivery-report <final-mix>-master.mp4` (must PASS, no clip).
  Ship the `-master.mp4`, not the raw mix.

## Stage 5 — SFX (the suggest-sfx machinery, ad flavor)

Read `brand.md` §7 (ad variant) + `media/library/sfx/catalog.json`. Library-first, **recorded
clips before generated** — prefer `source` = `sonniss-gdc-*`/`kenney`/`soundcn`/`freesound`
(ids `pro-*`/`rec-*`) over ElevenLabs clips; misses go through `tools/import_sfx.py` (see
`docs/sfx-sources.md`) before any `gen_sfx.py` fallback. Sonniss `pro/` clips are gitignored
(per-machine `tools/fetch_pro_sfx.py`; the mixer skips their cues if absent). Author
`shorts/ad-N-<business>/sfx-plan.json` (preview = the -voiced.mp4, out = output/ad-N-sfx.mp4).

Ad taste adaptations (louder than a calm short, still not MrBeast): score the **offer reveal**
(riser → impact on the PriceBadge pop), a **whoosh → pop on the CTA card**, a WhatsApp **send**
click on the final CTA. Big-brand ads can push cue gains a touch higher than calm shorts, but
**under the voice, always** — the VO is the meaning layer. Cue times from EXACT frames/words:
`at_s = (move.at + move.dur + sequence_from) / fps` or the real word time.

```
PYTHONIOENCODING=utf-8 python tools/mix_sfx.py shorts/ad-N-<business>/sfx-plan.json --print
PYTHONIOENCODING=utf-8 python tools/mix_sfx.py shorts/ad-N-<business>/sfx-plan.json
```
The mix is an AUDITION — the user's ear is the audit gate. Update catalog `used_in` afterwards.

## Stage 6 — music (optional, per video)

Library beds in `media/library/music/` (gen_music.py to grow). Audition over the SFX mix:
`python tools/mix_music.py --all --base shorts/ad-N-<business>/output/ad-N-sfx.mp4`
(or `--bed <id>`). Hard-ducked under voice. Prefer an up-tempo bed for ads — the calm beds read
as low-energy for a sale.

## Done =

brief.md + script.md + beats.json authored (mode:"ad", validated by validate_ad_beats) ·
composition QA'd frame-by-frame (price math true, bidi safe, CTA holds) · rendered at scale 1 ·
voice generated (edge-tts Hebrew, word-exact RTL captions) and muxed + audio-gated · SFX plan
authored + audition mixed (awaiting the user's ear) · library used_in updated · cost stated
before any paid step.
