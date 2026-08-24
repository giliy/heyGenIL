#!/usr/bin/env python3
"""nikkud_g2p.py — Phonikud nikkud->IPA pronunciation front-end for Hebrew TTS.

This is the G2P (grapheme-to-phoneme) disambiguation layer the research doc
research/hebrew-avatar/03-hebrew-tts.md §2 ranks as the documented answer for ambiguous
Hebrew words and Hebrew<->English code-switching. It sits IN FRONT of a TTS engine:
unpointed modern Hebrew goes in, a pronunciation-guided string comes out.

It is a TTS tool — DISTINCT from tools/nikkud.py, which is the reading track's
deterministic *segmentation* engine for already-pointed pedagogical text (deliberately
ML-free: a wrong vowel taught to a child is the worst case). Here the goal is making a
TTS voice pronounce ambiguous adult-facing text correctly, so a neural nakdan is in scope.

Two output modes:

  nikkud   (default, for edge-tts) — pointed Hebrew text. edge-tts is a plain-text TTS:
            it has no phoneme input (custom SSML was removed), so IPA would be read aloud
            as gibberish. The only pronunciation handle we have is feeding it nikkudded
            Hebrew, which steers its internal G2P to the right vowels/stress. THIS is the
            mode gen_voice_edge.py --nikkud uses.

  ipa      (for a phoneme-aware engine) — modern spoken IPA (5 vowels, 24 consonants,
            stress `ˈ`). edge-tts CANNOT consume this; it is the front-end for the future
            Chatterbox lane (thewh1teagle/phonikud-chatterbox feeds exactly this IPA).
            Latin words get a small grapheme fallback so a code-switched line yields one
            continuous phoneme string.

Needs the Phonikud ONNX nakdan model, fetched per-machine into models/phonikud/ by
tools/fetch_phonikud.py (CC BY 4.0, ~300MB, gitignored). Pointed->IPA conversion
(phonikud.phonemize) is a rule-based FST and always works; only nikkud PREDICTION on
unpointed text needs the model. Runs in the .venv-voice312 venv (Python 3.12).

Usage:
  python tools/nikkud_g2p.py "אני אוהב לקרוא ספר"            # -> pointed Hebrew
  python tools/nikkud_g2p.py "תשלחו לי email ב-Slack"        # code-switch
  python tools/nikkud_g2p.py "אני אוהב לקרוא ספר" --ipa     # -> IPA
  echo "אני אוהב לקרוא ספר" | python tools/nikkud_g2p.py -  # stdin
"""
import os
import re
import sys

# Hebrew on stdout: force UTF-8 so the console (cp1252) doesn't choke on nikkud/IPA marks.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = os.path.join(ROOT, "models", "phonikud", "phonikud-1.0.int8.onnx")

# Phonikud's add_diacritics() output mixes real nikkud with its internal annotations:
#   '|'      (Txiliyot prefix marker) — not real nikkud; a TTS reads/skips it unpredictably.
#   U+05AB   ole — the Hat'ama STRESS marker (real Hebrew mark, but phonikud-internal here).
#   U+05BD   meteg — the vocal-shva marker phonikud uses.
# edge-tts is the consumer, and it reads standard pointed Hebrew. We keep the real vowel
# points but must decide on the stress/prefix annotations. The prefix bar is always stripped.
PREFIX_BAR = "|"
OLE = "֫"     # Hat'ama stress marker
METEG = "ֽ"   # vocal-shva marker phonikud emits


def _load_model(model_path=DEFAULT_MODEL):
    """Import phonikud_onnx lazily so --help / non-Hebrew paths never pay the load cost."""
    if not os.path.exists(model_path):
        sys.exit(
            "Phonikud ONNX nakdan model not found:\n  " + model_path + "\n"
            "Fetch it per-machine (CC BY 4.0, ~300MB, gitignored):\n"
            "  .venv-voice312\\Scripts\\python.exe tools/fetch_phonikud.py"
        )
    from phonikud_onnx import Phonikud
    return Phonikud(model_path)


def add_nikkud(text, model=None, keep_stress=False):
    """Unpointed Hebrew -> pointed Hebrew for edge-tts.

    Always strips the Txiliyot prefix bar (phonikud-internal). By default also strips the
    ole/meteg stress + vocal-shva marks, leaving STANDARD pointed Hebrew — the safest input
    for a plain-text TTS. keep_stress=True keeps ole/meteg (a phoneme-aware consumer that
    wants the stress can opt in; edge-tts should NOT, it can misread them).
    """
    ph = model if model is not None else _load_model()
    out = ph.add_diacritics(text)
    out = out.replace(PREFIX_BAR, "")
    if not keep_stress:
        out = out.replace(OLE, "").replace(METEG, "")
    return out


def _latin_fallback(word):
    """Rough English grapheme->IPA for code-switched Latin words in the IPA output.

    Only used for the phoneme-aware lane; Hebrew letters never reach this. Deliberately
    crude (a phonikud-chatterbox consumer replaces it with a real English G2P) — its job is
    to keep a mixed line as ONE continuous IPA string instead of stranding Latin glyphs.
    """
    table = {
        "a": "a", "b": "b", "c": "k", "d": "d", "e": "e", "f": "f", "g": "ɡ", "h": "h",
        "i": "i", "j": "dʒ", "k": "k", "l": "l", "m": "m", "n": "n", "o": "o",
        "p": "p", "q": "k", "r": "ʁ", "s": "s", "t": "t", "u": "u", "v": "v", "w": "w",
        "x": "ks", "y": "j", "z": "z",
    }
    # a couple of common digraphs first
    w = word.lower()
    w = w.replace("ch", "χ").replace("sh", "ʃ").replace("th", "θ").replace("ph", "f")
    return "".join(table.get(c, "") for c in w)


def phonemize_text(text, model=None):
    """Unpointed Hebrew -> modern spoken IPA (phoneme-aware-engine front-end).

    edge-tts CANNOT read this — do not pass it to gen_voice_edge. For the future Chatterbox
    lane. Latin words go through _latin_fallback so code-switching yields one IPA string.
    """
    pointed = add_nikkud(text, model=model, keep_stress=True)
    from phonikud import phonemize
    return phonemize(pointed, fallback=_latin_fallback)


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Phonikud nikkud/IPA front-end for Hebrew TTS.")
    ap.add_argument("text", help="unpointed Hebrew (use '-' to read from stdin)")
    ap.add_argument("--ipa", action="store_true",
                    help="emit IPA phonemes (phoneme-aware engine; NOT for edge-tts)")
    ap.add_argument("--keep-stress", action="store_true",
                    help="keep ole/meteg stress marks in nikkud output (default strips)")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="path to phonikud ONNX model")
    args = ap.parse_args()

    text = sys.stdin.read() if args.text == "-" else args.text
    text = text.strip()
    if not text:
        return
    model = _load_model(args.model)
    if args.ipa:
        print(phonemize_text(text, model=model))
    else:
        print(add_nikkud(text, model=model, keep_stress=args.keep_stress))


if __name__ == "__main__":
    main()
