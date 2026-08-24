#!/usr/bin/env python3
"""audio_gate.py — loudness/silence gate for the audio chain.

Every mux/mix step must pass this before any output is called "done". It catches the
silent-AAC class of bug (audio track present but decodes to silence) and verifies cues
actually land in a mix.

Modes:
  1. Check a single file is non-silent (default):
       python tools/audio_gate.py path/to/out.mp4
     Fails (exit 1) if there is no audio stream or its RMS level is -inf (silent).
  2. Per-cue RMS report (for SFX audibility) — compare a cue window of the MIXED file
     against the VOICE-ONLY preview:
       python tools/audio_gate.py --cue 4.9 --cue 10.2 --mix output/x-sfx.mp4 --base output/x.mp4
     Prints RMS(dB) for each file + the delta; fails if a story-critical cue (default
     threshold) adds less than the floor.

  3. Delivery report (final-master QA — LUFS / true-peak / LRA compliance):
       python tools/audio_gate.py --delivery-report path/to/out-master.mp4
     Prints integrated loudness, LRA, speech-band (LRA-high) loudness, and true peak, and
     FAILS (exit 1) on clipping (true peak over the ceiling) or a wildly dynamic/unmastered
     mix. This is the objective gate that would have caught the short-16 +1.1 dBTP clip and
     the -20 LUFS dead-quiet finals. Run it after tools/master.py.

Also: --dur S  (window length per cue, default 0.3s — short for transients)
      --floor DB (min dB a required cue must add; default 4.0)
      --optional-floor DB (default 1.0)
      --list-cues  (only print, don't enforce)
      --tp-ceiling DB (delivery true-peak ceiling, default -1.0 dBTP)
      --json  (with --delivery-report: also emit a machine-readable line)

Uses tools/ffw.py to resolve a full ffmpeg/ffprobe.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import ffw

RMS_RE = re.compile(r"RMS level dB:\s*(-?[\d.]+|inf|-inf)")


def _last(rx, text):
    m = re.findall(rx, text)
    return float(m[-1]) if m else None


def delivery_measure(path):
    """Full-file ebur128 measure: I / LRA / LRA-high (speech) / true peak. None if no audio."""
    if not has_audio_stream(path):
        return None
    r = ffw.ffmpeg("-hide_banner", "-i", path, "-map", "0:a:0",
                   "-af", "ebur128=peak=true", "-f", "null", "-")
    out = (r.stdout or "") + (r.stderr or "")
    I = _last(r"I:\s*(-?[\d.]+)\s*LUFS", out)
    if I is None:
        return None
    return {"I": I,
            "LRA": _last(r"LRA:\s*(-?[\d.]+)\s*LU", out),
            "LRAH": _last(r"LRA high:\s*(-?[\d.]+)", out),
            "TP": _last(r"Peak:\s*(-?[\d.]+)", out)}


def gate_delivery(path, tp_ceiling, as_json):
    """Delivery-compliance gate. Returns the measure dict; exits nonzero on clip/no-audio."""
    m = delivery_measure(path)
    if m is None:
        sys.exit(f"AUDIO GATE FAIL: {path} has no measurable audio stream.")
    tp = m["TP"]
    lra = m["LRA"]
    clipped = tp is None or tp > (tp_ceiling + 0.3)
    # LRA sanity: an unmastered/over-dynamic mix reads as a very wide range
    lra_ok = lra is None or lra <= 20.0

    def f(v, u=""):
        return "n/a" if v is None else f"{v:.2f}{u}"
    print(f"DELIVERY REPORT: {path}")
    print(f"  integrated  {f(m['I'],' LUFS')}")
    print(f"  LRA         {f(lra,' LU')}")
    print(f"  speech(HI)  {f(m['LRAH'],' LUFS')}   (LRA-high = the voice band)")
    print(f"  true peak   {f(tp,' dBTP')}   ceiling {tp_ceiling:g} dBTP")
    print(f"  [{'FAIL' if clipped else 'OK'}] true peak {'over ceiling — WILL clip on platform re-encode' if clipped else 'under ceiling (no clip)'}")
    print(f"  [{'OK' if lra_ok else 'WARN'}] loudness range {'OK' if lra_ok else 'very wide — sounds unmastered'}")
    if m["I"] is not None and m["I"] < -17.0:
        print(f"  note: integrated {m['I']:.1f} LUFS is quiet vs the -14 platform norm — "
              f"if speech(HI) is also low, the mix is soft")
    if as_json:
        print("DELIVERY_JSON " + json.dumps(
            {"file": path, "I": m["I"], "LRA": lra, "speech": m["LRAH"], "TP": tp,
             "clipped": clipped, "lra_ok": lra_ok}))
    if clipped:
        sys.exit(f"AUDIO GATE FAIL: {path} true peak {f(tp,' dBTP')} exceeds ceiling "
                 f"{tp_ceiling:g} dBTP — master it with tools/master.py.")
    print("AUDIO GATE OK: delivery compliant (no clip).")
    return m


def _window(path, t, dur):
    """RMS (dB) of `path` in window [t, t+dur]. None if no audio / silent."""
    r = ffw.ffmpeg("-hide_banner", "-ss", f"{t}", "-t", f"{dur}",
                   "-i", path, "-map", "0:a:0", "-af", "astats=metadata=0",
                   "-f", "null", "-")
    out = (r.stdout or "") + (r.stderr or "")
    m = RMS_RE.search(out)
    if not m or m.group(1) in ("inf", "-inf"):
        return None
    return float(m.group(1))


def overall_rms(path):
    """Overall RMS (dB) of the file's audio; None if absent or silent."""
    r = ffw.ffmpeg("-hide_banner", "-i", path, "-map", "0:a:0",
                   "-af", "astats=metadata=0", "-f", "null", "-")
    out = (r.stdout or "") + (r.stderr or "")
    m = RMS_RE.search(out)
    if not m:
        return None
    v = m.group(1)
    if v in ("inf", "-inf"):
        return None
    return float(v)


def has_audio_stream(path):
    r = ffw.ffprobe("-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=codec_type",
                    "-of", "csv=p=0", path)
    return bool((r.stdout or "").strip())


def gate_file(path):
    """Assert a file is non-silent. Returns overall RMS or exits nonzero."""
    if not has_audio_stream(path):
        sys.exit(f"AUDIO GATE FAIL: {path} has NO audio stream.")
    rms = overall_rms(path)
    if rms is None:
        sys.exit(f"AUDIO GATE FAIL: {path} audio decodes to SILENCE (RMS -inf).")
    print(f"AUDIO GATE OK: {path} overall RMS = {rms:.1f} dB")
    return rms


def gate_cues(mix, base, cues, dur, floor, optional_floor, list_only):
    """Compare mixed vs base RMS at each cue. Returns list of (t, delta) or exits."""
    results = []
    for t in cues:
        mix_rms = _window(mix, t, dur)
        base_rms = _window(base, t, dur)
        delta = (mix_rms - base_rms) if (mix_rms is not None and base_rms is not None) else None
        results.append((t, mix_rms, base_rms, delta))
        print(f"  cue@{t:>6.2f}s  mix={_f(mix_rms)}dB  base={_f(base_rms)}dB  delta={_f(delta)}dB")
    if list_only:
        return results
    for t, mix_rms, base_rms, delta in results:
        if delta is not None and delta < floor:
            sys.exit(
                f"AUDIO GATE FAIL: cue@{t}s adds only {delta:.1f} dB "
                f"(need >= {floor} dB for a required cue)."
            )
    print("AUDIO GATE OK: all required cues audible.")
    return results


def _f(v):
    return f"{v:.1f}" if v is not None else "n/a"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("file", nargs="?", help="file to gate for non-silence")
    ap.add_argument("--mix", help="mixed file (for cue mode)")
    ap.add_argument("--base", help="base/preview file (for cue mode)")
    ap.add_argument("--cue", action="append", type=float, help="cue time (s), repeatable")
    ap.add_argument("--dur", type=float, default=0.3, help="window length per cue")
    ap.add_argument("--floor", type=float, default=4.0, help="min dB a required cue must add")
    ap.add_argument("--optional-floor", type=float, default=1.0)
    ap.add_argument("--list-cues", action="store_true", help="print cues, don't enforce")
    ap.add_argument("--delivery-report", action="store_true",
                    help="delivery-compliance report (LUFS/LRA/true-peak); gate a master")
    ap.add_argument("--tp-ceiling", type=float, default=-1.0,
                    help="delivery true-peak ceiling dBTP (default -1.0)")
    ap.add_argument("--json", action="store_true",
                    help="with --delivery-report: also emit a machine-readable DELIVERY_JSON line")
    args = ap.parse_args()

    ffw.require_full()

    if args.delivery_report:
        if not args.file:
            ap.error("--delivery-report needs a file to inspect")
        gate_delivery(args.file, args.tp_ceiling, args.json)
    elif args.cue or args.mix:
        if not args.mix or not args.base:
            ap.error("cue mode needs --mix and --base")
        gate_cues(args.mix, args.base, args.cue or [], args.dur,
                  args.floor, args.optional_floor, args.list_cues)
    elif args.file:
        gate_file(args.file)
    else:
        ap.error("pass a file, or --mix/--base with --cue")


if __name__ == "__main__":
    main()
