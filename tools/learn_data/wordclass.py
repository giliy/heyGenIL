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


if __name__ == "__main__":
    for r in WORDCLASS:
        print(f"{r['order']:>2}. {r['key']:<16} {r['name_he']:<22} ({len(r['words'])} words, {r['status']})")
