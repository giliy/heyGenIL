# 04 — Repo Capability Recon: Hebrew Kids' Shorts Feasibility

Repo: `C:\source\shorts-with-claude\claude-faceless-shorts-creator`

## (a) Hebrew capability inventory — what already works end-to-end

The pipeline is **production-proven for Hebrew**, not just theorized. A real Hebrew RTL commercial
(`shorts/short-16-formy`, voiceStatus `edge-tts:he-IL-AvriNeural`) shipped through the full chain.

| Capability | Status | Where |
|---|---|---|
| **Hebrew TTS (free, word-exact)** | ✅ works | `tools/gen_voice_edge.py` — edge-tts `he-IL-AvriNeural` (male) / `he-IL-HilaNeural` (female), `boundary="WordBoundary"` writes real per-word times to `.words.json` + `vo.gen.ts`. No API key. |
| **Hebrew TTS (paid, emotional)** | ✅ v3 only | `tools/gen_voice.py --engine elevenlabs` — Hebrew exists ONLY on `eleven_multilingual_v3` (`--lang he`). **v2 / flash v2.5 have NO Hebrew; kokoro excluded** (`make-ad/SKILL.md:142-144`). |
| **Hebrew forced alignment (fallback)** | ✅ wired | `tools/align_words.py --lang he` → WhisperX → `imvladikon/wav2vec2-xls-r-300m-hebrew` resolves automatically (`hebrew-ads-deep-dive.md:228`). |
| **RTL captions (word-pop)** | ✅ built | `remotion/src/lib/shorts.tsx` — `rtl` prop on `CaptionsPop`/`CaptionsPill`/`CaptionPillPage`/`BigTitle`/`PauseCard`; `direction:'rtl'`, `unicodeBidi:'isolate'`, `anchorRtl()` (RLM), `stripNikkud()`. |
| **Bidi-safe Hebrew+digits** | ✅ built | `remotion/src/lib/ads.tsx` — `formatILPrice/formatILPhone/formatILPct`, RLM-anchored. |
| **Hebrew fonts (offline, vendored)** | ✅ built | `media/library/fonts/` — Heebo 500/600/700 + Rubik 700/900, `hebrew+latin` incl. ₪ U+20AA. Wired in `remotion/src/fonts.ts` (`FONT_HEBREW_CAPTION` = Rubik→Heebo fallback) + `lib/fontFaces.tsx`. |
| **Nikkud control** | ✅ built | `stripNikkud()` strips U+0591–U+05C7 at the caption boundary. **brand.md:48-50 explicitly carves out the kids exception: "Use nikkud only for liturgy or children's content; bump caption lineHeight to ~1.5 so the points don't clip."** |
| **RTL in vox/collage engine** | ✅ built | `remotion/src/lib/collage.tsx:565,607` — `rtl` prop on headline/word components. |
| **RTL in kinetic type engine** | ✅ built | `remotion/src/lib/kinetic.tsx:79-163` — full RTL contract. |
| **Hebrew linguistic/market research** | ✅ done | `research/hebrew-ads/` — register rules (ISRAELI > ACADEMY, ktiv maleh), per-vertical gender, freier-code, taboos, regulation, calendar. |
| **API keys needed** | edge-tts: none | `.env.example` — Hebrew needs **no key** (edge-tts). ElevenLabs/Gemini/FAL only if upgrading. |

**Net: the entire Hebrew voice → word-timing → RTL-caption → font chain is solved and battle-tested.**

## (b) Track-by-track fit for a Hebrew kids' CHARACTER series

### 🥇 make-ai-short (generative video) — BEST FIT for a *recurring character*
The only track built around a **locked recurring character**.
- **`character.json` LOCK mechanism** (`ai-shorts/blue-man/character.json`): schema = `name`, `rule`
  ("NEVER generate from text twice"), `image` (locked PNG), `locked` date, `video_model{}` (Seedance
  1.5 Pro, `generate_audio:false`, `$0.0583/s`), `design{}`, `generation{}`, `shot_workflow[]`.
  The existing design even specifies **"childlike ~4 heads tall, oversized rounded head, mitten hands,
  stubby legs"** — already a cute-creature aesthetic.
- **Consistency:** every still = `gen_image.py --ref character.png`; every clip = image-to-video from a
  frame already containing the character. Exactly what a kids' mascot needs.
- **Loop-pinned** via `end_image_url` (frame-0 == last-frame) — kids' shorts love seamless loops.
- **Pros:** true character motion (walks, waves, hugs), strongest consistency story, proven cost
  discipline ($2.33/40s @1080p).
- **Cons:** 💰 cost per re-roll (~$0.29/5s clip), clone-spawning risk ("EXACTLY ONE character" prompt
  discipline), Hebrew voice is ElevenLabs-only here — **must pass `--model eleven_multilingual_v3
  --lang he`**, NOT the default v2. **No edge-tts path documented in this skill — a gap.**
- **Singing/rhythm:** Seedance animates but won't lipsync a song; voice is a separate VO track. Singing
  is NOT native here.

### 🥈 make-short (TSX, via lib/story.tsx) — BEST FIT for *illustrated storybook* kids content
- `remotion/src/lib/story.tsx` is **explicitly labeled** "Storybook kit — animated stills for the
  image-driven STORY shorts (kids, manga…)" — Ken-Burns over AI stills.
- **Already proven on kids:** `shorts/short-7-kids` ("Little Pip", ages 4-6, a fox cub, lost-and-found
  arc, 9 AI stills, ElevenLabs v3 emotion tags `[warmly]/[scared]/[crying]/[whispers]`). The template to clone.
- **Pros:** 💰 **cheapest** (stills, not video clips), fastest iteration (pure TSX retiming), perfect
  captions, seamless loop free (rewind trick), all components Hebrew-ready.
- **Cons:** character is a **still image** (Ken-Burns only — no true limb motion); "recurring character"
  stays consistent only via `--ref` on the stills. Hebrew voice path: must force v3+he, or swap to
  `gen_voice_edge.py` (proven: short-13 used edge-tts).
- **Singing/rhythm:** possible but manual — synthesize speech-melody via v3 emotion tags or layer a
  music bed; no true song engine.

### 🥉 make-vox (collage documentary) — POOR FIT
`lib/collage.tsx` has RTL support, but the engine is layered paper-collage / archival documentary, not
a cute recurring mascot. No character-lock. Wrong visual language for young kids.

### make-ad-style hybrid — WRONG GOAL, but the Hebrew plumbing is the donor
`make-ad` is persuasion with a CTA end card. A kids' series is the opposite (no CTA, wants a loop).
**Don't use ad mode** — but **steal its entire Hebrew stack** (edge-tts voices, `ads.tsx` bidi
formatters, register research). It's the Hebrew donor, not the track.

**Recommendation:** `make-ai-short` for a true recurring mascot (character.json lock), OR
`make-short`+`lib/story.tsx` for a cheaper storybook pilot series. Both Hebrew-capable once voice
routing is fixed.

## (c) Gaps for kids' Hebrew content

1. **Voice routing gap (both kids tracks).** `make-short` Stage 4 and `make-ai-short` Stage 2 both
   default to `gen_voice.py` (ElevenLabs), whose **default model `eleven_multilingual_v2` has NO
   Hebrew**. Neither skill documents the `--lang he --model eleven_multilingual_v3` flags or the
   `gen_voice_edge.py` Hebrew path. **A kids skill must hard-wire edge-tts `he-IL-HilaNeural` (or
   v3+he) — as make-ad already does.**
2. **No children's VOICE persona.** edge-tts has only Avri (male) + Hila (female) adult voices. No
   child/animated-character voice, no documented Hebrew singing TTS. ElevenLabs v3 has emotion tags
   (proven on short-7) but **no Hebrew singing**.
3. **Kids' music library is thin.** `media/library/music/catalog.json` has ONE relevant bed:
   `lullaby-tender` (music-box, piano, storybook). No playful/ukulele/cartoon/upbeat-kids bed.
   `gen_music.py` can grow it (force_instrumental) but nothing is pre-built.
4. **SFX catalog skews premium-calm, not playful.** Of 34 SFX, only `chime-magic`, `sparkle-soft`,
   `warm-shimmer`, `page-flip`, `owl-hoot`, `stream-soft`, `chime-reward` suit kids. **No cartoon
   boings, giggles, pops, splats, animal sounds, or toy sounds.** brand.md §7's taste is deliberately
   "calm/premium, felt-not-heard" — the opposite register of kids' content. A kids track needs a
   palette extension in `sfx/palette.json` + a brand-taste override.
5. **Brand palette/motion is anti-kid.** brand.md:13-14 explicitly bans "bouncy/cartoonish… Memphis"
   looks, hard shadows, sticker-pop — and §5 mandates "no overshoot, no bounce, no spins, no elastic."
   **Kids' content wants exactly the banned register.** A kids track needs a documented brand-mode
   override (like ad-mode's override of the no-CTA rule).
6. **No nursery-rhyme / singing licensing notes.** The research covers ACUM music licensing for
   commercial video but nothing on nursery-rhyme public-domain status or singing synthesis.
7. **No Hebrew kids' linguistic research.** The research maps *advertising* registers but not
   **child-directed speech** (simplified vocabulary, repetition, diminutives, gisha mekuvenet).
   Kids' Hebrew phrasing is unmapped.
8. **No kids' niche in the idea banks.** `IDEAS.md` ranks 18 TSX niches — none kids. The ai-track
   `ai-shorts/IDEAS.md:146` lists "kids story in motion" as an agreed concept but with no built series.
   Kids content is proven as a one-off (short-7), not a track.

## (d) Conventions a new 'kids' track MUST follow

- **Artifact contract:** `shorts/<id>/` with `script.md`, `beats.json` (the machine contract), `voice/`
  (gitignored), `sfx-plan.json`, `output/` (gitignored); composition + auto-gen `vo.gen.ts` under
  `remotion/src/shots/<id>/`. For ai-track: `ai-shorts/<series>/` + `character.json` +
  `shots/NN-slug.{png,json}` + `media/projects/<name>/` (committed clips).
- **beats.json shape:** `format{width,height,fps,durationSec}` + `vo[]` (`text`/`start`/`end`/`words[]`)
  + `beats[]` (`name`/`start_s`/`end_s`). short-7 adds the kids-useful `subtype:"image-story"`,
  `series`, `audience:"ages 4-6"`, and a **`tts` field** (clean `text` for captions, v3-tagged `tts`
  for delivery — tags filtered from the word map).
- **Voice contract:** per-line TTS cached by text-hash (only changed lines re-bill); real word times
  written back to beats.json + `vo.gen.ts`; captions highlight on the exact word. **Kids pacing:
  short-7 used ~2.2-2.5 wps with real pauses (NOT the 2.7wps punchy-short rule) — "Kids stories breathe;
  do not tighten."**
- **Character lock (ai-track iron rule):** never generate the character from text twice; one locked
  `character.png` reference; every clip is image-to-video.
- **Cost gate (ai-track):** state derived cost BEFORE spending.
- **Registry:** after adding a shot, `cd remotion && npm run gen`.
- **QA at phone scale (non-negotiable):** `node scripts/qa_frames.mjs <Id> 0,<boundaries+heroes>,<last>
  --scale=0.333`, READ every small JPG. For Hebrew: bidi-check digit tokens + nikkud lineHeight if used.
- **Media rules:** cross-video reusables → `media/library/` (with catalog); one-video assets →
  `media/projects/<proj>/`. AI clips/collage layers committed; `voice/`+`output/` gitignored.
- **No-CTA-outro rule (locked):** end on the payoff, seamless frame-0 loop is the ending. **Kids'
  shorts keep this rule** (unlike ads, which override it).
- **ffmpeg via wrapper:** always `tools/ffw.py`, then `tools/audio_gate.py` must pass.
- **SFX flow:** library-first, author `sfx-plan.json`, audition mix awaits the user's ear; update catalog `used_in`.
