#!/usr/bin/env python3
"""
gen_cue.py — synthesize the BRAND SONIC CUE: a rising two-note resolve stamped at every
short's payoff moment. The catalog's consistent audio signature, like the checkmark Lottie
is its visual one.

WHY A SEPARATE TOOL (not gen_chords.py): gen_chords makes STACKED one-shot chords for the
music-theory series (a chord IS the subject there). The brand cue is MELODIC — two notes
played in sequence (low -> high), not simultaneously — and it is a recurring signature, not
a content chord. Same deterministic additive synth, different note timing.

THE CUE: A3 (220 Hz) lands, then resolves UP to C#5 (~554 Hz) — a warm major-third leap
that reads as "arrived / success / signed." Rhodes-like colour (matches gen_chords' tone,
brand.md §10 calm/premium), soft attack, gentle decay, ~1.4s total so it tucks under a
payoff beat without overstaying. Byte-identical on every run (pure math, no randomness).

Output: media/library/sfx/clips/brand-cue-rise.mp3, registered in the sfx catalog so
tools/mix_sfx.py can stamp it at any short's payoff frame. Loudness-normalized to the
library level (-20 LUFS) so gain_db stays meaningful across the catalog.

Usage:
  python tools/gen_cue.py            # synthesize brand-cue-rise if missing
  python tools/gen_cue.py --force    # re-synthesize
  python tools/gen_cue.py --dry-run

No third-party deps (stdlib wave/math/array). ffmpeg/ffprobe via tools/ffw.
"""
import argparse
import array
import json
import math
import os
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.dirname(HERE)
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)
SFX_DIR = os.path.join(CORE, "media", "library", "sfx")
CLIPS_DIR = os.path.join(SFX_DIR, "clips")
CATALOG = os.path.join(SFX_DIR, "catalog.json")

SR = 44100
TARGET_LUFS = -20.0  # matches the rest of the SFX library
PEAK_CEIL = -1.5

# Equal temperament, A4 = 440 Hz. MIDI 69 = A4.
def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


NOTE_BASE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi(name: str, octave: int) -> int:
    return 12 * (octave + 1) + NOTE_BASE[name]


# The rising resolve: (note, octave, onset_seconds, note_decay). A3 lands, rings ~0.5s,
# then C#5 arrives on top and carries the tail. The overlap (low still decaying when the
# high note enters) is what makes it read as a *resolution*, not two separate pings.
CUE_NOTES = [
    ("A", 3, 0.00, 2.2),   # 220.0 Hz — the low anchor
    ("C#", 5, 0.42, 3.4),  # 554.4 Hz — the resolve, brighter and longer-ringing
]
CUE_DUR = 1.5  # seconds total


def synth_cue(notes=CUE_NOTES, dur=CUE_DUR):
    """Additive synth, sequential notes. Returns float samples in [-1, 1]."""
    n = int(SR * dur)
    buf = [0.0] * n

    # Rhodes-ish partials: fundamental strongest, upper partials fall away fast.
    HARMONICS = [(1, 1.00), (2, 0.32), (3, 0.14), (4, 0.07), (6, 0.03)]

    for i, (name, octv, onset, note_decay) in enumerate(notes):
        f0 = midi_hz(midi(name, octv))
        start = int(SR * onset)
        # the resolve note sits slightly hotter so it reads as the "arrival"
        note_amp = 0.85 if i == 0 else 1.0
        detune = 1.0 + (0.0004 * (i - 0.5))  # hair of detune so it isn't a test tone

        for h, hamp in HARMONICS:
            f = f0 * h * detune
            if f > SR / 2.2:  # stay well below Nyquist
                continue
            w = 2.0 * math.pi * f / SR
            # higher partials decay faster (struck, not bowed); note_decay sets the body
            decay = note_decay + 0.7 * h
            a = note_amp * hamp
            for s in range(start, n):
                t = (s - start) / SR
                env = math.exp(-decay * t)
                if env < 1e-4:
                    break
                atk = min(1.0, t / 0.010)  # 10ms attack — no click at the transient
                buf[s] += a * atk * env * math.sin(w * (s - start))

    peak = max(abs(v) for v in buf) or 1.0
    return [v / peak * 0.89 for v in buf]


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        pcm = array.array("h", (int(max(-1.0, min(1.0, v)) * 32767) for v in samples))
        w.writeframes(pcm.tobytes())


def normalize_to_mp3(wav_path, mp3_path):
    subprocess.run(
        [ffw.path(), "-y", "-hide_banner", "-loglevel", "error", "-i", wav_path,
         "-af", f"loudnorm=I={TARGET_LUFS}:TP={PEAK_CEIL}:LRA=11",
         "-ar", "44100", "-ac", "1", "-b:a", "192k", mp3_path],
        check=True,
    )


def probe(path, entries):
    out = subprocess.run(
        [ffw.ffprobe_path(), "-v", "error", "-show_entries", f"format={entries}", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cid = "brand-cue-rise"
    mp3 = os.path.join(CLIPS_DIR, f"{cid}.mp3")
    rel = os.path.relpath(mp3, SFX_DIR).replace("\\", "/")

    if os.path.exists(mp3) and not args.force:
        print(f"  = {cid} exists, skipping (use --force)")
        return
    if args.dry_run:
        print(f"  + {cid} WOULD synth: " + " -> ".join(f"{n}{o}({midi_hz(midi(n,o)):.1f}Hz)@{on}s" for n, o, on, _d in CUE_NOTES))
        return

    os.makedirs(CLIPS_DIR, exist_ok=True)
    print(f"  + {cid} " + " -> ".join(f"{n}{o}({midi_hz(midi(n,o)):.1f}Hz)@{on}s" for n, o, on, _d in CUE_NOTES))
    samples = synth_cue()
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "cue.wav")
        write_wav(wav, samples)
        normalize_to_mp3(wav, mp3)

    catalog = json.load(open(CATALOG, encoding="utf-8"))
    by_id = {c["id"]: c for c in catalog["clips"]}
    entry = by_id.get(cid, {"id": cid})
    entry.update({
        "id": cid,
        "file": rel,
        "category": "brand",
        "tags": ["brand", "cue", "signature", "resolve", "success", "payoff", "sonic-logo", "calm"],
        "desc": "brand sonic cue — rising two-note resolve (A3->C#5) stamped at payoff moments",
        "function": "signature",  # non-diegetic brand mark, not a content sound
        "source": "gen_cue.py (deterministic additive synth, equal temperament A4=440)",
        "duration_s": round(float(probe(mp3, "duration")), 3),
    })
    entry.setdefault("used_in", [])
    if cid not in by_id:
        catalog["clips"].append(entry)
    json.dump(catalog, open(CATALOG, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"catalog updated -> {CATALOG}")


if __name__ == "__main__":
    main()
