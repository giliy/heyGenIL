# Library Adoption — P1 decisions

Build log for the P1 library-adoption pass. Each entry records the verdict, the
evidence, and any gate numbers. License discipline is the through-line: only
MIT / Apache-2.0 / BSD / ISC / OFL / CC0 are adoptable for this commercial repo.

---

## P1-1 · flubber — ADOPTED (MIT) — DONE 2026-08-24

**What:** `flubber@0.4.2` (+ `@types/flubber@0.4.0`, MIT). Path-morphing:
`interpolate(fromPath, toPath, {maxSegmentLength, single})` → `(t: 0..1) => pathString`.

**Determinism:** flubber's interpolator is a PURE function of `(from, to, t)`.
The morph is driven purely by `useCurrentFrame()` via a clamped `interpolate()`.
No wall-clock, no rAF. Byte-compare gate PASSES.

**Integration:** `remotion/src/lib/morph.tsx`
- `useMorphPath(from, to, progress, opts)` — memoized flubber interpolator + clamp.
- `<Morph from to at dur [easing] [viewBox] ...>` — frame-driven morphing path.
- `circlePath(cx, cy, r)` helper for dot↔ring morphs.

**Proof:** `remotion/src/shots/proof-5-morph/Proof5Morph.tsx` (star→heart via
`<Morph>`, circle→square via raw `useMorphPath`). `tsc --noEmit` exit 0.
Determinism gate: frames 10/40/70/100 byte-identical across two renders — PASS.
QA frame f0040 read at phone scale: both morphs render, brand palette respected.

**Cost:** $0 (MIT). Two deps added; registered in THIRD_PARTY_NOTICES.

---

## P1-2 · popmotion — SKIP (documented rationale) — DONE 2026-08-24

**Verdict:** not adopted. Evaluated its full pure-math subset against what the
repo already ships; every deterministic helper is redundant.

**What popmotion offers, vs what we already have:**
| popmotion pure helper | Our existing equivalent |
|---|---|
| `ease*` / `cubicBezier` / `backInOut` / `bounce*` / `circ*` | Remotion `Easing` (linear/ease/quad/cubic/sin/circle/exp/elastic/back/spring/bounce/bezier/in/out/inOut) |
| `mix`, `mixColor`, `mixComplex` | `chroma-js` `chroma.mix(a,b,t)` + remotion `interpolate` |
| `clamp`, `wrap`, `snap`, `progress` | remotion `interpolate` extrapolation modes + trivial math |
| `pipe`, `applyOffset`, `distance`, `angle` | unused / trivial |
| `animate`, `spring`, `keyframes`, `inertia`, `decay`, `smoothFrame`, `velocityPerFrame/Second`, `framesync` | **NON-deterministic wall-clock drivers — the research skip-list already rejects these for Remotion's frame model** |

**Why skip:** (1) The only things popmotion adds over Remotion core are the
wall-clock animation drivers, which break the `pixels = f(frame)` determinism
rule (they tick on wall-clock, not frame index). (2) Its pure easing/color/mix
helpers duplicate Remotion `Easing`, our `lib/shorts.tsx` `EASE_*`/`settleP`/
`arcRise`, and `chroma.mix`. (3) Adopting it would add a dependency + a
THIRD_PARTY_NOTICES entry for zero benefit. Reference: research/pro-quality
skip-list — "Motion, react-spring, popmotion (wall-clock → non-deterministic)."

**No new code.** (Should a specific pure helper ever be needed, import just that
named function from `popmotion` — but none is needed today.)

---

## P1-3 · @paper-design/shaders — ADOPTED (Apache-2.0), benchmark-gated, DONE 2026-08-24

**Verdict:** ADOPTED. `@paper-design/shaders` + `@paper-design/shaders-react` @0.0.80,
both Apache-2.0, no runtime deps, no network calls. Proof: `Proof6Paper` (GrainGradient).

**Gate results:**
1. **Determinism — PASS, with one hard rule.** `speed={0.02}` FAILED the byte-compare
   (frames 5/30/60 differed across two renders): in `shader-mount.js`, `setFrame` sets
   `currentFrame` then calls `render(performance.now())`, and with `currentSpeed !== 0`
   the RAF loop keeps advancing `currentFrame += dt * speed` on wall-clock. With
   **`speed={0}`** the loop stops (`rafId = null`) and `u_time = frame * 1e-3` exactly.
   Re-gated with `speed={0}` + `frame={frame * 12}` → frames 5/30/60 byte-identical
   across two runs. GLSL `randomR` hash + fixed `u_noiseTexture` are frame-seeded.
2. **Cost — PASS.** 1 full-res frame 22s incl. bundle+browser warmup; 3-frame batches
   at scale 0.5: Proof6Paper 25s vs Proof5Morph 22s vs Proof2Sketch 22s → ~1s/frame
   marginal on the Intel-iGPU box. Fixed startup dominates, not per-frame GPU work.
3. **License — PASS.** Apache-2.0.

**Usage rule (hard):** paper-shaders components MUST be driven with `speed={0}` and an
explicit frame-derived `frame` prop (e.g. `frame={frame * 12}`, N scales motion speed).
Never use `speed≠0` — it breaks frame determinism. Rule also added to the skill crash list.

---

## P1-4 · ivrit-ai whisper fine-tune — ADOPTED (Apache-2.0), DONE 2026-08-24

**Verdict:** ADOPTED as the default `--lang he` engine in `tools/align_words.py`.
Model: `ivrit-ai/whisper-large-v3-turbo-ct2` (CTranslate2 / faster-whisper format,
0.8B). **License Apache-2.0 ✓** (verified on the HF card sidebar) — this was the
decisive factor: whisperx's previous `he` default, `imvladikon/wav2vec2-xls-r-300m-hebrew`,
declares **no license** on Hugging Face (license-ambiguous — not safe to ship).

**A/B (4 Hebrew edge-tts clips, ad-1-liat, vs edge-tts native word boundaries):**
- ivrit-ai turbo: MAE 0.048 / 0.198 / 0.067 / 0.066 s → mean **~0.095s** (~3 frames @30fps).
- whisperx wav2vec2 (old): MAE **~0.090s** on the shared clip. Par.
- Both well inside caption-timing tolerance. ivrit-ai also *transcribes* the audio, so it
  recovers the spoken text when the passed transcript drifts (wav2vec2 forced alignment
  can only shuffle the given tokens) — strictly more robust for the breakage-drill path.
- Speed: ~0.2s inference per short clip on CPU after a one-time ~50s model load/cache.

**Wiring:** `align_words.py` — Hebrew routes to `align_hebrew_ivrit()` under the new
`--aligner auto` (default), falls back to whisperx if faster-whisper isn't importable.
`--aligner whisperx` forces the old path. faster-whisper 1.2.1 already present in
`.venv-voice312` (whisperx dep) — no new install needed. English/other langs unchanged.

---

## P1-5 · Chatterbox Hebrew bakeoff — PENDING (needs a consented voice + human A/B)

**Verdict:** pending, blocked on ONE human input — a consented reference voice.
ResembleAI Chatterbox Multilingual is the only commercial-legal free model that does
expressive Hebrew. License **MIT ✓** and Hebrew (`he`) confirmed in the 23-language
list (checked the resemble-ai/chatterbox repo, 2026-08-24). It is NOT arena-proven to
sound better to Israeli ears — so this is a **bakeoff, not a switch**. Needs:
1. A **consented** reference voice (recorded/licensed Israeli voice, or owned
   synthetic) for zero-shot cloning — hard rule, never scrape a real person.
   **← the blocker. Cannot proceed without it.**
2. No native word timestamps → pair with align_words.py (ivrit-ai) for ads; NOT for
   per-unit reading.
3. Human A/B: 5 Hebrew lines, Chatterbox vs edge-tts he-IL-HilaNeural.
State cost before spending. **No money spent yet** — no generation run.
