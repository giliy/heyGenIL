#!/usr/bin/env python3
"""learn_data.numbers — the data pack for the NUMBERS & MATH lesson type.

One number (or one simple sum) per video: the numeral + the Hebrew counting word + that
many objects on screen, lit one-by-one in sync with the spoken count. The math ethos:
the on-screen COUNT is COMPUTED (code places N objects), never asserted.

⚠ ALL ROWS ARE DRAFT — the Hebrew number words (masc/fem) must be human-vetted.
   Hebrew counting is gendered: masculine nouns count with the FEMALE number form
   (שְׁלוֹשָׁה בָּנִים) and vice versa. For a gender-neutral count-along of objects we use
   the MASCULINE counting form by default (אֶחָד, שְׁנַיִם, ...) — confirm with a teacher.

A row:
  key        str    the number key (one..ten, or add-N-M)
  numeral    int    the digit (display)
  word_m     str    the masculine counting form, pointed (אֶחָד / שְׁנַיִם / ...)
  word_f     str    the feminine counting form, pointed (אַחַת / שְׁתַּיִם / ...)
  count      int    how many objects the count-along places
  add        {a,b}  optional simple-sum spec (a+b objects merge)
  musicBed   str
  status     "draft" until human-vetted
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

NUMBERS = [
    {"order": 1,  "key": "one",   "numeral": 1,  "count": 1,
     "word_m": "אֶחָד", "word_f": "אַחַת", "status": "draft"},
    {"order": 2,  "key": "two",   "numeral": 2,  "count": 2,
     "word_m": "שְׁנַיִם", "word_f": "שְׁתַּיִם", "status": "draft"},
    {"order": 3,  "key": "three", "numeral": 3,  "count": 3,
     "word_m": "שְׁלוֹשָׁה", "word_f": "שָׁלוֹשׁ", "status": "draft"},
    {"order": 4,  "key": "four",  "numeral": 4,  "count": 4,
     "word_m": "אַרְבָּעָה", "word_f": "אַרְבַּע", "status": "draft"},
    {"order": 5,  "key": "five",  "numeral": 5,  "count": 5,
     "word_m": "חֲמִשָּׁה", "word_f": "חָמֵשׁ", "status": "draft"},
    {"order": 6,  "key": "six",   "numeral": 6,  "count": 6,
     "word_m": "שִׁשָּׁה", "word_f": "שֵׁשׁ", "status": "draft"},
    {"order": 7,  "key": "seven", "numeral": 7,  "count": 7,
     "word_m": "שִׁבְעָה", "word_f": "שֶׁבַע", "status": "draft"},
    {"order": 8,  "key": "eight", "numeral": 8,  "count": 8,
     "word_m": "שְׁמֹנָה", "word_f": "שְׁמֹנֶה", "status": "draft"},
    {"order": 9,  "key": "nine",  "numeral": 9,  "count": 9,
     "word_m": "תִּשְׁעָה", "word_f": "תֵּשַׁע", "status": "draft"},
    {"order": 10, "key": "ten",   "numeral": 10, "count": 10,
     "word_m": "עֲשָׂרָה", "word_f": "עֶשֶׂר", "status": "draft"},
    # simple sums (a+b, sums ≤ 10) — teach "כמה ביחד" (how many together)
    {"order": 20, "key": "add-1-1", "numeral": None, "add": {"a": 1, "b": 1}, "count": 2,
     "word_m": "שְׁנַיִם", "word_f": "שְׁתַּיִם", "status": "draft",
     "note": "1+1=2 — count the union"},
    {"order": 21, "key": "add-2-1", "numeral": None, "add": {"a": 2, "b": 1}, "count": 3,
     "word_m": "שְׁלוֹשָׁה", "word_f": "שָׁלוֹשׁ", "status": "draft", "note": "2+1=3"},
    {"order": 22, "key": "add-2-2", "numeral": None, "add": {"a": 2, "b": 2}, "count": 4,
     "word_m": "אַרְבָּעָה", "word_f": "אַרְבַּע", "status": "draft", "note": "2+2=4"},
]

# The progressive count-along sequence (masculine counting form, the gender-neutral default
# for a mixed object set): one..ten, the SAME words the child hears when counting objects.
COUNT_WORDS = ["אֶחָד", "שְׁנַיִם", "שְׁלוֹשָׁה", "אַרְבָּעָה", "חֲמִשָּׁה",
               "שִׁשָּׁה", "שִׁבְעָה", "שְׁמֹנָה", "תִּשְׁעָה", "עֲשָׂרָה"]

_BY_KEY = {r["key"]: r for r in NUMBERS}


def get_number(key):
    return _BY_KEY.get(key)


def keys():
    return [r["key"] for r in NUMBERS]


# ---------------------------------------------------------------------------
# PACK registration — a number video teaches the numeral + the Hebrew counting word
# + a count-along (N objects, lit one-by-one in sync with the spoken count).
# The ladder reuses hook / isolated / word / call:
#   isolated = the Hebrew counting word (e.g. אֶחָד), the hero pop
#   word     = REPEATED count lines, one per object ("אֶחָד" ... up to the number);
#              each lights the next object. count = N from the row (COMPUTED, never asserted).
# There is no cv/blend — a number is not a reading syllable.
# ---------------------------------------------------------------------------
def _composition_id(proj_id, key):
    import re
    m = re.match(r"^(?:number|learn)-(\d+)-(.*)$", proj_id)
    if m:
        name = "".join(p[:1].upper() + p[1:] for p in m.group(2).split("-") if p)
        return f"Number{m.group(1)}{name}"
    parts = proj_id.replace("-", " ").split()
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def detect(beats):
    """Detect the taught number from the row that matches the isolated/word count word."""
    for b in beats:
        if b["role"] == "isolated":
            for r in NUMBERS:
                if r["word_m"] == b["text"]:
                    return r["key"]
    return "one"


def _count_word(r, n):
    """The n-th counting word (1-based) for a row — the masculine count-along form."""
    w = r.get("word_m", "")
    return w


def _count_sequence(row):
    """The progressive count-along words for a row (1..count), each lighting one object."""
    count = row.get("count", 1)
    return [COUNT_WORDS[k - 1] for k in range(1, count + 1) if k <= len(COUNT_WORDS)]


def _auto_script(row):
    """Compose a templated number script.md: hook + the hero number word + a count-along
    (the full count 1..N, one read-word line per object, each a different counting word) + call."""
    key = row["key"]
    count = row.get("count", 1)
    is_add = bool(row.get("add"))
    name = f"{count}" if not is_add else f"{row['add']['a']}+{row['add']['b']}"
    title = f"בּוּ מְלַמֵּד לִסְפּוֹר {name}"
    lines = [
        f"---\ntitle: {title}\nnumber: {key}\nmusicBed: kids-play-ukulele\n---",
        "",
        f"hook: בּוּ בּוּ! הַיּוֹם סוֹפְרִים {name}!",
        "",
    ]
    word_m = row.get("word_m", "")
    if word_m:
        lines.append(f"isolated: {word_m}")
        lines.append("sub: מִסְפָּר — הֲכִי גָּדוֹל!")
    # the count-along: 1..N read-word lines, each a DIFFERENT progressive counting word.
    seq = _count_sequence(row)
    for w in seq:
        lines.append(f"word: {w}")
    lines.append("sub: יוֹפִי! סָפַרְנוּ בַּיַּחַד!")
    lines += ["", "call: אַתֶּם!", "sub: עַכְשָׁו אַתֶּם סוֹפְרִים!", ""]
    return "\n".join(lines)


def _block_fields(row):
    """Fill the number{} concept block: the numeral, the Hebrew word, and the count."""
    return {
        "numeral": row.get("numeral"),
        "word": row.get("word_m", ""),
        "count": row.get("count", 0),
        "add": row.get("add"),
    }


def _validate_number_beats(d):
    blk = d.get("number") or {}
    assert blk.get("numeral") is not None or blk.get("add"), "number block missing numeral/sum"
    assert blk.get("count", 0) > 0, "number block must carry a positive count"
    n_words = sum(1 for b in d["beats"] if b["name"] == "read-word")
    if n_words != blk["count"]:
        raise ValueError(f"number count-along mismatch: {n_words} read-word lines for count {blk['count']}")


PACK = {
    "type": "number",
    "series": "bu-koala-numbers",
    "role_aliases": {
        "hook": "hook", "intro": "hook", "פתיחה": "hook",
        "isolated": "isolated", "count": "isolated", "מִסְפָּר": "isolated",
        "word": "word", "read": "word", "מילה": "word", "מילים": "word",
        "call": "call", "response": "call", "תורכם": "call",
        "sub": "sub",
    },
    "canonical_order": ["hook", "isolated", "word", "call"],
    "beat_for": {"hook": "hook", "isolated": "teach-isolated", "word": "read-word", "call": "call-response"},
    "unit_roles": ["isolated"],
    "default_hook": "בּוּ בּוּ! הַיּוֹם סוֹפְרִים!",
    "default_call": "אַתֶּם!",
    "get_row": get_number,
    "keys": keys,
    "detect": detect,
    "sound_of_key": {},
    "composition_id": _composition_id,
    # a number's hero is a whole counting word (multi-grapheme), not a single glyph —
    # tell the engine to treat the isolated beat as a whole-word highlight.
    "isolated_is_word": True,
    "auto_script": _auto_script,
    "block_fields": _block_fields,
    "validate_extra": _validate_number_beats,
    "mode": "number",
    "block": "number",
    "concept_key": "number",
}


if __name__ == "__main__":
    for r in NUMBERS:
        n = r.get("numeral", r.get("add"))
        print(f"{r['order']:>2}. {r['key']:<10} {n} {r['word_m']:<12} ({r['status']})")
