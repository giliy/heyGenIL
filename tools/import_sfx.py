#!/usr/bin/env python3
"""
import_sfx.py — import RECORDED SFX clips into the shared library (media/library/sfx/).

The house SFX source is now RECORDED-first (brand.md §7): professional recorded clips read
premium where ElevenLabs text-to-sfx reads synthetic/childish. This tool takes a curated set
of recorded source files (Sonniss GDC, Kenney, soundcn, Freesound-CC0, 99Sounds) and brings
them into the library through the SAME polish + normalization pipeline as gen_sfx.py, then
registers them in catalog.json with their real source + license. mix_sfx.py and /suggest-sfx
consume the catalog unchanged.

LICENSE ROUTING (the reason this tool exists):
  - CC0 / MIT clips (Kenney, soundcn, Freesound-CC0)  -> clips/   (committed to git)
  - Sonniss GDC / 99Sounds (raw redistribution banned) -> pro/    (GITIGNORED, per-machine)
  The `pro/` tier is excluded from git (.gitignore); each machine fetches it via
  tools/fetch_pro_sfx.py. catalog.json keeps the metadata (filename/license/duration) but the
  audio stays local — mix_sfx.py warns-and-skips a pro clip that's absent on a fresh clone.

POLISH CHAIN (the "premium pass", applied to every imported clip; all filters are in
ffw.FULL_FILTERS so the full ffmpeg build is required):
  1. trim head silence to just before the transient   (silenceremove)
  2. high-pass at 80 Hz                                (highpass)  — cut mud/rumble
  3. gentle de-harsh in the 3-6 kHz band               (equalizer) — tame cartoon brightness
  4. loudness-normalize to -20 LUFS / -1.5 dBFS ceiling (same target as gen_sfx.py)
  5. keep tails DRY — we never ADD reverb

INPUT: a manifest (JSON) describing each clip to import:
  {
    "clips": [
      { "id": "ui-click-soft-2",            # catalog id (generic, reusable)
        "src": "staging/kenney/.../click_001.ogg",  # path to the source file
        "category": "snap",                  # motion|tension|emphasis|snap|foley|reward|texture
        "tags": ["ui","click","tick"],
        "origin": "kenney",                  # kenney|soundcn|freesound|sonniss-gdc-YYYY|99sounds
        "license": "Creative Commons CC0",   # per-clip license string -> catalog.license
        "desc": "short dry UI click"         # optional human note
      }, ...
    ]
  }
Paths in the manifest resolve against the CWD (project root) unless absolute.

Usage:
  python tools/import_sfx.py manifest.json              # import every clip in the manifest
  python tools/import_sfx.py manifest.json --dry-run    # show what WOULD be imported
  python tools/import_sfx.py manifest.json --only a,b   # just these ids
  python tools/import_sfx.py manifest.json --force      # re-import (overwrite existing)

Needs ffmpeg/ffprobe full build (tools/ffw.py). No third-party Python deps.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)

SFX_DIR = os.path.join(ROOT, "media", "library", "sfx")
CLIPS_DIR = os.path.join(SFX_DIR, "clips")   # committed CC0/MIT tier
PRO_DIR = os.path.join(SFX_DIR, "pro")        # gitignored Sonniss/99Sounds tier
CATALOG = os.path.join(SFX_DIR, "catalog.json")

TARGET_LUFS = -20.0   # matches gen_sfx.py so per-cue gain_db stays perceptually meaningful
CEILING_DB = -1.5

# origins whose license forbids committing raw files to the distributed repo -> gitignored pro/
PRO_ORIGINS = ("sonniss", "99sounds")


def run_capture(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout


def probe_duration(path):
    out = run_capture([ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
                       "-of", "default=nw=1:nk=1", path]).strip()
    try:
        return round(float(out), 3)
    except ValueError:
        return None


def measure_peak_db(path):
    out = run_capture([ffw.path(), "-hide_banner", "-i", path, "-af", "volumedetect",
                       "-f", "null", os.devnull])
    m = re.search(r"max_volume:\s*(-?[\d.]+) dB", out)
    return float(m.group(1)) if m else None


def measure_lufs(path):
    out = run_capture([ffw.path(), "-hide_banner", "-i", path, "-af", "ebur128",
                       "-f", "null", os.devnull])
    ms = re.findall(r"I:\s*(-?[\d.]+)\s*LUFS", out)
    try:
        return float(ms[-1]) if ms else None
    except ValueError:
        return None


def apply_gain(path, gain_db):
    if abs(gain_db) < 0.1:
        return True
    tmp = path + ".norm.mp3"
    run_capture([ffw.path(), "-y", "-hide_banner", "-i", path, "-af", f"volume={gain_db:.2f}dB",
                 "-c:a", "libmp3lame", "-q:a", "2", tmp])
    if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
        os.replace(tmp, path)
        return True
    if os.path.exists(tmp):
        os.remove(tmp)
    return False


def normalize_clip(path):
    """Reuse the gen_sfx.py normalization: loudness to TARGET_LUFS, peak clamped to CEILING_DB."""
    lufs = measure_lufs(path)
    peak = measure_peak_db(path)
    if peak is None:
        return None, None
    if lufs is None or lufs < -50:  # ebur128 gated a very short transient -> peak-normalize
        apply_gain(path, CEILING_DB - peak)
    else:
        gain = TARGET_LUFS - lufs
        if peak + gain > CEILING_DB:
            gain = CEILING_DB - peak
        apply_gain(path, gain)
    return measure_lufs(path), measure_peak_db(path)


def polish_to_mp3(src, dst):
    """Craft polish chain -> 48kHz stereo mp3. Returns True on success.

    silenceremove trims leading silence to just before the transient; highpass 80Hz cuts mud;
    a wide -4dB cut at 4.5kHz tames the 3-6kHz harshness band; alimiter enforces the ceiling.
    All filters are in ffw.FULL_FILTERS (full build required — the Remotion minimal build
    lacks them and would silently produce a broken file).
    """
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005,"
          "highpass=f=80,"
          "equalizer=f=4500:t=q:w=2:g=-4,"
          "aformat=sample_rates=48000:channel_layouts=stereo,"
          "alimiter=level_in=1:level_out=1:limit=0.97")
    out = run_capture([ffw.path(), "-y", "-hide_banner", "-i", src, "-af", af,
                       "-c:a", "libmp3lame", "-q:a", "2", dst])
    return os.path.exists(dst) and os.path.getsize(dst) > 0


def dest_for(origin, cid):
    """Route by license: Sonniss/99Sounds -> gitignored pro/, everything else -> committed clips/."""
    if any(origin.lower().startswith(p) for p in PRO_ORIGINS):
        return PRO_DIR, f"pro/{cid}.mp3"
    return CLIPS_DIR, f"clips/{cid}.mp3"


def main():
    args = sys.argv[1:]
    force = "--force" in args
    dry = "--dry-run" in args
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    positional = [a for a in args if not a.startswith("--") and not (only and a in ",".join(only))]
    positional = [a for a in positional if a not in (",".join(only) if only else "")]
    if not positional:
        sys.exit("usage: python tools/import_sfx.py manifest.json [--dry-run] [--only ids] [--force]")
    manifest_path = os.path.abspath(positional[0])

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    clips = manifest.get("clips", [])
    if not clips:
        sys.exit("manifest has no clips.")

    if not dry:
        ffw.require_full()  # silenceremove/highpass/equalizer/alimiter all need the full build

    catalog = {"note": "", "clips": []}
    if os.path.exists(CATALOG):
        with open(CATALOG, encoding="utf-8") as f:
            catalog = json.load(f)
    by_id = {c["id"]: c for c in catalog.get("clips", [])}

    os.makedirs(CLIPS_DIR, exist_ok=True)
    os.makedirs(PRO_DIR, exist_ok=True)

    imported, skipped, errors = 0, 0, 0
    for c in clips:
        cid = c["id"]
        if only and cid not in only:
            continue
        origin = c.get("origin", "imported")
        src = c["src"] if os.path.isabs(c["src"]) else os.path.abspath(c["src"])
        ddir, rel = dest_for(origin, cid)
        dst = os.path.join(SFX_DIR, rel)

        if not os.path.exists(src):
            print(f"  !! {cid}: source missing -> {src}")
            errors += 1
            continue
        if os.path.exists(dst) and not force:
            skipped += 1
            continue

        if dry:
            tier = "pro/ (gitignored)" if ddir == PRO_DIR else "clips/ (committed)"
            print(f"  WOULD import {cid:<22} <- {os.path.basename(src)}  [{origin}] -> {tier}")
            continue

        if not polish_to_mp3(src, dst):
            print(f"  !! {cid}: polish/encode failed for {src}")
            errors += 1
            continue
        lufs, peak = normalize_clip(dst)
        dur = probe_duration(dst)
        print(f"  {cid:<22} dur={dur}s peak={peak}dB lufs={lufs}  [{origin}] -> {rel}")

        by_id[cid] = {
            "id": cid, "file": rel, "category": c.get("category", ""),
            "tags": c.get("tags", []), "duration_s": dur, "peak_dbfs": peak,
            "loudness_lufs": lufs, "source": origin, "model": None,
            "license": c.get("license", ""), "prompt": None,
            "desc": c.get("desc", ""),
            "used_in": by_id.get(cid, {}).get("used_in", []),
        }
        imported += 1

    if dry:
        print(f"\ndry-run: {len(clips)} clips in manifest ({skipped} already present).")
        return

    # preserve palette-ordered clips first, then the rest, mirroring gen_sfx.py's stable order
    catalog["clips"] = list(by_id.values())
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nimported {imported}  skipped {skipped}  errors {errors}")
    print(f"catalog -> {os.path.relpath(CATALOG, ROOT)}  ({len(catalog['clips'])} clips)")
    if imported:
        print("note: pro/ clips are gitignored; clips/ clips are committed. Run /suggest-sfx to use them.")


if __name__ == "__main__":
    main()
