#!/usr/bin/env python3
"""learn_data.letters — the data pack for the Hebrew LETTER (אָלֶף־בֵּית) lesson type.

One letter per video: its shape, name, and sound, plus 2-3 example words that START with it
(the taught letter highlights at the word's start — RTL = rightmost). Ages 5-7 (כיתה א).

⚠ ALL ROWS ARE DRAFT — the pointed example words must be human-vetted before ship
   (findings §3: a wrong vowel taught to a 5-year-old is the worst-case bug). `status`
   stays "draft" until a teacher/parent confirms each row's pointing.

A row:
  key          str    romanized letter key (alef, bet, ...)
  letter       str    the bare letter glyph (display)
  sofit        bool   True for final forms (ךםןףץ) — taught as "the end-of-word shape"
  name_he      str    the letter's Hebrew name, pointed
  sound        str    the letter's sound label (Latin, display only)
  exampleWords [str]  2-3 pointed kid words that START with the letter
  musicBed     str    kids bed
  status       "draft" until human-vetted, then "vetted"
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# DRAFT — 22 letters + 5 sofit. Example words are early-reading decodable vocabulary.
# Each starts with the taught letter. CONFIRM pointing before ship.
LETTERS = [
    {"order": 1,  "key": "alef",   "letter": "א", "name_he": "אָלֶף",   "sound": "(א)",
     "exampleWords": ["אַבָּא", "אֹרֶן", "אֲנִי"], "status": "draft"},
    {"order": 2,  "key": "bet",    "letter": "בּ", "name_he": "בֵּית",   "sound": "b",
     "exampleWords": ["בֵּית", "בַּד", "בֹּקֶר"], "status": "draft"},
    {"order": 3,  "key": "gimel",  "letter": "ג", "name_he": "גִּימֶל",  "sound": "g",
     "exampleWords": ["גַּם", "גֶּשֶׁם", "גָּדוֹל"], "status": "draft"},
    {"order": 4,  "key": "dalet",  "letter": "ד", "name_he": "דָּלֶת",   "sound": "d",
     "exampleWords": ["דֶּלֶת", "דָּג", "דְּלִי"], "status": "draft"},
    {"order": 5,  "key": "he",     "letter": "ה", "name_he": "הֵי",      "sound": "h",
     "exampleWords": ["הָר", "הֵד", "הוֹד"], "status": "draft"},
    {"order": 6,  "key": "vav",    "letter": "ו", "name_he": "וָו",      "sound": "v",
     "exampleWords": ["וָרֹד", "וֶרֶד", "וִילוֹן"], "status": "draft"},
    {"order": 7,  "key": "zayin",  "letter": "ז", "name_he": "זַיִן",    "sound": "z",
     "exampleWords": ["זָהָב", "זְמַן", "זֶבְרָה"], "status": "draft"},
    {"order": 8,  "key": "chet",   "letter": "ח", "name_he": "חֵית",     "sound": "ch",
     "exampleWords": ["חַג", "חָלָב", "חֶדֶר"], "status": "draft"},
    {"order": 9,  "key": "tet",    "letter": "ט", "name_he": "טֵית",     "sound": "t",
     "exampleWords": ["טוֹב", "טִיפָה", "טֶלֶפוֹן"], "status": "draft"},
    {"order": 10, "key": "yod",    "letter": "י", "name_he": "יוֹד",     "sound": "y",
     "exampleWords": ["יָד", "יֶלֶד", "יוֹם"], "status": "draft"},
    {"order": 11, "key": "kaf",    "letter": "כּ", "name_he": "כַּף",    "sound": "k",
     "exampleWords": ["כֶּלֶב", "כַּד", "כִּסֵּא"], "status": "draft"},
    {"order": 12, "key": "lamed",  "letter": "ל", "name_he": "לָמֶד",    "sound": "l",
     "exampleWords": ["לֵב", "לֶחֶם", "לַיְלָה"], "status": "draft"},
    {"order": 13, "key": "mem",    "letter": "מ", "name_he": "מֵם",      "sound": "m",
     "exampleWords": ["מָמָא", "מַיִם", "מֶלֶךְ"], "status": "draft"},
    {"order": 14, "key": "nun",    "letter": "נ", "name_he": "נוּן",     "sound": "n",
     "exampleWords": ["נָשִׁים", "נֶר", "נָהָר"], "status": "draft"},
    {"order": 15, "key": "samekh", "letter": "ס", "name_he": "סָמֶךְ",   "sound": "s",
     "exampleWords": ["סוּס", "סֵפֶר", "סֻכָּר"], "status": "draft"},
    {"order": 16, "key": "ayin",   "letter": "ע", "name_he": "עַיִן",    "sound": "(ע)",
     "exampleWords": ["עַיִן", "עֵץ", "עוֹף"], "status": "draft"},
    {"order": 17, "key": "pe",     "letter": "פּ", "name_he": "פֵּא",    "sound": "p",
     "exampleWords": ["פֶּרַח", "פַּר", "פִּיל"], "status": "draft"},
    {"order": 18, "key": "tsadi",  "letter": "צ", "name_he": "צָדִי",    "sound": "ts",
     "exampleWords": ["צָב", "צִפּוֹר", "צֶבַע"], "status": "draft"},
    {"order": 19, "key": "qof",    "letter": "ק", "name_he": "קוֹף",     "sound": "k",
     "exampleWords": ["קֶרֶן", "קוֹל", "קַר"], "status": "draft"},
    {"order": 20, "key": "resh",   "letter": "ר", "name_he": "רֵישׁ",    "sound": "r",
     "exampleWords": ["רֹאשׁ", "רַגְלַיִם", "רֶחֶם"], "status": "draft"},
    {"order": 21, "key": "shin",   "letter": "שׁ", "name_he": "שִׁין",    "sound": "sh",
     "exampleWords": ["שָׁלוֹם", "שֵׁם", "שִׁיר"], "status": "draft"},
    {"order": 22, "key": "tav",    "letter": "ת", "name_he": "תָּו",     "sound": "t",
     "exampleWords": ["תֻּת", "תֵּבָה", "תַּלְמִיד"], "status": "draft"},
    # sofit (final forms) — taught as the end-of-word shape, sound unchanged
    {"order": 23, "key": "kaf-sofit",  "letter": "ך", "sofit": True, "name_he": "כַּף סוֹפִית", "sound": "ch",
     "exampleWords": ["מֶלֶךְ", "בָּרוּךְ"], "status": "draft"},
    {"order": 24, "key": "mem-sofit",  "letter": "ם", "sofit": True, "name_he": "מֵם סוֹפִית", "sound": "m",
     "exampleWords": ["מַיִם", "שָׁלוֹם"], "status": "draft"},
    {"order": 25, "key": "nun-sofit",  "letter": "ן", "sofit": True, "name_he": "נוּן סוֹפִית", "sound": "n",
     "exampleWords": ["אֹרֶן", "חָתָן"], "status": "draft"},
    {"order": 26, "key": "pe-sofit",   "letter": "ף", "sofit": True, "name_he": "פֵּא סוֹפִית", "sound": "f",
     "exampleWords": ["כַּף", "אוֹף"], "status": "draft"},
    {"order": 27, "key": "tsadi-sofit","letter": "ץ", "sofit": True, "name_he": "צָדִי סוֹפִית","sound": "ts",
     "exampleWords": ["עֵץ", "אָרֶץ"], "status": "draft"},
]

_BY_KEY = {r["key"]: r for r in LETTERS}


def get_letter(key):
    return _BY_KEY.get(key)


def keys():
    return [r["key"] for r in LETTERS]


if __name__ == "__main__":
    for r in LETTERS:
        print(f"{r['order']:>2}. {r['letter']} {r['name_he']:<14} ({r['key']})  {r['status']}")


# ---------------------------------------------------------------------------
# PACK registration — a letter video maps onto the SAME beat ladder as nikkud
# (isolated -> word), so the generic renderer needs no new beat kind:
#   isolated = the bare letter (shape + name + sound pop)
#   word     = each example word, the taught letter highlighted at its start (RTL = rightmost)
# There is no cv/blend for a single letter. The teach is the letter itself.
# ---------------------------------------------------------------------------
def _composition_id(proj_id, key):
    import re
    m = re.match(r"^(?:letter|learn)-(\d+)-(.*)$", proj_id)
    if m:
        name = "".join(p[:1].upper() + p[1:] for p in m.group(2).split("-") if p)
        return f"Letter{m.group(1)}{name}"
    parts = proj_id.replace("-", " ").split()
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def detect(beats):
    """Detect the taught letter from the isolated unit's base glyph."""
    import nikkud as _n
    for b in beats:
        if b["role"] == "isolated":
            gs = _n.graphemes(b["text"])
            if gs:
                base = _n.strip_to_base(gs[0])
                for r in LETTERS:
                    if _n.strip_to_base(r["letter"]) == base:
                        return r["key"]
    return "alef"


def _auto_script(row):
    """Compose a templated letter script.md: bare letter teach + example words + call."""
    letter = row.get("letter", "א")
    name_he = row.get("name_he") or row.get("key")
    words = row.get("exampleWords") or []
    lines = [
        f"---\ntitle: בּוּ מְלַמֵּד אֶת הָאוֹת {name_he}\nletter: {row['key']}\nmusicBed: kids-play-ukulele\n---",
        "",
        f"hook: בּוּ בּוּ! הַיּוֹם לוֹמְדִים אֶת הָאוֹת {name_he}!",
        "",
        f"isolated: {letter}",
        f"sub: {name_he} — צוּרָה שֶׁל הָאוֹת",
        "",
    ]
    for w in words:
        lines.append(f"word: {w}")
    lines.append("sub: יוֹפִי! מִלִּים עִם הָאוֹת!")
    lines += ["", "call: אַתֶּם!", "sub: עַכְשָׁו אַתֶּם אוֹמְרִים!", ""]
    return "\n".join(lines)


def _block_fields(row):
    """Fill the letter{} concept block from a letter row (glyph, pointed name, sound label)."""
    return {
        "letter": row.get("letter", "א"),
        "sign": row.get("letter", "א"),  # display glyph = the bare letter (no nikkud default)
        "name_he": row.get("name_he", ""),
        "sound": row.get("sound", ""),
        "sofit": bool(row.get("sofit", False)),
    }


def _validate_letter_beats(d):
    """Letter beats.json sub-checks: mode/block/concept consistency + progression floor."""
    blk = d.get("letter") or {}
    assert blk.get("letter"), "letter block missing target letter"
    assert blk.get("name_he"), "letter block missing pointed name"
    assert blk.get("anchorWords"), "letter block must carry at least one example word"
    if "teach-isolated" not in [b["name"] for b in d["beats"]]:
        raise ValueError("letter video requires a teach-isolated beat (the shape/name/sound teach)")
    if not any(b["name"] == "read-word" for b in d["beats"]):
        raise ValueError("letter video requires at least one read-word beat (an example word)")


PACK = {
    "type": "letter",
    "series": "bu-koala-letters",
    "role_aliases": {
        "hook": "hook", "intro": "hook", "פתיחה": "hook",
        # NOTE: "letter" is NOT a role alias — it is the front-matter concept key
        # (letter: alef). Aliasing it to a role would swallow the front matter as a beat.
        "isolated": "isolated", "אות": "isolated",
        "word": "word", "read": "word", "מילה": "word", "מילים": "word",
        "call": "call", "response": "call", "תורכם": "call",
        "sub": "sub",
    },
    "canonical_order": ["hook", "isolated", "word", "call"],
    "beat_for": {"hook": "hook", "isolated": "teach-isolated", "word": "read-word", "call": "call-response"},
    "unit_roles": ["isolated"],
    "default_hook": "בּוּ בּוּ! הַיּוֹם לוֹמְדִים אֶת הָאוֹת {name_he}!",
    "default_call": "אַתֶּם!",
    "get_row": get_letter,
    "keys": keys,
    "detect": detect,
    "sound_of_key": {},
    "composition_id": _composition_id,
    "auto_script": _auto_script,
    "block_fields": _block_fields,
    "validate_extra": _validate_letter_beats,
    "mode": "letter",
    "block": "letter",
    "concept_key": "letter",
}
