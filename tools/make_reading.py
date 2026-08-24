#!/usr/bin/env python3
"""make_reading.py — the transcript-driven Hebrew reading-track derivation engine.

The reading track is SCRIPT-FIRST: the human authors ONE file, `script.md` (front matter +
beat-tagged pointed Hebrew lines). From that single source of truth this engine DERIVES:
  - the nikkud (auto-detected from the pointed units, or from front matter)
  - the units[] (which lines/segments get sub-word highlight)
  - the target letters
  - reading.json (the unit manifest gen_voice_reading.py consumes)
  - beats.json (mode:reading, reading{} block, vo[] with PLANNED unit windows, beats[] schedule)
  - the thin GENERATED per-video wrapper comp (registration only; the renderer is generic)

The curriculum (tools/nikkud_data.py) is a REFERENCE/word-bank, not a closed gate: the script
supplies the words; the engine validates they are decodable against the nikkud taught (warning,
not blocking, on non-vetted words). The voice/timing/mux/QA pipeline is UNCHANGED — this tool
only emits the derived data with PLANNED unit windows; gen_voice_reading.py later replaces them
with REAL trimmed bounds.

Stdlib-only (Python 3.10+). Does NOT touch voice — no .venv-voice312 needed. Imports
tools/nikkud.py + tools/nikkud_data.py + the CV_GAP constant from gen_voice_reading.py (single
source for the stagger gap, so the planned windows and the real placer never drift).

Design reference: research/hebrew-reading/transcript-driven-design.md (authoritative).

CLI (run from repo root):
  python tools/make_reading.py reading-shorts/read-2-patach/script.md
      [--out-dir reading-shorts/read-2-patach]     # default: the script's own dir
      [--nikkud patach]                            # override front-matter/auto-detect
      [--force]                                    # overwrite existing reading.json/beats.json
      [--dry-run]                                  # print the derived JSON, write nothing
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import nikkud  # noqa: E402
import nikkud_data  # noqa: E402
from contracts import validate_reading_beats_dict  # noqa: E402
from gen_voice_reading import CV_GAP  # noqa: E402  (single source — never duplicated)

# ---------------------------------------------------------------------------
# Scheduled-window constants (seeded from the P0 probe trim table — findings §2/§4;
# gen_voice_reading.py replaces these PLANNED windows with REAL trimmed bounds later).
# ---------------------------------------------------------------------------
PLANNED_ONSET = 0.3        # onset slack before a held single sound (~0.2–0.4s probe)
PLANNED_UNIT_DUR = 0.3     # a held single sound at rate -18% (the trimmed speech window)
TAIL = 2.5                 # dead-tail rule: total = last speech end + ~2.5s
# Per-unit TIMELINE room the real placer occupies (NOT the trimmed speech window):
#   CV beat:  _place_cv spaces units by trimmed-speech-end + CV_GAP  -> ~1.15s each
#   blend:    _place_blend spaces by the FULL PADDED clip duration    -> ~2.0s each
#             (back-to-back by probe_duration, which includes edge-tts's ~1.05s trailing pad)
PLANNED_CV_STEP = 1.2
PLANNED_BLEND_STEP = 2.0
# Whole-line TTS estimate (hook/word/call): slowed Hebrew at rate -18% reads ~1.2 words/s
# for short directive phrases, plus per-clip onset+trailing-pad slack. Calibrated against the
# real edge-tts output (a 9-word hook synths to ~7.6s).
EST_WPS = 1.2
EST_PAD = 1.2

# A small static Latin CV transliteration for the sound-label only (never load-bearing — the
# pointed glyph is the content; author can override per-unit in front matter `sounds:`).
_CONSONANT_SOUNDS = {
    "א": "", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch",
    "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m", "נ": "n",
    "ן": "n", "ס": "s", "ע": "", "פ": "p", "ף": "p", "צ": "ts", "ץ": "ts", "ק": "k",
    "ר": "r", "ש": "sh", "ת": "t",
}
# NOTE: no dagesh alternates here — the kamatz pilot labels בָּ as "ba" (with dagesh), so the
# reading track treats a dagesh-carrying letter by its base sound for the display label. The
# dagesh-kal video (order 9) is its own teaching moment and overrides via front-matter sounds:.

# Default hook/call generated from the nikkud row when the author omits them (design §1.5).
DEFAULT_HOOK = "בּוּ בּוּ! הַיּוֹם לוֹמְדִים {name_he}!"
DEFAULT_CALL = "אַתֶּם!"

# Role keyword aliases (design §1.3) — ASCII canonical + Hebrew conveniences.
_ROLE_ALIASES = {
    "hook": "hook", "intro": "hook", "פתיחה": "hook",
    "isolated": "isolated", "letter": "isolated", "sound": "isolated", "אות": "isolated",
    "cv": "cv", "syllables": "cv", "syllable": "cv", "צירוף": "cv", "צירופים": "cv",
    "blend": "blend", "מיזוג": "blend",
    "word": "word", "read": "word", "מילה": "word",
    "call": "call", "response": "call", "call-response": "call", "תורכם": "call",
    "sub": "sub",
}

_CANONICAL_ORDER = ["hook", "isolated", "cv", "blend", "word", "call"]
# beat name that realizes each role (mirrors contracts._READING_BEAT_FOR for the unit roles)
_BEAT_FOR = {
    "hook": "hook", "isolated": "teach-isolated", "cv": "teach-cv",
    "blend": "blend", "word": "read-word", "call": "call-response",
}

_TRUE_VOWELS = {"kamatz", "patach", "tzere-segol", "chirik", "cholam", "shuruk", "kubutz",
                "hataf-segol", "hataf-patach", "hataf-kamatz"}
# signs explicitly deferred from v1 (design: raising "not in v1" for these)
_DEFERRED = {"hataf-segol", "hataf-patach", "hataf-kamatz"}


# ---------------------------------------------------------------------------
# §2.1 parse_script
# ---------------------------------------------------------------------------
def parse_script(path):
    """Parse a transcript script.md -> {"meta": {...}, "beats": [{role,text}, ...]}.

    Raises ValueError (with line number) on any unrecognized non-empty line. Roles are
    canonicalized through the alias table. Blank lines and comments are dropped. Front matter
    is collected but defaults are NOT applied here. A `sub:` line attaches as a modifier to the
    preceding beat (decorative sub-caption, no highlight)."""
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    meta = {}
    beats = []  # list of {"role", "text", "sub": <str|None>}
    in_frontmatter = False
    saw_role_line = False
    pending_sub = None

    def _err(msg, lineno):
        raise ValueError(f"{path}:{lineno}: {msg}")

    lines = raw.splitlines()
    i = 0
    for lineno, line in enumerate(lines, 1):
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            continue
        if s == "---":
            in_frontmatter = not in_frontmatter
            continue
        # front matter: `key: value`, only before the first role line (or inside fence)
        if (in_frontmatter or not saw_role_line) and not _is_role_prefix(s):
            m = re.match(r"^([A-Za-z0-9_]+)\s*:\s*(.*)$", s)
            if m:
                key, val = m.group(1).strip(), m.group(2).strip()
                meta[key] = _coerce_frontmatter(key, val)
                continue
        # role line (or sub: modifier): split on the FIRST colon, left token is a known alias
        m = re.match(r"^([^\s:]+)\s*:\s*(.*)$", s)
        if not m:
            _err(f"unrecognized line (not a role line / front matter / comment): {s!r}", lineno)
        key, text = m.group(1).strip().lower(), m.group(2).strip()
        canonical = _ROLE_ALIASES.get(key)
        if canonical is None:
            _err(f"unknown role keyword {key!r}", lineno)
        if canonical == "sub":
            if not beats:
                _err("a 'sub:' line must follow a role line", lineno)
            beats[-1]["sub"] = text
            continue
        beats.append({"role": canonical, "text": text, "sub": None})
        saw_role_line = True
    # a trailing pending_sub (sub on the very last line) already handled inline.
    return {"meta": meta, "beats": beats}


def _is_role_prefix(s):
    """True if the line starts with a known role keyword + colon (used to end front-matter mode)."""
    m = re.match(r"^([^\s:]+)\s*:", s)
    return bool(m) and _ROLE_ALIASES.get(m.group(1).strip().lower()) is not None


def _coerce_frontmatter(key, val):
    if key in ("loop",):
        return val.lower() in ("true", "yes", "1")
    if key in ("sounds",):
        # `sounds: בָּ=ba, מָּ=ma` -> {"בָּ": "ba", "מָּ": "ma"}
        out = {}
        for pair in val.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                out[k.strip()] = v.strip()
        return out
    return val


# ---------------------------------------------------------------------------
# §2.2 detect_nikkud
# ---------------------------------------------------------------------------
def detect_nikkud(beats):
    """Auto-detect the taught nikkud from the isolated/cv/blend units (tally over true vowels).

    word beat is EXCLUDED (a whole word carries many vowels and would pollute the tally). The
    mode wins; ties/empty -> 'kamatz' (the §1 first-taught, highest-frequency default). Raises
    ValueError if the only vowels found are a deferred sign (not in v1)."""
    tally = {}
    for b in beats:
        if b["role"] not in ("isolated", "cv", "blend"):
            continue
        gs = nikkud.graphemes(b["text"])
        for g in gs:
            v = nikkud.nikkud_of(g)
            if v is None or v in ("shva", "shva-na", "dagesh", "shin-dot", "sin-dot"):
                continue
            if v not in _TRUE_VOWELS:
                continue
            tally[v] = tally.get(v, 0) + 1
    if not tally:
        return "kamatz"
    top = max(tally, key=lambda k: (tally[k], -list(tally).index(k) if k in tally else 0))
    # determinism on ties: pick the one appearing first in introduction order
    order = list(nikkud_data.keys())
    top = max(tally, key=lambda k: (tally[k], -(order.index(k) if k in order else 0)))
    if top in _DEFERRED:
        raise ValueError(
            f"detected nikkud {top!r} is a deferred sign (not in v1). "
            f"Tally: {tally}. This transcript teaches a hataf form — v1 doesn't cover it yet.")
    return top


# ---------------------------------------------------------------------------
# §2.3 derive_units
# ---------------------------------------------------------------------------
def _cv_sound_label(g, nikkud_row, overrides):
    """A simple Latin sound label for a pointed grapheme (display only; never load-bearing)."""
    if overrides and g in overrides:
        return overrides[g]
    base = nikkud.strip_to_base(g)
    if base not in _CONSONANT_SOUNDS:
        return nikkud_row.get("sound", "a")
    cons = _CONSONANT_SOUNDS[base]
    vow = nikkud_row.get("sound", "a")
    return (cons + vow) if cons else vow


def derive_units(beats, nikkud_row, overrides=None):
    """Return one entry per unit-carrying beat:
        {"role": isolated|cv|blend, "text", "units":[{"g":...}], "syllables":[...]?}

    isolated: units = [the single pointed grapheme]
    cv:       units = one per whitespace-separated צירוף token, each re-validated single-syllable
    blend:    units = syllabify(text); a vetted blendWords[] entry's units WIN over structural.
    Also cross-checks each unit's nikkud against the taught key (WARN on mismatch), and warns on
    non-vetted words (curriculum is a reference, not a gate)."""
    overrides = overrides or {}
    out = []
    for b in beats:
        role = b["role"]
        if role not in ("isolated", "cv", "blend"):
            continue
        text = b["text"]
        entry = {"role": role, "text": text, "units": [], "syllables": None}
        if role == "isolated":
            gs = nikkud.graphemes(text)
            if len(gs) != 1:
                raise ValueError(f"isolated beat must be a SINGLE pointed grapheme, got {len(gs)}: {text!r}")
            entry["units"] = [{"g": gs[0]}]
        elif role == "cv":
            tokens = [t for t in text.split() if t]
            for tok in tokens:
                syll = nikkud.syllabify(tok)
                if len(syll) != 1:
                    raise ValueError(f"cv token must be a single syllable (צירוף): {tok!r} -> {syll}")
                entry["units"].append({"g": tok})
        elif role == "blend":
            # vetted split wins if the word is in the row's blendWords
            vetted = None
            for bw in (nikkud_row.get("blendWords") or []):
                if bw.get("word") == text:
                    vetted = bw.get("units")
                    break
            if vetted:
                entry["units"] = [{"g": u} for u in vetted]
                entry["syllables"] = vetted
            else:
                syll = nikkud.syllabify(text)
                if len(syll) < 2:
                    # a single-syllable blend is unusual but allowed (defensive); still ship it
                    pass
                entry["units"] = [{"g": s} for s in syll]
                entry["syllables"] = syll
                if nikkud_row.get("blendWords"):
                    print(f"  WARN  blend word {text!r} not in the vetted blendWords bank — "
                          f"structural split {syll} used; confirm the pointing (listening QA).")
        # cross-check: each unit must carry the taught SOUND or be a mater/silent letter.
        # Compare by PHONEME, not key: kamatz and patach are both /a/ (same-sound pair, taught
        # right after each other), so a kamatz-pointed syllable inside a patach word is fine.
        # Only a genuinely DIFFERENT vowel sound (chirik /i/, cholam /o/, ...) gets flagged.
        taught = nikkud_row.get("key")
        taught_sound = nikkud_row.get("sound", "a")
        _sound_of_key = {"kamatz": "a", "patach": "a", "tzere-segol": "e", "chirik": "i",
                         "cholam": "o", "shuruk": "u", "kubutz": "u"}
        for u in entry["units"]:
            v = nikkud.nikkud_of(u["g"])
            if v is None:
                continue  # mater / silent letter (e.g. the coda ם in גַּם) — fine
            if v in ("shva", "shva-na", "dagesh", "shin-dot", "sin-dot"):
                continue
            v_sound = _sound_of_key.get(v)
            if v_sound is not None and v_sound != taught_sound:
                print(f"  WARN  unit {u['g']!r} carries {v!r} (/ {v_sound} /) but the taught "
                      f"nikkud is {taught!r} (/ {taught_sound} /) — a different vowel sound; "
                      f"verify the pointing (listening QA).")
        out.append(entry)
    return out


# ---------------------------------------------------------------------------
# §2.4 build_reading
# ---------------------------------------------------------------------------
def _slugify(s):
    s = nikkud.strip_to_base(s)
    tr = {"א": "alef", "ב": "bet", "ג": "gimel", "ד": "dalet", "ה": "he", "ו": "vav",
          "ז": "zayin", "ח": "chet", "ט": "tet", "י": "yod", "כ": "kaf", "ך": "kaf",
          "ל": "lamed", "מ": "mem", "ם": "mem", "נ": "nun", "ן": "nun", "ס": "samekh",
          "ע": "ayin", "פ": "pe", "ף": "pe", "צ": "tsadi", "ץ": "tsadi", "ק": "qof",
          "ר": "resh", "ש": "shin", "ת": "tav"}
    return "".join(tr.get(ch, "x") for ch in s) or "grapheme"


def build_reading(beats, units, nikkud_row, meta):
    """Assemble reading.json (the unit manifest gen_voice_reading.py consumes)."""
    overrides = meta.get("sounds") or {}
    voice = meta.get("voice", "he-IL-HilaNeural")
    rate = meta.get("rate", "-18%")
    manifest_units = []
    unit_idx = 0
    for e in units:
        role = e["role"]
        if role == "blend":
            # ONE blend entry per blend beat: the whole word + the syllables array (matches the
            # kamatz pilot manifest; gen_voice_reading._place_blend synthesizes each syllable).
            whole = e["text"]
            uid = f"blend-{_slugify(whole)}-{unit_idx}"
            manifest_units.append({
                "id": uid, "grapheme": whole,
                "sound": "-".join(_cv_sound_label(u["g"], nikkud_row, overrides) for u in e["units"]),
                "role": "blend", "syllables": e["syllables"],
            })
            unit_idx += 1
            continue
        for i, u in enumerate(e["units"]):
            g = u["g"]
            uid = f"{role}-{_slugify(g)}-{unit_idx}"
            manifest_units.append({
                "id": uid, "grapheme": g,
                "sound": _cv_sound_label(g, nikkud_row, overrides),
                "role": role,
            })
            unit_idx += 1
    # word beats: one continuous clip -> role:"word" entry, no syllables
    for b in beats:
        if b["role"] == "word":
            txt = b["text"]
            manifest_units.append({
                "id": f"word-{_slugify(txt)}-{len(manifest_units)}",
                "grapheme": txt, "sound": "", "role": "word",
            })
    return {
        "voice": voice,
        "rate": rate,
        "note": "AUTO-DERIVED by tools/make_reading.py from script.md. role in isolated|cv|blend|word. "
                "isolated/cv = one clip per unit -> vo[].units[] (real trimmed windows). "
                "blend = each syllable its own clip, stitched back-to-back (continuous blending). "
                "word = one continuous clip -> NO units[] (whole-word highlight).",
        "units": manifest_units,
    }


# ---------------------------------------------------------------------------
# §2.5/§2.6 build_beats + scheduler
# ---------------------------------------------------------------------------
def _strip_punct(s):
    return s.rstrip("!.…, ")


def build_beats(meta, beats, units, nikkud_row, out_dir):
    """Assemble the full mode:reading beats.json (metadata, reading{}, vo[], beats[]) with
    PLANNED unit windows, then validate with contracts.validate_reading_beats_dict."""
    proj_id = meta.get("id") or os.path.basename(out_dir.rstrip("/\\"))
    nikkud_key = nikkud_row["key"]
    title = meta.get("title") or f"בּוּ מְלַמֵּד {nikkud_row.get('name_he', nikkud_key)}"
    composition = meta.get("composition") or _composition_id(proj_id, nikkud_key)

    # derive targetLetters from the script's CV/isolated units (fall back to the row).
    # Match the row's shape (base letter + dagesh where present, e.g. "בּ"), NOT the pointed
    # grapheme with its vowel — targetLetters names the CONSONANT letters taught, display/QA only.
    taught_letters = []
    for e in units:
        if e["role"] in ("isolated", "cv"):
            for u in e["units"]:
                gs = nikkud.graphemes(u["g"])
                if not gs:
                    continue
                base = nikkud.strip_to_base(gs[0])
                # keep the dagesh in the letter itself (בּ) — it's part of the consonant identity
                full = (base + "ּ") if nikkud.has_dagesh(gs[0]) else base
                taught_letters.append(full)
    # dedupe preserving order
    seen = set()
    targetLetters = [l for l in taught_letters if not (l in seen or seen.add(l))]
    if not targetLetters:
        targetLetters = list(nikkud_row.get("targetLetters") or [])

    # progression from which unit roles are present
    present = [r for r in ("isolated", "cv", "blend", "word") if any(b["role"] == r for b in beats)]
    progression = []
    for step in ("isolated", "cv", "blend", "word"):
        if step in present:
            progression.append(step)

    anchorWords = [ _strip_punct(b["text"]) for b in beats if b["role"] == "word" ]

    reading_block = {
        "nikkud": nikkud_key,
        "sign": nikkud_row.get("sign", "בָּ"),
        "sound": nikkud_row.get("sound", "a"),
        "targetLetters": targetLetters,
        "progression": progression,
        "anchorWords": anchorWords,
    }

    # ---- scheduler: assign vo[].start/end + planned units + beats[] ----
    # Ordering: hook -> isolated -> cv -> blend -> word -> call (canonical), repeats in encounter
    # order within their group. Gaps per design §2.6.
    # A unit-carrying role may REPEAT (e.g. several blend lines in one video). A plain
    # {role: entry} dict keeps only the LAST repeat, stamping every line with the same units
    # (the read-3-kamatz-aba bug). Keep a per-role QUEUE and pop in encounter order so each
    # repeated line gets its own derived units.
    from collections import deque
    unit_queues = {}
    for e in units:
        unit_queues.setdefault(e["role"], deque()).append(e)

    def _take_units(role):
        q = unit_queues.get(role)
        if not q:
            raise ValueError(f"scheduler: no derived units left for role {role!r} "
                             f"(more '{role}' lines than derived unit sets)")
        return q.popleft()
    vo_lines = []
    beats_sched = []
    cursor = 0.0

    def est_tts(text):
        # Slowed Hebrew at rate -18% reads ~1.2 words/s for short directive phrases, plus
        # per-clip onset+trailing-pad slack. Generous on purpose — the real trimmed windows
        # replace these, and the slack becomes hold time (calm is good for kids).
        nwords = max(1, len([w for w in text.split() if w]))
        return nwords / EST_WPS + EST_PAD

    # build the beat schedule order (canonical, preserving encounter order per role)
    ordered = []
    for role in _CANONICAL_ORDER:
        for b in beats:
            if b["role"] == role:
                ordered.append(b)

    for b in ordered:
        role = b["role"]
        beat_name = _BEAT_FOR[role]
        text = b["text"]
        line = {"beat": beat_name, "text": text, "tts": text}
        if role == "hook":
            start = cursor
            dur = est_tts(text)
            line["start"] = round(start, 3)
            line["end"] = round(start + dur, 3)
            cursor = line["end"] + 0.6
        elif role == "isolated":
            e = _take_units("isolated")
            start = cursor + 0.4
            g = e["units"][0]["g"]
            onset = start + PLANNED_ONSET
            line["start"] = round(start, 3)
            line["end"] = round(onset + PLANNED_UNIT_DUR, 3)
            line["units"] = [{"g": g, "start": round(onset, 3),
                              "end": round(onset + PLANNED_UNIT_DUR, 3)}]
            cursor = line["end"] + 1.2
        elif role == "cv":
            e = _take_units("cv")
            start = cursor + 0.4
            line["start"] = round(start, 3)
            off = PLANNED_ONSET
            us = []
            for u in e["units"]:
                s = start + off
                us.append({"g": u["g"], "start": round(s, 3), "end": round(s + PLANNED_UNIT_DUR, 3)})
                off += PLANNED_CV_STEP
            line["units"] = us
            line["end"] = round(us[-1]["end"], 3)
            cursor = line["end"] + 1.2
        elif role == "blend":
            e = _take_units("blend")
            start = cursor + 0.4
            line["start"] = round(start, 3)
            # back-to-back stacking by the FULL PADDED clip duration (matches _place_blend's
            # `off += probe_duration`, which includes edge-tts's ~1.05s trailing pad)
            off = PLANNED_ONSET
            us = []
            for u in e["units"]:
                s = start + off
                us.append({"g": u["g"], "start": round(s, 3), "end": round(s + PLANNED_UNIT_DUR, 3)})
                off += PLANNED_BLEND_STEP
            line["units"] = us
            line["end"] = round(start + PLANNED_ONSET + PLANNED_BLEND_STEP * len(us) + 0.4, 3)
            cursor = line["end"] + 0.8
        elif role == "word":
            start = cursor + 0.5
            dur = est_tts(text)
            line["start"] = round(start, 3)
            line["end"] = round(start + dur, 3)
            cursor = line["end"] + 0.8
        elif role == "call":
            start = cursor + 0.5
            dur = est_tts(text) + 2.5  # engineered response pause (real silence, no filler word)
            line["start"] = round(start, 3)
            line["end"] = round(start + dur, 3)
            line["pause"] = True
            line["note"] = ("call-and-response: 'you!' then an engineered ~2.5s silent pause so "
                            "the child answers aloud. The pause is REAL silence (the trailing "
                            "tail), not a spoken filler word.")
            cursor = line["end"]
        # record the vo line + the visual beat schedule
        if b.get("sub"):
            line["sub"] = b["sub"]
        vo_lines.append(line)
        beats_sched.append({"name": beat_name, "start_s": round(line["start"], 3),
                            "end_s": round(line["end"], 3)})

    total = round(cursor + TAIL, 3)
    beats_sched[-1]["end_s"] = total  # final beat stretches over the tail

    d = {
        "id": proj_id,
        "title": title,
        "mode": "reading",
        "language": "he",
        "series": "bu-koala-reading",
        "composition": composition,
        "characterRef": "ai-shorts/bu-koala/character.jpg",
        "musicBed": meta.get("musicBed", "kids-play-ukulele"),
        "format": {"width": 1080, "height": 1920, "fps": 30, "durationSec": total},
        "loop": meta.get("loop", False),
        "notes": (f"AUTO-DERIVED by tools/make_reading.py from script.md (transcript-driven). "
                  f"Teaches {nikkud_row.get('name_he', nikkud_key)} ({nikkud_key}, /{nikkud_row.get('sound','a')}/) "
                  f"to ages 5-7. mode:reading, language:he. The pointed letter/syllable highlights "
                  f"in EXACT sync with the spoken unit. The units[] here are PLANNED windows seeded "
                  f"from the P0 probe trim table; gen_voice_reading.py replaces them with REAL "
                  f"trimmed bounds. Register 5-7: short directive prompts + call-and-response. "
                  f"In-TSX koala tile (no AI stills, $0). Loop relaxed (loop:false). No CTA."),
        "reading": reading_block,
        "vo": vo_lines,
        "beats": beats_sched,
    }
    # validate in-memory (dict overload) before returning
    validate_reading_beats_dict(d)
    return d


def _composition_id(proj_id, nikkud_key):
    """Derive a PascalCase comp id from the project id, e.g. read-2-patach -> Read2Patach."""
    m = re.match(r"^read-(\d+)-(.*)$", proj_id)
    if m:
        num = m.group(1)
        name = "".join(part[:1].upper() + part[1:] for part in m.group(2).split("-") if part)
        return f"Read{num}{name}"
    parts = proj_id.replace("-", " ").split()
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


# ---------------------------------------------------------------------------
# Wrapper-writer — the thin GENERATED per-video registration stub (design §3.4)
# ---------------------------------------------------------------------------
def write_wrapper(out_dir, d, shots_dir):
    """Write the thin generated wrapper TSX that imports the generic renderer + vo.gen.ts.
    Regenerated by gen_voice_reading.py after voice gen (duration literal)."""
    comp_id = d["composition"]
    group = os.path.basename(out_dir.rstrip("/\\"))
    # convert project dir (read-2-patach) to the shots group (read-2)
    m = re.match(r"^(read-\d+)(?:-.*)?$", group)
    shots_group = m.group(1) if m else group
    wdir = os.path.join(shots_dir, shots_group)
    os.makedirs(wdir, exist_ok=True)
    path = os.path.join(wdir, f"{comp_id}.tsx")
    # relative path FROM THE WRAPPER FILE to the project beats.json (crosses outside remotion/src,
    # so it must be exact — 4 levels up: read-N -> shots -> src -> remotion -> repo root)
    rel_beats = os.path.relpath(os.path.join(out_dir, "beats.json"), wdir).replace("\\", "/")
    dur = d["format"]["durationSec"]
    content = f"""import React from 'react';
import {{ ReadingShort }} from '../../lib/reading-render';
import beats from '{rel_beats}';
import {{ VO }} from './vo.gen';

// AUTO-GENERATED by tools/make_reading.py — registration stub only. Never hand-edit.
// The generic ReadingShort renders any mode:reading beats.json; this file exists so
// gen-registry has a stable compositionConfig.id + durationInSeconds per video.
export const compositionConfig = {{
  id: '{comp_id}',
  durationInSeconds: {dur},
  fps: 30,
  width: 1080,
  height: 1920,
}};
const {comp_id}: React.FC = () => <ReadingShort beats={{beats}} vo={{VO}} />;
export default {comp_id};
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"wrapper written -> {os.path.relpath(path, ROOT)}  (id={comp_id}, {dur}s)")
    return path


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Derive reading.json + beats.json + wrapper from script.md")
    ap.add_argument("script", help="path to the transcript script.md")
    ap.add_argument("--out-dir", help="output dir (default: the script's own dir)")
    ap.add_argument("--nikkud", help="override front-matter/auto-detect (nikkud_data key)")
    ap.add_argument("--force", action="store_true", help="overwrite existing reading.json/beats.json")
    ap.add_argument("--dry-run", action="store_true", help="print the derived JSON, write nothing")
    args = ap.parse_args()

    script_path = os.path.abspath(args.script)
    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.dirname(script_path)
    if not os.path.exists(script_path):
        sys.exit(f"script not found: {script_path}")

    parsed = parse_script(script_path)
    meta = dict(parsed["meta"])
    beats = parsed["beats"]

    # defaults (design §1.2): musicBed, loop, voice, rate — track whether author wrote them
    meta.setdefault("musicBed", "kids-play-ukulele")
    meta.setdefault("loop", False)
    meta.setdefault("voice", "he-IL-HilaNeural")
    meta.setdefault("rate", "-18%")
    meta.setdefault("id", os.path.basename(out_dir.rstrip("/\\")))

    # detect nikkud
    detected = detect_nikkud(beats)
    declared = meta.get("nikkud")
    if args.nikkud:
        declared = args.nikkud
    if declared:
        if declared != detected:
            sys.exit(f"CONTRACT FAIL: front matter/--nikkud says {declared!r} but the pointed units "
                     f"teach {detected!r} (tally). One of them is wrong — never teach a wrong sign "
                     f"name. Fix the transcript or override with --nikkud {detected}.")
    nikkud_key = declared or detected
    nikkud_row = nikkud_data.get_nikkud(nikkud_key)
    if nikkud_row is None:
        sys.exit(f"unknown nikkud key {nikkud_key!r} — not in nikkud_data.CURRICULUM")
    meta["nikkud"] = nikkud_key

    # auto-generate missing hook/call (design §1.5)
    has_hook = any(b["role"] == "hook" for b in beats)
    has_call = any(b["role"] == "call" for b in beats)
    if not has_hook:
        default_hook = DEFAULT_HOOK.format(name_he=nikkud_row.get("name_he", nikkud_key))
        beats.insert(0, {"role": "hook", "text": default_hook, "sub": None})
        print(f"  note  no hook: line — using default hook: {default_hook!r}")
    if not has_call:
        beats.append({"role": "call", "text": DEFAULT_CALL, "sub": None})
        print(f"  note  no call: line — using default call: {DEFAULT_CALL!r}")
    # no isolated -> hard error (contract requires it)
    if not any(b["role"] == "isolated" for b in beats):
        sys.exit("CONTRACT FAIL: transcript has no 'isolated' line — the progression floor "
                 "requires one (the teach-isolated beat is the product's promise).")

    # guard against clobbering voice output
    beats_out = os.path.join(out_dir, "beats.json")
    if os.path.exists(beats_out) and not args.force and not args.dry_run:
        try:
            existing = json.load(open(beats_out, encoding="utf-8"))
        except Exception:
            existing = {}
        if existing.get("voiceStatus"):
            sys.exit("beats.json already has voiceStatus set (voice generated). Re-running "
                     "make_reading.py would clobber the REAL trimmed unit windows. Use --force to "
                     "regenerate (loses the real timing).")

    units = derive_units(beats, nikkud_row, meta.get("sounds"))
    reading = build_reading(beats, units, nikkud_row, meta)
    d = build_beats(meta, beats, units, nikkud_row, out_dir)

    if args.dry_run:
        print(json.dumps(d, ensure_ascii=False, indent=2))
        print(f"dry-run — {len(d['vo'])} vo line(s), {len(d['beats'])} beat(s), {d['format']['durationSec']}s. Nothing written.")
        return

    os.makedirs(out_dir, exist_ok=True)
    reading_path = os.path.join(out_dir, "reading.json")
    with open(reading_path, "w", encoding="utf-8") as f:
        json.dump(reading, f, ensure_ascii=False, indent=2)
    with open(beats_out, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print(f"reading.json -> {os.path.relpath(reading_path, ROOT)}")
    print(f"beats.json   -> {os.path.relpath(beats_out, ROOT)}  (durationSec {d['format']['durationSec']}s)")
    # curriculum snapshot (optional reference metadata)
    cur = dict(nikkud_row)
    cur_path = os.path.join(out_dir, "curriculum.json")
    with open(cur_path, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, indent=2)
    print(f"curriculum.json -> {os.path.relpath(cur_path, ROOT)}")
    # wrapper
    shots_dir = os.path.join(ROOT, "remotion", "src", "shots")
    write_wrapper(out_dir, d, shots_dir)
    print("OK: make_reading.py derived reading.json + beats.json + wrapper (validate_reading_beats PASS)")


if __name__ == "__main__":
    main()
