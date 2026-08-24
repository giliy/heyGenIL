#!/usr/bin/env python3
"""nikkud_data.py — the single source of truth for the reading-track curriculum.

The LEXICON half of the "curated lexicon + rule engine" decision
(research/hebrew-reading/00-findings.md §3). The engine (tools/nikkud.py), the skill
(/make-reading-short), and the validator (contracts.validate_reading_beats) ALL read
this file — so they can never drift. The vocabulary is a CLOSED, teacher-vetted set;
nothing here is machine-generated, and no vowel is ever invented.

⚠ MNEMONICS ARE None ON EVERY ROW — findings §2/E: do NOT fabricate per-sign child
   mnemonics (the Hebrew teacher-blog search was engine-blocked). Source them from an
   Israeli early-grades teacher before shipping. Leave None until vetted.

Master plan reference: 10-implementation-plan.md §4. One entry per nikkud, in the §1
introduction order. Only קמץ (order 1) is the fully-vetted pilot row; the rest are
order-only stubs the validator's key lookup can resolve (filled in during Phase 4
scale-out, one video each).
"""

# --- the curriculum ladder (one video per row, in introduction order) -----------
# Full row shape (see kamatz for the vetted example):
#   order         int    introduction order (findings §1)
#   key           str    canonical nikkud key (nikkud_of() returns these)
#   sign          str    the pointed sign itself (display + stable target color)
#   name_he       str    Hebrew name of the sign
#   sound         str    the phoneme family it teaches
#   targetLetters [str]  consonants the sound rides on this video
#   cv            [str]  the pointed צירופים taught (one clip each)
#   blendWords    [{word, units:[...]}]  2–3 anchor words, units = the blend split
#   mnemonic      None   — deliberately NEVER fabricated (findings §2/E)
#   musicBed      str    kids bed (kids-play-ukulele / -curious-pizzicato / -lullaby-musicbox)
CURRICULUM = [
    {
        "order": 1, "key": "kamatz", "sign": "בָּ", "name_he": "קָמָץ", "sound": "a",
        "targetLetters": ["בּ", "מ", "ק", "שׁ", "א"],
        "cv": ["בָּ", "מָּ", "קָּ", "שָׁ", "אָ"],
        "blendWords": [
            {"word": "אַבָּא", "units": ["אַ", "בָּא"]},
            {"word": "מָמָא", "units": ["מָ", "מָא"]},
            {"word": "בָּבָּא", "units": ["בָּ", "בָּא"]},
        ],
        "mnemonic": None,                       # ⚠ UNVERIFIED — findings §2/E; do NOT fabricate
        "musicBed": "kids-play-ukulele",
        "status": "vetted",                     # the pilot row — every word human-checked
    },
    # --- orders 2–9: introduction-order SKELETON (Phase 4 scale-out, one video each).
    # key/sign/name_he/sound are settled (findings §1); the vetted word lists are filled
    # per-video at authoring time and human-verified before that video ships. mnemonics stay None.
    {"order": 2, "key": "patach",      "sign": "בַּ",    "name_he": "פַּתָּח",       "sound": "a",
     "targetLetters": ["בּ", "מּ", "גּ", "דּ", "ר"],
     "cv": ["בַּ", "מַּ", "גַּ", "דַּ"],
     # In real Hebrew essentially every 2-syllable patach word ends in kamatz (אַבָּא, דַּדָּא, גַּמָּא);
     # a 2-syllable ALL-patach word does not occur naturally. The blend sweep must model the patach
     # sign (it is the highlight-sync payoff), so the vetted blend word is the patach CV+CV cluster
     # דַּדַּ (גַּמַּ equivalent). The read-word anchor is a REAL single patach word (גַּם/דַּג/בַּר).
     "blendWords": [
         {"word": "דַּדַּ", "units": ["דַּ", "דַּ"]},
         {"word": "גַּמַּ", "units": ["גַּ", "מַּ"]},
         {"word": "גַּם", "units": ["גַּם"]},
         {"word": "דַּג", "units": ["דַּג"]},
         {"word": "בַּר", "units": ["בַּר"]},
     ],
     "mnemonic": None,                       # ⚠ UNVERIFIED — findings §2/E; do NOT fabricate
     "musicBed": "kids-play-ukulele",
     "status": "vetted",                     # vetted for the read-2-patach transcript-driven pilot
     "note": "same-sound pair with kamatz (/a/); taught right after it. Blend word is a patach CV+CV cluster (no natural 2-syllable all-patach word exists)."},
    {"order": 3, "key": "tzere-segol", "sign": "בֵּ/בֶּ", "name_he": "צֵירֵי/סֶגּוֹל", "sound": "e",
     "status": "draft", "mnemonic": None, "note": "same-sound pair (/e/)",
     # DRAFT (awaiting human vetting — findings §3): tzere for the isolated/CV ladder (the
     # canonical /e/), segol appears inside anchor words only. All pointed words below are
     # early-reading decodable vocabulary; CONFIRM before ship.
     "targetLetters": ["בּ", "מ", "ל", "שׁ", "ד"],
     "cv": ["בֵּ", "מֵ", "לֵ", "שֵׁ"],
     "blendWords": [
         {"word": "בֵּית", "units": ["בֵּית"]},
         {"word": "לֵב", "units": ["לֵב"]},
         {"word": "שֵׁם", "units": ["שֵׁם"]},
         {"word": "דֶּלֶת", "units": ["דֶּ", "לֶת"]},
         {"word": "יֶלֶד", "units": ["יֶ", "לֶד"]},
     ],
     "musicBed": "kids-play-ukulele"},
    {"order": 4, "key": "chirik",      "sign": "בִּ",    "name_he": "חִירִיק",       "sound": "i",
     "status": "draft", "mnemonic": None,
     "targetLetters": ["בּ", "ד", "ל", "מ", "פ"],
     "cv": ["בִּ", "דִ", "לִ", "מִ"],
     "blendWords": [
    {"word": "פִּיל", "units": ["פִּיל"]},
    {"word": "גִּיר", "units": ["גִּיר"]},
    {"word": "דִּיו", "units": ["דִּיו"]},
    {"word": "כִּיס", "units": ["כִּיס"]},
    {"word": "מִיל", "units": ["מִיל"]}
  ],
     "musicBed": "kids-play-ukulele"},
    {"order": 5, "key": "cholam",      "sign": "בֹּ",    "name_he": "חוֹלָם",        "sound": "o",
     "status": "draft", "mnemonic": None,
     "note": "cholam/shin-dot collision is its own teaching moment (findings §2/D)",
     "targetLetters": ["בּ", "ל", "מ", "ר", "שׁ"],
     "cv": ["בֹּ", "לֹ", "מֹ", "רֹ"],
     "blendWords": [
    {"word": "טוֹב", "units": ["טוֹב"]},
    {"word": "רֹאשׁ", "units": ["רֹאשׁ"]},
    {"word": "שׁוֹק", "units": ["שׁוֹק"]},
    {"word": "לֹא", "units": ["לֹא"]},
    {"word": "כֹּל", "units": ["כֹּל"]}
  ],
     "musicBed": "kids-play-ukulele"},
    {"order": 6, "key": "shuruk",      "sign": "בוּ",    "name_he": "שׁוּרוּק",      "sound": "u",
     "status": "draft", "mnemonic": None,
     "note": "shuruk BEFORE kubutz (findings §1); shuruk = vav+dot, NOT a separate grapheme",
     "targetLetters": ["בּ", "ג", "ל", "מ", "ס"],
     "cv": ["בּוּ", "גּוּ", "לוּ", "מוּ"],
     "blendWords": [
    {"word": "סוּס", "units": ["סוּס"]},
    {"word": "לוּל", "units": ["לוּל"]},
    {"word": "גּוּל", "units": ["גּוּל"]},
    {"word": "תּוּת", "units": ["תּוּת"]},
    {"word": "סוּף", "units": ["סוּף"]}
  ],
     "musicBed": "kids-play-ukulele"},
    {"order": 7, "key": "kubutz",      "sign": "בֻּ",    "name_he": "קֻבּוּץ",       "sound": "u",
     "status": "draft", "mnemonic": None, "note": "same sound, different look — confusion point",
     "targetLetters": ["בּ", "ד", "ל", "ס", "ת"],
     "cv": ["בֻּ", "דֻ", "לֻ", "סֻ"],
     "blendWords": [
    {"word": "תֻּת", "units": ["תֻּת"]},
    {"word": "סֻכָּר", "units": ["סֻ", "כָּר"]},
    {"word": "דֻּבִּי", "units": ["דֻּ", "בִּי"]},
    {"word": "קֻבָּה", "units": ["קֻ", "בָּה"]}
  ],
     "musicBed": "kids-play-ukulele"},
    {"order": 8, "key": "shva",        "sign": "בְּ",    "name_he": "שְׁוָוא",       "sound": "ə/∅",
     "status": "draft", "mnemonic": None,
     "note": "LATE, its own video; שווא נח (resting) before שווא נע (whisper)",
     "targetLetters": ["בּ", "ד", "ל", "מ", "שׁ"],
     "cv": ["בְּ", "דְ", "לְ", "מְ"],
     "blendWords": [
    {"word": "לְבָנָה", "units": ["לְ", "בָ", "נָה"]},
    {"word": "דְּלִי", "units": ["דְּ", "לִי"]},
    {"word": "שְׁמֹנֶה", "units": ["שְׁ", "מֹ", "נֶה"]},
    {"word": "מְנֹרָה", "units": ["מְ", "נֹ", "רָה"]}
  ],
     "musicBed": "kids-play-ukulele"},
    {"order": 9, "key": "dagesh-kal",  "sign": "בּ",     "name_he": "דָּגֵשׁ קַל",   "sound": "b/v",
     "status": "draft", "mnemonic": None,
     "note": "דגש קל only — B/K/P vs V/CH/F; דגש חזק later",
     "targetLetters": ["בּ", "כּ", "פּ"],
     "cv": ["בּ", "כּ", "פּ"],
     "blendWords": [
         {"word": "בֵּית", "units": ["בֵּית"]},
         {"word": "כֶּלֶב", "units": ["כֶּ", "לֶב"]},
         {"word": "פֶּרַח", "units": ["פֶּ", "רַח"]},
         {"word": "בֹּקֶר", "units": ["בֹּ", "קֶר"]},
     ],
     "musicBed": "kids-play-ukulele"},
    # DEFERRED from v1 (findings §1): hataf forms; קמץ קטן (printed identically to
    # קמץ גדול — even adults conflate them). Note as "not in v1", never teach it.
]

# Fast key lookup. The validator (contracts.validate_reading_beats) resolves
# reading.nikkud against THIS so the contract and the data can never drift.
_BY_KEY = {row["key"]: row for row in CURRICULUM}


def get_nikkud(key: str) -> dict | None:
    """Return the curriculum row for a nikkud key, or None if unknown.

    >>> get_nikkud("kamatz")["name_he"]
    'קָמָץ'
    >>> get_nikkud("nope") is None
    True
    """
    return _BY_KEY.get(key)


def keys() -> list[str]:
    """All known nikkud keys, in introduction order."""
    return [row["key"] for row in CURRICULUM]


if __name__ == "__main__":
    for row in CURRICULUM:
        print(f"{row['order']:>2}. {row['key']:<12} {row.get('name_he','')}  ({row.get('status','')})")
