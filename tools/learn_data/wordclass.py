#!/usr/bin/env python3
"""learn_data.wordclass — the data pack for the WORD-CLASS lesson type (שֵׁם עֶצֶם / פּוֹעַל).

One word-class concept per video: a set of nouns vs a set of verbs, each word popping with
a picture/glyph cue, then a sort-game (see a word, is it a noun or a verb? — the
call-and-response pause is where the child answers). Ages 5-7.

⚠ ALL ROWS ARE DRAFT — the pointed words must be human-vetted (findings §3).

A row:
  key       str    the lesson key (nouns, verbs, nouns-vs-verbs)
  name_he   str    the class name, pointed (שֵׁם עֶצֶם / פּוֹעַל)
  class     str    noun | verb | mixed
  words     [str]  vetted pointed words of this class (imageable kid words / action verbs)
  musicBed  str
  status    "draft" until human-vetted
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

WORDCLASS = [
    {"order": 1, "key": "nouns", "class": "noun", "name_he": "שֵׁם עֶצֶם",
     "words": ["בַּיִת", "כֶּלֶב", "חָתוּל", "סֵפֶר", "פֶּרַח"],
     "status": "draft",
     "note": "a noun NAMES a thing/person — imageable kid words"},
    {"order": 2, "key": "verbs", "class": "verb", "name_he": "פּוֹעַל",
     "words": ["רָץ", "אוֹכֵל", "יָשֵׁן", "שָׁר", "קוֹפֵץ"],
     "status": "draft",
     "note": "a verb is an ACTION word (what someone does)"},
    {"order": 3, "key": "nouns-vs-verbs", "class": "mixed", "name_he": "שֵׁם עֶצֶם אוֹ פּוֹעַל",
     "words": ["בַּיִת", "רָץ", "כֶּלֶב", "אוֹכֵל", "סֵפֶר", "יָשֵׁן"],
     "status": "draft",
     "note": "the sort-game: see a word — noun or verb? (call-and-response pause)"},
]

_BY_KEY = {r["key"]: r for r in WORDCLASS}


def get_wordclass(key):
    return _BY_KEY.get(key)


def keys():
    return [r["key"] for r in WORDCLASS]


# ---------------------------------------------------------------------------
# PACK registration — a wordclass video teaches ONE class concept (noun / verb) or a
# noun-vs-verb sort-game. The ladder reuses hook / isolated / word / call:
#   isolated = the class NAME (e.g. שֵׁם עֶצֶם), the hero teach
#   word     = REPEATED example words of that class, each popping with the class label
#   call     = "you!" (the sort-game pause where the child answers)
# ---------------------------------------------------------------------------
def _composition_id(proj_id, key):
    import re
    m = re.match(r"^(?:wordclass|learn)-(\d+)-(.*)$", proj_id)
    if m:
        name = "".join(p[:1].upper() + p[1:] for p in m.group(2).split("-") if p)
        return f"Wordclass{m.group(1)}{name}"
    parts = proj_id.replace("-", " ").split()
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def detect(beats):
    for b in beats:
        if b["role"] == "isolated":
            for r in WORDCLASS:
                if r["name_he"] == b["text"]:
                    return r["key"]
    return "nouns"


def _auto_script(row):
    """Compose a templated wordclass script.md: hook + class-name teach + example words + call."""
    key = row["key"]
    name_he = row.get("name_he", key)
    words = row.get("words") or []
    is_mixed = row.get("class") == "mixed"
    lines = [
        f"---\ntitle: בּוּ מְלַמֵּד {name_he}\nwordclass: {key}\nmusicBed: kids-play-ukulele\n---",
        "",
        f"hook: בּוּ בּוּ! הַיּוֹם לוֹמְדִים {name_he}!",
        "",
        f"isolated: {name_he}",
        "sub: כָּךְ נוֹתְנִים שֵׁם!",
        "",
    ]
    for w in words:
        lines.append(f"word: {w}")
    lines.append("sub: יוֹפִי!")
    if is_mixed:
        lines += ["", "call: אַתֶּם!", "sub: שֵׁם עֶצֶם אוֹ פּוֹעַל?", ""]
    else:
        lines += ["", "call: אַתֶּם!", "sub: עַכְשָׁו אַתֶּם!", ""]
    return "\n".join(lines)


def _block_fields(row):
    """Fill the wordclass{} concept block: the class name + the words + their per-word class."""
    return {
        "name_he": row.get("name_he", ""),
        "class": row.get("class", "noun"),
        "words": row.get("words") or [],
        # per-word class, parallel to words — for a mixed sort-game each word has its own
        # class; a single-class row marks every word with the row's class.
        "wordClasses": [("noun" if row.get("class") == "mixed" and i % 2 == 0 else row.get("class"))
                        for i, _ in enumerate(row.get("words") or [])],
    }


def _validate_wordclass_beats(d):
    blk = d.get("wordclass") or {}
    assert blk.get("name_he"), "wordclass block missing class name"
    assert blk.get("words"), "wordclass block must carry example words"


PACK = {
    "type": "wordclass",
    "series": "bu-koala-wordclass",
    "role_aliases": {
        "hook": "hook", "intro": "hook", "פתיחה": "hook",
        "isolated": "isolated", "class": "isolated", "שֵׁם": "isolated",
        "word": "word", "read": "word", "מילה": "word", "מילים": "word",
        "call": "call", "response": "call", "תורכם": "call",
        "sub": "sub",
    },
    "canonical_order": ["hook", "isolated", "word", "call"],
    "beat_for": {"hook": "hook", "isolated": "teach-isolated", "word": "read-word", "call": "call-response"},
    "unit_roles": ["isolated"],
    "default_hook": "בּוּ בּוּ! הַיּוֹם לוֹמְדִים שֵׁם עֶצֶם!",
    "default_call": "אַתֶּם!",
    "get_row": get_wordclass,
    "keys": keys,
    "detect": detect,
    "sound_of_key": {},
    "composition_id": _composition_id,
    # the class name is a whole phrase (multi-grapheme) — treat the isolated beat as a word.
    "isolated_is_word": True,
    "auto_script": _auto_script,
    "block_fields": _block_fields,
    "validate_extra": _validate_wordclass_beats,
    "mode": "wordclass",
    "block": "wordclass",
    "concept_key": "wordclass",
}


if __name__ == "__main__":
    for r in WORDCLASS:
        print(f"{r['order']:>2}. {r['key']:<16} {r['name_he']:<22} ({len(r['words'])} words, {r['status']})")
