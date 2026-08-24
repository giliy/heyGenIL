#!/usr/bin/env python3
"""make_reading.py — BACKWARD-COMPAT SHIM over tools/make_learn.py.

The reading track was generalized into the learn track: all derivation now lives in
tools/make_learn.py (driven by the nikkud data pack, tools/learn_data/nikkud.py). This shim
preserves the original CLI so existing skills, batch_reading.py, and docs keep working —
it simply forwards to make_learn.py with --type nikkud and the legacy --nikkud flag mapped
to --key.

Stdlib-only. Run from repo root:
  python tools/make_reading.py reading-shorts/read-N-<nikkud>/script.md [--nikkud patach] [--force] [--dry-run]
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import make_learn  # noqa: E402


def main():
    argv = [sys.argv[0]]
    i = 1
    saw_type = False
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--nikkud":
            argv += ["--key", sys.argv[i + 1]]
            i += 2
            continue
        if a.startswith("--nikkud="):
            argv += ["--key", a.split("=", 1)[1]]
            i += 1
            continue
        if a == "--type" or a.startswith("--type="):
            saw_type = True
        argv.append(a)
        i += 1
    if not saw_type:
        argv += ["--type", "nikkud"]
    sys.argv = argv
    make_learn.main()


if __name__ == "__main__":
    main()
