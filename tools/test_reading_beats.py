#!/usr/bin/env python3
"""test_reading_beats.py — verify validate_reading_beats passes the GOOD fixture and
FAILS a set of deliberately-broken fixtures (each must raise ValueError with a precise
message). Exits 0 iff good passes and every broken case fails with the expected cause.

Run:  python tools/test_reading_beats.py
"""
import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))          # tools/
ROOT = os.path.dirname(HERE)                                # repo root
sys.path.insert(0, HERE)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import contracts

GOOD = os.path.join(ROOT, "research", "hebrew-reading", "fixtures", "read-1-kamatz-good.json")
with open(GOOD, encoding="utf-8") as f:
    BASE = json.load(f)


def good():
    return copy.deepcopy(BASE)


def expect_fail(label, data, needle):
    import tempfile
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    try:
        contracts.validate_reading_beats(path)
        print(f"  FAIL  {label}: did NOT raise (should have failed)")
        return False
    except ValueError as e:
        ok = needle in str(e)
        print(f"  {'PASS' if ok else 'FAIL'}  {label}: {str(e)[:90]}")
        return ok
    finally:
        os.remove(path)


def write_tmp(data):
    import tempfile
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return path


def main():
    ok = True

    print("[good fixture]")
    try:
        contracts.validate_reading_beats(GOOD)
        print("  PASS  good read-1-kamatz fixture validates")
    except ValueError as e:
        print(f"  FAIL  good fixture raised: {e}")
        ok = False

    print("[broken fixtures]")
    # 1. wrong mode
    d = good(); d["mode"] = "ad"
    ok &= expect_fail("wrong mode", d, "mode:\"reading\"")
    # 2. missing reading block
    d = good(); del d["reading"]
    ok &= expect_fail("missing reading{}", d, "reading' block")
    # 3. unknown nikkud key
    d = good(); d["reading"]["nikkud"] = "nope"
    ok &= expect_fail("unknown nikkud key", d, "nikkud_data.CURRICULUM")
    # 4. progression not starting at isolated
    d = good(); d["reading"]["progression"] = ["cv", "blend", "word"]
    ok &= expect_fail("progression missing isolated-first", d, "isolated")
    # 5. progression out of order (blend before cv)
    d = good(); d["reading"]["progression"] = ["isolated", "blend", "cv", "word"]
    ok &= expect_fail("progression out of order", d, "order")
    # 6. beats out of order (read-word before teach-isolated)
    d = good(); d["beats"] = [
        {"name": "read-word", "start_s": 26.0, "end_s": 32.0},
        {"name": "teach-isolated", "start_s": 2.0, "end_s": 8.0},
        {"name": "teach-cv", "start_s": 8.0, "end_s": 16.0},
        {"name": "blend", "start_s": 16.0, "end_s": 26.0},
    ]
    ok &= expect_fail("canonical beats out of order", d, "progression order")
    # 7. missing a canonical beat (no teach-isolated)
    d = good(); d["beats"] = [b for b in d["beats"] if b["name"] != "teach-isolated"]
    ok &= expect_fail("missing canonical beat", d, "teach-isolated")
    # 8. units overlapping
    d = good()
    d["vo"][1]["units"] = [
        {"g": "בָּ", "start": 8.3, "end": 8.8},
        {"g": "מָּ", "start": 8.6, "end": 9.05},
    ]
    ok &= expect_fail("units overlap", d, "overlaps/unsorted")
    # 9. units unsorted (later start before earlier)
    d = good()
    d["vo"][1]["units"] = [
        {"g": "בָּ", "start": 8.8, "end": 9.05},
        {"g": "מָּ", "start": 8.3, "end": 8.55},
    ]
    ok &= expect_fail("units unsorted", d, "overlaps/unsorted")
    # 10. units out of parent span
    d = good(); d["vo"][0]["units"] = [{"g": "בָּ", "start": 1.0, "end": 1.5}]
    ok &= expect_fail("units outside parent span", d, "parent line span")
    # 11. units start >= end
    d = good(); d["vo"][0]["units"] = [{"g": "בָּ", "start": 2.5, "end": 2.5}]
    ok &= expect_fail("unit start<end violated", d, "start<end")
    # 12. teach-isolated line unit-less while others have units
    d = good(); d["vo"][0]["units"] = []   # teach-isolated stripped; cv still has units
    ok &= expect_fail("isolated line unit-less (units present elsewhere)", d, "teach-isolated")
    # 13. draft with NO units anywhere still passes (conditional audit)
    d = good()
    for line in d["vo"]:
        line.pop("units", None)
    p = write_tmp(d)
    try:
        contracts.validate_reading_beats(p)
        print("  PASS  draft with no units anywhere passes (conditional)")
    except ValueError as e:
        print(f"  FAIL  draft-without-units raised: {e}")
        ok = False
    finally:
        os.remove(p)
    # 14. progression is a legal suffix (isolated + blend + word, cv dropped) with beats matching
    d = good()
    d["reading"]["progression"] = ["isolated", "blend", "word"]
    d["beats"] = [b for b in d["beats"] if b["name"] != "teach-cv"]
    p = write_tmp(d)
    try:
        contracts.validate_reading_beats(p)
        print("  PASS  legal suffix progression (cv dropped) validates")
    except ValueError as e:
        print(f"  FAIL  legal suffix raised: {e}")
        ok = False
    finally:
        os.remove(p)

    print()
    print("ALL PASS" if ok else "FAILURES")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
