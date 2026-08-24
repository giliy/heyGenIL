#!/usr/bin/env python3
"""
gen_sfx_local.py — synthesize the small set of UI/shorts SFX deterministically, for free.

WHY THIS EXISTS (and why it is not gen_sfx.py / gen_chords.py):
  gen_sfx.py prompts the paid ElevenLabs Sound Effects API. gen_chords.py synthesizes only
  exact-pitch chords (a music-theory necessity). But the everyday cues the videos actually
  use — whoosh, pop, chime, riser, impact, tick — are generic shapes, not recordings. They
  don't need a generative model: a whoosh is filtered noise sweeping through the spectrum, a
  pop is a short envelope burst, a chime is a sine + harmonic decay. All of it is doable with
  the stdlib (math/array/wave), byte-identical on every run, at $0.

  This removes a per-video PAID dependency: the mix can be fully local. Targets the same
  names/categories the library already uses (whoosh-soft, pop-reveal, chime-reward,
  riser-soft, impact-soft, ui-click, clock-tick) so mix_sfx.py and /suggest-sfx pick them up
  with zero paid calls. The ElevenLabs-generated versions of these IDs stay in the catalog;
  the synthesized ones are registered as ALTERNATIVES (distinct ids, same categories/tags)
  so a plan can point at either — and the paid path is never required for the basics.

  Like gen_chords.py these are loudness-normalized to the library's ~-20 LUFS with a -1.5 dBFS
  ceiling, so per-cue gain_db in a plan stays perceptually meaningful.

Output: mp3 clips in media/library/sfx/clips/, registered in media/library/sfx/catalog.json.
REUSABLE across the whole short/ad/vox library — the exact set of "UI + motion" cues every
video reaches for.

Usage:
  python tools/gen_sfx_local.py                 # generate any missing clips
  python tools/gen_sfx_local.py --force         # re-synthesize all
  python tools/gen_sfx_local.py --only whoosh-local
  python tools/gen_sfx_local.py --dry-run

Needs ffmpeg/ffprobe on PATH. No third-party Python deps (stdlib wave/math/array only).
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
TARGET_LUFS = -20.0  # matches the rest of the SFX library, so gain_db stays meaningful
PEAK_CEIL = -1.5

# A4 = 440 Hz for the pitched cues (chime), same tuning as gen_chords.py.
def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


# ---------------------------------------------------------------------------
# DSP primitives (all stdlib, deterministic)
# ---------------------------------------------------------------------------

class RNG:
    """Deterministic PRNG (xorshift32) so every run is byte-identical."""
    def __init__(self, seed: int = 0xC0FFEE):
        self.s = seed & 0xFFFFFFFF

    def next(self) -> int:
        self.s ^= (self.s << 13) & 0xFFFFFFFF
        self.s ^= self.s >> 17
        self.s ^= (self.s << 5) & 0xFFFFFFFF
        return self.s & 0xFFFFFFFF

    def unit(self) -> float:  # uniform in [0,1)
        return self.next() / 4294967296.0

    def gauss(self) -> float:  # approx standard normal via Box-Muller
        u1 = max(self.unit(), 1e-12)
        u2 = self.unit()
        return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def white_noise(n: int, rng: RNG) -> list:
    return [rng.gauss() for _ in range(n)]


def one_pole_highpass(x: list, fc: float) -> list:
    """Simple first-order highpass to keep noise cues from sounding muddy/rumble-y."""
    alpha = math.exp(-2.0 * math.pi * fc / SR)
    y = [0.0] * len(x)
    prev = 0.0
    for i, v in enumerate(x):
        y[i] = alpha * (y[i - 1] if i else 0.0) + alpha * (v - prev)
        prev = v
    return y


def sweep_filter(x: list, f_lo: float, f_hi: float, up: bool = True, t0: float = 0.0) -> list:
    """Cheap resonant-ish sweep: modulate the mix of an in-place highpass cutoff so the
    noise band glides from f_lo up to f_hi (whoosh/riser) or the reverse (swoosh).
    Implemented as a moving-average difference band that widens over time — a passable
    'air whoosh' with only stdlib."""
    n = len(x)
    y = [0.0] * n
    # running mean for a smoothing 'tone' term so it reads as air, not static
    run = 0.0
    for i in range(n):
        t = (i / SR) - t0
        if t < 0:
            t = 0.0
        prog = min(1.0, t / (n / SR))
        if not up:
            prog = 1.0 - prog
        f = f_lo + (f_hi - f_lo) * prog
        # window length ~ 1/f; clamp to sane bounds
        half = int(max(1, SR / (4.0 * max(f, 40.0))))
        run += x[i]
        if i >= 2 * half:
            run -= x[i - 2 * half]
        # difference over the window ≈ band energy near f
        y[i] = x[i] - (run / (2 * half)) if (2 * half) else 0.0
    return y


def attack_release(n: int, atk: float, rel: float, hold: float = 0.0) -> list:
    """Piecewise-linear gain envelope: attack ramp, hold, exponential-ish release."""
    a = int(SR * atk)
    h = int(SR * hold)
    env = [0.0] * n
    for i in range(n):
        if i < a:
            env[i] = i / a if a else 1.0
        elif i < a + h:
            env[i] = 1.0
        else:
            t = (i - (a + h)) / SR
            env[i] = math.exp(-t / max(rel, 1e-3))
    return env


def normalize_peak(buf: list, head: float = 0.89) -> list:
    peak = max(abs(v) for v in buf) or 1.0
    return [v / peak * head for v in buf]


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        pcm = array.array("h", (int(max(-1.0, min(1.0, v)) * 32767) for v in samples))
        w.writeframes(pcm.tobytes())


def normalize_to_mp3(wav_path, mp3_path):
    """Loudness-normalize to the library's level and encode — same treatment as every clip."""
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


# ---------------------------------------------------------------------------
# The synthesized cues
# ---------------------------------------------------------------------------

def synth_whoosh(dur=0.7, up=True):
    """Air whoosh: filtered noise sweeping through the spectrum under a smooth swell envelope."""
    n = int(SR * dur)
    rng = RNG(0x1111 if up else 0x2222)
    noise = white_noise(n, rng)
    noise = one_pole_highpass(noise, 120.0)
    sweep = sweep_filter(noise, 200.0, 4200.0, up=up)
    env = attack_release(n, atk=0.12, rel=0.25, hold=0.15)
    buf = [s * env[i] * 0.9 for i, s in enumerate(sweep)]
    return normalize_peak(buf)


def synth_swoosh(dur=0.8):
    """Downward swoosh — the reverse/drop variant (like whoosh-reverse, low-mids)."""
    n = int(SR * dur)
    rng = RNG(0x3333)
    noise = white_noise(n, rng)
    noise = one_pole_highpass(noise, 100.0)
    sweep = sweep_filter(noise, 2600.0, 180.0, up=False)
    env = attack_release(n, atk=0.10, rel=0.30, hold=0.12)
    buf = [s * env[i] * 0.9 for i, s in enumerate(sweep)]
    return normalize_peak(buf)


def synth_pop(dur=0.16):
    """Soft UI pop: a short damped-sine burst + a touch of click at the transient."""
    n = int(SR * dur)
    f0 = 190.0  # low warm thump so it reads 'rounded bubble', not a hard tick
    buf = [0.0] * n
    # body — damped sine with a fast pitch drop (kettle-drum-ish 'bloom')
    w = 2.0 * math.pi * f0 / SR
    for i in range(n):
        t = i / SR
        drop = 1.0 - 0.35 * min(1.0, t / 0.06)  # pitch sags a touch = 'pop'
        env = math.exp(-t / 0.05)
        buf[i] += 0.85 * env * math.sin(w * drop * i)
        # a bit of harmonic gives it body, not a pure sine beep
        buf[i] += 0.30 * env * math.exp(-t / 0.03) * math.sin(2 * w * i)
    # transient click — a couple of high, fast-decay taps at t=0 for 'snap' definition
    wc = 2.0 * math.pi * 1800.0 / SR
    for i in range(n):
        t = i / SR
        buf[i] += 0.18 * math.exp(-t / 0.008) * math.sin(wc * i)
    env = attack_release(n, atk=0.001, rel=0.09)
    return normalize_peak([b * env[i] for i, b in enumerate(buf)])


def synth_chime(dur=1.6, note_midi=81.0, second_note=None):
    """Bell-like chime: sine fundamental + inharmonic partials, long exponential decay.
    option second_note adds a rising second bell for the 'reward' two-note colour."""
    n = int(SR * dur)
    buf = [0.0] * n
    # inharmonic partials — a struck bar/bell, not a pure sine: overtones are NOT integer multiples
    partials = [(1.0, 1.00), (2.71, 0.45), (5.40, 0.16), (8.93, 0.05)]

    def bell(f0, amp):
        for ratio, ham in partials:
            f = f0 * ratio
            if f > SR / 2.2:
                continue
            w = 2.0 * math.pi * f / SR
            decay = 3.2 + 2.4 * ratio  # higher partials die faster = struck, not sustained
            for i in range(n):
                t = i / SR
                env = math.exp(-decay * t)
                if env < 1e-4:
                    break
                atk = min(1.0, t / 0.004)  # tiny attack so no click
                buf[i] += amp * ham * atk * env * math.sin(w * i)

    bell(midi_hz(note_midi), 1.0)
    if second_note is not None:
        # stagger the second bell by ~150ms (the 'rising two-tone' colour)
        off = int(SR * 0.15)
        w2 = 2.0 * math.pi * midi_hz(second_note) / SR
        for i in range(off, n):
            t = (i - off) / SR
            env = math.exp(-3.2 * t)
            if env < 1e-4:
                break
            atk = min(1.0, t / 0.004)
            buf[i] += 0.75 * atk * env * math.sin(w2 * (i - off))
    return normalize_peak(buf)


def synth_riser(dur=1.4):
    """Upward riser: noise that swells and brightens into a soft top — no landing hit."""
    n = int(SR * dur)
    rng = RNG(0x4444)
    noise = white_noise(n, rng)
    noise = one_pole_highpass(noise, 80.0)
    sweep = sweep_filter(noise, 150.0, 5000.0, up=True)
    # exponential-ish swell to the top, quick dip at the very end so it 'resolves' softly
    buf = [0.0] * n
    for i in range(n):
        prog = i / n
        env = prog ** 1.6
        if prog > 0.9:  # let the very top fall back a touch (soft resolve, no hit)
            env *= (1.0 - 0.6 * (prog - 0.9) / 0.1)
        buf[i] = sweep[i] * env * 0.95
    return normalize_peak(buf)


def synth_impact(dur=0.9, deep=False):
    """Low impact thump: a fast-decay low sine 'boom' with a tiny sub drop. deep => longer tail."""
    n = int(SR * dur)
    f0 = 95.0 if deep else 130.0
    buf = [0.0] * n
    w = 2.0 * math.pi * f0 / SR
    w2 = 2.0 * math.pi * (f0 * 1.6) / SR  # a bit of knock/body
    decay = 4.5 if deep else 7.0
    for i in range(n):
        t = i / SR
        env = math.exp(-decay * t)
        atk = min(1.0, t / 0.004)
        buf[i] = atk * env * (0.9 * math.sin(w * i) + 0.35 * math.sin(w2 * i))
    return normalize_peak(buf)


def synth_tick(dur=0.06):
    """Short dry UI tick/click — a fast-decay high tap, very crisp."""
    n = int(SR * dur)
    rng = RNG(0x5555)
    buf = [0.0] * n
    w = 2.0 * math.pi * 2400.0 / SR
    for i in range(n):
        t = i / SR
        buf[i] = math.exp(-t / 0.006) * math.sin(w * i)
    # a tiny bit of noise 'mechanism' grit at the transient
    noise = white_noise(n, rng)
    for i in range(n):
        t = i / SR
        buf[i] += 0.12 * math.exp(-t / 0.004) * noise[i]
    return normalize_peak(buf)


# (id, description, category, tags, synth_fn)
CUES = [
    ("whoosh-local", "soft air whoosh — filtered noise sweep (transition)", "motion",
     ["whoosh", "transition", "swipe", "air", "motion", "local"], lambda: synth_whoosh(dur=0.7, up=True)),
    ("swoosh-down-local", "downward swoosh — reversed drop (whoosh-reverse stand-in)", "motion",
     ["swoosh", "whoosh", "reverse", "drop", "down", "motion", "local"], lambda: synth_swoosh(dur=0.8)),
    ("pop-local", "soft rounded UI pop — damped sine burst (pop-reveal stand-in)", "emphasis",
     ["pop", "reveal", "appear", "ui", "bubble", "emphasis", "local"], lambda: synth_pop(dur=0.16)),
    ("chime-local", "single warm bell chime — sine + inharmonic decay (success)", "reward",
     ["chime", "bell", "reward", "success", "positive", "local"], lambda: synth_chime(dur=1.6, note_midi=81.0)),
    ("chime-up-local", "rising two-note reward chime (chime-reward stand-in)", "reward",
     ["chime", "reward", "two-tone", "up", "success", "local"],
     lambda: synth_chime(dur=1.6, note_midi=76.0, second_note=83.0)),
    ("riser-local", "soft upward riser — swelling noise sweep, no landing hit", "tension",
     ["riser", "swell", "build", "anticipation", "tension", "local"], lambda: synth_riser(dur=1.4)),
    ("impact-local", "soft low impact thump — felt not heard (emphasis)", "emphasis",
     ["impact", "hit", "thud", "emphasis", "underline", "local"], lambda: synth_impact(dur=0.9, deep=False)),
    ("impact-deep-local", "deeper impact with longer tail (reveal/payoff)", "emphasis",
     ["impact", "deep", "reveal", "payoff", "boom", "long-tail", "local"], lambda: synth_impact(dur=1.4, deep=True)),
    ("ui-click-local", "short dry UI click/tick (menu select)", "snap",
     ["ui", "click", "tick", "menu", "select", "snap", "local"], lambda: synth_tick(dur=0.06)),
    ("clock-tick-local", "single clean clock tick (countdown texture)", "texture",
     ["clock", "tick", "tock", "countdown", "timer", "texture", "local"], lambda: synth_tick(dur=0.06)),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-synthesize clips that already exist")
    ap.add_argument("--only", help="just this cue id")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    os.makedirs(CLIPS_DIR, exist_ok=True)
    catalog = json.load(open(CATALOG, encoding="utf-8"))
    by_id = {c["id"]: c for c in catalog["clips"]}

    todo = [c for c in CUES if not args.only or c[0] == args.only]
    if not todo:
        sys.exit(f"no cue matches --only {args.only}")

    made = 0
    for cid, desc, category, tags, fn in todo:
        mp3 = os.path.join(CLIPS_DIR, f"{cid}.mp3")
        rel = os.path.relpath(mp3, SFX_DIR).replace("\\", "/")

        if os.path.exists(mp3) and not args.force:
            print(f"  = {cid:18} exists, skipping")
            continue
        if args.dry_run:
            print(f"  + {cid:18} WOULD synth ({category}) {', '.join(tags[:4])}...")
            continue

        print(f"  + {cid:18} {desc}")
        samples = fn()
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "c.wav")
            write_wav(wav, samples)
            normalize_to_mp3(wav, mp3)

        entry = by_id.get(cid, {"id": cid})
        entry.update({
            "id": cid,
            "file": rel,
            "category": category,
            "tags": tags,
            "desc": desc,
            "function": "ui",  # non-diegetic UI/motion cue (not 'content' like a chord)
            "source": "gen_sfx_local.py (deterministic stdlib synthesis)",
            "license": "Synthesized programmatically by this repo (no rights; public-domain-equivalent waveform)",
            "duration_s": round(float(probe(mp3, "duration")), 3),
        })
        entry.setdefault("used_in", [])
        if cid not in by_id:
            catalog["clips"].append(entry)
            by_id[cid] = entry
        made += 1

    if not args.dry_run and made:
        json.dump(catalog, open(CATALOG, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(f"\ncatalog updated -> {CATALOG}  ({made} local SFX clip(s))")


if __name__ == "__main__":
    main()
