---
name: orchestrate
description: Thin router that runs a short end-to-end through the pinned specialist agents (story-writer → voice ∥ pixel → build → qa → mix), passing only contract/verdict file paths so the main session's context stays small. Use when the user wants a video built via the multi-agent pipeline, or when a track skill (make-short / make-ai-short / make-vox) defers orchestration here. Encodes the spawn order, the contract validation at each handoff, and the human gates.
---

# orchestrate — thin router over the pinned specialist agents

The main session runs this and becomes a **router, not a worker**. It never reads a pixel, an mp4, or
audio — only JSON contracts and verdict strings. Heavy lifting (TSX, frame-reading, mixing) happens in
spawned agents whose context is spent, not yours.

## The agents (`.claude/agents/*.md` — inline the matching body into each spawn prompt)

| Agent | Contract in | Contract out | Validate |
|---|---|---|---|
| story-writer | brief | `beats.json` + `script.md` | `contracts.py beats` |
| voice | beats.json | `voice/<n>.wav` (+ caption ts) | `audio_gate.py` on the file |
| pixel | script.md | `asset-manifest.json` + layers | `contracts.py manifest` |
| build | manifest + beats | TSX + silent master + `qa-contract.json` | `contracts.py qa-contract` |
| qa | qa-contract + small JPEGs | `qa-verdicts.json` | `contracts.py qa-verdicts` |
| mix | silent master + voice + sfx-plan | final muxed mp4 | `audio_gate.py` after each stage |

## The spawn sequence (dependency order)

```
1. ROUTE        pick track (make-short / make-ai-short / make-vox) from the brief.
2. STORY        spawn story-writer → beats.json + script.md. Validate beats. STOP if invalid.
3. VOICE ∥ PIXEL spawn BOTH in parallel (both read only beats.json / script.md):
                   voice → voice file + caption ts, gated by audio_gate.
                   pixel → asset-manifest.json, validated. State derived cost before spending.
4. BUILD        spawn build → TSX, npm run gen, silent master, qa-contract.json. Validate qa-contract.
5. QA           spawn qa → reads ONLY the small JPEGs, writes qa-verdicts.json. Validate it.
                   verdict FAIL → re-spawn build with the failing frame# + note (no pixel upstream).
                   Loop until PASS.
6. MIX          spawn mix → voice-mux → sfx → music, audio_gate after each stage. SFX is
                   recorded-first: prefer `catalog.json` clips with `source` = `sonniss-gdc-*`/
                   `kenney`/`soundcn`/`freesound` (`pro-*`/`rec-*`), import misses via
                   `tools/import_sfx.py`; Sonniss `pro/` is gitignored + per-machine
                   `tools/fetch_pro_sfx.py` (see `docs/sfx-sources.md`).
7. REPORT       final path + cost ledger + all gate results.
```

## Gates — never skip

- **Contract validation** at every handoff via `tools/contracts.py`.
- **audio_gate.py** after every mux/mix stage AND after the orchestrator's voice-mux — a silent or
  −inf RMS file is a hard stop.
- **Human gates** (pause and ask the user):
  1. character/hero still lock (ai/vox) before any paid clip,
  2. SFX audit (`mix_sfx.py --print` cue sheet) before mixing — confirm `pro/` (Sonniss)
     clips are present on this machine (else `tools/fetch_pro_sfx.py`); their cues are skipped
     with a warning if absent,
  3. final ear check before "done".

## Hard rules the router enforces

- Run from the repo root. `npm run gen` after any added/renamed shot (build does it).
- Media: cross-video reusable → `media/library/`; per-video → `media/projects/<proj>/` (committed);
  `voice/` + `output/` gitignored.
- Keys live only in the gitignored `.env`; never echo/log/commit. State cost before spending.
- No CTA outros; seamless frame-0==last-frame loop.
- ffmpeg only via `tools/ffw.py` (never bare) — the minimal Remotion-bundled build makes silent AAC.
- QA frames: `remotion/scripts/qa_frames.mjs <CompId> <f,...> --scale=0.333` → ~5KB JPEGs; never read
  full-size PNGs into context.

## Report format (what you return to the user)

A compact table: track · final mp4 path · voice/sfx/final RMS (finite) · QA verdict · cost USD · any
human-gate items awaiting the user. No pixel/audio dumps.
