# CLAUDE.md — claude-faceless-shorts-creator

A **faceless-shorts factory** driven by Claude Code. Three production tracks, one repo — the
right skill is picked automatically from the request:

| The user asks for… | Skill | Pixels come from | Projects live in |
|---|---|---|---|
| "make a short about X" (default) | `/make-short` | 100% TSX (Remotion animation) | `shorts/short-N-<niche>/` |
| "make an ad / advertising short / commercial" (Hebrew SMB) | `/make-ad` | 100% TSX + `lib/ads.tsx` (CTA end card, PriceBadge, Logo) | `shorts/ad-N-<business>/` |
| "make an AI video short", "blue-man video" | `/make-ai-short` | a fal video model (locked recurring character) | `ai-shorts/<series>/` |
| "vox style / documentary / explainer short" | `/make-vox` | layered paper-collage (AI images + cutouts) | `vox-shorts/vox-N-<topic>/` |

All four share the same backbone: a `beats.json` contract, ElevenLabs voice with word-exact
captions (`gen_voice.py`), frame-by-frame QA at phone scale, library-first SFX (`/suggest-sfx`),
optional music bed, seamless frame-0==last-frame loops, no CTA outros. TSX crash rules live in
`/vidtsx-2d-generator`. **The ad track (`/make-ad`) is the deliberate exception**: mode:"ad"
overrides the no-CTA-outro and seamless-loop rules — an ad's payoff IS the conversion CTA, and
the end card must hold. Ads are Hebrew/RTL by default (`language:"he"`), voice = edge-tts
(`gen_voice_edge.py`, free, native word boundaries; ElevenLabs only on `eleven_multilingual_v3`,
kokoro excluded). Hebrew language/market research lives in `research/hebrew-ads/`.

## Layout

```
tools/            Python tools: gen_voice, gen_sfx, gen_music, mix_sfx, mix_music, gen_chords,
                  gen_image, gen_clip, bakeoff_clip, cutout, capture_web
remotion/         the Remotion project — src/lib/ (shared + niche kits incl. collage.tsx),
                  src/shots/{short-N, ai-N, vox-N}/
media/            Remotion's public root: library/ (reusable: sfx, music, logos)
                  + projects/<proj>/ (media for ONE video — incl. committed AI clips & layers)
shorts/           TSX shorts: script.md, beats.json, sfx-plan.json each
ai-shorts/        generative shorts: + character.json (LOCKED reference), shot sidecars, IDEAS.md
vox-shorts/       collage shorts: + DESIGN.md (the visual language — read before any vox work)
brand.md          the style contract every skill reads (palette, motion, safe areas, SFX taste)
IDEAS.md          the TSX-shorts idea bank + niche ranking
.claude/skills/   make-short, make-ai-short, make-vox, vidtsx-2d-generator, suggest-sfx
```

## Conventions (hard rules)

- **Run everything from the repo root.** Tools resolve engine paths (media/library, catalogs)
  against their own location, but project paths (`shorts/...`) against the CWD.
- **Python:** any Python 3.10+ — the core pipeline is stdlib-only. Only vox layer production
  needs extras: `pip install pillow rembg` (cutout.py) and `pip install playwright &&
  playwright install chromium` (capture_web.py). `ffmpeg`/`ffprobe` and `node`/`npx` on PATH.
- **Voice pipeline (kokoro/whisperx) needs Python 3.12, NOT 3.13+.** The local TTS + aligner
  deps (kokoro→misaki/phonemizer-fork, whisperx→ctranslate2) have no cp313/cp314 wheels and
  break on 3.14. Use the committed venv `.venv-voice312` (Python 3.12): run voice work with
  `.venv-voice312\Scripts\python.exe tools/gen_voice.py ...` (kokoro) and
  `.venv-voice312\Scripts\python.exe tools/align_words.py ...` (whisperx). Rebuild it with
  `py -3.12 -m venv .venv-voice312` then `pip install kokoro soundfile whisperx pyloudnorm`.
  espeak-ng is supplied by the pip `espeakng-loader` package (no system install). Requires
  Windows long paths enabled (`LongPathsEnabled=1`) for the torch install.
- **API keys** live in `.env` at the repo root (copy `.env.example`). Never commit `.env`.
  ELEVENLABS_API_KEY = voice/SFX/music · FAL_KEY = AI clips + images · GEMINI_API_KEY = images.
- **Registry is generated:** after adding/renaming a shot, `cd remotion && npm run gen`
  (frames.mjs/render-all.mjs do NOT run it themselves).
- **Media rules:** `media/library/` is for CROSS-VIDEO reusable assets only (each with a
  catalog). Anything generated FOR ONE video (story frames, AI clips, collage layers) goes in
  `media/projects/<proj>/`, referenced as `staticFile('projects/<proj>/x')`. Reuse before you
  generate — check the catalogs first.
- **Committed vs gitignored media:** AI-generated clips and collage layers in
  `media/projects/` ARE committed (paid, non-reproducible pixels). `*/voice/` and `*/output/`
  are gitignored everywhere (regenerable); `ai-shorts/*/shots/*.mp4` working copies too — the
  canonical clip lives in `media/projects/<name>/`.
- **Costs (ai-shorts only):** state the derived generation cost BEFORE spending it, and never
  regenerate a locked character from text (see /make-ai-short's iron rules).
- **QA is not optional:** render frames at phone scale and READ them before any full render.
