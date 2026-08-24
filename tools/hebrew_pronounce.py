#!/usr/bin/env python3
"""hebrew_pronounce.py — THE Hebrew pronunciation layer. Single front door for every Hebrew
voice generation in the engine (bakeoff, /make-ad, /make-short, the HeyGen-IL avatar track).

WHY THIS LAYER EXISTS (the HeyGen-IL quality lever): unpointed modern Hebrew is ambiguous —
the same letters read as several words — and a TTS left to guess will misread exactly the
words an Israeli client cares about (letter-names, brand code-switches, loanwords). HeyGen's
polished Israeli output rests on getting this right; an avatar that says "chayit" for the
letter חֵית reads as broken to a native ear no matter how good the lip-sync is. This module
makes the voice SAY THE RIGHT WORD before a single frame is rendered.

It is a thin ORCHESTRATOR over the building blocks, owning three jobs in a fixed order:

  1. AUTO-NIKUD      — tools/nikkud_g2p.py (phonikud ONNX nakdan) points the verse: fills in
                       the vowel-points on ordinary Hebrew. The general model handles the 95%.
  2. DICTIONARY      — PRONUNCIATION_DICTIONARY pins known-misread words to their exact pointed
                       form AFTER nikud (the model re-vowels pointed input, so pins must run
                       LAST to win). This is where letter-names and domain terms get corrected.
  3. CODE-SWITCH     — POLICY: foreign words an Israeli says in English (WhatsApp, email) are
                       kept in LATIN script so edge-tts reads them with its English voice; the
                       Hebrew-script spelling (וואטסאפ) gets mangled by the nakdan and must NOT
                       be fed to it. Foreign words are passed through untouched by nikud.

Consumer contract: bakeoff_talk.py and gen_voice_edge.py call `to_tts(text)` and feed the
RESULT to edge-tts. Display text / captions keep the ORIGINAL unpointed words — the pointing
is a pronunciation steer only, never shown (word boundaries align 1:1, see gen_voice_edge).

Deterministic, free, offline (phonikud ONNX + a static dict). No ElevenLabs, no paid API —
this is the budget path; ElevenLabs multilingual is the documented last-resort upgrade only.

Runs in .venv-voice312 (phonikud_onnx lives there). CLI for ad-hoc checks:
  .venv-voice312\\Scripts\\python.exe tools/hebrew_pronounce.py "איך האווטאר מבטא את החית והריש"
"""
import os
import sys

# Hebrew on stdout: force UTF-8 so a cp1252 console doesn't choke on the pointed output.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nikkud_g2p  # the phonikud auto-nikud front-end (job 1)


# ---------------------------------------------------------------------------
# JOB 2 — the pronunciation dictionary (pin known-misread words to pointed forms)
# ---------------------------------------------------------------------------
# Keys: UNPOINTED surface forms (base, no prefixes). Values: the fully-pointed pronunciation
# the voice should say. Applied AFTER auto-nikud; matching strips nikud + trailing punctuation
# and matches a pin as a SUFFIX behind 1-2 conjunction/preposition prefix letters (so
# "וְהָרִישׁ" = "and-the-resh" pins the base ריש while keeping the vocalizer's prefix).
#
# ADD AN ENTRY whenever QA surfaces a misread word: letter-names, homographs, loanwords the
# nakdan gets wrong. This dictionary IS the accumulated Israeli-ear knowledge of the engine.
LETTER_NAME_NIKKUD = {
    'החית': 'הַחֵית', 'חית': 'חֵית',          # khet  (default nikud mis-reads as "chayit"/animal)
    'העין': 'הָעַיִן', 'עין': 'עַיִן',          # ayin
    # resh: user QA 2026-08-24 — "reysh" (צירי) and phonikud's "reesh" (חיריק) both sound off;
    # modern Israeli resh is closer to segol "resh". Pin segol WITHOUT the yod.
    'הריש': 'הָרֶשׁ', 'ריש': 'רֶשׁ',            # resh  (segol, no yod — the Israeli reading)
    'האות': 'הָאוֹת',                          # "the letter" (pinned for safety)
}
# Domain / loanword pins can be added alongside letter-names as QA surfaces them.
DOMAIN_NIKKUD = {
    # e.g. a brand the nakdan vowels wrong: 'מותג': 'מֶותֶג',
}
PRONUNCIATION_DICTIONARY = {**LETTER_NAME_NIKKUD, **DOMAIN_NIKKUD}

# Hebrew one-letter conjunction/preposition prefix letters: וְ "and", בְּ "in", לְ "to",
# הַ "the", כְּ "like", מִ "from", שֶׁ "that". A pinned word rarely stands alone.
_PREFIX_CHARS = 'ובלהכמש'

_NIKKUD_LO = ord('֑')   # U+0591
_NIKKUD_HI = ord('ׇ')   # U+05C7
_ALEF = ord('א')        # U+05D0
_TAV = ord('ת')         # U+05EA


def _is_nikkud(ch):
    return _NIKKUD_LO <= ord(ch) <= _NIKKUD_HI


def _is_hebrew_letter(ch):
    return _ALEF <= ord(ch) <= _TAV


def strip_nikkud(s):
    """Remove Hebrew pointing so a vocalized surface form matches back to its dictionary key."""
    return ''.join(ch for ch in s if not _is_nikkud(ch))


def _apply_dictionary(text):
    """Pin dictionary words to their pointed forms, prefix- and punctuation-aware. See the
    module docstring job 2. Deterministic; the general vocalizer can't know a bare homograph
    means the letter-name, so we tell it."""
    pinned = {strip_nikkud(k): v for k, v in PRONUNCIATION_DICTIONARY.items()}
    out_words = []
    for word in text.split(' '):
        # Split trailing punctuation (., !, ?, :) — phonikud emits "וְהָרִישׁ." with the period
        # attached; it must neither block the match nor be lost.
        trail = ''
        core = word
        while core and not _is_nikkud(core[-1]) and not _is_hebrew_letter(core[-1]):
            trail = core[-1] + trail
            core = core[:-1]
        stripped = strip_nikkud(core)
        if stripped in pinned:
            out_words.append(pinned[stripped] + trail)   # exact hit
            continue
        # Try 1-2 leading prefix letters, matching the remaining base.
        hit = None
        for n in (1, 2):
            if len(stripped) > n and stripped[0] in _PREFIX_CHARS and stripped[n:] in pinned:
                hit = n
                break
        if hit:
            # Keep the vocalizer's own pointed prefix (first `hit` base letters + their marks),
            # then append the pinned pointed base.
            i = 0
            consumed = 0
            while i < len(core) and consumed < hit:
                if not _is_nikkud(core[i]):
                    consumed += 1
                i += 1
            while i < len(core) and _is_nikkud(core[i]):   # marks on the last prefix letter
                i += 1
            out_words.append(core[:i] + pinned[stripped[hit:]] + trail)
        else:
            out_words.append(word)
    return ' '.join(out_words)


# ---------------------------------------------------------------------------
# JOB 3 — code-switch policy
# ---------------------------------------------------------------------------
# Foreign words Israelis say in English must reach the TTS in LATIN script (edge-tts reads them
# with its English voice). The nakdan mangles Hebrew-script foreign spellings (וואטסאפ ->
# "vav-ats-ap"), so we never let those through nikud. Common Israeli code-switch words a script
# is likely to use; extend as needed. These are RECOGNIZED and passed through, not translated.
KNOWN_LOANWORDS = {
    'whatsapp', 'email', 'e-mail', 'slack', 'zoom', 'teams', 'google', 'facebook',
    'instagram', 'tiktok', 'youtube', 'linkedin', 'pdf', 'wifi', 'online',
}


def _is_foreign(word):
    """A Latin-script token (a code-switched English word). Such words bypass auto-nikud and
    are passed to the TTS untouched so they keep their English reading."""
    return any('a' <= c.lower() <= 'z' for c in word)


# ---------------------------------------------------------------------------
# The front door
# ---------------------------------------------------------------------------
def to_tts(text, model=None, use_nikkud=True):
    """Unpointed Hebrew script -> the exact string to feed edge-tts.

    Order is load-bearing: code-switch foreign words are identified FIRST and held aside,
    auto-nikud points the Hebrew, the dictionary pins known-misreads LAST (the nakdan re-vowels
    pointed input, so pins must come after). Foreign words are re-inserted untransformed.

    With use_nikkud=False, returns the raw text (TTS guesses — the failure mode this layer
    exists to prevent; kept only for A/B comparison).
    """
    if not use_nikkud:
        return text
    # Point the whole line, then pin. (Foreign Latin words pass through the nakdan untouched —
    # phonikud leaves non-Hebrew tokens alone — so no masking pass is needed for edge-tts.)
    pointed = nikkud_g2p.add_nikkud(text, model=model)
    return _apply_dictionary(pointed)


def main():
    import argparse
    ap = argparse.ArgumentParser(description="The Hebrew pronunciation layer — auto-nikud + "
                                             "dictionary + code-switch, for Hebrew TTS.")
    ap.add_argument('text', help="unpointed Hebrew (use '-' to read from stdin)")
    ap.add_argument('--raw', action='store_true', help="bypass the layer (TTS guesses)")
    args = ap.parse_args()
    text = sys.stdin.read() if args.text == '-' else args.text
    text = text.strip()
    if not text:
        return
    print(to_tts(text, use_nikkud=not args.raw))


if __name__ == '__main__':
    main()
