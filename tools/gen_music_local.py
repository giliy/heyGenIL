#!/usr/bin/env python3
"""
gen_music_local.py — deterministic $0 ambient music beds, synthesized locally, pure stdlib.

WHY THIS EXISTS (and why it is not gen_music.py):
  gen_music.py grows the music library by PROMPTING a paid generative API (ElevenLabs Music,
  or ACE-Step on fal). Every new bed bills money and can never be regenerated identically.
  This tool is the offline twin of tools/gen_chords.py: additive synthesis, equal temperament
  (A4 = 440 Hz), no samples, no RNG, no API — deterministic on every run, marginal cost $0.
  The point: every video gets a produced music bed WITHOUT a per-video paid dependency.

SOUND (brand.md §10 — calm/premium, felt-not-heard):
  layered pads (soft-attack sine/triangle stacks with a slow drift and a gentle detune beat),
  a slow cyclic four-chord progression, a sub root, a faint "air" shimmer, and — in the
  focused/upbeat beds — a quiet Rhodes-ish pulse on an exact tempo grid. No drums, no melody,
  nothing that grabs attention. Beds are loudness-normalized to the library's -20 LUFS /
  -1.5 dBFS convention (static gain, NOT dynamic loudnorm — see below) so mix_music.py's
  --bed-gain stays perceptually meaningful across paid and local beds alike.

SEAMLESS LOOPS:
  every partial is quantized to an INTEGER number of cycles over the loop (frequency error
  < 0.02 cents at 40-48 s — inaudible), the progression is cyclic (the last bar's crossfade
  tail wraps into the first bar's attack), drift/tremolo LFOs run an integer number of
  cycles, and pulses sit on a grid that divides the loop exactly. The result is sample-exact
  periodic, so mix_music.py's -stream_loop repeats it with no click, no gap, no chord jump.
  Beds are shipped as WAV (not mp3) precisely so no encoder padding can break that seam.
  Normalization uses measured static gain (ebur128 -> volume), never dynamic loudnorm —
  a time-varying gain would destroy the periodicity.

Output: media/library/music/clips/<id>.wav, registered in media/library/music/catalog.json,
so tools/mix_music.py consumes them exactly like the paid beds (--bed local-calm-pad / --all).
Local beds live OUTSIDE palette.json on purpose: gen_music.py only bills ids in palette.json,
so a later paid run never touches (or clobbers) these entries.

Usage:
  python tools/gen_music_local.py                 # synthesize any missing local beds
  python tools/gen_music_local.py --force         # re-synthesize all local beds
  python tools/gen_music_local.py --only local-calm-pad[,local-focus-pulse]
  python tools/gen_music_local.py --dry-run

Needs the full ffmpeg/ffprobe build (tools/ffw.py resolves it, fails fast on the minimal one).
No third-party Python deps (stdlib wave/math/array only). No API keys, no network.
"""
import argparse
import array
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)
MUSIC_DIR = os.path.join(ROOT, "media", "library", "music")
CLIPS_DIR = os.path.join(MUSIC_DIR, "clips")
CATALOG = os.path.join(MUSIC_DIR, "catalog.json")

SR = 44100
TARGET_LUFS = -20.0  # matches the rest of the music library, so mix --bed-gain stays meaningful
PEAK_CEIL = -1.5

SOURCE = "local:gen_music_local.py"
MODEL = "stdlib-additive (sine/triangle stacks, equal temperament A4=440)"
LICENSE = ("Original deterministic synthesis by tools/gen_music_local.py — no samples, no API, "
           "no third-party material; distributed with this repo")

# Equal temperament, A4 = 440 Hz. MIDI 69 = A4.
def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


NOTE_BASE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi(name: str, octave: int) -> int:
    """'C',4 -> 60."""
    return 12 * (octave + 1) + NOTE_BASE[name]


# ---------------------------------------------------------------------------
# The beds. Four brand moods, each a cyclic 4-chord progression:
#   root  — the low anchor (fundamental + a soft octave partial, no detune)
#   pad   — 4 close-voiced notes; fundamental as a detune pair + triangle-ish upper partials
#   air   — one high shimmer note with a slow tremolo (the "airy" of brand.md)
#   arp   — chord tones the pulse grid picks from (beds with a pulse only)
# partials: (harmonic ratio, amplitude) — odd-heavy stacks read as soft triangle, even 2nd
# adds warmth. amp fields are RELATIVE (every bed is peak-then-loudness normalized after).
# ---------------------------------------------------------------------------
BEDS = [
    {
        "id": "local-calm-pad",
        "category": "ambient",
        "tags": ["ambient", "pad", "calm", "minimal", "no-drums", "premium", "bed", "local", "loop"],
        "desc": ("Local synth bed: Cmaj9 - Fmaj9 - Am11 - Gadd9 pads, 10s bars, no pulse. "
                 "The free analogue of 'ambient-pad' — quiet keynote air under a voice."),
        "bar_s": 10.0, "xf": 3.0, "detune": 0.0010, "drift": 0.18, "drift_cycles": 3,
        "partials": [(1, 1.00), (3, 0.11), (5, 0.04)],
        "pad_amp": 0.90, "root_amp": 0.55, "air_amp": 0.050, "air_cycles": 2,
        "pulse": None,
        "chords": [
            {"root": ("C", 2), "pad": [("C", 3), ("G", 3), ("D", 4), ("E", 4)], "air": ("E", 5)},
            {"root": ("F", 2), "pad": [("F", 3), ("C", 4), ("E", 4), ("G", 4)], "air": ("C", 5)},
            {"root": ("A", 2), "pad": [("A", 3), ("C", 4), ("E", 4), ("G", 4)], "air": ("D", 5)},
            {"root": ("G", 2), "pad": [("G", 3), ("B", 3), ("D", 4), ("A", 4)], "air": ("B", 4)},
        ],
    },
    {
        "id": "local-warm-lofi",
        "category": "lofi",
        "tags": ["lofi", "warm", "cozy", "friendly", "downtempo", "bed", "local", "loop"],
        "desc": ("Local synth bed: Am9 - Fmaj9 - Cmaj9 - G6 warm pads, 12s bars, sparse soft "
                 "root-pluck every 3s. The free analogue of 'lofi-warm'."),
        "bar_s": 12.0, "xf": 3.5, "detune": 0.0016, "drift": 0.22, "drift_cycles": 4,
        "partials": [(1, 1.00), (2, 0.10), (3, 0.04)],
        "pad_amp": 0.90, "root_amp": 0.55, "air_amp": 0.045, "air_cycles": 2,
        "pulse": {"sps": 3 * SR, "pattern": [0], "vel": [1.0, 0.50, 0.65, 0.50],
                  "amp": 0.10, "decay": 6.5},
        "chords": [
            {"root": ("A", 2), "pad": [("A", 3), ("C", 4), ("E", 4), ("G", 4)], "air": ("B", 4),
             "arp": [("A", 3)]},
            {"root": ("F", 2), "pad": [("F", 3), ("A", 3), ("C", 4), ("G", 4)], "air": ("E", 5),
             "arp": [("F", 3)]},
            {"root": ("C", 3), "pad": [("G", 3), ("B", 3), ("D", 4), ("E", 4)], "air": ("D", 5),
             "arp": [("C", 4)]},
            {"root": ("G", 2), "pad": [("G", 3), ("B", 3), ("E", 4), ("G", 4)], "air": ("D", 5),
             "arp": [("G", 3)]},
        ],
    },
    {
        "id": "local-focus-pulse",
        "category": "tech",
        "tags": ["tech", "pulse", "focus", "forward-motion", "minimal", "premium", "bed", "local", "loop"],
        "desc": ("Local synth bed: Dm9 - Bbmaj9 - Fmaj9 - Cadd9 pads, 12s bars, quiet 8th-note "
                 "arp pulse at an 80 BPM feel. The free analogue of 'tech-pulse'."),
        "bar_s": 12.0, "xf": 2.5, "detune": 0.0012, "drift": 0.16, "drift_cycles": 4,
        "partials": [(1, 1.00), (3, 0.13), (5, 0.05)],
        "pad_amp": 0.85, "root_amp": 0.55, "air_amp": 0.050, "air_cycles": 2,
        "pulse": {"sps": 33075, "pattern": [0, 1, 2, 1], "vel": [1.0, 0.45, 0.65, 0.45, 0.80, 0.45, 0.65, 0.45],
                  "amp": 0.085, "decay": 5.5},   # 33075 samples = 0.75s; 16 per 12s bar
        "chords": [
            {"root": ("D", 3), "pad": [("F", 3), ("A", 3), ("C", 4), ("E", 4)], "air": ("A", 4),
             "arp": [("D", 4), ("A", 4), ("E", 5)]},
            {"root": ("A#", 2), "pad": [("F", 3), ("A#", 3), ("D", 4), ("A", 4)], "air": ("G", 4),
             "arp": [("F", 4), ("A#", 4), ("C", 5)]},
            {"root": ("F", 3), "pad": [("C", 4), ("E", 4), ("G", 4), ("A", 4)], "air": ("E", 5),
             "arp": [("F", 4), ("A", 4), ("C", 5)]},
            {"root": ("C", 3), "pad": [("G", 3), ("D", 4), ("E", 4), ("G", 4)], "air": ("D", 5),
             "arp": [("G", 4), ("D", 5), ("E", 5)]},
        ],
    },
    {
        "id": "local-upbeat-day",
        "category": "upbeat",
        "tags": ["upbeat", "sunny", "light", "friendly", "pulse", "bed", "local", "loop"],
        "desc": ("Local synth bed: Cmaj9 - Gadd9 - Am11 - Fmaj9 brighter pads, 12s bars, gentle "
                 "arp pulse at a 90 BPM feel. Restrained but the sunniest of the local beds."),
        "bar_s": 12.0, "xf": 2.5, "detune": 0.0013, "drift": 0.16, "drift_cycles": 5,
        "partials": [(1, 1.00), (2, 0.10), (3, 0.12), (5, 0.05)],
        "pad_amp": 0.85, "root_amp": 0.55, "air_amp": 0.080, "air_cycles": 3,
        "pulse": {"sps": 29400, "pattern": [0, 1, 2, 3, 2, 1], "vel": [1.0, 0.50, 0.65, 0.80, 0.65, 0.50],
                  "amp": 0.075, "decay": 6.0},   # 29400 samples = 2/3s; 18 per 12s bar
        "chords": [
            {"root": ("C", 2), "pad": [("G", 3), ("D", 4), ("E", 4), ("B", 4)], "air": ("D", 5),
             "arp": [("G", 4), ("B", 4), ("D", 5), ("E", 5)]},
            {"root": ("G", 2), "pad": [("B", 3), ("D", 4), ("G", 4), ("A", 4)], "air": ("B", 4),
             "arp": [("G", 4), ("B", 4), ("D", 5), ("A", 4)]},
            {"root": ("A", 2), "pad": [("C", 4), ("E", 4), ("G", 4), ("B", 4)], "air": ("D", 5),
             "arp": [("A", 4), ("C", 5), ("E", 5), ("G", 4)]},
            {"root": ("F", 2), "pad": [("A", 3), ("C", 4), ("E", 4), ("G", 4)], "air": ("E", 5),
             "arp": [("F", 4), ("A", 4), ("C", 5), ("E", 5)]},
        ],
    },
]


# ---------------------------------------------------------------------------
# Synthesis. All oscillators read ONE shared sine table T of N = dur*SR samples (T[N] = T[0]
# closes the ring): a partial at k = f0*dur cycles over the loop steps its float phase by k
# per sample (mod N) with linear interpolation between table entries. Pitch error is
# |round(k) - k|/k ≤ 0.02 cents at 40-48 s — inaudible — and the waveform is EXACTLY
# periodic, which is what makes the -stream_loop seam sample-exact.
# ---------------------------------------------------------------------------

def _mix(dst, seg, g0, N):
    """Add seg (starting at global sample g0, possibly <0 or running past N) into the
    period-N buffer, wrapping at the loop boundary."""
    n = len(seg)
    i0 = g0 % N
    if i0 + n <= N:
        j = i0
        for i in range(n):
            dst[j] += seg[i]
            j += 1
    else:
        k = N - i0
        j = i0
        for i in range(k):
            dst[j] += seg[i]
            j += 1
        j = 0
        for i in range(k, n):
            dst[j] += seg[i]
            j += 1


def _pad_osc(seg, seg_n, g0, k, amp, lfo_cyc, lfo_depth, phase_turns, T, N, barN, inv_xf):
    """One pad partial into seg: linear xf-in over the first crossfade, sustain to bar end,
    linear xf-out over the trailing crossfade, slow amplitude drift on a loop-integer LFO.
    k is a float phase step in table-index units (near-integer cycles over the loop);
    linear interpolation between adjacent table entries keeps it periodic."""
    pos = (g0 * k) % N
    dpos = (g0 * lfo_cyc + phase_turns * N) % N if lfo_cyc else (phase_turns * N) % N
    invA = 1.0 / 0.009 / SR
    for i in range(seg_n):
        if i < barN:
            e = i * inv_xf if i < seg_n - barN else 1.0
        else:
            e = (seg_n - i) * inv_xf
        if i < 400:  # 9ms de-click ramp under the crossfade slope
            e *= i * invA
        j = int(pos)
        fr = pos - j
        m = 1.0 + lfo_depth * (T[int(dpos)] if lfo_cyc else 1.0)
        seg[i] += amp * e * m * (T[j] + (T[j + 1] - T[j]) * fr)
        pos += k
        if pos >= N:
            pos -= N
        if lfo_cyc:
            dpos += lfo_cyc
            if dpos >= N:
                dpos -= N


def _render_chord(buf, b, chord, spec, T, N, dur):
    """Render one bar's chord instance (pads + root + air) and mix it in at bar b."""
    barN = int(spec["bar_s"] * SR)
    xfN = int(spec["xf"] * SR)
    seg_n = barN + xfN
    inv_xf = 1.0 / xfN
    g0 = b * barN
    seg = [0.0] * seg_n
    cyc = spec["drift_cycles"]
    drift = spec["drift"]
    partials = spec["partials"]
    fund_amp = partials[0][1]

    # pads: fundamental as a detune pair (the slow beat that keeps it from reading as a
    # test tone), upper partials single — golden-ratio LFO phases so notes don't move as one
    for j, (nm, octv) in enumerate(chord["pad"]):
        f0 = midi_hz(midi(nm, octv))
        k = f0 * dur
        k_det = f0 * (1.0 + spec["detune"]) * dur
        ph = ((j + 1) * 0.61803398875) % 1.0
        a = 0.5 * spec["pad_amp"] * fund_amp
        _pad_osc(seg, seg_n, g0, k, a, cyc, drift, ph, T, N, barN, inv_xf)
        _pad_osc(seg, seg_n, g0, k_det, a, cyc, drift, (ph + 0.37) % 1.0, T, N, barN, inv_xf)
        for ratio, pamp in partials[1:]:
            _pad_osc(seg, seg_n, g0, f0 * ratio * dur, spec["pad_amp"] * pamp,
                     0, drift * 0.5, (ph * ratio) % 1.0, T, N, barN, inv_xf)

    # root: fundamental + soft octave, no detune (the anchor stays still)
    f0 = midi_hz(midi(*chord["root"]))
    k = f0 * dur
    _pad_osc(seg, seg_n, g0, k, spec["root_amp"], cyc, drift * 0.5, 0.13, T, N, barN, inv_xf)
    _pad_osc(seg, seg_n, g0, 2 * k, spec["root_amp"] * 0.3, cyc, drift * 0.5, 0.41, T, N, barN, inv_xf)

    # air: one high shimmer note, tremolo on its own slow loop-integer cycle
    f0 = midi_hz(midi(*chord["air"]))
    _pad_osc(seg, seg_n, g0, f0 * dur, spec["air_amp"],
             spec["air_cycles"], 0.35, 0.77, T, N, barN, inv_xf)

    _mix(buf, seg, g0, N)


def _pluck(buf, g0, k, amp, decay, T, N):
    """One Rhodes-ish pulse note: 8ms attack, exponential decay, fundamental + octave.
    k is a float phase step (see _pad_osc); octave partial runs at 2k."""
    n = int(2.4 * SR)
    seg = [0.0] * n
    r = math.exp(-decay / SR)
    atkN = int(0.008 * SR)
    invA = 1.0 / atkN
    pos = (g0 * k) % N
    pos2 = (g0 * 2 * k) % N
    env = 1.0
    for i in range(n):
        e = env
        if i < atkN:
            e *= i * invA
        j = int(pos)
        fr = pos - j
        j2 = int(pos2)
        fr2 = pos2 - j2
        seg[i] = amp * e * ((T[j] + (T[j + 1] - T[j]) * fr)
                            + 0.25 * (T[j2] + (T[j2 + 1] - T[j2]) * fr2))
        env *= r
        pos += k
        if pos >= N:
            pos -= N
        pos2 += 2 * k
        if pos2 >= N:
            pos2 -= N
    _mix(buf, seg, g0, N)


def synth_bed(spec):
    """Full bed -> (mono float samples peaked at 0.5, duration_s). Sample-exact periodic."""
    dur = spec["bar_s"] * len(spec["chords"])
    N = int(round(SR * dur))
    barN = int(spec["bar_s"] * SR)
    pulse = spec.get("pulse")
    if pulse:
        assert barN % pulse["sps"] == 0, f"{spec['id']}: pulse grid must divide the bar"

    T = [math.sin(2.0 * math.pi * i / N) for i in range(N)]
    T.append(T[0])  # T[N] closes the loop: linear interp (s[j], s[j+1]) stays periodic
    buf = [0.0] * N

    for b, chord in enumerate(spec["chords"]):
        _render_chord(buf, b, chord, spec, T, N, dur)

    if pulse:
        pat, vel = pulse["pattern"], pulse["vel"]
        per_bar = barN // pulse["sps"]
        for b, chord in enumerate(spec["chords"]):
            arp = chord["arp"]
            for s in range(per_bar):
                tone = arp[pat[s % len(pat)]]
                k = midi_hz(midi(*tone)) * dur
                _pluck(buf, b * barN + s * pulse["sps"], k,
                       pulse["amp"] * vel[s % len(vel)], pulse["decay"], T, N)

    peak = max(abs(v) for v in buf) or 1.0
    return [v / peak * 0.5 for v in buf], dur


# ---------------------------------------------------------------------------
# IO / normalization / catalog — mirrors gen_chords.py + gen_music.py conventions.
# ---------------------------------------------------------------------------

def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        pcm = array.array("h", (int(max(-1.0, min(1.0, v)) * 32767) for v in samples))
        w.writeframes(pcm.tobytes())


def run_capture(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout


def measure_peak_db(path):
    out = run_capture([ffw.path(), "-hide_banner", "-i", path, "-af", "volumedetect",
                       "-f", "null", os.devnull])
    m = re.search(r"max_volume:\s*(-?[\d.]+) dB", out)
    return float(m.group(1)) if m else None


def measure_lufs(path):
    out = run_capture([ffw.path(), "-hide_banner", "-i", path, "-af", "ebur128", "-f", "null", os.devnull])
    ms = re.findall(r"I:\s*(-?[\d.]+)\s*LUFS", out)
    return float(ms[-1]) if ms else None


def probe_duration(path):
    out = run_capture([ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
                       "-of", "default=nw=1:nk=1", path]).strip()
    return round(float(out), 3)


def normalize_bed(wav_in, wav_out):
    """STATIC gain to the library level (gen_music.py's approach): a time-varying loudnorm
    would break the loop's sample-exact periodicity. Clamped so peaks stay under the ceiling."""
    lufs = measure_lufs(wav_in)
    peak = measure_peak_db(wav_in)
    gain = TARGET_LUFS - lufs
    if peak + gain > PEAK_CEIL:
        gain = PEAK_CEIL - peak
    subprocess.run(
        [ffw.path(), "-y", "-hide_banner", "-loglevel", "error", "-i", wav_in,
         "-af", f"volume={gain:.2f}dB", "-ar", "44100", "-ac", "1",
         "-c:a", "pcm_s16le", wav_out],
        check=True,
    )
    return gain


def seam_rms(path):
    """Loop-join health: RMS around the join (last 200 + first 200 samples) vs the same-size
    window mid-loop. A seamless periodic bed reads ~1x; a discontinuity reads well above."""
    with wave.open(path, "rb") as w:
        n = w.getnframes()
        data = w.readframes(n)
    a = array.array("h")
    a.frombytes(data)
    win = a[n - 200:] + a[:200]
    rms_j = math.sqrt(sum(v * v for v in win) / len(win))
    mid = a[100000:100400]
    rms_b = math.sqrt(sum(v * v for v in mid) / len(mid))
    return rms_j, rms_b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-synthesize beds that already exist")
    ap.add_argument("--only", help="just these bed ids (comma-separated)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    ffw.require_full()
    os.makedirs(CLIPS_DIR, exist_ok=True)
    catalog = json.load(open(CATALOG, encoding="utf-8"))
    by_id = {c["id"]: c for c in catalog["clips"]}

    only = set(args.only.split(",")) if args.only else None
    todo = [b for b in BEDS if not only or b["id"] in only]
    if not todo:
        sys.exit(f"no local bed matches --only {args.only} (known: "
                 + ", ".join(b["id"] for b in BEDS) + ")")

    made = 0
    for spec in todo:
        bid = spec["id"]
        wav_path = os.path.join(CLIPS_DIR, f"{bid}.wav")
        rel = os.path.relpath(wav_path, MUSIC_DIR).replace("\\", "/")
        dur = spec["bar_s"] * len(spec["chords"])

        if os.path.exists(wav_path) and not args.force:
            print(f"  = {bid:18} exists, skipping")
            if bid not in by_id:  # file survived but catalog entry didn't — re-register
                by_id[bid] = catalog_entry(spec, rel, wav_path, {})
                catalog["clips"].append(by_id[bid])
                made += 1
            continue
        if args.dry_run:
            tones = " / ".join(" ".join(n + str(o) for n, o in c["pad"]) for c in spec["chords"])
            print(f"  + {bid:18} WOULD synth {dur:.0f}s seamless loop  [{tones}]"
                  + (f"  pulse every {pulse_desc(spec)}" if spec.get("pulse") else "  no pulse"))
            continue

        print(f"  + {bid:18} {dur:.0f}s loop, {len(spec['chords'])} chords"
              f" (xf {spec['xf']}s, detune {spec['detune'] * 100:.2f}%) ...")
        samples, _ = synth_bed(spec)
        with tempfile.TemporaryDirectory() as td:
            raw = os.path.join(td, "raw.wav")
            write_wav(raw, samples)
            gain = normalize_bed(raw, wav_path)

        lufs, peak = measure_lufs(wav_path), measure_peak_db(wav_path)
        rms_j, rms_b = seam_rms(wav_path)
        print(f"    gain {gain:+.2f}dB -> lufs {lufs}  peak {peak}dBFS  "
              f"seam rms {rms_j:.0f} vs body {rms_b:.0f} ({rms_j / max(rms_b, 1):.2f}x)")

        entry = catalog_entry(spec, rel, wav_path, by_id.get(bid, {}))
        by_id[bid] = entry
        if bid in {c["id"] for c in catalog["clips"]}:
            catalog["clips"] = [entry if c["id"] == bid else c for c in catalog["clips"]]
        else:
            catalog["clips"].append(entry)
        made += 1

    if not args.dry_run and made:
        json.dump(catalog, open(CATALOG, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(f"\ncatalog updated -> {CATALOG}  ({made} local bed(s))")
        print("mix one under a video:  python tools/mix_music.py --bed "
              + todo[0]["id"] + " --base <video.mp4>")


def pulse_desc(spec):
    p = spec["pulse"]
    return f"{p['sps'] / SR:.3g}s ({p['decay']} decay)"


def catalog_entry(spec, rel, wav_path, old):
    return {
        "id": spec["id"],
        "file": rel,
        "category": spec["category"],
        "tags": spec["tags"],
        "duration_s": probe_duration(wav_path),
        "requested_ms": int(round(spec["bar_s"] * len(spec["chords"]) * 1000)),
        "peak_dbfs": measure_peak_db(wav_path),
        "loudness_lufs": measure_lufs(wav_path),
        "source": SOURCE,
        "model": MODEL,
        "force_instrumental": True,
        "license": LICENSE,
        "loop": True,  # sample-exact periodic; mix_music.py -stream_loop repeats seamlessly
        "prompt": spec["desc"],
        "used_in": old.get("used_in", []),
    }


if __name__ == "__main__":
    main()
