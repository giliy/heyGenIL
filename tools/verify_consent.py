#!/usr/bin/env python3
"""
verify_consent.py — HeyGen-IL spoken-consent verifier for digital-twin avatars.

The anti-impersonation gate: before a user's 2-min driver video can become a lip-synced
talking head, they must record themselves speaking a unique Hebrew consent phrase. This tool
decides whether a submitted consent clip actually says the phrase.

TWO TIERS (production-first, dev-safe):
  TIER 1 (real ASR gate): WhisperX transcribes the clip and fuzzy-matches the transcript
    against the issued Hebrew phrase. Runs on .venv-voice312 (whisperx + torch). This is the
    production verdict.
  TIER 2 (deterministic fallback): when whisperx can't transcribe (no ASR model cached /
    download blocked), fall back to the deterministic check that the clip is a REAL spoken
    recording — it has an audio stream, is non-silent (RMS floor), and lasts at least
    MIN_SECS. Verdict 'verified' with method:'fallback'. The fallback trusts that the
    consent clip was recorded in-app after the challenge; the ASR gate is the strict upgrade.

Usage (repo root cwd):
    python tools/verify_consent.py --clip <consent.(mp4|mov|webm)> --phrase "הבנתי אני מסכים ..." [--json]
Exit code 0 = verified, 1 = rejected, 2 = error. Prints a JSON verdict line.
"""
import argparse
import json
import os
import sys
import tempfile

# Windows consoles default to cp1252 and can't print Hebrew — the worker parses the last
# `{`-line of stdout, so UTF-8 must reach it intact. Force UTF-8 for stdout/stderr.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ffw  # noqa: E402  (ensures a full ffmpeg/ffprobe is on PATH for whisperx + ffmpeg below)

MIN_SECS = 1.5        # an unspoken/empty consent clip shorter than this is rejected
RMS_FLOOR_DB = -45.0  # below this overall RMS the clip is (near-)silent → rejected
MIN_WORD_MATCH = 0.5  # tier-1: at least 50% of the phrase words must appear in the transcript


def _ffprobe(path, *args):
    import subprocess
    return subprocess.run([ffw.ffprobe_path(), *args, path], capture_output=True, text=True)


def _duration(path):
    r = _ffprobe(path, '-v', 'error', '-show_entries', 'format=duration',
                 '-of', 'json')
    try:
        return float(json.loads(r.stdout)['format']['duration'])
    except Exception:
        return None


def _has_audio(path):
    r = _ffprobe(path, '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type',
                 '-of', 'json')
    try:
        streams = json.loads(r.stdout).get('streams', [])
        return any(s.get('codec_type') == 'audio' for s in streams)
    except Exception:
        return False


def _overall_rms(path):
    """Mean loudness of the clip in dB (negative); None if it can't be measured."""
    import subprocess
    r = subprocess.run(
        [ffw.path(), '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True, text=True,
    )
    out = r.stderr
    for line in out.splitlines():
        if 'mean_volume' in line:
            try:
                return float(line.split('mean_volume:')[1].split('dB')[0].strip())
            except Exception:
                return None
    return None


def _extract_wav(clip):
    """Extract mono 16k wav for whisperx into a temp file; return path or None."""
    import subprocess
    fd, out = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    r = subprocess.run(
        [ffw.path(), '-hide_banner', '-y', '-i', clip, '-ar', '16000', '-ac', '1', out],
        capture_output=True, text=True,
    )
    return out if r.returncode == 0 else None


def _transcribe_hebrew(wav):
    """Return the (lowercased, normalized) transcript via whisperx, or None on any failure.

    Skips the ASR attempt entirely when no whisper ASR model is cached locally AND offline —
    avoids both a multi-GB download attempt AND the heavy torch/whisperx import (the cached
    wav2vec2 model is an ALIGN model, not an ASR transcriber). Set VERIFY_CONSENT_ASR=1 to
    force the attempt (e.g. once a whisper model is cached in production).
    """
    # Bail early unless a whisper ASR model is cached (else load_model would try to download GBs).
    hf_cache = os.path.expanduser(os.path.join('~', '.cache', 'huggingface', 'hub'))
    cached = [d for d in (os.listdir(hf_cache) if os.path.isdir(hf_cache) else [])
              if 'whisper' in d.lower() or 'faster-whisper' in d.lower()]
    if not cached and os.environ.get('VERIFY_CONSENT_ASR') != '1':
        return None
    try:
        import whisperx
        import torch
    except Exception:
        return None
    try:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        compute = 'float16' if device == 'cuda' else 'int8'
        model = whisperx.load_model('large-v3', device=device, compute_type=compute)
        # whisperx.load_audio() shells out to a BARE `ffmpeg` that isn't on PATH in this env
        # (ffw resolves the full path, but whisperx doesn't use it) → FileNotFoundError. The
        # caller already decoded a 16k mono wav via ffw; load it directly with soundfile and
        # hand whisperx the float32 numpy array — bypassing whisperx's ffmpeg call entirely.
        import soundfile as sf
        import numpy as np
        audio, sr = sf.read(wav, dtype='float32', always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)  # downmix to mono just in case
        if sr != 16000:  # should already be 16k from _extract_wav; resample defensively
            import torchaudio
            audio = torchaudio.functional.resample(
                torch.from_numpy(np.ascontiguousarray(audio)), sr, 16000).numpy()
        audio = np.ascontiguousarray(audio, dtype=np.float32)
        result = model.transcribe(audio, language='he', batch_size=8)
        text = ' '.join(seg.get('text', '') for seg in result.get('segments', [])).lower()
        # An empty transcript from a successful ASR pass means the clip has no speech — return
        # '' (not None) so the caller treats it as a real ASR REJECT, not an ASR-unavailable fallback.
        return text
    except Exception:
        return None


def _norm_he(s):
    # strip niqqud + punctuation, collapse whitespace
    for ch in 'ְֱֲֳִֵֶַָֹֺֻּֽ֑֖֛֢֣֤֥֦֧֪֚֭֮֒֓֔֕֗֘֙֜֝֞֟֠֡֨֩֫֬֯־ֿ׀ׁׂ׃ׅׄ׆ׇ':
        s = s.replace(ch, '')
    import re
    s = re.sub(r'[^֐-׿a-z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def _fuzzy_phrase_match(phrase, transcript):
    p_words = [w for w in _norm_he(phrase).split() if w]
    t = set(_norm_he(transcript).split())
    if not p_words:
        return True
    hits = sum(1 for w in p_words if w in t)
    return hits / len(p_words) >= MIN_WORD_MATCH


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--clip', required=True, help='consent clip path (.mp4/.mov/.webm)')
    ap.add_argument('--phrase', required=True, help='the issued Hebrew consent phrase')
    ap.add_argument('--json', action='store_true', help='emit machine-readable verdict JSON')
    args = ap.parse_args()

    def verdict(ok, method, reason, extra=None):
        out = {'ok': ok, 'method': method, 'reason': reason, **(extra or {})}
        if args.json:
            print(json.dumps(out, ensure_ascii=False))
        else:
            print(f"{'VERIFIED' if ok else 'REJECTED'} [{method}] {reason}")
        sys.exit(0 if ok else 1)

    clip = args.clip
    if not os.path.exists(clip):
        verdict(False, 'error', 'clip not found', {'detail': clip})

    # Deterministic sanity: real audio stream, plausible duration, non-silent.
    dur = _duration(clip)
    if not _has_audio(clip):
        verdict(False, 'fallback', 'consent clip has no audio stream')
    if dur is None or dur < MIN_SECS:
        verdict(False, 'fallback', f'consent clip too short ({dur}s < {MIN_SECS}s)')
    rms = _overall_rms(clip)
    if rms is None:
        verdict(False, 'fallback', 'could not measure consent clip loudness')
    if rms < RMS_FLOOR_DB:
        verdict(False, 'fallback', f'consent clip silent (RMS {rms:.1f}dB < {RMS_FLOOR_DB}dB)')

    # TIER 1: whisperx Hebrew transcription + fuzzy phrase match.
    wav = _extract_wav(clip)
    transcript = _transcribe_hebrew(wav) if wav else None
    if transcript is not None:
        # ASR ran. '' means no speech detected → reject. Non-empty → fuzzy-match the phrase.
        if transcript and _fuzzy_phrase_match(args.phrase, transcript):
            verdict(True, 'asr', 'spoken phrase matched', {'transcript': transcript})
        reason = 'no speech detected in consent clip' if not transcript else 'spoken phrase did NOT match'
        verdict(False, 'asr', reason, {'transcript': transcript})
    elif wav:
        # ASR unavailable (no whisper model cached / download blocked) — deterministic fallback.
        verdict(True, 'fallback', 'ASR unavailable; non-silent spoken clip accepted', {'duration': dur})


if __name__ == '__main__':
    main()
