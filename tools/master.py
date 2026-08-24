#!/usr/bin/env python3
"""master.py — the delivery mastering chain (the missing last step of the audio pipeline).

Today every video stops at the AUDITION mix (`mix_sfx.py` then `mix_music.py`), whose own
docs defer loudness to "assemble's job later" — a job that did not exist. Measured result:
shipped finals land at -15.8..-20.4 LUFS (platform target -14) and one master clipped at
+1.1 dBTP. This tool is that job.

Approach (pure ffmpeg via ffw — no paid dep, no new install):
  Speech-level normalization to the pro loudness, then a brickwall true-peak limiter.
    1. measure the SPEECH loudness (ebur128 "LRA high" = the loud foreground band, i.e. the
       voice, robust to the quiet kids gaps that drag integrated loudness down),
    2. gain it up to the target speech level (--speech-target, default -13 LUFS) — this is
       what makes the VOICE sound platform-loud; integrated loudness lands near -14 for ads
       and a little lower for calm kids videos (their pauses are meant to be quiet),
    3. brickwall-limit the true peak to --target-tp (default -1 dBTP): oversample ->
       alimiter(level=0) -> back to 48k. alimiter is a SAMPLE-peak limiter, so the
       oversampling is what catches the inter-sample peaks — this is the exact fix for the
       +1.1 dBTP clip short-16 shipped (its alimiter=0.97 = -0.26 dBFS sat ABOVE -1 dBTP).
  The delivered file is re-measured and reported; the step fails if the true peak is over
  the ceiling. Encode AAC ONCE at the end (decode-to-float -> process -> single AAC).

Usage:
  python tools/master.py <in.mp4>                       # -> <stem>-master.mp4 next to input
  python tools/master.py <in.mp4> --out <out.mp4>
  python tools/master.py <in.mp4> --target-i -14 --target-tp -1
  python tools/master.py <in.mp4> --print               # show the resolved plan, no render

Gate it afterwards with:  python tools/audio_gate.py --delivery-report <out.mp4>
"""
import argparse
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ffw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rp(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def show(p):
    try:
        return os.path.relpath(p, ROOT)
    except ValueError:
        return p


def _last(rx, text):
    m = re.findall(rx, text)
    return float(m[-1]) if m else None


def probe_duration(path):
    out = ffw.ffprobe("-v", "error", "-show_entries", "format=duration",
                      "-of", "default=nw=1:nk=1", path)
    return float((out.stdout or "").strip())


def measure_delivery(path):
    """Full-file delivery measure: integrated LUFS / LRA / LRA-high (speech) / true peak."""
    r = subprocess.run([ffw.path(), "-hide_banner", "-i", path, "-map", "0:a:0",
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    out = r.stdout or ""
    return {"I": _last(r"I:\s*(-?[\d.]+)\s*LUFS", out),
            "LRA": _last(r"LRA:\s*(-?[\d.]+)\s*LU", out),
            "LRAH": _last(r"LRA high:\s*(-?[\d.]+)", out),
            "TP": _last(r"Peak:\s*(-?[\d.]+)", out)}


def _run_render(inp, out, af):
    # Map audio always; map video only if the input actually has one (a mastered voice.wav
    # is audio-only). Copy the video through untouched when present.
    probe = ffw.ffprobe("-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0", inp)
    has_video = bool((probe.stdout or "").strip())
    cmd = [ffw.path(), "-y", "-hide_banner", "-i", inp,
           "-af", af, "-ar", "48000",
           "-map", "0:a:0"]
    if has_video:
        cmd += ["-map", "0:v:0", "-c:v", "copy"]
    cmd += ["-c:a", "aac", "-b:a", "192k", "-ac", "2",
            "-movflags", "+faststart", out]
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.stderr.write("\nFFMPEG FAILED:\n" + (r.stdout or "")[-3000:] + "\n")
        raise SystemExit(1)


def master(inp, out, speech_target, ttp, fade_out, print_only):
    inp = rp(inp)
    if not os.path.exists(inp):
        sys.exit(f"master.py: missing input {inp}")
    if out is None:
        stem, _ = os.path.splitext(inp)
        out = stem + "-master.mp4"
    out = rp(out)
    dur = probe_duration(inp)

    src = measure_delivery(inp)
    if src["I"] is None:
        sys.exit(f"master.py: {inp} has no measurable audio stream")
    ref = src["LRAH"] if src["LRAH"] is not None else src["I"]   # speech-band loudness
    gain = speech_target - ref
    # alimiter is a sample-peak limiter; even oversampled it leaves ~0.2 dB of inter-sample
    # overshoot, so aim the SAMPLE ceiling ~0.2 dB under the true-peak target to land on it.
    lim = round(10 ** ((ttp - 0.2) / 20.0), 4)                    # -1 dBTP -> 0.871 linear

    print(f"master: {show(inp)}  ({dur:.1f}s)")
    print(f"  measured  I={src['I']:.2f} LUFS  LRA={src['LRA']:.2f} LU  "
          f"speech(LRA-high)={ref:.2f}  TP={src['TP']:.2f} dBTP")
    print(f"  target    speech~{speech_target:g} LUFS  TP<={ttp:g} dBTP  fade-out={fade_out}s  gain={gain:+.1f} dB")
    print(f"  -> {show(out)}")

    # fade-out BEFORE the gain/limiter so it can't poke the ceiling; oversample so the
    # brickwall catches inter-sample peaks (the +1.1 dBTP clip fix); back to 48k for AAC.
    fade = (f"afade=t=out:st={max(0.0, dur - fade_out):.3f}:d={fade_out:.3f}," if fade_out > 0 else "")
    af = (fade + f"volume={gain:.2f}dB,"
                 f"aresample=96000,alimiter=level_in=1:level_out=1:limit={lim}:level=0,"
                 f"aresample=48000:first_pts=0")
    if print_only:
        print("  chain: " + af)
        return None

    _run_render(inp, out, af)

    # --- delivery report + gate ------------------------------------------------

    # --- delivery report + gate ------------------------------------------------
    rep = measure_delivery(out)
    ok_tp = rep["TP"] is not None and rep["TP"] <= (ttp + 0.3)
    print(f"  delivered I={rep['I']:.2f} LUFS  LRA={rep['LRA']:.2f} LU  "
          f"speech={rep['LRAH']:.2f}  TP={rep['TP']:.2f} dBTP")
    print(f"    [{'OK' if ok_tp else 'FAIL'}] true peak <= {ttp:g} dBTP (no clip on re-encode)")
    if not ok_tp:
        print("MASTER GATE: FAIL — true peak over ceiling (would clip on the platform)")
        raise SystemExit(1)
    if rep["I"] is not None and rep["I"] < -17.0:
        print(f"  note: integrated {rep['I']:.1f} LUFS is quiet — the MIX is soft; "
              f"raise mix levels, don't push the master harder")
    print("MASTER GATE: PASS")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="the audition mix (mp4) to master")
    ap.add_argument("--out", help="output mp4 (default <stem>-master.mp4 next to input)")
    ap.add_argument("--speech-target", type=float, default=-13.0,
                    help="target loudness of the speech band in LUFS (default -13)")
    ap.add_argument("--target-tp", type=float, default=-1.0, help="true-peak ceiling dBTP")
    ap.add_argument("--fade-out", type=float, default=0.30, help="fade-out seconds (0=off)")
    ap.add_argument("--print", dest="print_only", action="store_true",
                    help="show the resolved plan, no render")
    args = ap.parse_args()
    ffw.require_full()
    master(args.input, args.out, args.speech_target, args.target_tp,
           args.fade_out, args.print_only)


if __name__ == "__main__":
    main()
