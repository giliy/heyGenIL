#!/usr/bin/env python3
"""learn_data.nikkud — the data pack for the nikkud (vowel-sign) lesson type.

This is the PROVEN reading track, re-homed as a learn_data pack so the generalized engine
(tools/make_learn.py) drives it generically. The curriculum rows themselves stay in
tools/nikkud_data.py (the single source of truth shared by the validator, the engine, and
the skill — re-exported here so they never drift).

Pack contract (every learn_data pack provides these keys):
  type            str   canonical type name (matches the --type CLI flag)
  series          str   the beats.json `series` string
  role_aliases    dict  script.md role keyword (+ Hebrew conveniences) -> canonical role
  canonical_order [str] the ladder order roles are scheduled in
  beat_for        dict  canonical role -> the beats[] beat name that realizes it
  unit_roles      [str] roles that carry per-unit sub-word highlight (isolated/cv/blend)
  default_hook    str   template (uses {name_he}) when the author omits the hook
  default_call    str   when the author omits the call
  get_row(key)    fn    resolve a curriculum/data row by key (nikkud key here)
  keys()          fn    all known keys in introduction order
  detect(beats)   fn    auto-detect the taught concept key from the script's units
  sound_of_key    dict  vowel key -> phoneme label (for the cross-check warning)
  composition_id(proj_id, key)  fn  PascalCase comp id (Read2Patach)
  validate_extra  fn|None  optional per-type beats-dict sub-checks (None = the base shape
                        + validate_reading_beats_dict already covers nikkud)
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import nikkud  # noqa: E402
import nikkud_data  # noqa: E402

# Vowel keys that count toward the auto-detect tally (true vowels; shva/dagesh are not).
TRUE_VOWELS = {"kamatz", "patach", "tzere-segol", "chirik", "cholam", "shuruk", "kubutz",
               "hataf-segol", "hataf-patach", "hataf-kamatz"}
# signs explicitly deferred from v1 (raising "not in v1" for these)
DEFERRED = {"hataf-segol", "hataf-patach", "hataf-kamatz"}

SOUND_OF_KEY = {"kamatz": "a", "patach": "a", "tzere-segol": "e", "chirik": "i",
                "cholam": "o", "shuruk": "u", "kubutz": "u"}

# vowel nikkud values that are NOT a taught-sound mismatch (mater/silent/diacritic)
_NON_VOWEL = ("shva", "shva-na", "dagesh", "shin-dot", "sin-dot")

# every Hebrew base letter (for counting "pointed consonant graphemes" in shva/dagesh detect)
_CONSONANT_BASES = set("אבגדהוזחטיכךלמםנןסעפףצץקרשת")


def detect(beats):
    """Auto-detect the taught nikkud from the isolated/cv/blend units (tally over true vowels).

    word beat is EXCLUDED (a whole word carries many vowels and would pollute the tally). The
    mode wins; ties break by introduction order; empty -> 'kamatz' (highest-frequency default).
    Raises ValueError if the only vowels found are a deferred sign (not in v1).

    Non-vowel signs (shva, dagesh-kal) carry no true vowel, so they can never win the vowel
    tally. When the vowel tally is EMPTY but every pointed grapheme carries a shva (resp. a
    dagesh), detect that sign instead — the front-matter must still agree (the CONFLICT guard
    in make_learn.main). This keeps the "never teach a wrong sign" invariant for the two signs
    that aren't vowels."""
    # Normalize codepoint-level nikkud names to CURRICULUM keys. tzere (U+05B5) and segol
    # (U+05B6) share the "tzere-segol" same-sound-pair row; each maps into that bucket.
    _KEY_OF = {"kamatz": "kamatz", "patach": "patach", "tzere": "tzere-segol",
               "segol": "tzere-segol", "chirik": "chirik", "cholam": "cholam",
               "kubutz": "kubutz", "hataf-segol": "hataf-segol",
               "hataf-patach": "hataf-patach", "hataf-kamatz": "hataf-kamatz"}
    # Detection tallies ONLY the deliberately-taught units (isolated + cv), never blend/word:
    # a blend/read word is a REAL whole word that legitimately carries OTHER vowels (e.g.
    # בֹּקֶר carries cholam, דְּלִי carries chirik) and would pollute the tally. The
    # isolated + cv units are single-sign by construction — the reliable signal.
    tally = {}
    shva_ct = 0
    dagesh_ct = 0
    shuruk_ct = 0
    pointed = 0
    for b in beats:
        if b["role"] not in ("isolated", "cv"):
            continue
        for g in nikkud.graphemes(b["text"]):
            base = nikkud.strip_to_base(g)
            v = nikkud.nikkud_of(g)
            key = _KEY_OF.get(v)
            if key is not None and key in TRUE_VOWELS:
                tally[key] = tally.get(key, 0) + 1
                pointed += 1
                continue
            # a consonant grapheme (with or without dagesh/shva) — still a taught unit.
            if base and base in _CONSONANT_BASES:
                pointed += 1
            if v in ("shva", "shva-na"):
                shva_ct += 1
            if nikkud.has_dagesh(g):
                # shuruk = vav + dot (the "dagesh" is the shuruk dot, NOT a consonant dagesh).
                if base == "ו":
                    shuruk_ct += 1
                else:
                    dagesh_ct += 1
    if not tally:
        # no true vowels in the taught units: fall back to shuruk / shva / dagesh by dominance.
        if pointed and shuruk_ct > 0:
            return "shuruk"
        if pointed and shva_ct >= pointed // 2 and shva_ct > 0:
            return "shva"
        if pointed and dagesh_ct >= pointed // 2 and dagesh_ct > 0:
            return "dagesh-kal"
        return "kamatz"
    order = list(nikkud_data.keys())
    top = max(tally, key=lambda k: (tally[k], -(order.index(k) if k in order else 0)))
    if top in DEFERRED:
        raise ValueError(
            f"detected nikkud {top!r} is a deferred sign (not in v1). "
            f"Tally: {tally}. This transcript teaches a hataf form — v1 doesn't cover it yet.")
    return top


def _composition_id(proj_id, key):
    import re
    m = re.match(r"^read-(\d+)-(.*)$", proj_id)
    if m:
        name = "".join(p[:1].upper() + p[1:] for p in m.group(2).split("-") if p)
        return f"Read{m.group(1)}{name}"
    parts = proj_id.replace("-", " ").split()
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


PACK = {
    "type": "nikkud",
    "series": "bu-koala-reading",
    "role_aliases": {
        "hook": "hook", "intro": "hook", "פתיחה": "hook",
        "isolated": "isolated", "letter": "isolated", "sound": "isolated", "אות": "isolated",
        "cv": "cv", "syllables": "cv", "syllable": "cv", "צירוף": "cv", "צירופים": "cv",
        "blend": "blend", "מיזוג": "blend",
        "word": "word", "read": "word", "מילה": "word",
        "call": "call", "response": "call", "call-response": "call", "תורכם": "call",
        "sub": "sub",
    },
    "canonical_order": ["hook", "isolated", "cv", "blend", "word", "call"],
    "beat_for": {
        "hook": "hook", "isolated": "teach-isolated", "cv": "teach-cv",
        "blend": "blend", "word": "read-word", "call": "call-response",
    },
    "unit_roles": ["isolated", "cv", "blend"],
    "default_hook": "בּוּ בּוּ! הַיּוֹם לוֹמְדִים {name_he}!",
    "default_call": "אַתֶּם!",
    "get_row": nikkud_data.get_nikkud,
    "keys": nikkud_data.keys,
    "detect": detect,
    "sound_of_key": SOUND_OF_KEY,
    "composition_id": _composition_id,
    # nikkud reuses the existing reading validator (mode:"reading" shape) — no extra sub-check.
    "validate_extra": None,
    # the beats.json mode + the block name carrying the type payload
    "mode": "reading",
    "block": "reading",
    "concept_key": "nikkud",
}
