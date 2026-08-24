#!/usr/bin/env python3
"""learn_data — the per-type data-pack registry for the generalized learn engine.

The learn track teaches ONE Hebrew concept per short to ages 5-7 (a nikkud, a letter, a
number, a word-class). Every type rides the SAME transcript-driven spine
(tools/make_learn.py): the author writes one pointed-Hebrew script.md, the engine derives
beats.json + the unit manifest, one generic renderer draws it, edge-tts voices each unit.

What changes per TYPE lives HERE, not in the engine: the role aliases, the canonical beat
order, the curriculum/data rows, and the defaults. The engine resolves a type name to a
pack and drives the derivation generically — so a new lesson type is a new data pack, not
a fork of the pipeline.

Packs:
  nikkud     — one vowel sign per video (the proven reading track; wraps tools/nikkud_data.py)
  letter     — one Hebrew letter per video (shape, name, sound, example words)
  number     — counting + simple math, computed never asserted
  wordclass  — nouns vs verbs (שם עצם / פועל)

The engine imports `get_pack(name)`. Each pack is a plain dict; see nikkud.py for the
canonical shape and per-field contract.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from learn_data import nikkud as _nikkud  # noqa: E402
from learn_data import letters as _letters  # noqa: E402

# Registry: type name -> pack dict. letter/number/wordclass register themselves here as
# they are built (Phases 3-5). nikkud is available today (the proven reading track).
_PACKS = {
    _nikkud.PACK["type"]: _nikkud.PACK,
    _letters.PACK["type"]: _letters.PACK,
}


def register(pack):
    """Register a data pack (called by each type module on import)."""
    _PACKS[pack["type"]] = pack


def get_pack(name):
    """Return the pack for a type name, or None if unknown."""
    return _PACKS.get(name)


def types():
    """All registered type names."""
    return sorted(_PACKS)


if __name__ == "__main__":
    print("learn_data types:", ", ".join(types()))
    for t in types():
        p = _PACKS[t]
        print(f"  {t:<10} beat_kinds={len(p.get('beat_for', {}))} roles")
