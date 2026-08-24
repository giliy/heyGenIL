# Library Adoption — session log & status

Master summary of the pro-quality library-adoption program: what shipped, what was
rejected, and what's left. The per-item evidence lives in `P1-decisions.md`; the license
registry lives in `remotion/THIRD_PARTY_NOTICES.md`. This file is the index.

**Driving goal:** keep raising the video engine toward TOP-of-market quality by adopting
proven open-source libraries (permissive licenses only) as thin, deterministic wrappers.

**Two hard rules govern every adoption:**
1. **Determinism** — pixels must be a pure function of frame number. Verified by a
   byte-compare gate: `node scripts/frames.mjs <Id> <frames> --scale=0.5` run twice,
   `sha256sum` compared per frame → PASS/FAIL.
2. **License** — only MIT / Apache-2.0 / BSD / ISC / OFL / CC0. Reject GPL/LGPL/AGPL
   (except server-side subprocess binaries like ffmpeg), CC-BY-NC, CC-BY-SA,
   non-commercial model weights, and revenue caps.

---

## P0 — DONE (4 adoptions, all gated & shippable)

Thin deterministic wrappers, each with a proof shot and a passing byte-compare gate.

| Library | License | Wrapper | Proof shot | Status |
|---|---|---|---|---|
| `roughjs` | MIT | `lib/sketch.tsx` (`SketchLine`, `SketchShape`, …) | Proof2Sketch | ADOPTED |
| `perfect-freehand` | MIT | `lib/freehand.tsx` (pressure strokes) | — | ADOPTED |
| `remotion-captions-kit` | MIT | `lib/captions-kit.tsx` (per-word captions) | Proof3Captions | ADOPTED |
| `@tabler/icons-react` | MIT | `lib/icons.tsx` (brand/platform icons) | Proof4Icons | ADOPTED |

Crash rule added to the skill: **rough-js needs a non-zero integer seed** — `seed: 0` /
omitted falls back to `Math.random()` and fails the gate. All wrappers force a concrete
seed (default `STABLE_SEED = 7`).

---

## P1 — 4 of 5 DONE, 1 blocked on a human input

| # | Library | License | Verdict | Where |
|---|---|---|---|---|
| P1-1 | `flubber` | MIT | **ADOPTED** | `lib/morph.tsx` (`useMorphPath`, `<Morph>`, `circlePath`); proof Proof5Morph; gate PASS 10/40/70/100 |
| P1-2 | `popmotion` | MIT | **SKIP** | documented rationale — its only unique features are wall-clock drivers that break determinism; all pure helpers duplicate Remotion `Easing` / `chroma.mix` / `interpolate` |
| P1-3 | `@paper-design/shaders(-react)` | Apache-2.0 | **ADOPTED** | proof Proof6Paper (GrainGradient); gate PASS with the `speed={0}` rule |
| P1-4 | `ivrit-ai/whisper-large-v3-turbo-ct2` | Apache-2.0 | **ADOPTED** | `tools/align_words.py --lang he` default engine |
| P1-5 | ResembleAI Chatterbox Multilingual | MIT | **PENDING — blocked on consented voice** | see below |

### P1-3 — paper-shaders, the one hard-won rule
WebGL shader backgrounds (grain, mesh gradients, dithering, god-rays). Adopted, gated on
determinism + cost — both PASS, but determinism only holds under one rule:

> **Always `speed={0}` + an explicit frame-derived `frame` prop** (e.g. `frame={frame * 12}`).
> With `speed≠0`, `setFrame` re-enters `render(performance.now())` and a RAF loop advances
> `currentFrame` on **wall-clock** → `u_time` drifts → gate FAILS. With `speed=0` the loop
> stops and `u_time = frame * 1e-3` exactly → gate PASS (5/30/60 byte-identical).

Cost: ~1s/frame marginal on the Intel-iGPU box (fixed bundle+browser warmup dominates).
The rule is recorded in `P1-decisions.md` and added to the `vidtsx-2d-generator` skill
crash list.

### P1-4 — ivrit-ai Hebrew aligner
Replaced the Hebrew word-alignment engine in `tools/align_words.py`. The old default
(`imvladikon/wav2vec2-xls-r-300m-hebrew`) declares **no license** — not safe to ship.
ivrit-ai whisper-large-v3-turbo is **Apache-2.0**, and because it *transcribes* rather than
force-aligns, it also recovers the spoken text when a transcript drifts from the audio
(strictly more robust on the edge-tts breakage-drill path).

A/B on 4 Hebrew clips vs edge-tts native boundaries: MAE **~0.095s** (ivrit-ai) vs
**~0.090s** (old wav2vec2) — par, well inside caption tolerance. Wired as `--aligner auto`
(default, whisperx fallback); `--aligner whisperx` forces the old path. No new install
(faster-whisper already in `.venv-voice312`).

### P1-5 — Chatterbox Hebrew bakeoff — BLOCKED, needs you
The only commercial-legal free model for expressive Hebrew TTS (MIT, `he` in its 23-language
list). It's a **bakeoff, not a switch** — not arena-proven to Israeli ears.

**The blocker is a hard rule, not a technical problem:** zero-shot voice cloning requires a
**consented reference voice** — a voice you own, or a recording from someone who explicitly
agreed. I won't scrape or approximate a real person.

To unblock: point me at a consented voice file (or record one of your own lines). Then I'll
A/B 5 Hebrew lines, Chatterbox vs edge-tts `he-IL-HilaNeural`, with `align_words.py`
(ivrit-ai) supplying word timings. **No cost spent yet** — no generation run.

---

## What's left

- **P1-5 Chatterbox** — waiting on the consented reference voice (above).
- **P2** (not started): Rhubarb lip-sync, Kevin MacLeod music bed, the G5 AI-pixel chain.

---

## Files touched this program

- `remotion/src/lib/morph.tsx` — flubber wrapper (P1-1)
- `remotion/src/shots/proof-5-morph/Proof5Morph.tsx` — morph proof (P1-1)
- `remotion/src/shots/proof-6-paper/Proof6Paper.tsx` — paper-shaders proof (P1-3)
- `tools/align_words.py` — ivrit-ai Hebrew engine + `--aligner` flag (P1-4)
- `remotion/package.json` — flubber, @types/flubber, @paper-design/shaders(-react)
- `remotion/THIRD_PARTY_NOTICES.md` — license registry (P0 + P1 entries)
- `.claude/skills/vidtsx-2d-generator/SKILL.md` — rough-js seed rule + paper-shaders
  `speed={0}` rule (the two determinism crash rules)
- `research/library-adoption/P1-decisions.md` — per-item evidence & verdicts
