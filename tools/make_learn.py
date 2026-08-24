#!/usr/bin/env python3
"""make_learn.py — the generalized transcript-driven Hebrew LEARN-track derivation engine.

The learn track teaches ONE Hebrew concept per short to ages 5-7 — a nikkud, a letter, a
number, a word-class. Every type is SCRIPT-FIRST: the human authors ONE file, `script.md`
(front matter + beat-tagged pointed Hebrew lines). From that single source of truth this
engine DERIVES the taught concept, the units[] (which segments get sub-word highlight),
the unit manifest (reading.json), the beats.json (mode + block + vo[] planned windows +
beats[] schedule), and the thin GENERATED registration wrapper.

This is the GENERALIZATION of tools/make_reading.py: everything nikkud-specific is moved
into a per-type DATA PACK (tools/learn_data/<type>.py) and the engine here drives it
generically. A new lesson type is a new data pack, NOT a fork of this file.

Stdlib-only (Python 3.10+). Does NOT touch voice — no .venv-voice312 needed.

CLI (run from repo root):
  python tools/make_learn.py reading-shorts/read-2-patach/script.md --type nikkud
      [--out-dir <dir>] [--key patach] [--force] [--dry-run]

`--type` defaults to nikkud today (the only registered pack until Phases 3-5 register
letter/number/wordclass). `--key` is the per-type concept key (a nikkud key for nikkud).
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import nikkud  # noqa: E402  (grapheme/syllable utilities shared by all types)
import learn_data  # noqa: E402
from contracts import validate_reading_beats_dict  # noqa: E402
from gen_voice_reading import CV_GAP  # noqa: F401,E402  (single source — never duplicated)

# ---------------------------------------------------------------------------
# Scheduled-window constants (seeded from the P0 probe trim table; gen_voice_reading.py
# replaces these PLANNED windows with REAL trimmed bounds later).
# ---------------------------------------------------------------------------
PLANNED_ONSET = 0.3
PLANNED_UNIT_DUR = 0.3
TAIL = 2.5
PLANNED_CV_STEP = 1.2
PLANNED_BLEND_STEP = 2.0
EST_WPS = 1.2
EST_PAD = 1.2

_CONSONANT_SOUNDS = {
    "א": "", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch",
    "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m", "נ": "n",
    "ן": "n", "ס": "s", "ע": "", "פ": "p", "ף": "p", "צ": "ts", "ץ": "ts", "ק": "k",
    "ר": "r", "ש": "sh", "ת": "t",
}


# ---------------------------------------------------------------------------
# parse_script (pack-agnostic — role aliases come from the pack)
# ---------------------------------------------------------------------------
def parse_script(path, role_aliases):
    """Parse a transcript script.md -> {"meta": {...}, "beats": [{role,text}, ...]}."""
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    meta = {}
    beats = []
    in_frontmatter = False
    saw_role_line = False

    def _err(msg, lineno):
        raise ValueError(f"{path}:{lineno}: {msg}")

    for lineno, line in enumerate(raw.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s == "---":
            in_frontmatter = not in_frontmatter
            continue
        if (in_frontmatter or not saw_role_line) and not _is_role_prefix(s, role_aliases):
            m = re.match(r"^([A-Za-z0-9_]+)\s*:\s*(.*)$", s)
            if m:
                meta[m.group(1).strip()] = _coerce_frontmatter(m.group(1).strip(), m.group(2).strip())
                continue
        m = re.match(r"^([^\s:]+)\s*:\s*(.*)$", s)
        if not m:
            _err(f"unrecognized line (not a role line / front matter / comment): {s!r}", lineno)
        key, text = m.group(1).strip().lower(), m.group(2).strip()
        canonical = role_aliases.get(key)
        if canonical is None:
            _err(f"unknown role keyword {key!r}", lineno)
        if canonical == "sub":
            if not beats:
                _err("a 'sub:' line must follow a role line", lineno)
            beats[-1]["sub"] = text
            continue
        beats.append({"role": canonical, "text": text, "sub": None})
        saw_role_line = True
    return {"meta": meta, "beats": beats}


def _is_role_prefix(s, role_aliases):
    m = re.match(r"^([^\s:]+)\s*:", s)
    return bool(m) and role_aliases.get(m.group(1).strip().lower()) is not None


def _coerce_frontmatter(key, val):
    if key in ("loop",):
        return val.lower() in ("true", "yes", "1")
    if key in ("sounds",):
        out = {}
        for pair in val.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                out[k.strip()] = v.strip()
        return out
    return val


# ---------------------------------------------------------------------------
# derive_units — nikkud-flavored today; per-type unit logic keys off pack["unit_roles"].
# ---------------------------------------------------------------------------
def _cv_sound_label(g, row, overrides, sound_of_key):
    if overrides and g in overrides:
        return overrides[g]
    base = nikkud.strip_to_base(g)
    if base not in _CONSONANT_SOUNDS:
        return row.get("sound", "a")
    cons = _CONSONANT_SOUNDS[base]
    vow = row.get("sound", "a")
    return (cons + vow) if cons else vow


def derive_units(beats, row, pack, overrides=None):
    """Return one entry per unit-carrying beat. Cross-checks each unit's vowel sound against
    the taught sound (WARN on a genuinely different vowel), and warns on non-vetted blend words."""
    overrides = overrides or {}
    unit_roles = set(pack["unit_roles"])
    sound_of_key = pack.get("sound_of_key") or {}
    taught = row.get("key")
    taught_sound = row.get("sound", "a")
    out = []
    for b in beats:
        role = b["role"]
        if role not in unit_roles:
            continue
        text = b["text"]
        entry = {"role": role, "text": text, "units": [], "syllables": None}
        if role == "isolated":
            gs = nikkud.graphemes(text)
            if len(gs) != 1:
                raise ValueError(f"isolated beat must be a SINGLE pointed grapheme, got {len(gs)}: {text!r}")
            entry["units"] = [{"g": gs[0]}]
        elif role == "cv":
            for tok in [t for t in text.split() if t]:
                syll = nikkud.syllabify(tok)
                if len(syll) != 1:
                    raise ValueError(f"cv token must be a single syllable (צירוף): {tok!r} -> {syll}")
                entry["units"].append({"g": tok})
        elif role == "blend":
            vetted = None
            for bw in (row.get("blendWords") or []):
                if bw.get("word") == text:
                    vetted = bw.get("units")
                    break
            if vetted:
                entry["units"] = [{"g": u} for u in vetted]
                entry["syllables"] = vetted
            else:
                syll = nikkud.syllabify(text)
                entry["units"] = [{"g": s} for s in syll]
                entry["syllables"] = syll
                if row.get("blendWords"):
                    print(f"  WARN  blend word {text!r} not in the vetted blendWords bank — "
                          f"structural split {syll} used; confirm the pointing (listening QA).")
        # cross-check: each unit must carry the taught SOUND or be a mater/silent letter.
        for u in entry["units"]:
            v = nikkud.nikkud_of(u["g"])
            if v is None or v in ("shva", "shva-na", "dagesh", "shin-dot", "sin-dot"):
                continue
            v_sound = sound_of_key.get(v)
            if v_sound is not None and v_sound != taught_sound:
                print(f"  WARN  unit {u['g']!r} carries {v!r} (/ {v_sound} /) but the taught "
                      f"concept is {taught!r} (/ {taught_sound} /) — a different vowel sound; "
                      f"verify the pointing (listening QA).")
        out.append(entry)
    return out


# ---------------------------------------------------------------------------
# build manifest (reading.json) + beats.json
# ---------------------------------------------------------------------------
def _slugify(s):
    s = nikkud.strip_to_base(s)
    tr = {"א": "alef", "ב": "bet", "ג": "gimel", "ד": "dalet", "ה": "he", "ו": "vav",
          "ז": "zayin", "ח": "chet", "ט": "tet", "י": "yod", "כ": "kaf", "ך": "kaf",
          "ל": "lamed", "מ": "mem", "ם": "mem", "נ": "nun", "ן": "nun", "ס": "samekh",
          "ע": "ayin", "פ": "pe", "ף": "pe", "צ": "tsadi", "ץ": "tsadi", "ק": "qof",
          "ר": "resh", "ש": "shin", "ת": "tav"}
    return "".join(tr.get(ch, "x") for ch in s) or "grapheme"


def build_manifest(beats, units, row, pack, meta):
    """Assemble the unit manifest (reading.json) gen_voice_reading.py consumes."""
    overrides = meta.get("sounds") or {}
    sound_of_key = pack.get("sound_of_key") or {}
    manifest_units = []
    unit_idx = 0
    for e in units:
        role = e["role"]
        if role == "blend":
            whole = e["text"]
            uid = f"blend-{_slugify(whole)}-{unit_idx}"
            manifest_units.append({
                "id": uid, "grapheme": whole,
                "sound": "-".join(_cv_sound_label(u["g"], row, overrides, sound_of_key) for u in e["units"]),
                "role": "blend", "syllables": e["syllables"],
            })
            unit_idx += 1
            continue
        for u in e["units"]:
            g = u["g"]
            uid = f"{role}-{_slugify(g)}-{unit_idx}"
            manifest_units.append({
                "id": uid, "grapheme": g,
                "sound": _cv_sound_label(g, row, overrides, sound_of_key),
                "role": role,
            })
            unit_idx += 1
    for b in beats:
        if b["role"] == "word":
            txt = b["text"]
            manifest_units.append({
                "id": f"word-{_slugify(txt)}-{len(manifest_units)}",
                "grapheme": txt, "sound": "", "role": "word",
            })
    return {
        "voice": meta.get("voice", "he-IL-HilaNeural"),
        "rate": meta.get("rate", "-18%"),
        "note": ("AUTO-DERIVED by tools/make_learn.py from script.md. role in "
                 + "|".join(pack["unit_roles"]) + "|word. isolated/cv = one clip per unit -> "
                 "vo[].units[] (real trimmed windows). blend = each syllable its own clip, "
                 "stitched back-to-back. word = one continuous clip -> NO units[]."),
        "units": manifest_units,
    }


def _strip_punct(s):
    return s.rstrip("!.…, ")


def build_beats(meta, beats, units, row, pack, out_dir):
    """Assemble the full beats.json (metadata, block, vo[], beats[]) with PLANNED windows."""
    proj_id = meta.get("id") or os.path.basename(out_dir.rstrip("/\\"))
    concept_key = row["key"]
    block_name = pack["block"]
    title = meta.get("title") or f"בּוּ מְלַמֵּד {row.get('name_he', concept_key)}"
    composition = meta.get("composition") or pack["composition_id"](proj_id, concept_key)

    # derive targetLetters from the script's CV/isolated units (fall back to the row).
    taught_letters = []
    for e in units:
        if e["role"] in ("isolated", "cv"):
            for u in e["units"]:
                gs = nikkud.graphemes(u["g"])
                if not gs:
                    continue
                base = nikkud.strip_to_base(gs[0])
                full = (base + "ּ") if nikkud.has_dagesh(gs[0]) else base
                taught_letters.append(full)
    seen = set()
    targetLetters = [l for l in taught_letters if not (l in seen or seen.add(l))]
    if not targetLetters:
        targetLetters = list(row.get("targetLetters") or [])

    present = [r for r in ("isolated", "cv", "blend", "word") if any(b["role"] == r for b in beats)]
    progression = [s for s in ("isolated", "cv", "blend", "word") if s in present]
    anchorWords = [_strip_punct(b["text"]) for b in beats if b["role"] == "word"]

    concept_block = {
        pack["concept_key"]: concept_key,
        "sign": row.get("sign", "בָּ"),
        "sound": row.get("sound", "a"),
        "targetLetters": targetLetters,
        "progression": progression,
        "anchorWords": anchorWords,
    }
    # A type pack may supply extra/renamed block fields (e.g. letter rows carry name_he + a bare
    # glyph, number rows carry the counted value). Merged LAST so a pack can override the defaults.
    if pack.get("block_fields"):
        concept_block.update(pack["block_fields"](row))

    from collections import deque
    unit_queues = {}
    for e in units:
        unit_queues.setdefault(e["role"], deque()).append(e)

    def _take_units(role):
        q = unit_queues.get(role)
        if not q:
            raise ValueError(f"scheduler: no derived units left for role {role!r}")
        return q.popleft()

    vo_lines = []
    beats_sched = []
    cursor = 0.0
    beat_for = pack["beat_for"]

    def est_tts(text):
        nwords = max(1, len([w for w in text.split() if w]))
        return nwords / EST_WPS + EST_PAD

    ordered = []
    for role in pack["canonical_order"]:
        for b in beats:
            if b["role"] == role:
                ordered.append(b)

    for b in ordered:
        role = b["role"]
        beat_name = beat_for[role]
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
            dur = est_tts(text) + 2.5
            line["start"] = round(start, 3)
            line["end"] = round(start + dur, 3)
            line["pause"] = True
            line["note"] = ("call-and-response: 'you!' then an engineered ~2.5s silent pause so "
                            "the child answers aloud. REAL silence, not a spoken filler word.")
            cursor = line["end"]
        if b.get("sub"):
            line["sub"] = b["sub"]
        vo_lines.append(line)
        beats_sched.append({"name": beat_name, "start_s": round(line["start"], 3),
                            "end_s": round(line["end"], 3)})

    total = round(cursor + TAIL, 3)
    beats_sched[-1]["end_s"] = total

    d = {
        "id": proj_id,
        "title": title,
        "mode": pack["mode"],
        "language": "he",
        "series": pack["series"],
        "composition": composition,
        "characterRef": "ai-shorts/bu-koala/character.jpg",
        "musicBed": meta.get("musicBed", "kids-play-ukulele"),
        "format": {"width": 1080, "height": 1920, "fps": 30, "durationSec": total},
        "loop": meta.get("loop", False),
        "notes": (f"AUTO-DERIVED by tools/make_learn.py (--type {pack['type']}) from script.md. "
                  f"Teaches {row.get('name_he', concept_key)} ({concept_key}, /{row.get('sound','a')}/) "
                  f"to ages 5-7. mode:{pack['mode']}, language:he. The pointed letter/syllable highlights "
                  f"in EXACT sync with the spoken unit. units[] are PLANNED windows; gen_voice_reading.py "
                  f"replaces them with REAL trimmed bounds. In-TSX koala tile (no AI stills, $0). "
                  f"Loop relaxed. No CTA."),
        block_name: concept_block,
        "vo": vo_lines,
        "beats": beats_sched,
    }
    # per-type extra validation if the pack supplies one; nikkud rides the reading validator.
    if pack.get("validate_extra"):
        pack["validate_extra"](d)
    elif pack["type"] == "nikkud":
        validate_reading_beats_dict(d)
    return d


def write_wrapper(out_dir, d, shots_dir):
    """Write the thin generated wrapper TSX (registration stub). Regenerated after voice gen.

    Picks the renderer by the beats mode: mode:"reading" -> reading-render/ReadingShort
    (the nikkud track), mode:"letter" -> learn-render/LearnShort (the letters track),
    and future modes (number/wordclass) ride LearnShort too via a mode map."""
    comp_id = d["composition"]
    mode = d.get("mode", "reading")
    # mode -> (module, component)
    _RENDERERS = {
        "reading": ("reading-render", "ReadingShort"),
        "letter": ("learn-render", "LearnShort"),
        "number": ("learn-render", "LearnShort"),
        "wordclass": ("learn-render", "LearnShort"),
    }
    mod, comp = _RENDERERS.get(mode, ("learn-render", "LearnShort"))
    group = os.path.basename(out_dir.rstrip("/\\"))
    m = re.match(r"^(read-\d+|learn-\d+|letter-\d+)(?:-.*)?$", group)
    shots_group = m.group(1) if m else group
    wdir = os.path.join(shots_dir, shots_group)
    os.makedirs(wdir, exist_ok=True)
    path = os.path.join(wdir, f"{comp_id}.tsx")
    rel_beats = os.path.relpath(os.path.join(out_dir, "beats.json"), wdir).replace("\\", "/")
    dur = d["format"]["durationSec"]
    content = f"""import React from 'react';
import {{ {comp} }} from '../../lib/{mod}';
import beats from '{rel_beats}';
import {{ VO }} from './vo.gen';

// AUTO-GENERATED by tools/make_learn.py — registration stub only. Never hand-edit.
// The generic {comp} renders any mode:{mode} beats.json; this file exists so
// gen-registry has a stable compositionConfig.id + durationInSeconds per video.
export const compositionConfig = {{
  id: '{comp_id}',
  durationInSeconds: {dur},
  fps: 30,
  width: 1080,
  height: 1920,
}};
const {comp_id}: React.FC = () => <{comp} beats={{beats}} vo={{VO}} />;
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
    ap = argparse.ArgumentParser(description="Derive manifest + beats.json + wrapper from script.md (learn track)")
    ap.add_argument("script", help="path to the transcript script.md")
    ap.add_argument("--type", default="nikkud", help="lesson type (learn_data pack name)")
    ap.add_argument("--out-dir", help="output dir (default: the script's own dir)")
    ap.add_argument("--key", help="override front-matter/auto-detect concept key (pack-specific)")
    ap.add_argument("--force", action="store_true", help="overwrite existing manifest/beats.json")
    ap.add_argument("--dry-run", action="store_true", help="print the derived JSON, write nothing")
    args = ap.parse_args()

    pack = learn_data.get_pack(args.type)
    if pack is None:
        sys.exit(f"unknown learn type {args.type!r} — registered: {', '.join(learn_data.types())}")

    script_path = os.path.abspath(args.script)
    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.dirname(script_path)
    if not os.path.exists(script_path):
        sys.exit(f"script not found: {script_path}")

    parsed = parse_script(script_path, pack["role_aliases"])
    meta = dict(parsed["meta"])
    beats = parsed["beats"]

    meta.setdefault("musicBed", "kids-play-ukulele")
    meta.setdefault("loop", False)
    meta.setdefault("voice", "he-IL-HilaNeural")
    meta.setdefault("rate", "-18%")
    meta.setdefault("id", os.path.basename(out_dir.rstrip("/\\")))

    # detect concept key (pack-specific)
    detected = pack["detect"](beats)
    declared = meta.get(pack["concept_key"]) or meta.get("key")
    if args.key:
        declared = args.key
    if declared and declared != detected:
        sys.exit(f"CONTRACT FAIL: front matter/--key says {declared!r} but the pointed units "
                 f"teach {detected!r} (tally). Never teach a wrong sign name. Fix the transcript "
                 f"or override with --key {detected}.")
    concept_key = declared or detected
    row = pack["get_row"](concept_key)
    if row is None:
        sys.exit(f"unknown {pack['concept_key']} key {concept_key!r} — not in the {pack['type']} pack")
    meta[pack["concept_key"]] = concept_key

    # auto-generate missing hook/call
    has_hook = any(b["role"] == "hook" for b in beats)
    has_call = any(b["role"] == "call" for b in beats)
    if not has_hook:
        default_hook = pack["default_hook"].format(name_he=row.get("name_he", concept_key))
        beats.insert(0, {"role": "hook", "text": default_hook, "sub": None})
        print(f"  note  no hook: line — using default hook: {default_hook!r}")
    if not has_call:
        beats.append({"role": "call", "text": pack["default_call"], "sub": None})
        print(f"  note  no call: line — using default call: {pack['default_call']!r}")
    if not any(b["role"] == "isolated" for b in beats):
        sys.exit("CONTRACT FAIL: transcript has no 'isolated' line — the progression floor "
                 "requires one (the teach-isolated beat is the product's promise).")

    beats_out = os.path.join(out_dir, "beats.json")
    if os.path.exists(beats_out) and not args.force and not args.dry_run:
        try:
            existing = json.load(open(beats_out, encoding="utf-8"))
        except Exception:
            existing = {}
        if existing.get("voiceStatus"):
            sys.exit("beats.json already has voiceStatus set (voice generated). Re-running would "
                     "clobber the REAL trimmed unit windows. Use --force (loses real timing).")

    units = derive_units(beats, row, pack, meta.get("sounds"))
    manifest = build_manifest(beats, units, row, pack, meta)
    d = build_beats(meta, beats, units, row, pack, out_dir)

    if args.dry_run:
        print(json.dumps(d, ensure_ascii=False, indent=2))
        print(f"dry-run — {len(d['vo'])} vo line(s), {len(d['beats'])} beat(s), {d['format']['durationSec']}s. Nothing written.")
        return

    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "reading.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    with open(beats_out, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print(f"reading.json -> {os.path.relpath(manifest_path, ROOT)}")
    print(f"beats.json   -> {os.path.relpath(beats_out, ROOT)}  (durationSec {d['format']['durationSec']}s)")
    cur = dict(row)
    cur_path = os.path.join(out_dir, "curriculum.json")
    with open(cur_path, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, indent=2)
    print(f"curriculum.json -> {os.path.relpath(cur_path, ROOT)}")
    shots_dir = os.path.join(ROOT, "remotion", "src", "shots")
    write_wrapper(out_dir, d, shots_dir)
    print(f"OK: make_learn.py (--type {pack['type']}) derived manifest + beats.json + wrapper (validate PASS)")


if __name__ == "__main__":
    main()
