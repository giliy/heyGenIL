#!/usr/bin/env python3
"""
lexicon.py — per-vertical ad lexicons for /make-ad Stage 1.

The lexicons.json file is the single source of truth for "how to write an ad in Hebrew for
vertical X": register (the grammatical gender/person of ALL persuasive copy), the address
pronoun, the default edge-tts voice, the offer structure, the proof type, the CTA (and the
CTA to NEVER use), urgency phrases, magic phrases, and hard taboos. Baked from
research/hebrew-ads/hebrew-ads-deep-dive.md (§4, §6, §7, §8, §9).

Used two ways:

  1. As a library — the make-ad skill loads the vertical's playbook while drafting the script:
       import lexicon
       lx = lexicon.get("beauty")
       lx["register"]            # "feminine-singular"
       lx["address"]             # "את"
       lx["voice"]               # "he-IL-HilaNeural"
       lx["offer_structure"]     # "concern → empathy → ..."
       lexicon.cta("beauty")     # "להזמנת תור"
       lexicon.hooks("beauty")   # ["pain-question", "social-proof"]

  2. As a CLI — to dump one vertical (or all) for the skill / a human to read:
       python tools/lexicon.py beauty          # one vertical, human-readable
       python tools/lexicon.py beauty --json   # machine-readable
       python tools/lexicon.py --list          # all vertical keys + labels
       python tools/lexicon.py --check beauty "תפוס מקום"   # does the text hit a never-CTA / taboo?

The register note (ISRAELI > ACADEMY) applies to every vertical — see default_register_note.
"""

import argparse
import io
import json
import os
import sys

# Windows consoles default to cp1252 — force UTF-8 so Hebrew prints clean.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
_LEX_PATH = os.path.join(_HERE, "lexicons.json")


def _load():
    with io.open(_LEX_PATH, encoding="utf-8") as f:
        return json.load(f)


def list_verticals():
    """Return {key: label} for every concrete vertical (skips _meta keys)."""
    d = _load()
    return {k: v.get("label", k) for k, v in d.items()
            if not k.startswith("_") and isinstance(v, dict)}


def register_note():
    """The cross-vertical register rule (ISRAELI > ACADEMY)."""
    return _load().get("default_register_note", "")


def get(vertical):
    """Return the full lexicon dict for a vertical, or raise KeyError with the valid keys."""
    d = _load()
    if vertical not in d or not isinstance(d[vertical], dict):
        raise KeyError(f"unknown vertical {vertical!r}; valid: {sorted(list_verticals())}")
    return d[vertical]


def cta(vertical):
    return get(vertical).get("cta", "הזמינו עכשיו")


def cta_never(vertical):
    return get(vertical).get("cta_never", "")


def hooks(vertical):
    return get(vertical).get("hook_styles", [])


def voice(vertical):
    return get(vertical).get("voice", "he-IL-AvriNeural")


def violations(vertical, text):
    """Return the list of never-CTAs / taboo phrases from `text` that appear in `text`
    (a cheap lint the skill runs on a drafted headline/VO line before building)."""
    lx = get(vertical)
    hits = []
    never = lx.get("cta_never")
    if never and never in text:
        hits.append(("never-cta", never))
    for t in lx.get("taboos", []):
        # taboos are descriptive rules, not literal strings — only flag exact-substring hits
        # when the taboo is quoted (contains «"»), else skip (can't substring-match a rule).
        if '"' in t:
            for frag in t.split('"'):
                if frag and frag in text and frag != t:
                    hits.append(("taboo", frag))
    return hits


def _print_vertical(key):
    lx = get(key)
    print(f"\n=== {key} — {lx.get('label','')} ===")
    order = ["register", "address", "gender_note", "voice", "hook_styles", "vocab",
             "offer_structure", "proof", "cta", "cta_never", "urgency", "magic_phrases", "taboos"]
    for k in order:
        v = lx.get(k)
        if v in (None, "", []):
            continue
        if isinstance(v, list):
            print(f"  {k:16}: " + " · ".join(v))
        else:
            print(f"  {k:16}: {v}")
    print(f"  {'(register rule)':16}: {register_note()}")


def main():
    ap = argparse.ArgumentParser(description="per-vertical ad lexicons for /make-ad")
    ap.add_argument("vertical", nargs="?", help="vertical key (see --list)")
    ap.add_argument("text", nargs="?", help="text to lint with --check")
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    ap.add_argument("--list", action="store_true", help="list all vertical keys + labels")
    ap.add_argument("--check", action="store_true", help="lint <vertical> <text> for never-CTA/taboo hits")
    args = ap.parse_args()

    if args.list:
        for k, label in list_verticals().items():
            print(f"  {k:12} {label}")
        return 0

    if args.check:
        if not args.vertical or args.text is None:
            sys.exit("usage: lexicon.py --check <vertical> <text>")
        hits = violations(args.vertical, args.text)
        if hits:
            for kind, frag in hits:
                print(f"HIT [{kind}]: {frag}")
            return 1
        print("clean")
        return 0

    if not args.vertical:
        ap.print_help()
        return 0

    lx = get(args.vertical)
    if args.json:
        print(json.dumps(lx, ensure_ascii=False, indent=2))
    else:
        _print_vertical(args.vertical)
    return 0


if __name__ == "__main__":
    sys.exit(main())
