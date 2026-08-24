#!/usr/bin/env python3
"""nikkud.py — Hebrew pointed-text segmentation engine (stdlib-only, Python 3.10+).

The reading track's rule half of the "curated lexicon + rule engine" decision
(research/hebrew-reading/00-findings.md §3). The lexicon half lives in
tools/nikkud_data.py — a closed, teacher-vetted set. NO live ML nakdan in the
product path: a wrong vowel taught to a 5-year-old is the worst-case bug.

This module ONLY does deterministic text segmentation on already-pointed text:
  - graphemes():   one HEBREW LETTER + its following combining marks (Mn).
  - syllabify():   greedy-left CV/CVC split into צירופים (clusters).
  - helpers:       strip_to_base / nikkud_of / has_dagesh.

Segmentation spec (findings §3 — load-bearing, do not relax):
  - Grapheme = one letter + following combining marks. Dagesh (U+05BC) and the
    shin/sin dots (U+05C1/U+05C2) stay INSIDE the grapheme — ב vs בּ is
    pedagogically load-bearing (dagesh kal changes the sound).
  - Nikkud block = U+05B0–05BF + shin/sin U+05C1–05C2. Cantillation
    (U+0591–05AF, U+05C4–05C5) is EXCLUDED — never in decodable text.
  - Holam haser U+05BA == holam. Kubutz U+05BB vs shuruk (vav + dot) — shuruk is
    NOT a separate grapheme; the dot lives inside the vav's grapheme.
  - Maqaf (U+05BE) and whitespace = hard syllable boundaries. Geresh/gershayim
    (U+05F3/U+05F4) are preserved as punctuation, not vowels.

Pure stdlib (unicodedata). Runs under any Python 3.10+ — NO venv required.
"""
import unicodedata

# --- codepoint classes (findings §3 spec) -------------------------------------
NIKKUD = range(0x05B0, 0x05C0)        # U+05B0–05BF (incl. shva U+05B0, dagesh U+05BC)
SHIN_DOT = (0x05C1, 0x05C2)           # shin/sin dots stay with the letter
HEB_LETTER = range(0x05D0, 0x05EB)    # U+05D0–05EA incl. sofits (םןץףך)
MAQAF = 0x05BE
GERESH = (0x05F3, 0x05F4)             # punctuation, preserved (not vowels)

DAGESH = 0x05BC
SHVA = 0x05B0
HOLAM = 0x05B9
HOLAM_HASER = 0x05BA                  # == holam (findings §3)
KUBUTZ = 0x05BB

# Vowel-sign codepoint -> canonical nikkud key (matches nikkud_data.CURRICULUM keys
# where a row exists). Dagesh/shva/shin handled separately below.
_NIKKUD_NAMES = {
    0x05B0: "shva",
    0x05B1: "hataf-segol",
    0x05B2: "hataf-patach",
    0x05B3: "hataf-kamatz",
    0x05B4: "chirik",
    0x05B5: "tzere",
    0x05B6: "segol",
    0x05B7: "patach",
    0x05B8: "kamatz",
    0x05B9: "cholam",
    0x05BA: "cholam",                 # holam haser == holam
    0x05BB: "kubutz",
    0x05BC: "dagesh",
    0x05BD: "shva-na",                # rare explicit vocal-shva meteg-like mark
    0x05C1: "shin-dot",
    0x05C2: "sin-dot",
}

# Matres lectionis — resolve role from their nikkud, never a standalone vowel.
_MATRES = set("אהוי")


def _cp(ch):
    return ord(ch)


def _is_letter(ch):
    return _cp(ch) in HEB_LETTER


def _is_combining(ch):
    """True for nikkud/dagesh/shin-dot combining marks (Mn). Excludes cantillation
    (U+0591–05AF, U+05C4–05C5) — those never appear in decodable text."""
    cp = _cp(ch)
    if 0x0591 <= cp <= 0x05AF or cp in (0x05C4, 0x05C5):
        return False                                # cantillation — excluded
    if cp in NIKKUD or cp in SHIN_DOT:
        return True
    return unicodedata.combining(ch) > 0


def graphemes(word: str) -> list[str]:
    """Split a pointed word into graphemes: one HEBREW LETTER + its following
    combining marks. Dagesh and shin/sin dots stay INSIDE the grapheme (never
    split a letter from its nikkud). Maqaf/whitespace are hard breaks (skipped).

    >>> graphemes("בָּבָּא")
    ['בָּ', 'בָּ', 'א']
    >>> graphemes("שָׁלוֹם")
    ['שָׁ', 'ל', 'וֹ', 'ם']
    """
    out = []
    for ch in word:
        if _is_letter(ch):
            out.append(ch)                      # start a new grapheme
        elif _is_combining(ch):
            if out:
                out[-1] += ch                   # attach mark to the current grapheme
            # else: leading combining mark with no base letter — drop (defensive)
        elif _cp(ch) == MAQAF or ch.isspace():
            continue                            # hard boundary — not part of any grapheme
        elif _cp(ch) in GERESH:
            if out:
                out[-1] += ch                   # geresh/gershayim cling to their letter
        # other punctuation (., !, …) ignored
    return out


def strip_to_base(g: str) -> str:
    """Grapheme -> its bare base letter (drops all combining marks).

    >>> strip_to_base("בָּ")
    'ב'
    """
    return "".join(ch for ch in g if _is_letter(ch))


def nikkud_of(g: str) -> str | None:
    """Grapheme -> its vowel-sign name (a nikkud_data key where one exists).

    Returns the FIRST true vowel sign found (shva/dagesh/shin-dot are consonant
    modifiers, skipped when a real vowel is present). None if the grapheme carries
    no vowel sign.

    >>> nikkud_of("בָּ")
    'kamatz'
    >>> nikkud_of("בּ") is None or nikkud_of("בּ")
    True
    """
    vowel = None
    for ch in g:
        name = _NIKKUD_NAMES.get(_cp(ch))
        if name is None:
            continue
        # shva/dagesh/shin-dot are modifiers; keep scanning for a true vowel
        if name in ("shva", "dagesh", "shin-dot", "sin-dot", "shva-na"):
            if vowel is None and name == "shva":
                vowel = "shva"          # a lone shva IS the sign (shva video)
            continue
        return name
    return vowel


def has_dagesh(g: str) -> bool:
    """True if the grapheme carries dagesh (U+05BC). Pedagogically load-bearing: ב/בּ.

    >>> has_dagesh("בָּ")
    False
    >>> has_dagesh("בּ")
    True
    """
    return any(_cp(ch) == DAGESH for ch in g)


def _is_shva_na(grapheme: str, prev_full_vowel: bool, next_base: str | None) -> bool:
    """Shva na/nach heuristic (findings §3 — the hard case).

    Vocal (נע) when: word-initial (no prev grapheme) OR after a full vowel in an
    open syllable. Silent (נח) when: between identical consonants OR word-final.
    Default (ambiguous) → nach (the lexicon flag in nikkud_data overrides for the
    closed vetted set). This is a structural default only, never an invented vowel.
    """
    base = strip_to_base(grapheme)
    if next_base is None:
        return False                     # word-final shva -> nach
    if next_base == base:
        return False                     # between identical consonants -> nach
    if prev_full_vowel is False and base in _MATRES:
        return True                      # initial mater+shva edge -> na
    return prev_full_vowel               # after a full vowel in open syllable -> na


def _has_vowel_ahead(gs: list[str], i: int) -> bool:
    """True if some grapheme at/after index i carries a real vowel (or a dagesh).

    Decides onset vs coda for a bare (vowel-less) consonant: a following vowel means
    the consonant is the ONSET of that syllable; none means it is a word-final CODA
    closing the previous syllable.
    """
    return any(nikkud_of(g) is not None or has_dagesh(g) for g in gs[i:])


def syllabify(word: str) -> list[str]:
    """Greedy-left CV/CVC split into צירופים. Maqaf/whitespace = hard boundaries.

    A syllable is one onset consonant-grapheme + its vowel (a coda consonant joins
    a closed CVC). Matres (א ה ו י) are consumed as part of the preceding vowel's
    grapheme span, not opened as new syllables, when they carry no vowel of their own.

    The kamatz blend lexicon is the contract: these MUST round-trip:
      אַבָּא -> [אַ, בָּא]   מָמָא -> [מָ, מָא]   בָּבָּא -> [בָּ, בָּא]

    For an unvetted pointed word the split is structural (best-effort); the closed
    lexicon (nikkud_data.blendWords[].units) is authoritative and always wins.
    """
    gs = graphemes(word)
    if not gs:
        return []
    n = len(gs)
    out = []
    i = 0
    prev_full_vowel = False
    while i < n:
        g = gs[i]
        vowel = nikkud_of(g)
        # onset grapheme always starts a cluster
        cluster = g
        i += 1
        if vowel == "shva" and not _is_shva_na(g, prev_full_vowel, strip_to_base(gs[i]) if i < n else None):
            # silent shva closes the PREVIOUS syllable — but if it's the onset we
            # keep it (defensive; a silent-shva onset shouldn't head a cluster).
            if out and prev_full_vowel:
                out[-1] += cluster
                prev_full_vowel = False
                continue
        if vowel is None:
            # A bare (vowel-less) consonant: mater lectionis with no vowel -> attach to
            # the PREVIOUS syllable (e.g. בָּא -> ...+א). Otherwise a vowel ahead makes
            # it the ONSET of that syllable -> attach there (e.g. ר...וֹ -> רוֹ); with no
            # vowel ahead it's a word-final CODA closing the previous syllable (e.g.
            # וֹם -> ...+ם). This fixes maqaf-stretched drills (אָ-רוֹן -> [אָ, רוֹן]).
            bare_base = strip_to_base(g)
            if bare_base in _MATRES:
                if out:
                    out[-1] += cluster
                    continue
                out.append(cluster)
                continue
            if _has_vowel_ahead(gs, i):
                # attach forward: this onset + the NEXT (voweled) cluster
                rest = syllabify("".join(gs[i:]))
                if rest:
                    out.append(cluster + rest[0])
                    out.extend(rest[1:])
                else:
                    out.append(cluster)
                return out
            if out:
                out[-1] += cluster
                continue
            out.append(cluster)
            continue
        # swallow trailing matres with no vowel of their own (they close the vowel)
        while i < n and strip_to_base(gs[i]) in _MATRES and nikkud_of(gs[i]) is None and not has_dagesh(gs[i]):
            cluster += gs[i]
            i += 1
        out.append(cluster)
        prev_full_vowel = vowel is not None and vowel != "shva"
    return out


if __name__ == "__main__":
    # smoke: python tools/nikkud.py בָּבָּא
    import sys
    w = sys.argv[1] if len(sys.argv) > 1 else "בָּבָּא"
    print("graphemes:", graphemes(w))
    print("syllabify:", syllabify(w))
    print("nikkud:", [nikkud_of(g) for g in graphemes(w)])
