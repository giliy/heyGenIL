#!/usr/bin/env python3
"""
gen_voice.py — voice track for a TSX short, driven by its beats.json.

Shorts-track voice step. Reads a short's beats.json (vo[] lines with estimated
start/end seconds), generates each line with text-to-speech (per line, so a single line
can be re-rolled without re-billing the rest), time-fits any clip that overflows its
window (gentle atempo, capped), assembles one timed voice track, and writes the ACTUAL
line timings back into beats.json — the TSX captions retime from it.

--engine elevenlabs (default): ElevenLabs API with per-word timestamps.
--engine kokoro: local Kokoro-82M (zero-key, $0, CPU) with native per-token timestamps,
  same mp3 + .words.json contract. Needs `pip install kokoro soundfile` + espeak-ng on
  PATH (imported lazily so the elevenlabs path works without them).

LIBRARY-FIRST: generated lines are cached by (engine, text-hash); unchanged lines are
never re-billed. --force regenerates everything.

Usage:
  python tools/gen_voice.py --beats shorts/short-1-chess/beats.json
  python tools/gen_voice.py --beats ... --engine kokoro --voice af_bella
  python tools/gen_voice.py --beats ... --mux remotion/out/Short1Chess.mp4   # + voiced preview
  python tools/gen_voice.py --beats ... --dry-run                            # plan only

Needs ELEVENLABS_API_KEY in .env (elevenlabs engine only). ffmpeg/ffprobe on PATH.
Default voice: ElevenLabs premade "Liam".
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)
DEFAULT_VOICE = "TX3LPaxmHKxFdv7VOQHJ"  # ElevenLabs premade "Liam"
DEFAULT_MODEL = "eleven_multilingual_v2"
MAX_ATEMPO = 1.3  # never speed a line up more than 30%

# ElevenLabs audio tags ([excited], [pause]…) steer delivery; Kokoro has no such concept
# and would literally read them, so the kokoro path strips them before synthesis.
AUDIO_TAG_RE = re.compile(r"\[[^\]]*\]")

# Kokoro-82M audio sample rate (its KPipeline synthesizes raw 24 kHz PCM).
KOKORO_SR = 24000


def load_env():
    env = {}
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return {**env, **os.environ}


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stdout}")
    return r.stdout


def probe_duration(path):
    out = run([ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", path])
    return float(out.strip())


def tts_line(key, voice, model, text, prev_text, next_text, out_path, lang="en"):
    """TTS with character-level timestamps -> writes the mp3 AND <out_path>.words.json
    (per-word start/end seconds in the RAW clip) so captions can sync exactly.

    `text` may contain eleven_v3 audio tags like [excited] — they steer delivery and are
    FILTERED out of the word map (never captioned). If the model rejects /with-timestamps,
    falls back to plain TTS with an empty word map (captions then use estimated timing)."""
    body = {"text": text, "model_id": model}
    if not model.startswith("eleven_v3"):
        # v3 rejects the classic settings block AND previous/next context stitching;
        # server defaults are right for it
        body["voice_settings"] = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3,
                                  "use_speaker_boost": True}
        if prev_text:
            body["previous_text"] = prev_text
        if next_text:
            body["next_text"] = next_text

    import base64

    def call(url):
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"xi-api-key": key, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read()
        return json.loads(raw) if "json" in ctype else raw

    base = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
    try:
        resp = call(f"{base}/with-timestamps?output_format=mp3_44100_128")
        audio = base64.b64decode(resp["audio_base64"])
        align = resp.get("alignment") or {}
        words = chars_to_words(align.get("characters", []),
                               align.get("character_start_times_seconds", []),
                               align.get("character_end_times_seconds", []))
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:500]
        if e.code in (400, 404, 422):  # model may not support timestamps — plain fallback
            print(f"    (with-timestamps not available: {e.code}; falling back to plain TTS)")
            try:
                audio = call(f"{base}?output_format=mp3_44100_128")
                words = []
            except urllib.error.HTTPError as e2:
                sys.exit(f"ElevenLabs TTS failed ({e2.code}) for: {text!r}\n{e2.read().decode()[:500]}")
        else:
            sys.exit(f"ElevenLabs TTS failed ({e.code}) for: {text!r}\n{detail}")

    # audio tags ([excited], [pause]…) are delivery directions, not spoken words
    words = [w for w in words if not (w["w"].startswith("[") or w["w"].endswith("]"))]
    with open(out_path, "wb") as f:
        f.write(audio)
    if not words:
        # Plain fallback: the vendor returned no timestamps — try a local WhisperX forced
        # alignment to fill the map (T03); otherwise captions fall back to estimated timing.
        words = run_aligner(out_path, text, lang)
    with open(out_path + ".words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


def chars_to_words(chars, starts, ends):
    """Collapse character alignment into [{w, start, end}] (whitespace-delimited)."""
    words, cur, w_start, w_end = [], "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"w": cur, "start": round(w_start, 3), "end": round(w_end, 3)})
                cur, w_start = "", None
            continue
        if not cur:
            w_start = s
        cur += ch
        w_end = e
    if cur:
        words.append({"w": cur, "start": round(w_start, 3), "end": round(w_end, 3)})
    return words


def build_kokoro_pipeline():
    """Construct the Kokoro-82M KPipeline once per process (model download + load is the
    expensive part). Lazy import keeps the default elevenlabs path free of the kokoro/
    torch/numpy stack — this only imports when --engine kokoro is actually used."""
    try:
        from kokoro import KPipeline
    except ImportError as e:
        sys.exit(f"--engine kokoro needs 'pip install kokoro soundfile' and espeak-ng on PATH "
                 f"(not importable: {e})")
    # lang_code 'a' = American English — the English path exposes per-token
    # start_ts/end_ts via KPipeline.join_timestamps (zero forced alignment).
    return KPipeline(lang_code="a")


def tokens_to_words(tokens, offset):
    """Collapse Kokoro's per-token MToken list into [{w, start, end}] (whitespace-delimited,
    same shape as chars_to_words). Each MToken carries native start_ts/end_ts seconds
    (set by KPipeline.join_timestamps); tokens with whitespace close the current word."""
    words, cur, w_start, w_end = [], "", None, None
    for t in tokens:
        if t.start_ts is None or t.end_ts is None or not t.text:
            continue
        if not cur:
            w_start = t.start_ts
        cur += t.text
        w_end = t.end_ts
        if t.whitespace:
            words.append({"w": cur, "start": round(offset + w_start, 3),
                          "end": round(offset + w_end, 3)})
            cur = ""
    if cur:
        words.append({"w": cur, "start": round(offset + w_start, 3),
                      "end": round(offset + w_end, 3)})
    return words


def tts_line_kokoro(pipeline, voice, text, out_path, lang="en"):
    """Local Kokoro-82M TTS -> writes the SAME contract as tts_line: the mp3 AND
    <out_path>.words.json ([{w,start,end}] in the RAW clip).

    Uses Kokoro's native per-token start_ts/end_ts (KPipeline.join_timestamps on the
    English path) — no forced alignment. ElevenLabs audio tags like [excited] are stripped
    before synthesis (Kokoro would read them literally). No prev/next stitching. Audio is
    concatenated per line (long lines split into >510-phoneme chunks) and encoded as
    44100/128k mp3 to match downstream assumptions."""
    import numpy as np
    import soundfile as sf

    text = AUDIO_TAG_RE.sub(" ", text).strip()  # [audio tags] are delivery, not speech
    words = []
    chunks = []
    offset = 0.0  # seconds accumulated across chunks (timestamps restart at 0 per chunk)
    for res in pipeline(text, voice=voice):
        if res.audio is None:
            continue
        words += tokens_to_words(res.tokens or [], offset)
        audio = res.audio
        if hasattr(audio, "detach"):  # torch.FloatTensor -> numpy float32 PCM
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio, dtype=np.float32))
        offset += chunks[-1].size / KOKORO_SR

    if not chunks:
        sys.exit(f"Kokoro produced no audio for: {text!r}")
    pcm = np.concatenate(chunks)

    # encode float PCM -> wav -> 44100/128k mp3 (matches the ElevenLabs output format)
    tmp_wav = out_path + ".tmp.wav"
    sf.write(tmp_wav, pcm, KOKORO_SR)
    run([ffw.path(), "-y", "-v", "error", "-i", tmp_wav,
         "-ar", "44100", "-ac", "2", "-b:a", "128k", out_path])
    os.remove(tmp_wav)

    if not words:
        # Belt-and-braces (T03): Kokoro's native per-token timestamps usually fill the map,
        # but if a line produced an empty token map, try a local WhisperX forced alignment
        # before falling back to estimated timing.
        words = run_aligner(out_path, text, lang)

    with open(out_path + ".words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


def run_aligner(raw_path, text, lang="en"):
    """Fill <raw_path>.words.json via local WhisperX forced alignment (T03).

    Called after a plain-TTS fallback produced NO word timestamps. Shells out to
    tools/align_words.py when whisperx is importable; otherwise keeps the empty map and
    prints a one-line warning that captions will use estimated timing.

    `lang` selects the forced-alignment model whisperx loads ('he' -> the Hebrew
    wav2vec2 aligner, etc.); forwarded as align_words.py --lang. Defaults to English.

    Returns the aligned word map [{w,start,end}], possibly []."""
    # find_spec does NOT import the module — a cheap existence check that keeps the core
    # pipeline stdlib-only and boots instantly even without whisperx/torch installed.
    if importlib.util.find_spec("whisperx") is None:
        print("    (whisperx not installed; captions will use estimated timing)")
        return []
    words_out = raw_path + ".words.json"
    try:
        run([sys.executable, os.path.join(TOOLS, "align_words.py"),
             raw_path, text, "--out", words_out, "--lang", lang])
    except SystemExit:
        print("    (forced alignment failed; captions will use estimated timing)")
        return []
    if os.path.exists(words_out):
        with open(words_out, encoding="utf-8") as f:
            return json.load(f)
    return []


# Master chain targets (2026 social norm for Shorts/TikTok/Reels): -14 LUFS / -1.0 dBTP.
LOUD_I = -14.0
LOUD_TP = -1.0
LOUD_LRA = 11.0

# The cleanup front shared by BOTH loudnorm passes. highpass rolls off sub rumble,
# deesser tames sibilance, compand makes the voice sit louder and more present on phones.
# It MUST be identical in pass 1 (measure) and pass 2 (normalize) so that pass-2 loudnorm
# normalizes exactly the signal pass 1 measured — that's what lands the integrated
# loudness on the -14 target (measuring the raw signal and THEN companding misses it).
_CLEANUP_FRONT = (
    "highpass=f=80,"
    "deesser=i=0.3:m=0.5:f=0.5,"
    "compand=attacks=0.02:decays=0.25:points=-80/-80|-45/-45|-27/-20|0/-7:soft-knee=6:gain=0:volume=0"
)


def _measure_loudnorm(wav_path, front=_CLEANUP_FRONT):
    """Loudnorm measurement pass (dynamic, print_format=json) on a wav file.

    `front` is the filter chain applied BEFORE the measuring loudnorm. For pass 1 of the
    mastering chain this is the cleanup front, so the reported loudness is exactly what
    pass-2 loudnorm will receive and can normalize onto the target (the cleanup front must
    be identical in both passes — measuring the raw signal and THEN companding misses it).
    Pass an empty front for a pure measure (used by --verify to read the true peak of an
    already-mastered file without re-processing it through the compand).

    Parses the filter's JSON block on stderr and returns the measured_* params:
    input_i, input_tp, input_lra, input_thresh, target_offset."""
    chain = f"{front}," if front else ""
    cmd = [ffw.path(), "-y", "-v", "info", "-i", wav_path,
           "-af", f"{chain}loudnorm=I={LOUD_I}:TP={LOUD_TP}:LRA={LOUD_LRA}:print_format=json",
           "-f", "null", "-"]
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.exit(f"loudnorm measure failed: {' '.join(cmd)}\n{r.stderr}")
    start = r.stderr.find("{")
    end = r.stderr.rfind("}") + 1
    if start < 0 or end <= start:
        sys.exit(f"loudnorm measure produced no JSON block:\n{r.stderr}")
    data = json.loads(r.stderr[start:end])
    keys = ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")
    return {k: float(data[k]) for k in keys}


def _cleanup_chain(m):
    """Pass-2 filter string: cleanup front + LINEAR loudnorm (measured params) + hard limiter.

    Linear loudnorm lands the integrated loudness on the measured target (no dynamic
    lookahead -> no dead-air intro). A final `alimiter` (level=false = no makeup gain) is
    appended because loudnorm in LINEAR mode does NOT hard-limit true peak (its TP is a
    normalization target, not a limiter) — without it the compand pushes peaks past
    -1.0 dBTP on peaky material and the true-peak acceptance (<= -1.0 dBTP) would fail.

    TRUE-PEAK SAFETY: alimiter is a SAMPLE-peak limiter — inter-sample peaks can overshoot it.
    So we oversample to 96k around it (catches inter-sample peaks) and aim the sample ceiling
    ~0.2 dB under the true-peak target, matching tools/master.py. Then resample to the voice
    rate (44.1k) so downstream consumers get the same format they always did."""
    peak_lin = round(10 ** ((LOUD_TP - 0.2) / 20), 4)  # -1.0 dBTP -> ~0.871 linear sample ceiling
    return (
        f"{_CLEANUP_FRONT},"
        f"loudnorm=I={LOUD_I}:TP={LOUD_TP}:LRA={LOUD_LRA}:linear=true:"
        f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
        f"offset={m['target_offset']},"
        f"aresample=96000,alimiter=limit={peak_lin}:level=false,aresample=44100:first_pts=0"
    )


def _verify(wav_path):
    """--verify: independent loudness check of the final voice.wav.

    Integrated LUFS via pyloudnorm (EBU R128); true peak via ffmpeg's loudnorm measure
    (oversampled inter-sample peak, reported as input_tp). Prints both and PASS/FAIL
    against the -14 ±0.5 LUFS / <= -1.0 dBTP acceptance. Returns True on pass."""
    import soundfile as sf
    import pyloudnorm as pyln

    data, rate = sf.read(wav_path)
    meter = pyln.Meter(rate)  # default block size 0.400s, EBU R128
    loudness = meter.integrated_loudness(data)

    # true peak: a PURE loudnorm measure (front="" — no compand) so the oversampled
    # inter-sample peak (input_tp) reflects the final file as-is, not re-processed.
    try:
        tp = _measure_loudnorm(wav_path, front="")["input_tp"]
    except SystemExit:
        tp = float("-inf")
        print("    (true-peak measure unavailable)")

    ok = abs(loudness - LOUD_I) <= 0.5 and tp <= LOUD_TP
    print(f"  verify: integrated LUFS = {loudness:+.2f}  (target {LOUD_I} ±0.5)")
    print(f"  verify: true peak      = {tp:+.2f} dBTP  (target <= {LOUD_TP})")
    print(f"  verify: {'PASS' if ok else 'FAIL'}")
    return ok


def emit_ts(vo, path):
    """Write the generated VO (with exact word times) as a TS module the shot imports."""
    lines = ["// AUTO-GENERATED by tools/gen_voice.py — do not edit.",
             "// Word times are the REAL ElevenLabs alignment; captions sync exactly.",
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
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--engine", choices=("elevenlabs", "kokoro"), default="elevenlabs",
                    help="TTS backend: elevenlabs (API, default) or kokoro (local, $0)")
    ap.add_argument("--mux", help="optional rendered mp4 to mux the voice onto (-voiced.mp4)")
    ap.add_argument("--emit-ts", help="write the VO (with exact word times) as a TS module, e.g. remotion/src/shots/short-2/vo.gen.ts")
    ap.add_argument("--lang", default="en",
                    help="language code for the forced-alignment fallback (align_words.py --lang); "
                         "use 'he' for Hebrew voice. Does not affect TTS, only the WhisperX aligner.")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify", action="store_true",
                    help="print measured integrated LUFS + true peak of the final voice.wav (pyloudnorm)")
    args = ap.parse_args()

    beats_path = os.path.abspath(args.beats)
    beats = json.load(open(beats_path, encoding="utf-8"))
    vo = beats["vo"]
    total = float(beats["format"]["durationSec"])
    vdir = os.path.join(os.path.dirname(beats_path), "voice")
    os.makedirs(vdir, exist_ok=True)

    key = load_env().get("ELEVENLABS_API_KEY")
    if args.engine == "elevenlabs" and not key and not args.dry_run:
        sys.exit("ELEVENLABS_API_KEY not found in .env")

    # Kokoro pipeline is constructed once per process (model + voice load), not per line.
    kokoro = None
    if args.engine == "kokoro" and not args.dry_run:
        kokoro = build_kokoro_pipeline()

    fitted = []  # (path, start_sec, fitted_dur)
    print(f"{'line':4s} {'start':>6s} {'window':>6s} {'clip':>6s} {'tempo':>5s}  text")
    for i, line in enumerate(vo):
        start = float(line["start"])
        next_start = float(vo[i + 1]["start"]) if i + 1 < len(vo) else total - 0.3
        window = next_start - start - 0.05
        tts_text = line.get("tts", line["text"])  # optional tagged/phonetic variant for TTS
        # engine in the key so the ElevenLabs and Kokoro caches never collide
        h = hashlib.sha1(f"{args.engine}|{args.voice}|{args.model}|{tts_text}".encode()).hexdigest()[:8]
        raw = os.path.join(vdir, f"line-{i:02d}-{h}.mp3")
        fit = os.path.join(vdir, f"line-{i:02d}-{h}-fit.wav")

        if args.dry_run:
            print(f"{i:4d} {start:6.2f} {window:6.2f}      ?     ?  {tts_text}")
            continue

        if args.force or not os.path.exists(raw) or not os.path.exists(raw + ".words.json"):
            if args.engine == "kokoro":
                # Kokoro reads [audio tags] literally (no delivery steering) and ignores
                # ElevenLabs prev/next stitching — strip tags, pass no context.
                tts_line_kokoro(kokoro, args.voice, tts_text, raw, args.lang)
            else:
                prev_text = vo[i - 1].get("tts", vo[i - 1]["text"]) if i > 0 else None
                next_text = vo[i + 1].get("tts", vo[i + 1]["text"]) if i + 1 < len(vo) else None
                tts_line(key, args.voice, args.model, tts_text, prev_text, next_text, raw, args.lang)

        dur = probe_duration(raw)
        tempo = 1.0
        if dur > window:
            tempo = min(MAX_ATEMPO, dur / window)
        if args.force or not os.path.exists(fit):
            run([ffw.path(), "-y", "-v", "error", "-i", raw,
                 "-filter:a", f"atempo={tempo:.4f}", "-ar", "44100", "-ac", "2", fit])
        fdur = probe_duration(fit)
        overflow = " OVERFLOW" if fdur > window + 0.05 else ""
        print(f"{i:4d} {start:6.2f} {window:6.2f} {fdur:6.2f} {tempo:5.2f}  {line['text']}{overflow}")
        line["end"] = round(start + fdur, 2)
        # exact word times: raw alignment, scaled by the tempo fit, offset to global
        raw_words = json.load(open(raw + ".words.json", encoding="utf-8"))
        line["words"] = [{"w": w["w"],
                          "start": round(start + w["start"] / tempo, 3),
                          "end": round(start + w["end"] / tempo, 3)} for w in raw_words]
        fitted.append((fit, start, fdur))

    if args.dry_run:
        return

    # assemble: delay each line to its start, sum (lines never overlap), pad to length.
    # Written to a temp wav FIRST so the mastering chain can measure the assembled audio,
    # then apply cleanup + two-pass LINEAR loudnorm (no dynamic lookahead dead-air).
    voice_wav = os.path.join(vdir, "voice.wav")
    assembled_wav = os.path.join(vdir, "voice.assembled.wav")
    inputs, parts = [], []
    for j, (path, start, _d) in enumerate(fitted):
        inputs += ["-i", path]
        ms = int(round(start * 1000))
        parts.append(f"[{j}:a]adelay={ms}|{ms}[a{j}]")
    chain = "".join(f"[a{j}]" for j in range(len(fitted)))
    fc = ";".join(parts) + f";{chain}amix=inputs={len(fitted)}:normalize=0,apad,atrim=0:{total}[out]"
    run([ffw.path(), "-y", "-v", "error", *inputs, "-filter_complex", fc,
         "-map", "[out]", "-ar", "44100", "-ac", "2", assembled_wav])

    # two-pass LINEAR loudnorm: measure the assembled wav (pass 1), then apply the
    # cleanup chain + linear loudnorm into the final voice.wav (pass 2).
    measured = _measure_loudnorm(assembled_wav)
    run([ffw.path(), "-y", "-v", "error", "-i", assembled_wav,
         "-af", _cleanup_chain(measured), "-ar", "44100", "-ac", "2", voice_wav])
    os.remove(assembled_wav)
    print(f"voice track -> {os.path.relpath(voice_wav, ROOT)}")

    if args.verify:
        _verify(voice_wav)

    beats["voiceStatus"] = f"{args.engine}:{args.voice}"
    json.dump(beats, open(beats_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"actual line timings + word maps written back -> {os.path.relpath(beats_path, ROOT)}")

    if args.emit_ts:
        emit_ts(vo, rp := os.path.abspath(args.emit_ts))
        print(f"VO TS module -> {os.path.relpath(rp, ROOT)}")

    if args.mux:
        out = os.path.splitext(args.mux)[0] + "-voiced.mp4"
        run([ffw.path(), "-y", "-v", "error", "-i", args.mux, "-i", voice_wav,
             "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-t", str(total), out])
        print(f"voiced preview -> {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
