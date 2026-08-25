#!/usr/bin/env python3
"""gen_voice_reading.py — FREE per-unit voice track + exact sub-word timing for a reading short.

The heart of the reading track's timing guarantee (research/hebrew-reading/00-findings.md §2;
01-subword-timing.md). Each teaching unit (isolated grapheme, CV syllable) is spoken in
isolation anyway — so it gets its OWN edge-tts clip, and the timing becomes EXACT BY
CONSTRUCTION (clip == unit). The only moving part is trimming edge-tts's per-clip silence
pad with a numpy RMS energy trim (edge-tts pads ~0.22–0.40s lead / ~1.05s trail, VARYING per
clip — no fixed offset is safe, so we measure it). That trimmed [onset,end] IS the highlight
window written into vo[].units[].

Imports and REUSES gen_voice_edge plumbing (_tts, probe_duration, run, hash-caching, ffw
resolution) rather than duplicating it. Runs under .venv-voice312 (Python 3.12.10 — edge-tts,
soundfile, numpy).

Roles:
  isolated / cv   — one clip per unit -> vo[].units[] with real trimmed windows
  blend           — synth each syllable as its own clip, trim, schedule BACK-TO-BACK at known
                    offsets (NO gaps = continuous blending, findings §1) -> per-syllable units
  word            — one continuous clip -> NO units[] (existing whole-word highlight is correct)

Usage (from repo root):
  .venv-voice312\\Scripts\\python.exe tools/gen_voice_reading.py \
      --beats reading-shorts/read-1-kamatz/beats.json \
      --reading reading-shorts/read-1-kamatz/reading.json \
      --emit-ts remotion/src/shots/read-1/vo.gen.ts
  ... [--dry-run] [--force] [--rate -18%] [--mux out.mp4]

edge-tts = FREE, no key. This build is $0.
"""
import argparse
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

# Reuse gen_voice_edge's plumbing (resolve ffmpeg/ffprobe via ffw, _tts, probe_duration, run).
import gen_voice_edge as gve
import ffw
import voice_cleanup  # the shared TTS cleanup front (highpass/deesser/compand)

FFMPEG = ffw.path()
FFPROBE = ffw.ffprobe_path()

DEFAULT_VOICE = "he-IL-HilaNeural"   # the locked בּוּ voice (findings §5)
DEFAULT_RATE = "-18%"                # slowed global rate: hold/stretch the single sound

# cached per-unit clip -> trimmed [onset, end] (seconds within the clip)
_trim_cache = {}

# Teach-CV beat: each צירוף is its own clip, heard as a DISTINCT sound (findings §1 — teach one at
# a time). CV_GAP is the silence between unit *ends* and the next unit's *start* so a 5-7yo hears
# "ba … ma … qa" as three separate sounds. (The BLEND beat is the opposite — no-gap stitching for
# continuous blending.) 0.55s reads clearly-separated without dragging the beat.
CV_GAP = 0.55


def _rms_trim(path: str, thresh: float = 0.15) -> tuple[float, float]:
    """numpy RMS energy trim -> exact [onset,end] of the speech in an edge-tts clip.

    edge-tts pads every clip with ~0.22–0.40s leading and ~1.05s trailing silence, VARYING
    per clip (01-subword-timing §Q2 probe table) — NO fixed global offset is safe, so measure
    it. Returns the first/last sample where the short-window RMS envelope exceeds `thresh` *
    peak, in absolute seconds within the clip. The trimmed window IS the highlight window.
    """
    import numpy as np
    import soundfile as sf

    # edge-tts emits mp3; decode to wav via ffw-resolved ffmpeg, read with soundfile.
    wav = path + ".wav"
    if not os.path.exists(wav):
        gve.run([FFMPEG, "-y", "-v", "error", "-i", path, "-ar", "44100", "-ac", "1", wav])
    data, sr = sf.read(wav)
    if data.ndim > 1:
        data = data.mean(axis=1)

    win = max(1, int(0.020 * sr))               # ~20 ms RMS window
    n = data.shape[0]
    # RMS envelope via a sliding window (frame boundaries at win multiples, deterministic).
    nf = n // win
    env = np.sqrt((data[: nf * win].reshape(nf, win) ** 2).mean(axis=1))
    peak = env.max()
    if peak <= 0:
        return 0.0, float(gve.probe_duration(wav))
    level = thresh * peak
    above = np.nonzero(env >= level)[0]
    if above.size == 0:
        return 0.0, float(gve.probe_duration(wav))
    onset = float(above[0] * win) / sr
    end = float((above[-1] + 1) * win) / sr
    return round(onset, 3), round(end, 3)


def _tts_cache_key(voice, rate, text):
    return hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()[:8]


def _synth_unit(voice, rate, text, vdir, force):
    """edge-tts synth one unit clip -> its path (hash-cached by voice|rate|text, library-first)."""
    h = _tts_cache_key(voice, rate, text)
    mp3 = os.path.join(vdir, f"u-{h}.mp3")
    if force or not os.path.exists(mp3):
        gve.tts_line(text, voice, rate, gve.DEFAULT_PITCH, mp3)   # reuses _tts + ffw
    return mp3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--beats", required=True, help="path to the short's beats.json")
    ap.add_argument("--reading", required=True, help="path to reading.json (the unit manifest)")
    ap.add_argument("--emit-ts", help="write vo.gen.ts (VoLine[] with optional units)")
    ap.add_argument("--mux", help="optional rendered mp4 to mux the voice onto (-voiced.mp4)")
    ap.add_argument("--dry-run", action="store_true", help="plan only, synth nothing")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--rate", default=DEFAULT_RATE)
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    args = ap.parse_args()

    beats_path = os.path.abspath(args.beats)
    reading = json.load(open(os.path.abspath(args.reading), encoding="utf-8"))
    beats = json.load(open(beats_path, encoding="utf-8"))
    voice = reading.get("voice", args.voice)
    vdir = os.path.join(os.path.dirname(beats_path), "voice")
    os.makedirs(vdir, exist_ok=True)

    # map vo[] line -> the units that belong to it (by beat name matching the unit roles)
    units = reading.get("units", [])
    if args.dry_run:
        for u in units:
            print(f"  dry: [{u['role']:9s}] {u['grapheme']}  (id={u['id']})")
        print(f"plan only — {len(units)} unit(s), voice={voice}, rate={args.rate}, $0")
        return

    # Group units by the vo[] line they drive (isolated->teach-isolated, cv->teach-cv, ...).
    # CV has SEVERAL units on ONE line — they must ACCUMULATE + stagger, never overwrite (P3 fix).
    beat_for_role = {"isolated": "teach-isolated", "cv": "teach-cv",
                     "blend": "blend", "word": "read-word"}
    # A beat name may REPEAT (e.g. 5 blend lines / 5 read-word lines in read-3-kamatz-aba). A plain
    # {beat: line} dict keeps only the LAST repeat, so every repeated role's units would be placed
    # into the SAME line's window (wrong highlight timing — the read-3 bug). Both the manifest order
    # and vo[] are built in canonical order with repeats in encounter order, so consume each beat's
    # vo[] lines from a per-beat QUEUE in encounter order.
    from collections import deque
    _lines_by_beat = {}
    for l in beats["vo"]:
        _lines_by_beat.setdefault(l.get("beat"), deque()).append(l)

    def _next_line(beat):
        q = _lines_by_beat.get(beat)
        return q.popleft() if q else None

    # We collect (path, globalStart, line) for every synthesized clip to assemble a timed
    # voice.wav. The `line` ref lets the post-placement re-flow shift a clip exactly when its
    # line's start moves (no fragile span-matching).
    placed = []   # (clip_path, global_start_sec, line_dict)

    def _place_isolated(u, line):
        """isolated: one clip per unit -> a single real trimmed window."""
        g = u.get("grapheme", "")
        ls = float(line["start"])
        mp3 = _synth_unit(voice, args.rate, g, vdir, args.force)
        on, en = _rms_trim(mp3)
        line["units"] = [{"g": g, "start": round(ls + on, 3), "end": round(ls + en, 3)}]
        line["end"] = round(ls + en, 3)
        placed.append((mp3, ls, line))
        print(f"  isolated {g:<8} trim [{on:.3f},{en:.3f}]s -> unit {ls+on:.3f}..{ls+en:.3f}")

    def _place_cv(us, line):
        """teach-cv: each צירוף its own clip, ACCUMULATED + staggered (distinct sounds, gap=CV_GAP)."""
        ls = float(line["start"])
        off = 0.0
        units_out = []
        for u in us:
            g = u.get("grapheme", "")
            mp3 = _synth_unit(voice, args.rate, g, vdir, args.force)
            on, en = _rms_trim(mp3)
            units_out.append({"g": g, "start": round(ls + off + on, 3), "end": round(ls + off + en, 3)})
            placed.append((mp3, ls + off, line))
            print(f"  cv       {g:<8} trim [{on:.3f},{en:.3f}]s -> unit {ls+off+on:.3f}..{ls+off+en:.3f}")
            # next unit starts after THIS clip's speech ends + a clear gap (distinct, not blended)
            off += en + CV_GAP
        line["units"] = units_out
        line["end"] = round(units_out[-1]["end"], 3)

    def _place_blend(u, line):
        """blend: each syllable its own clip, stitched BACK-TO-BACK (NO gaps = continuous blending)."""
        g = u.get("grapheme", "")
        ls = float(line["start"])
        syllables = u.get("syllables") or [g]
        off = 0.0
        units_out = []
        for s in syllables:
            mp3 = _synth_unit(voice, args.rate, s, vdir, args.force)
            on, en = _rms_trim(mp3)
            units_out.append({"g": s, "start": round(ls + off + on, 3), "end": round(ls + off + en, 3)})
            placed.append((mp3, ls + off, line))
            off += gve.probe_duration(mp3)              # back-to-back: next starts at prev clip end
        line["units"] = units_out
        line["end"] = round(ls + off, 3)
        print(f"  blend    {g:<8} {len(syllables)} syll(s) stitched, no gaps -> {len(units_out)} units")

    def _place_word(u, line):
        """word: one continuous clip + existing whole-word highlight -> NO units[]."""
        g = u.get("grapheme", "")
        ls = float(line["start"])
        mp3 = _synth_unit(voice, args.rate, g, vdir, args.force)
        dur = gve.probe_duration(mp3)
        line.pop("units", None)                          # word beat carries no sub-word units
        line["end"] = round(ls + dur, 3)
        placed.append((mp3, ls, line))
        print(f"  word     {g:<8} one clip {dur:.2f}s -> whole-word (no units)")

    # dispatch in manifest order, grouping CV units onto their shared line
    cv_pending = []
    def _flush_cv():
        if cv_pending:
            line = _next_line("teach-cv")
            if line is not None:
                _place_cv(cv_pending, line)
            else:
                print("  WARN  no teach-cv line — skipping cv units")
            cv_pending.clear()

    for u in units:
        role = u.get("role", "isolated")
        beat = beat_for_role.get(role, role)
        if role == "cv":
            cv_pending.append(u)                         # accumulate; flush as one staggered group
            continue
        _flush_cv()                                      # a non-cv unit closes any open cv group
        line = _next_line(beat)
        if line is None:
            print(f"  WARN  no vo[] line for role '{role}' (beat '{beat}') — skipping {u.get('grapheme','')}")
            continue
        {"isolated": _place_isolated, "blend": _place_blend, "word": _place_word}[role](u, line)
    _flush_cv()

    # Non-unit lines (hook, call-response) still need voice so the narration is heard — synth their
    # text as whole-line clips and place them at their start (whole-word Captions path handles them).
    unit_beats = set(beat_for_role.values())
    for line in beats["vo"]:
        if line.get("beat") in unit_beats:
            continue                                     # already voiced per-unit above
        txt = line.get("tts") or line.get("text")
        if not txt:
            continue
        mp3 = _synth_unit(voice, args.rate, txt, vdir, args.force)
        dur = gve.probe_duration(mp3)
        line["end"] = round(float(line["start"]) + dur, 3)
        placed.append((mp3, float(line["start"]), line))
        print(f"  line     {line.get('beat','?'):<14} whole-line clip {dur:.2f}s @ {line['start']}s")

    # ---------------------------------------------------------------------------
    # Re-flow line starts so real speech never overlaps (transcript-driven flow). The planned
    # schedule is generous but still an estimate; once REAL trimmed bounds exist, a line whose
    # real end runs past the NEXT line's start would bleed under it. Walk the vo[] in order and
    # push each overlapping line's start forward by the overflow — shifting its units/words, its
    # `placed` clips (tracked by line ref), and the beats[] schedule with it. Runs BEFORE the
    # voice track is assembled so `placed` carries the corrected global starts.
    # ---------------------------------------------------------------------------
    GAP = 0.5  # minimum silence between one line's real speech end and the next line's start

    def _line_real_end(line):
        us = line.get("units") or []
        if us:
            return float(us[-1]["end"])
        return float(line.get("end", line.get("start", 0.0)))

    ordered_lines = sorted(beats["vo"], key=lambda l: float(l.get("start", 0.0)))
    prev_end = None
    for line in ordered_lines:
        ls = float(line.get("start", 0.0))
        if prev_end is not None and ls < prev_end + GAP:
            delta = (prev_end + GAP) - ls
            # shift this line + its units/words forward by delta
            line["start"] = round(ls + delta, 3)
            line["end"] = round(float(line.get("end", ls)) + delta, 3)
            for u in (line.get("units") or []):
                u["start"] = round(float(u["start"]) + delta, 3)
                u["end"] = round(float(u["end"]) + delta, 3)
            for w in (line.get("words") or []):
                w["start"] = round(float(w["start"]) + delta, 3)
                w["end"] = round(float(w["end"]) + delta, 3)
            # shift this line's placed clips by delta (tracked by line identity)
            placed[:] = [(p, round(gs + delta, 3) if ln is line else gs, ln) for (p, gs, ln) in placed]
        prev_end = _line_real_end(line)

    # Sync the beats[] visual schedule to the (possibly shifted) vo[] line starts. Each beat's
    # start_s = its vo line's start; end_s = the next beat's start (the last beat's end_s is
    # re-derived below from the duration).
    beat_for_line = {id(l): l.get("beat") for l in beats["vo"]}
    # A beat name may REPEAT (e.g. several blend lines). A plain {name: line} dict keeps only the
    # LAST repeat, collapsing every repeated beats[] entry onto the same line (zero-width windows —
    # the read-3-kamatz-aba bug). Both beats[] and vo[] are built in canonical order with repeats in
    # encounter order, so map them POSITIONALLY: the i-th occurrence of a name in beats[] pairs with
    # the i-th vo[] line of that name.
    from collections import deque
    lines_by_beat = {}
    for l in beats["vo"]:
        lines_by_beat.setdefault(l.get("beat"), deque()).append(l)
    # Pre-compute each beats[] entry's paired vo line (consuming the per-name queue in order),
    # then set start_s from it and end_s from the NEXT entry's paired line (or its real end).
    sched = beats.get("beats", [])
    paired = []
    for b in sched:
        q = lines_by_beat.get(b.get("name"))
        paired.append(q.popleft() if q else None)
    for i, b in enumerate(sched):
        ln = paired[i]
        if ln is not None:
            b["start_s"] = round(float(ln["start"]), 3)
            # end_s: the next beat's start, or (for now) the line's real end — the duration
            # re-derivation below sets the final beat's end_s to the total.
            nxt = paired[i + 1] if i + 1 < len(sched) else None
            if nxt is not None:
                b["end_s"] = round(float(nxt["start"]), 3)
            else:
                b["end_s"] = round(_line_real_end(ln), 3)

    # Assemble ONE timed voice track: delay each clip to its global start, mix, pad, loudnorm.
    if placed:
        # total = the REAL last speech end + tail (NOT the stale planned format.durationSec —
        # the re-flow above may have pushed speech past it). Each clip's real end is its placed
        # global start + its probe duration.
        real_ends = []
        for (p, s, _ln) in placed:
            try:
                real_ends.append(s + gve.probe_duration(p))
            except Exception:
                real_ends.append(s + 2.5)
        total = (max(real_ends) if real_ends else 0.0) + 2.5
        inputs, parts = [], []
        for j, (path, start, _ln) in enumerate(placed):
            # Always mix from the .mp3. The "<mp3>.wav" sibling is a MONO 44.1k intermediate
            # written by the RMS onset detector (_trim_window) purely for analysis — feeding it
            # into the amix alongside the stereo mp3s deadlocks ffmpeg's channel-layout
            # auto-negotiation (mix spins forever, near-zero CPU). The mp3s mix in <1s.
            src = path
            inputs += ["-i", src]
            ms = int(round(start * 1000))
            parts.append(f"[{j}:a]adelay={ms}|{ms}[a{j}]")
        chain = "".join(f"[a{j}]" for j in range(len(parts)))
        fc = ";".join(parts) + f";{chain}amix=inputs={len(parts)}:normalize=0,apad," \
             f"atrim=0:{total},{voice_cleanup.CLEANUP_FRONT}[out]"
        voice_wav = os.path.join(vdir, "voice.wav")
        gve.run([FFMPEG, "-y", "-v", "error", *inputs, "-filter_complex", fc,
                 "-map", "[out]", "-ar", "44100", "-ac", "2", voice_wav])
        print(f"voice track -> {os.path.relpath(voice_wav, ROOT)}  ({len(placed)} clips, {total:.1f}s)")

    # Re-derive the registered duration from the REAL last speech end (no dead tail, no cut).
    # The transcript-driven flow's only existing-tool change (design §2.6): the planned
    # duration is an estimate; after voice gen the true last-speech-end is known, so
    # format.durationSec = last_speech_end + 2.5s and the final beat's end_s stretches to
    # match — clears the voice, kills the frozen tail, keeps registration in sync.
    _TAIL = 2.5
    speech_ends = []
    for line in beats["vo"]:
        us = line.get("units") or []
        if us:
            speech_ends.append(float(us[-1]["end"]))
        elif line.get("end") is not None:
            speech_ends.append(float(line["end"]))
    if speech_ends:
        last = max(speech_ends)
        total = last + _TAIL
        fmt = beats.setdefault("format", {})
        fmt["durationSec"] = round(total, 3)
        # stretch the final beat's end_s so the visual schedule covers the new tail
        if beats.get("beats"):
            b = beats["beats"][-1]
            b["end_s"] = round(total, 3)
        print(f"duration re-derived -> {total:.3f}s (last speech {last:.3f}s + {_TAIL}s tail)")

    # write actual timings back into beats.json (the captions/tiles retime from it)
    beats["voiceStatus"] = f"edge-tts:{voice}"
    json.dump(beats, open(beats_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"unit timings written back -> {os.path.relpath(beats_path, ROOT)}")

    # Rewrite the generated wrapper's durationInSeconds literal so registration matches the
    # re-derived duration (gen-registry parses the literal by regex — it can't follow the
    # beats.json import). The wrapper is at remotion/src/shots/<read-N>/<Composition>.tsx.
    _rewrite_wrapper_duration(beats)

    if args.emit_ts:
        emit_ts(beats["vo"], os.path.abspath(args.emit_ts))

    if args.mux:
        voice_wav = os.path.join(vdir, "voice.wav")
        out = os.path.splitext(args.mux)[0] + "-voiced.mp4"
        gve.run([FFMPEG, "-y", "-v", "error", "-i", args.mux, "-i", voice_wav,
                 "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                 "-b:a", "192k", "-ar", "48000", "-ac", "2", out])
        print(f"voiced preview -> {os.path.relpath(out, ROOT)}")


def _rewrite_wrapper_duration(beats):
    """Rewrite the generated wrapper's durationInSeconds literal to the re-derived duration.

    gen-registry (scripts/gen-registry.mjs) parses compositionConfig.durationInSeconds by regex
    — a LITERAL only, it can't follow the beats.json import — so the wrapper must be re-stamped
    whenever voice gen re-derives the duration. Locate the wrapper at
    remotion/src/shots/<read-N>/<composition>.tsx (group derived from the project id) and swap
    the duration literal in place. No-op (with a note) if the wrapper isn't found.
    """
    import re as _re
    comp = beats.get("composition")
    proj_id = beats.get("id", "")
    # Match make_learn.write_wrapper's shots-group naming for every learn mode
    # (read/learn/letter/number/wordclass) so the wrapper re-stamp lands on the right dir.
    m = _re.match(r"^(read-\d+|learn-\d+|letter-\d+|number-\d+|wordclass-\d+)(?:-.*)?$", proj_id)
    group = m.group(1) if m else proj_id
    if not comp:
        return
    wrapper = os.path.join(ROOT, "remotion", "src", "shots", group, f"{comp}.tsx")
    if not os.path.exists(wrapper):
        print(f"  note  wrapper not found (skipping duration rewrite): {os.path.relpath(wrapper, ROOT)}")
        return
    dur = beats["format"]["durationSec"]
    with open(wrapper, encoding="utf-8") as f:
        src = f.read()
    new = _re.sub(r"durationInSeconds:\s*[0-9.]+", f"durationInSeconds: {dur}", src, count=1)
    if new != src:
        with open(wrapper, "w", encoding="utf-8") as f:
            f.write(new)
        print(f"wrapper duration re-stamped -> {os.path.relpath(wrapper, ROOT)}  ({dur}s)")


def emit_ts(vo, path):
    """Write the generated VO (with exact per-word AND per-unit times) as a TS module."""
    lines = ["// AUTO-GENERATED by tools/gen_voice_reading.py — do not edit.",
             "// Word/unit times are REAL trimmed edge-tts clip bounds; sub-word highlight syncs exactly.",
             "import type { VoLine } from '../../lib/shorts';", "",
             "export const VO: VoLine[] = ["]
    for line in vo:
        esc = line["text"].replace("\\", "\\\\").replace("'", "\\'")
        ws = ", ".join(
            "{ w: '%s', start: %s, end: %s }" % (w["w"].replace("\\", "\\\\").replace("'", "\\'"), w["start"], w["end"])
            for w in line.get("words", []))
        us = ", ".join(
            "{ g: '%s', start: %s, end: %s }" % (u["g"].replace("\\", "\\\\").replace("'", "\\'"), u["start"], u["end"])
            for u in line.get("units", []))
        unit_field = f", units: [{us}]" if us else ""
        lines.append(f"  {{ text: '{esc}', start: {line['start']}, end: {line['end']}, words: [{ws}]{unit_field} }},")
    lines += ["];", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"VO TS module -> {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
