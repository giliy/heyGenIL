#!/usr/bin/env python3
"""test_nikkud.py — unit test for the nikkud segmentation engine + curriculum data.

Runs under PLAIN python (3.10+) — the engine is stdlib-only and needs no venv.
Exits 0 and prints PASS for every case; exits 1 on the first failure.

Run:  python tools/test_nikkud.py
"""
import os
import sys

# Hebrew on stdout: force UTF-8 so the console (cp1252) doesn't choke on nikkud marks.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nikkud
import nikkud_data

FAILS = []


def check(label, cond, detail=""):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}  {detail}")
        FAILS.append(label)


def main():
    kamatz = nikkud_data.get_nikkud("kamatz")
    check("curriculum has kamatz row", kamatz is not None)

    # --- graphemes(): dagesh + nikkud stay INSIDE each grapheme -----------------
    print("\n[graphemes]")
    check("בָּבָּא -> [בָּ,בָּ,א]", nikkud.graphemes("בָּבָּא") == ["בָּ", "בָּ", "א"],
          repr(nikkud.graphemes("בָּבָּא")))
    check("שָׁלוֹם keeps shin-dot + cholam",
          nikkud.graphemes("שָׁלוֹם") == ["שָׁ", "ל", "וֹ", "ם"],
          repr(nikkud.graphemes("שָׁלוֹם")))
    # every kamatz cv item is EXACTLY one grapheme
    for cv in kamatz["cv"]:
        check(f"cv '{cv}' is 1 grapheme", nikkud.graphemes(cv) == [cv],
              repr(nikkud.graphemes(cv)))

    # --- helpers -----------------------------------------------------------------
    print("\n[helpers]")
    check("strip_to_base(בָּ)==ב", nikkud.strip_to_base("בָּ") == "ב")
    check("strip_to_base(שָׁ)==ש", nikkud.strip_to_base("שָׁ") == "ש")
    check("nikkud_of(בָּ)==kamatz", nikkud.nikkud_of("בָּ") == "kamatz")
    check("nikkud_of(בַ)==patach", nikkud.nikkud_of("בַ") == "patach")
    check("nikkud_of(בִ)==chirik", nikkud.nikkud_of("בִ") == "chirik")
    check("nikkud_of(בֹ)==cholam", nikkud.nikkud_of("בֹ") == "cholam")
    check("nikkud_of(ב) is None", nikkud.nikkud_of("ב") is None)
    # Build from explicit codepoints — editors/encoders reorder Hebrew points, so a
    # literal "בָּ" can silently arrive as bet+dagesh+kamatz. Construct exact intent:
    BET, KAMATZ, DAGESH = "ב", "ָ", "ּ"
    bet_kamatz = BET + KAMATZ            # bet + kamatz ONLY (no dagesh)
    bet_dagesh = BET + DAGESH            # bet + dagesh ONLY
    check("has_dagesh(bet+kamatz) False", nikkud.has_dagesh(bet_kamatz) is False,
          repr(nikkud.graphemes(bet_kamatz)))
    check("has_dagesh(bet+dagesh) True", nikkud.has_dagesh(bet_dagesh) is True)
    check("has_dagesh(bet+dagesh+kamatz) True", nikkud.has_dagesh(BET + DAGESH + KAMATZ) is True)

    # --- syllabify(): lexicon agreement on the kamatz blend set ------------------
    print("\n[syllabify — lexicon agreement]")
    for bw in kamatz["blendWords"]:
        word, want = bw["word"], bw["units"]
        got = nikkud.syllabify(word)
        check(f"syllabify({word}) == {want}", got == want, repr(got))

    # --- data integrity -----------------------------------------------------------
    print("\n[data integrity]")
    for row in nikkud_data.CURRICULUM:
        check(f"{row['key']}: mnemonic is None (never fabricated)", row.get("mnemonic") is None)
    # every blendWord's units reassemble to the word
    for bw in kamatz["blendWords"]:
        check(f"{bw['word']}: units reassemble", "".join(bw["units"]) == bw["word"],
              repr(bw["units"]))
    # cv units carry the kamatz vowel
    for cv in kamatz["cv"]:
        check(f"cv '{cv}' nikkud is kamatz", nikkud.nikkud_of(cv) == "kamatz")

    print()
    if FAILS:
        print(f"FAILED: {len(FAILS)} case(s): {FAILS}")
        return 1
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
