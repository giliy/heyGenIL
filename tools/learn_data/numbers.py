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

_BY_KEY = {r["key"]: r for r in NUMBERS}


def get_number(key):
    return _BY_KEY.get(key)


def keys():
    return [r["key"] for r in NUMBERS]


if __name__ == "__main__":
    for r in NUMBERS:
        n = r.get("numeral", r.get("add"))
        print(f"{r['order']:>2}. {r['key']:<10} {n} {r['word_m']:<12} ({r['status']})")
