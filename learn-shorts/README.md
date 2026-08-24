# Learn-Shorts Engine — Hebrew learning shorts, generated daily

A factory of **templated Hebrew learning shorts** for ages 5–7: one concept per video,
script-first, batched, QA-gated, staged for daily publishing. This is the generalization
of the reading (nikkud) track.

## The model

Every video is the **same template, different content**:
`script.md` (pointed Hebrew) → `tools/make_learn.py` derives `beats.json` + unit manifest →
one generic renderer draws it → `gen_voice_reading.py` voices each unit with word-exact
highlight → QA gates → render → master → publish folder.

A **lesson type** is a data pack in `tools/learn_data/` — a new template is a new pack, not
a fork of the pipeline.

## Lesson types

| type | teaches | data pack | status |
|---|---|---|---|
| `nikkud` | one vowel sign (kamatz, patach, …) | `learn_data/nikkud.py` (wraps `nikkud_data.py`) | ✅ proven, 9 signs |
| `letter` | one Hebrew letter (shape/name/sound/words) | `learn_data/letters.py` | data drafted, renderer TBD |
| `number` | counting + simple math (computed, never asserted) | `learn_data/numbers.py` | data drafted, renderer TBD |
| `wordclass` | nouns vs verbs (שם עצם / פועל) | `learn_data/wordclass.py` | data drafted, renderer TBD |

> ⚠ All letter/number/wordclass rows are **DRAFT** — the pointed words must be human-vetted
> before ship (a wrong vowel taught to a child is the worst-case bug). nikkud kamatz/patach
> are vetted; tzere→dagesh-kal are draft word lists awaiting approval.

## The daily engine

`tools/learn_daily.py` — pick the next `queued` video in `learn-shorts/curriculum.json`,
auto-generate its script from the pack, then run
derive → gen → voice → QA → render → mux → audio-gate → master → stage.

`tools/publish_stage.py` — stage the mastered mp4 into `publish/<date>-<type>-<key>/` with a
Hebrew caption + NOTE, for a **human** to post to TikTok/Instagram/YouTube (no platform APIs
yet — that's a clean later add behind one flag).

Schedule once a day (Windows Task Scheduler):
```
python tools/learn_daily.py --track
```
One video per run; a scheduler fires it daily. Cost **$0** (edge-tts voice, in-TSX koala).

## Run it

```bash
# build ONE queued video end-to-end and stage it for publish
python tools/learn_daily.py --track

# dry-run (print the plan, write nothing)
python tools/learn_daily.py --dry-run

# build every queued video this run
python tools/learn_daily.py --all --track
```

## Gates (never skip)

- `make_learn.py` contract-validates beats before writing (taught sign auto-detected vs the
  front matter — a mismatch is a HARD error: never teach a wrong sign).
- `qa_frames.mjs <CompId> <frames> --scale=0.333` — READ every JPG: mark legible,
  highlight==sound, RTL order.
- `release_gate.py learn <beats.json>` — the "would a parent trust this" rubric.
- `audio_gate.py` PASS after voice-mux and final mix; `master.py` to −13 LUFS / −1 dBTP.

## Layout

```
tools/learn_data/       data packs (nikkud, letters, numbers, wordclass)
tools/make_learn.py     the generalized derivation engine (make_reading.py = shim)
tools/learn_daily.py    the daily runner
tools/publish_stage.py  the human publish hand-off
learn-shorts/           curriculum queue (curriculum.json) + daily-report.json
reading-shorts/read-N-* the nikkud videos (project dirs)
publish/                staged videos for a human to post
remotion/src/shots/read-N/  generated registration wrappers + vo.gen.ts
```
