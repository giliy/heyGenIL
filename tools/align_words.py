#!/usr/bin/env python3
"""
align_words.py — local forced word aligner (WhisperX) for the plain-TTS fallback path.

When a TTS vendor returns NO per-word timestamps (gen_voice.py's plain-fallback `words=[]`
branch), this tool fills `.words.json` in the existing `[{w, start, end}]` shape by running
a local forced aligner over the spoken clip + its transcript.

ENGINE: whisperx.align() (BSD-2-Clause) — on English it drives torchaudio's
WAV2VEC2_ASR_BASE_960H (wav2vec2-asr-base-960h). CPU-only run is ~10-30s per short line.
Source: https://github.com/m-bain/whisperX

INSTALL (heavy, CPU wheel is fine):
    pip install whisperx
    # torch CPU is fine; whisperx pulls torch/torchaudio/faster-whisper.
    # NOTE: whisperx pins ctranslate2==4.4.0 which needs Python < 3.13 — if it won't
    # install on your interpreter, this tool degrades gracefully (gen_voice falls back to
    # estimated timing) and everything else in the pipeline still works.

The CORE pipeline (gen_voice.py, etc.) stays stdlib-only: whisperx is a LAZY import inside
THIS tool only. gen_voice shells out to this script when whisperx is importable, else keeps
the empty word map.

HEBREW (--lang he): uses ivrit-ai's whisper-large-v3-turbo (Apache-2.0, CTranslate2 /
faster-whisper) instead of whisperx's default Hebrew aligner. Rationale: (1) whisperx's
`he` default (`imvladikon/wav2vec2-xls-r-300m-hebrew`) declares NO license on Hugging Face
(license-ambiguous — risky to ship); ivrit-ai is Apache-2.0. (2) ivrit-ai is a *transcriber*,
so it also recovers the spoken text when the passed transcript drifts from the audio
(wav2vec2 forced alignment can't). Measured on 4 Hebrew edge-tts clips: mean abs word-timing
error vs edge-tts native boundaries ≈ 0.095s (~3 frames @30fps), on par with wav2vec2
(~0.090s). Falls back to whisperx if faster-whisper isn't installed.

Usage:
    python tools/align_words.py <audio.(mp3|wav)> "<spoken text>" --out <audio>.words.json [--lang en]
    python tools/align_words.py <audio> "<text>" --out ... --lang he --aligner whisperx   # force old path
"""
import argparse
import json
import os
import sys

# WhisperX's load_audio() shells out to a bare `ffmpeg` subprocess with no path resolver.
# On this box ffmpeg is NOT on PATH, and the first ffmpeg that IS visible can be the
# Remotion-bundled minimal build (no audio filters). Prepend the repo's full ffmpeg dir
# (tools/bin, resolved by ffw.py) so the subprocess finds a full build. Self-contained:
# no caller env needed. See tools/ffw.py for why the minimal build must be avoided.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
try:
    import ffw
    _ffdir = os.path.dirname(ffw.path())
    os.environ["PATH"] = _ffdir + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass  # ffw/bootstrap failure must not break the aligner; whisperx will surface a clear error


IVRIT_MODEL = "ivrit-ai/whisper-large-v3-turbo-ct2"  # Apache-2.0; CTranslate2/faster-whisper


def _monotonic(out):
    """Force strictly non-decreasing timing; downstream consumers rely on it."""
    for i in range(1, len(out)):
        if out[i]["start"] < out[i - 1]["end"]:
            out[i]["start"] = out[i - 1]["end"]
        if out[i]["end"] < out[i]["start"]:
            out[i]["end"] = out[i]["start"]
    return out


def align_hebrew_ivrit(audio_path):
    """Hebrew via ivrit-ai whisper-large-v3-turbo (Apache-2.0), word timestamps.

    Transcriber (not forced aligner): recovers the spoken text too, so it tolerates a
    passed transcript that drifted from the audio. Returns [{w,start,end}] or None if
    faster-whisper is unavailable (caller falls back to whisperx)."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    model = WhisperModel(IVRIT_MODEL, device="cpu", compute_type="int8")
    segs, _info = model.transcribe(audio_path, language="he", word_timestamps=True)
    out = []
    for s in segs:
        for w in (s.words or []):
            word = (w.word or "").strip()
            if not word or w.start is None or w.end is None:
                continue
            out.append({"w": word, "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3)})
    return _monotonic(out)


def align(audio_path, text, lang="en", aligner="auto"):
    """Run forced word alignment; return [{w,start,end}] (3-decimal rounds).

    Hebrew (`lang="he"`) prefers ivrit-ai whisper-turbo (Apache-2.0) under aligner="auto";
    pass aligner="whisperx" to force the old wav2vec2 path. English/others use whisperx."""
    if lang == "he" and aligner in ("auto", "ivrit"):
        out = align_hebrew_ivrit(audio_path)
        if out is not None:
            return out
        if aligner == "ivrit":
            sys.exit("align_words: --aligner ivrit requested but faster-whisper is not "
                     "installed (pip install faster-whisper).")
        # auto: fall through to whisperx

    # Lazy import — the core pipeline must stay stdlib-only and must work without whisperx.
    try:
        import whisperx
        import torchaudio
    except ImportError as e:
        sys.exit(f"align_words: missing dependency ({e}) — run `pip install whisperx` "
                 "to enable local forced alignment.")

    device = "cpu"

    # Duration (seconds) of the clip, so the single segment spans the whole clip.
    info = torchaudio.info(audio_path)
    dur = info.num_frames / info.sample_rate

    # A single segment spanning the clip, transcripted with the given text.
    segments = [{"start": 0.0, "end": dur, "text": text}]

    # Load the align model once (WAV2VEC2_ASR_BASE_960H on English; whisperx resolves
    # other language codes to their default aligner — e.g. 'he' -> a Hebrew wav2vec2 model).
    model, metadata = whisperx.load_align_model(language_code=lang, device=device)

    # audio may be a filepath; whisperx loads + resamples internally.
    result = whisperx.align(segments, model, metadata, audio_path, device=device)
    word_segments = result.get("word_segments", [])

    out = []
    for ws in word_segments:
        w = (ws.get("word") or "").strip()
        start = ws.get("start")
        end = ws.get("end")
        if not w or start is None or end is None:
            continue
        out.append({"w": w, "start": round(float(start), 3), "end": round(float(end), 3)})

    # Monotonic-safety: the aligner can occasionally emit an out-of-order segment.
    return _monotonic(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("audio", help="path to the audio clip (.mp3|.wav)")
    ap.add_argument("text", help="the spoken transcript to force-align")
    ap.add_argument("--out", required=True, help="output path for the .words.json file")
    ap.add_argument("--lang", default="en",
                    help="language code for the aligner (default: en). Hebrew ('he') uses "
                         "ivrit-ai whisper-turbo by default; whisperx resolves other codes.")
    ap.add_argument("--aligner", default="auto", choices=["auto", "ivrit", "whisperx"],
                    help="Hebrew engine: 'auto' = ivrit-ai with whisperx fallback (default); "
                         "'ivrit' = force ivrit-ai (errors if faster-whisper missing); "
                         "'whisperx' = force the old wav2vec2 path. Ignored for non-Hebrew.")
    args = ap.parse_args()

    audio_path = os.path.abspath(args.audio)
    if not os.path.exists(audio_path):
        sys.exit(f"align_words: no such file: {audio_path}")

    words = align(audio_path, args.text, lang=args.lang, aligner=args.aligner)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)
    print(f"align_words: {len(words)} words -> {os.path.relpath(args.out, os.getcwd())}")


if __name__ == "__main__":
    main()
