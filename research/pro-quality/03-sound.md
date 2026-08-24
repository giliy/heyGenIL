# 03 — SFX / Music / Mix-Master Audio Quality

Researcher report for the pro-quality pass. Scope: `tools/gen_music.py`, `mix_music.py`, `gen_sfx.py`,
`import_sfx.py`, `mix_sfx.py`, `gen_chords.py`, `audio_gate.py`, `fetch_pro_sfx.py`, `brand.md §7`,
`media/library/{sfx,music}/{catalog,palette}.json`, `docs/sfx-sources.md`. Goal: raise the audio from
"assembled audition mix" to indistinguishable-from-professional delivery.

---

## 0. TL;DR — the verdict

**The single biggest audio-quality gap in the repo is not a source or a model — it is that there is
no mastering step at all.** Every video today stops at the *audition* mix (`mix_sfx.py` then
`mix_music.py`), which the code itself labels "an AUDITION — the user's ear is the audit gate" and
"final polished mix / loudness normalization is /assemble's job later." That later job does not exist.
I measured the shipped "final" files:

| File | Integrated LUFS | True peak | Verdict |
|---|---|---|---|
| `remotion/out/Ad2Noa-final.mp4` | **−15.8** | −1.5 dBTP | 1.8 LU too quiet for −14 |
| `remotion/out/Read1Kamatz-final.mp4` | **−20.4** | — | 6.4 LU too quiet (dead quiet) |
| `remotion/out/Read4KamatzAba-final.mp4` | **−19.0** | — | 5 LU too quiet |
| `shorts/short-16-formy/output/short-16-sfx.mp4` | ~−13 (mid-mix) | **+1.1 dBFS** | **CLIPPING (over 0)** |

So today we both **under-deliver loudness** (YouTube/TikTok turn the whole video down, SFX detail
vanishes) **and clip** on at least one path. Neither is caught — `audio_gate.py` only checks
silence/RMS and cue audibility. Build `tools/master.py` first. It is the cheapest, highest-leverage
audio change available, and it is pure $0 ffmpeg.

Everything else (music model choice, SFX sourcing) is secondary to fixing delivery.

---

## 1. Audit — what the audio stack actually does today

### Pipeline (confirmed by reading the tools + skills)
1. **Voice** — `gen_voice_edge.py` / `gen_voice_reading.py` (edge-tts `he-IL-AvriNeural`/`he-IL-HilaNeural`,
   free, native word boundaries). ElevenLabs `eleven_multilingual_v3` only as an emotional fallback.
   Voice is muxed onto the silent Remotion master via an explicit `ffw.ffmpeg(...)` call (the
   "silent-voice incident" workaround).
2. **SFX pass** — `mix_sfx.py` reads `sfx-plan.json`, delays each library clip to its cue, gains it,
   sums into an SFX bus, optionally sidechain-ducks under the voice, sums, `alimiter=0.97` safety.
3. **Music pass** — `mix_music.py` loops/trims a bed from `media/library/music/clips/`, high-passes
   it at 90 Hz, sets base level, **hard** sidechain-ducks it under the voice
   (`threshold=0.03:ratio≈3:attack=15:release=450`), fades in/out, sums, `alimiter=0.97`.
4. **Gate** — `audio_gate.py` after each mux stage: asserts a non-silent audio stream, or
   compares cue-window RMS of mix vs base to prove a cue landed.

That's it. **There is no step after `mix_music.py`.** The `mix_music.py` docstring says the final
polished mix + loudness normalization is "/assemble's job later," and `make-short/SKILL.md` "Done"
reads "SFX plan authored + audition mixed (~−15.5 LUFS, awaiting the user's ear)." The −14 LUFS
platform target is never applied. Confirmed by measurement (§0).

### What's already good (keep it)
- **SFX sourcing is the strongest part of the audio stack** and was just (same-day) rebuilt
  recorded-first — see `docs/session-summary-2026-08-23.md` and `docs/sfx-sources.md`. Three tiers:
  Sonniss GDC (pro, gitignored) / Kenney+soundcn (CC0/MIT, committed) / Freesound-CC0. Catalog went
  34 → 79 clips. License guardrails are correct (Sonniss no-redistribute, soundcn `wow/` is Blizzard
  not MIT, Freesound CC0-only, YouTube Audio Library YouTube-only). `import_sfx.py`'s polish chain
  (trim-to-transient → HP 80 Hz → de-harsh 4.5 kHz → limit) is genuinely the right "premium pass."
- **Normalization discipline inside the libraries is consistent**: SFX and music clips are both
  normalized to −20 LUFS / −1.5 dBFS, so a plan's per-cue `gain_db` is perceptually meaningful.
  This is correct and should be preserved.
- **`gen_chords.py` / `gen_cue.py`** — deterministic additive synth for factual chords and the brand
  sonic cue. Correct call: generative models can't be trusted for "A minor, exactly, at 440 Hz."
- **The sidechain ducking in `mix_music.py` is structurally correct** (key = base audio, slow 450 ms
  release to avoid pumping). This is the right shape for a pro bed-duck and should be reused in
  `master.py`.

### What's broken / missing
1. **No mastering step.** No integrated-loudness target, no true-peak ceiling, no final bus EQ/comp.
   Outputs land −15.8…−20.4 LUFS; one SFX mix clips at +1.1 dBFS. This is the #1 fix.
2. **Music is the biggest *content* gap** (see §2). Today every bed is ElevenLabs (paid) or ACE-Step
   on fal (paid, cheap). There is no free/self-host music path, and only ~10 beds exist.
3. **`audio_gate.py` is a silence detector, not a QA gate.** No clip detection, no LUFS compliance,
   no voice-vs-bed separation check.
4. **Double lossy encode risk.** Clips are stored as mp3, then `mix_sfx.py`/`mix_music.py` re-encode
   to AAC for the mp4, and the Remotion render may encode again. Each transcode smears transients —
   audible on exactly the short, dry, transient-critical SFX brand.md §7 cares about. (See §3.)

---

## 2. Music — the biggest free/content gap

### What an Israeli SMB ad bed vs a kids-learning bed actually need
- **SMB ad (Track A):** a *modern, confident, local-sounding* bed. Israeli SMB social ads skew
  upbeat-pop / light-electronic / warm-acoustic with a clear beat; the energy carries the offer.
  Needs a real low end and a forward pulse (think "tech-pulse"/"lofi-warm" but with more drive),
  tight enough to sit under a fast Hebrew VO, and a clean **resolve into the CTA** (music can swell
  on the end card — the ad-mode exception in CLAUDE.md). Length 15–40 s, must loop or end cleanly.
- **Kids-learning (Track B):** *calm, warm, unhurried* (the "Bluey, never manic" brief already in
  `palette.json`). Ukulele/glockenspiel/music-box/felt-piano palette, ~65–92 BPM, lots of space so
  the motherese VO and the call-and-response pauses breathe. Consistency across episodes matters
  more than variety — kids learn from repetition. Length 30–60 s, seamless loop preferred.

Both need: instrumental-only, consistent energy (no drops/build-ups that fight the VO), and a clean
loudness target so the duck behaves.

### Option (a) — grow our own generator (`gen_music.py`)
What makes a generated bed sound *pro* vs *cheap*:
- **Cheap tells:** thin low end, plasticky synth timbres, over-quantized robotic rhythm, a melody that
  wanders and grabs attention, wet/reverby tails, audible looping seams, no low-frequency weight.
- **Pro tells:** solid controlled low end, dry-ish mids that leave the 1–4 kHz speech band clear,
  steady-but-human groove, consistent energy with *no* foreground hook, a clean ending or a true loop.
- The current `gen_music.py` already does the right *framing* (force_instrumental, "no build-ups, no
  drops, no foreground melody, sit under a voiceover, X BPM"). The gap is **source quality and
  breadth**, not the prompt. Growing our own generator = writing a *procedural* composer (extend
  `gen_chords.py`'s additive synth into full beds). **Realistically this tops out at ambient/pad
  textures; it will not produce a convincing pop or ukulele groove.** Good as a *free filler* for the
  calmest ambient beds; not a general answer. Effort M, payoff limited to the ambient/lofi corner.

### Option (b) — free/CC0 music libraries
License findings (verified; see Sources):
- **Kevin MacLeod / incompetech** — CC-BY (3.0/4.0). **Free with attribution; usable commercially.**
  A **$30 flat-fee per-track license waives attribution.** Huge catalog, but the "incompetech sound"
  is instantly recognizable (it's everywhere on YouTube) and skews generic — a real "cheap" tell for
  a premium ad. Attribution in the description is a friction point for ads (looks unprofessional) and
  impossible to satisfy cleanly on TikTok/Reels. **Usable for kids content, mediocre for premium ads.**
- **Pixabay (music + SFX)** — CC0-like Pixabay Content License: **free, no attribution, commercial
  allowed, modification allowed.** Prohibited: reselling content standalone, and using recognizable
  brands. This is the **cleanest free license** of the bunch for both tracks. Quality is hit-or-miss
  but there is genuinely good modern corporate/kids material. **Best free sourcing option.**
- **Mixkit** — separate "Stock Music Free License" / "Sound Effects Free License" (per-item; the exact
  grant wasn't in the page text I could reach — **UNVERIFIED**, treat as "free for video, verify
  per-track"). Worth a manual license read before relying on it for paid ads.
- **Free Music Archive** — mixed Creative Commons (CC0 / CC-BY / CC-BY-NC / public domain vary per
  track). **Must filter per-track; CC-BY-NC is banned for commercial.** Good for kids, too risky/
  laborious to rely on for ads without a per-track license field in the catalog.
- **YouTube Audio Library** — **YouTube-only. Already correctly on the repo's avoid-list.** Do not use
  for cross-posted shorts.

**Recommendation:** for *sourcing* free music, Pixabay is the strongest (clean license, no
attribution, both tracks). Build a tiny `import_music.py` mirroring `import_sfx.py` (curate → license
field → normalize −20 LUFS → catalog), and pull a handful of modern ad beds + kids beds from Pixabay.
Use incompetech only where attribution is acceptable or the $30 waiver is worth it.

### Option (c) — self-host a music-gen model
- **Meta MusicGen / AudioCraft — DEAD END for commercial.** Code is MIT, but **the model weights are
  CC-BY-NC 4.0 (non-commercial).** Multiple sources confirm (Hugging Face model cards, the AudioCraft
  repo, GitHub issue #198). Output can't be used in commercial ads. This is already on the repo's
  avoid-list and is now confirmed. **Do not build on MusicGen.**
- **ACE-Step (ACE Studio × StepFun, 3.5 B) — the real option.** **Apache-2.0** (confirmed on the repo).
  Runs locally: **peak VRAM reduced to 8 GB** (flags `--torch_compile true --cpu_offload true
  --overlapped_decode true`), and fast — ~**1.7 s per minute of audio on an RTX 4090**, ~26 s/min on
  M2 Max. Instrumental via `lyrics="[inst]"`. **Already wired into `gen_music.py` as `--engine
  acestep` via fal** at ~$0.0002/s. Given the machine has "unlimited compute," self-hosting ACE-Step
  locally removes even that cost and the fal dependency, with an Apache-2.0 license that has **no
  revenue cap.** This is the best long-term free music engine.
- **Stable Audio Open (Stability) — usable but capped.** The Stability **Community License permits
  commercial use and you own the outputs**, BUT only for organizations with **< $1M annual revenue**;
  above that needs a paid Enterprise license. Fine today, but it's a *cap* the Apache-2.0 ACE-Step
  doesn't have. (Also note VentureBeat reported an earlier "non-commercial research" reading of the
  Open Small license — the current stability.ai/license page is the authority and says commercial is
  allowed under the Community License. Mild license ambiguity → prefer ACE-Step.)
- **Quality reality check:** none of these beat a well-picked human/library track for a *premium ad*,
  but for *beds under VO* they are good enough, and ACE-Step is the best free one available. For
  hero ad moments, a curated Pixabay/library track will still read more "pro" than a generated bed.

### Option (d) — ElevenLabs music (paid fallback)
Already the default engine in `gen_music.py`. Keep it as the **quality ceiling / paid fallback** for
beds ACE-Step can't nail — same role ElevenLabs SFX plays. Not the default going forward.

**Music bottom line:** default music engine = **self-hosted ACE-Step (Apache-2.0, free, no revenue
cap)**, sourced beds from **Pixabay** for the premium-ad cases that need a human feel, ElevenLabs as
the paid fallback. Skip MusicGen entirely (non-commercial weights).

---

## 3. Mix / Master — the pro differentiator (BUILD THIS)

This is where "indistinguishable from professionally-produced" is actually won or lost, and it's $0.

### Target spec (per platform)
Established delivery targets (see Sources; the Spotify −14 figure is confirmed, and −14 LUFS / −1 dBTP
is the de-facto social standard the others normalize toward):
- **YouTube Shorts / TikTok / Instagram Reels:** master to **−14 LUFS integrated**, **true peak ≤ −1
  dBTP**. All three apply their own normalization; delivering −14/−1 dBTP means they leave you alone
  (or turn you down minimally) instead of crushing an over-loud master or boosting a quiet one and
  raising the noise floor.
- **Codec/container:** AAC-LC in MP4, 48 kHz, stereo (the repo already does this), **192 kbps+**
  (mix tools already use 192k). 30–60 s, 9:16 — already satisfied.

### `tools/master.py` — the proposed tool
Takes the audition mix (output of `mix_music.py`, or the SFX mix if no music) and produces the final
delivery master. One ffmpeg pass chain + a measured second pass:

1. **Two-pass `loudnorm` to −14 LUFS / −1 dBTP** (the clean way — pyloudnorm is already installed in
   `.venv-voice312` but ffmpeg's own `loudnorm` two-pass is sufficient and avoids a Python dep for the
   render box):
   ```
   # pass 1 — measure
   ffmpeg -i in.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -
   # pass 2 — apply, feeding back measured_* + offset, linear mode
   ffmpeg -i in.wav -af loudnorm=I=-14:TP=-1:LRA=11:measured_I=..:measured_LRA=..:measured_TP=..:measured_thresh=..:offset=..:linear=true -ar 48000 out.wav
   ```
   `loudnorm` upsamples internally for true-peak detection; always set `-ar 48000` on output. Two-pass
   linear mode actually hits I and TP; single-pass is only for live. (Confirmed against ffmpeg filter
   docs.)
2. **Gentle bus glue before the limiter** (optional, tasteful): a wide high-pass ~30 Hz, a 1–2 dB
   presence shelf around 3 kHz *only if* the mix is dull, and a slow bus compressor
   (`acompressor` ratio ~1.5, slow attack/release) for cohesion. Keep it minimal — the brand is
   "calm/premium," and heavy bus comp is the amateur-loud tell. For kids content keep the bus even
   gentler (lower ratio) to preserve the soft dynamics.
3. **True-peak limiter as the final stage** — `alimiter` (already used) is fine, but set it to enforce
   **−1 dBTP**, not 0.97 FS. The current `alimiter=...:limit=0.97` is ≈ −0.26 dBFS, which is *above*
   the −1 dBTP ceiling we want for delivery — that's part of why short-16 hit +1.1 dBTP true peak.
   Either rely on `loudnorm`'s TP stage or end with `alimiter=limit=0.891` (≈ −1 dBFS).
4. **Sidechain voice-ducking of music+sfx already happens upstream** in `mix_music.py`/`mix_sfx.py` —
   keep it there. `master.py` should NOT re-duck; it masters the already-ducked mix. (Optionally
   expose a final combined duck if we later want music+sfx ducked as one bus keyed by the voice stem —
   that requires passing the voice stem in, a v2 feature.)
5. **Fades** — bed fades are handled in `mix_music.py`; `master.py` adds a tiny overall fade-out
   (≤0.3 s) so the master never ends on a hard cut, and asserts frame-0/last-frame audio continuity
   isn't broken for the loop rule (video loops visually; audio should fade to a clean point, not a
   click).
6. **Report + gate** — after mastering, run the extended `audio_gate.py` (§4) and print a delivery
   report: integrated LUFS, LRA, true peak, clipping yes/no. Exit nonzero if TP > −1 dBTP or clipping.

**Codec hygiene fix (cheap, do it):** stop round-tripping SFX/music through mp3 before the master.
Keep library *sources* as-is, but in `mix_sfx.py`/`mix_music.py` decode mp3 → process in float → and
have `master.py` encode AAC **once**, at the end. Each lossy→lossy hop smears the dry transients
brand.md §7 demands.

### Why this is the top-ranked build
It directly fixes the two measured defects (under-loud finals, one clipping master), it's pure ffmpeg
(already on the box via `ffw`), it's ~1–2 days of work, and it's the difference between "sounds like a
phone recording" and "sounds like the platform intended it." Every other audio improvement is muted
until delivery is correct.

---

## 4. Audio QA automation — extend `audio_gate.py`

Today: silence detection + cue-audibility (RMS delta mix vs base). Add four checks, all measurable
with ffmpeg's `ebur128`/`astats` (no new deps; optionally pyloudnorm from the venv):

1. **Clip / true-peak detection** — run `ebur128=peak=true`; fail if true peak > −1 dBTP (delivery) or
   > 0 dBFS (hard clip). This would have caught the short-16 +1.1 dBFS over.
2. **LUFS compliance report** — integrated loudness + LRA + a pass/fail band (e.g. −14 ± 0.5 LU for
   delivery; warn if LRA is wildly high, indicating an unmastered dynamic mix).
3. **Voice–bed separation check** — measure short-term loudness *during detected speech* vs *during
   gaps*; the bed should drop under speech and recover in gaps (the duck working). Flag if bed
   short-term level under speech is within ~3 LU of the voice (bed masking the VO) — i.e. ducking is
   off. This automates the "felt-not-heard" check brand.md §7 states but nothing verifies.
4. **Per-cue audibility already exists** — keep it, but also add a *per-cue peak* sanity check so a
   single cue can't poke the true-peak ceiling.

Deliver as `audio_gate.py --delivery-report out.mp4` (JSON: I, LRA, TP, clipping, duck-OK, per-cue)
plus the existing silence/cue modes. This turns "the user's ear is the audit gate" into an objective,
repeatable gate.

---

## 5. SFX — catalog gaps & sourcing

The recorded-first stack is solid; don't churn it. Fill the *gaps*:

- **Ads (Track A) gaps:** the catalog is heavy on UI/whoosh/impact/foley but light on **ad-specific
  one-shots** — a clean *whoosh-into-hit combo*, a *riser that resolves into a beat drop* for the CTA
  reveal, a *cash-register / cha-ching* (Israeli SMB price-badge moment), a *notification-ding* for
  social-proof beats, and a *signature logo-sting* (beyond the rising two-note `brand-cue-rise`, ads
  may want a slightly bigger resolve). Most can come from the existing Sonniss GDC pro tier
  (already fetched per machine) — curate + `import_sfx.py`.
- **Kids (Track B) gaps:** `kids-pop`, `kids-boing`, `kids-giggle`, `kids-toy-squeak`,
  `kids-sparkle-magic`, `kids-animal-coo` exist as *generated* palette entries but I saw no
  `rec-*`/`pro-*` recorded equivalents in the committed catalog — recorded cartoon boings/sparkles/
  giggles will read warmer than the AI versions (the exact "synthetic reads childish" finding).
  Source recorded cartoon/kids one-shots from **Kenney (CC0) and Sonniss cartoon packs** and import.
  A real child's giggle is a licensing-sensitive sound — prefer a CC0 recorded giggle over ElevenLabs
  (an AI "child's voice" is both lower quality and a worse look for kids content).
- **Better free pro sources beyond Sonniss/Kenney/soundcn/Freesound-CC0?** Nothing clearly better and
  license-clean surfaced. Pixabay SFX (CC0-like, no attribution) is a legitimate *addition* for both
  ad and kids one-shots and is worth adding to the sourcing rotation. The paid/stock libraries
  (Pond5, Envato, DepositPhotos) are out of scope for the free-first brief. Keep the three-tier stack;
  add Pixabay SFX as a fourth free tier.
- **Is ElevenLabs text-to-sfx good enough for the long tail now?** I could not find independent pro
  reviews confirming a quality jump (**UNVERIFIED**). The repo's own same-day finding — recorded reads
  premium, AI text-to-sfx reads synthetic/childish — stands and was empirically validated by the team.
  Keep ElevenLabs as the long-tail fallback only, exactly as `palette.json`'s recorded-first policy
  already states.

---

## 6. Proposals (ranked)

Ranked by (quality payoff) / (effort × cost). Effort S/M/L; cost $0/free/paid.

1. **`tools/master.py` — the delivery mastering chain** · ffmpeg two-pass `loudnorm` → gentle bus glue →
   true-peak limit at −1 dBTP → fades → delivery report. · **Effort M** · **Cost $0** · Payoff: **huge
   for both tracks** — fixes the measured −15.8…−20.4 LUFS under-delivery and the +1.1 dBTP clip;
   this is the single change that most moves "sounds amateur" → "sounds platform-native." Ranked #1
   because it's the highest payoff, fully free, uses tools already on the box, and every other audio
   improvement is inaudible until delivery loudness/peak is correct.

2. **`audio_gate.py --delivery-report`** · add clip/true-peak detection, LUFS compliance, and a
   voice–bed separation (duck-working) check on top of the existing silence/cue modes. · **Effort S** ·
   **Cost $0** (ebur128/astats; optional pyloudnorm already in the venv) · Payoff: **high for both** —
   turns the subjective "ear gate" into an objective, repeatable gate and would have caught today's
   clip + quiet finals. Ranked #2 as the cheap safety net that makes #1 verifiable and prevents
   regressions.

3. **Self-host ACE-Step as the default free music engine** · run Apache-2.0 ACE-Step locally (8 GB
   VRAM, ~1.7 s/min audio) instead of paying fal/ElevenLabs; no revenue cap. · **Effort M** (local
   setup + a `--engine acestep-local` path in `gen_music.py`; fal path already exists) · **Cost free**
   (after setup) · Payoff: **high for both tracks** — fills the biggest content gap (music) at $0
   marginal cost with a clean commercial license. Ranked below mastering because music *content* matters
   less than music *delivery*, and ACE-Step-on-fal already works today at trivial cost.

4. **`import_music.py` + Pixabay sourcing for premium beds** · mirror `import_sfx.py`: curate Pixabay
   (CC0-like, no attribution, commercial-OK) tracks → license field → normalize −20 LUFS → catalog.
   · **Effort S** · **Cost free** · Payoff: **higher for ads than kids** — a curated human track beats
   a generated bed for a *premium SMB ad*; kids beds are fine from ACE-Step. Ranked here because it's
   cheap and closes the "premium ad" quality ceiling that generative beds can't quite reach.

5. **Codec-hygiene fix (single AAC encode at master)** · stop mp3→AAC→(re-encode) round-trips; decode
   to float in the mixers, encode AAC once in `master.py`. · **Effort S** · **Cost $0** · Payoff:
   **moderate, both tracks** — preserves the dry-transient SFX character brand.md §7 requires; audible
   mainly on snaps/clicks. Bundled with #1 in practice.

6. **Kids recorded SFX pack (boing/sparkle/giggle/toy)** · curate Kenney/Sonniss cartoon + a CC0
   recorded giggle → `import_sfx.py`. · **Effort S** · **Cost free** · Payoff: **kids only** — replaces
   the generated kids one-shots (the "childish" tell) with warm recorded ones; an AI "child's giggle"
   is both lower-quality and a worse look. Ranked by track: high for kids, ~zero for ads.

7. **Ad one-shots pack (CTA hit, cha-ching, social ding, logo sting)** · curate from Sonniss GDC pro
   tier + Pixabay SFX. · **Effort S** · **Cost free** · Payoff: **ads only** — gives the CTA/end-card
   (the ad-mode payoff) a proper sonic resolve. High for ads, ~zero for kids.

8. **Procedural free bed generator (extend `gen_chords.py`)** · deterministic ambient/pad beds, $0.
   · **Effort M** · **Cost $0** · Payoff: **low–moderate** — fine for calm ambient/lofi corners only;
   can't do pop/ukulele grooves. Superseded by #3 (ACE-Step) for anything with a beat. Keep as a
   no-network fallback.

9. **incompetech / Mixkit / Free Music Archive sourcing** · free-with-attribution (incompetech CC-BY,
   $30 waiver), Mixkit per-track (**license UNVERIFIED**), FMA mixed-CC (filter out CC-BY-NC). ·
   **Effort S** · **Cost free/$30** · Payoff: **moderate kids, low ads** — attribution friction + the
   recognizable "incompetech sound" make these weak for premium ads; usable for kids where attribution
   is tolerable. Ranked below Pixabay (#4) on license cleanliness.

10. **Stable Audio Open self-host** · commercial under Stability Community License but **$1M revenue
    cap** + mild license ambiguity. · **Effort M** · **Cost free (today)** · Payoff: **redundant with
    #3** — ACE-Step is Apache-2.0 with no cap, so Stable Audio Open adds license risk for no gain.
    Listed for completeness; not recommended over ACE-Step.

**Explicitly rejected:** Meta **MusicGen/AudioCraft** — weights are **CC-BY-NC 4.0, non-commercial**;
cannot ship in ads. Already on the repo avoid-list; confirmed again here. Do not build on it.

---

## Sources
- MusicGen weights CC-BY-NC 4.0 — https://huggingface.co/facebook/musicgen-large ·
  https://github.com/facebookresearch/audiocraft/issues/198 ·
  https://replicate.com/meta/musicgen/readme
- ACE-Step — https://github.com/ace-step/ACE-Step (Apache-2.0; 8 GB VRAM; ~1.7 s/min on RTX 4090)
- Stability AI Community License (commercial OK, $1M revenue cap, own outputs) — https://stability.ai/license ·
  https://stability.ai/news-updates/stability-ai-and-arm-release-stable-audio-open-small-enabling-real-world-deployment-for-on-device-audio-control
  (note: VentureBeat reported an earlier non-commercial reading — https://venturebeat.com/ai/stability-ai-debuts-new-stable-audio-open-for-sound-design)
- Pixabay Content License (free, no attribution, commercial) — https://pixabay.com/service/license-summary/
- Kevin MacLeod / incompetech (CC-BY 3.0/4.0, $30 no-attribution waiver) — https://incompetech.com/music/royalty-free/ ·
  https://search.seznam.cz/?q=Kevin+MacLeod+incompetech+Creative+Commons+attribution+license+commercial+ads
- Mixkit license (per-item; full terms not retrieved — UNVERIFIED) — https://mixkit.co/license/
- Free Music Archive (mixed Creative Commons) — https://freemusicarchive.org/about
- YouTube Audio Library = YouTube-only (already on repo avoid-list) — confirmed via docs/sfx-sources.md
- Spotify normalization −14 LUFS — https://search.seznam.cz/?q=loudness+penalty+streaming+platforms+LUFS+true+peak+target+chart+YouTube+Spotify+Apple
- ffmpeg `loudnorm` two-pass workflow — https://ffmpeg.org/ffmpeg-filters.html (§8.97 loudnorm;
  parameter guidance quoted is general knowledge framed as such — the live excerpt was truncated)
- Internal: tools/{gen_music,mix_music,gen_sfx,import_sfx,mix_sfx,gen_chords,gen_cue,audio_gate,fetch_pro_sfx}.py ·
  brand.md §7 · media/library/{sfx,music}/{catalog,palette}.json · docs/sfx-sources.md ·
  docs/session-summary-2026-08-23.md · measured loudness of remotion/out/*-final.mp4 and
  shorts/short-16-formy/output/short-16-sfx.mp4 (this session)
