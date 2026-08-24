#!/usr/bin/env python3
"""
gen_voice_edge.py — FREE TTS voice track for a TSX short, driven by its beats.json.

Drop-in, no-API-key alternative to gen_voice.py (ElevenLabs). Same contract: reads a
short's beats.json (vo[] lines with estimated start/end seconds), synthesizes each line
with Microsoft Edge neural TTS (edge-tts — free, unlimited, natural), time-fits any clip
that overflows its window (gentle atempo, capped), assembles one timed voice track, and
writes the ACTUAL line + word timings back into beats.json — the TSX captions retime from
it. Can also emit the vo.gen.ts module the shot imports.

LIBRARY-FIRST: generated lines are cached by (voice, rate, pitch, text-hash); unchanged
lines are never re-synthesized. --force regenerates everything.

Usage:
  python tools/gen_voice_edge.py --beats shorts/short-13-dad-daughter/beats.json
  python tools/gen_voice_edge.py --beats ... --emit-ts remotion/src/shots/short-13/vo.gen.ts
  python tools/gen_voice_edge.py --beats ... --mux remotion/out/Short13DadDaughter.mp4
  python tools/gen_voice_edge.py --beats ... --dry-run                 # plan only
  python tools/gen_voice_edge.py --beats ... --voice he-IL-AvriNeural --nikkud   # Hebrew + nikkud G2P

--nikkud (he-IL voices only): runs each line through the phonikud nikkud G2P front-end
(tools/nikkud_g2p.py) BEFORE synthesis, so edge-tts reads pointed Hebrew — steers vowels/
stress on ambiguous words and code-switched lines. Display text stays unpointed; captions
are unaffected. Needs the ONNX nakdan model (tools/fetch_phonikud.py). Default OFF.

Voice: default en-US-AriaNeural. Delivery tuned "soft & intimate" via rate/pitch.
Needs edge-tts (pip install edge-tts) and ffmpeg/ffprobe on PATH. NO API KEY.

BREAKAGE DRILL (edge-tts is an UNOFFICIAL Microsoft endpoint — MS breaks it every few months):
  1. First response: `pip install -U edge-tts` — maintainer rany2 usually patches within
     days (current ~v7.2.8). Do NOT pin edge-tts — always take the fix-forward upgrade.
  2. If it stays down (NoAudioReceived / 503 / WSS handshake failures): synthesize with any
     local TTS, then recover word timings via `tools/align_words.py --lang he` (WhisperX
     forced alignment; the Hebrew aligner resolves automatically).
"""
import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ffmpeg/ffprobe: prefer PATH, else fall back to the binaries Remotion bundles in its
# compositor package (no separate install needed on this machine).
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)
import voice_cleanup  # the shared TTS cleanup front (highpass/deesser/compand)
import nikkud_g2p  # Hebrew nikkud G2P front-end (phonikud); used only by --nikkud


def _find_tool(name):
    # Route through ffw so we get a FULL build (the Remotion-bundled one silently
    # produces broken AAC). ffw resolves via --ffmpeg/FFMPEG_PATH/tools/bin/bootstrap.
    return ffw.path() if name == "ffmpeg" else ffw.ffprobe_path()


FFMPEG = _find_tool("ffmpeg")
FFPROBE = _find_tool("ffprobe")

DEFAULT_VOICE = "en-US-AriaNeural"
# soft & intimate: a touch slower and lower. Edge accepts "+-N%" rate and "+-NHz" pitch.
DEFAULT_RATE = "-6%"
DEFAULT_PITCH = "-2Hz"
MAX_ATEMPO = 1.3  # never speed a line up more than 30%


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stdout}")
    return r.stdout


def probe_duration(path):
    out = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", path])
    return float(out.strip())


async def _tts(text, voice, rate, pitch):
    """Synthesize one line -> (audio_bytes, words[{w,start,end}]) with real word times."""
    # This is the call that breaks when MS changes the endpoint — see BREAKAGE DRILL in the
    # module docstring: pip install -U edge-tts first; if still down, local TTS + align_words.py.
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    audio = bytearray()
    words = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            start = round(chunk["offset"] / 1e7, 3)
            end = round((chunk["offset"] + chunk["duration"]) / 1e7, 3)
            words.append({"w": chunk["text"], "start": start, "end": end})
    if not audio:
        sys.exit(f"edge-tts returned no audio for: {text!r}")
    return bytes(audio), words


def tts_line(text, voice, rate, pitch, out_path):
    audio, words = asyncio.run(_tts(text, voice, rate, pitch))
    with open(out_path, "wb") as f:
        f.write(audio)
    with open(out_path + ".words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


def emit_ts(vo, path):
    """Write the generated VO (with exact word times) as a TS module the shot imports."""
    lines = ["// AUTO-GENERATED by tools/gen_voice_edge.py — do not edit.",
             "// Word times are REAL Edge-TTS word boundaries; captions sync exactly.",
             "import type { VoLine } from '../../lib/shorts';", "",
             "export const VO: VoLine[] = ["]
    for line in vo:
        esc = line["text"].replace("\\", "\\\\").replace("'", "\\'")
        ws = ", ".join(
            "{ w: '%s', start: %s, end: %s }" % (w["w"].replace("\\", "\\\\").replace("'", "\\'"), w["start"], w["end"])
            for w in line.get("words", []))
        lines.append(f"  {{ text: '{esc}', start: {line['start']}, end: {line['end']}, words: [{ws}] }},")
    lines += ["];", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--beats", required=True, help="path to the short's beats.json")
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--rate", default=DEFAULT_RATE)
    ap.add_argument("--pitch", default=DEFAULT_PITCH)
    ap.add_argument("--mux", help="optional rendered mp4 to mux the voice onto (-voiced.mp4)")
    ap.add_argument("--emit-ts", help="write the VO (with exact word times) as a TS module, e.g. remotion/src/shots/short-13/vo.gen.ts")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--nikkud", action="store_true",
                    help="run Hebrew lines through the phonikud nikkud G2P front-end before "
                         "synthesis (only for he-IL voices). Keeps unpointed display text.")
    args = ap.parse_args()

    beats_path = os.path.abspath(args.beats)
    beats = json.load(open(beats_path, encoding="utf-8"))
    vo = beats["vo"]
    fmt = beats["format"]
    total = float(fmt.get("durationSec", fmt.get("duration_s")))
    vdir = os.path.join(os.path.dirname(beats_path), "voice")
    os.makedirs(vdir, exist_ok=True)

    # --nikkud is a Hebrew-only pronunciation steer; it does nothing for non-he-IL voices.
    nikkud = args.nikkud and str(args.voice).startswith("he-IL")
    if args.nikkud and not nikkud:
        print(f"note: --nikkud applies only to he-IL voices (voice={args.voice}); ignored")

    fitted = []  # (path, start_sec, fitted_dur)
    print(f"voice={args.voice} rate={args.rate} pitch={args.pitch}"
          + ("  [nikkud G2P]" if nikkud else ""))
    print(f"{'line':4s} {'start':>6s} {'window':>6s} {'clip':>6s} {'tempo':>5s}  text")
    for i, line in enumerate(vo):
        start = float(line["start"])
        next_start = float(vo[i + 1]["start"]) if i + 1 < len(vo) else total - 0.3
        window = next_start - start - 0.05
        text = line["text"]
        # Pronunciation-guided synthesis text: pointed Hebrew when --nikkud, else the raw
        # line. The cache hash keys on the SYNTH text so a nikkud change re-synthesizes.
        synth_text = nikkud_g2p.add_nikkud(text) if nikkud else text
        h = hashlib.sha1(f"{args.voice}|{args.rate}|{args.pitch}|{synth_text}".encode()).hexdigest()[:8]
        raw = os.path.join(vdir, f"line-{i:02d}-{h}.mp3")
        fit = os.path.join(vdir, f"line-{i:02d}-{h}-fit.wav")

        if args.dry_run:
            print(f"{i:4d} {start:6.2f} {window:6.2f}      ?     ?  {text}")
            continue

        if args.force or not os.path.exists(raw) or not os.path.exists(raw + ".words.json"):
            tts_line(synth_text, args.voice, args.rate, args.pitch, raw)

        dur = probe_duration(raw)
        tempo = 1.0
        if dur > window:
            tempo = min(MAX_ATEMPO, dur / window)
        if args.force or not os.path.exists(fit):
            run([FFMPEG, "-y", "-v", "error", "-i", raw,
                 "-filter:a", f"atempo={tempo:.4f}", "-ar", "44100", "-ac", "2", fit])
        fdur = probe_duration(fit)
        overflow = " OVERFLOW" if fdur > window + 0.05 else ""
        print(f"{i:4d} {start:6.2f} {window:6.2f} {fdur:6.2f} {tempo:5.2f}  {text}{overflow}")
        line["end"] = round(start + fdur, 2)
        # exact word times: raw alignment, scaled by the tempo fit, offset to global.
        # With --nikkud the synth text is pointed; nikkud adds combining marks without
        # changing tokenization, so boundaries align 1:1 onto the ORIGINAL unpointed
        # display words — captions stay clean (no nikkud shown). Fall back to the pointed
        # tokens if counts differ (timing still exact; the w field is informational).
        raw_words = json.load(open(raw + ".words.json", encoding="utf-8"))
        disp_words = text.split()
        if nikkud and len(raw_words) == len(disp_words):
            wl = [{"w": disp_words[k],
                   "start": round(start + raw_words[k]["start"] / tempo, 3),
                   "end": round(start + raw_words[k]["end"] / tempo, 3)}
                  for k in range(len(raw_words))]
        else:
            wl = [{"w": w["w"],
                   "start": round(start + w["start"] / tempo, 3),
                   "end": round(start + w["end"] / tempo, 3)} for w in raw_words]
        line["words"] = wl
        fitted.append((fit, start, fdur))

    if args.dry_run:
        return

    # assemble: delay each line to its start, sum (lines never overlap), pad to length
    voice_wav = os.path.join(vdir, "voice.wav")
    inputs, parts = [], []
    for j, (path, start, _d) in enumerate(fitted):
        inputs += ["-i", path]
        ms = int(round(start * 1000))
        parts.append(f"[{j}:a]adelay={ms}|{ms}[a{j}]")
    chain = "".join(f"[a{j}]" for j in range(len(fitted)))
    # Sum + pad, then the shared cleanup front (highpass/deesser/compand — the "produced"
    # voice sound). Loudness is left to the final master (tools/master.py); the cleanup front
    # replaces the old bare single-pass loudnorm=I=-16 that left the voice flat + quiet.
    fc = ";".join(parts) + f";{chain}amix=inputs={len(fitted)}:normalize=0,apad,atrim=0:{total}," \
         f"{voice_cleanup.CLEANUP_FRONT}[out]"
    run([FFMPEG, "-y", "-v", "error", *inputs, "-filter_complex", fc,
         "-map", "[out]", "-ar", "44100", "-ac", "2", voice_wav])
    print(f"voice track -> {os.path.relpath(voice_wav, ROOT)}")

    beats["voiceStatus"] = f"edge-tts:{args.voice}" + ("+nikkud" if nikkud else "")
    json.dump(beats, open(beats_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"actual line timings + word maps written back -> {os.path.relpath(beats_path, ROOT)}")

    if args.emit_ts:
        emit_ts(vo, rp := os.path.abspath(args.emit_ts))
        print(f"VO TS module -> {os.path.relpath(rp, ROOT)}")

    if args.mux:
        out = os.path.splitext(args.mux)[0] + "-voiced.mp4"
        run([FFMPEG, "-y", "-v", "error", "-i", args.mux, "-i", voice_wav,
             "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-t", str(total), out])
        print(f"voiced preview -> {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
