#!/usr/bin/env python3
"""
import_music.py — import curated HUMAN music beds into the shared MUSIC library (P1 #17).

Mirrors tools/import_sfx.py but for music beds. A curated human track beats a generated bed
for a PREMIUM SMB ad (the plan's #17) — it closes the premium-ad ceiling generative beds can't
reach. Kids beds stay fine from ACE-Step/gen_music; this tool exists so an editor can drop a
licence-clean track into the library once and reuse it everywhere (library-first).

Sources: Pixabay music is CC0-like (free to use commercially, no attribution required) and is
the recommended free source. The LICENSE text is recorded per entry so the legal record is
never lost. Freesound-CC0 also works. NEVER import a track whose license you haven't read and
recorded — license discipline is the through-line (research/pro-quality §5).

WORKFLOW:
  1. download the track (e.g. from Pixabay) into media/library/music/_staging/
  2. add a row to a manifest JSON (schema below)
  3. run this tool — it normalizes to ~-20 LUFS with a true-peak-safe ceiling, encodes a
     clean mp3 into media/library/music/clips/, and registers it in catalog.json

MANIFEST schema:
  { "note": "...",
    "clips": [
      { "id": "ad-premium-uplift",            # catalog id (generic, reusable)
        "src": "media/library/music/_staging/uplift.mp3",   # source file path (CWD-relative)
        "category": "bed",                     # bed|sting|jingle
        "tags": ["ad","premium","uplift","warm"],
        "license": "Pixabay Content License",  # recorded per-entry legal string
        "license_url": "https://pixabay.com/service/license-summary/",
        "desc": "warm premium uplift bed for SMB ad end cards",
        "bpm": 92                               # optional
      }, ...
    ]
  }

Usage:
  python tools/import_music.py manifest.json              # import every bed in the manifest
  python tools/import_music.py manifest.json --dry-run    # show what WOULD be imported
  python tools/import_music.py manifest.json --only a,b   # just these ids
  python tools/import_music.py manifest.json --force      # re-import (overwrite existing)

Needs ffmpeg/ffprobe full build (tools/ffw.py). No third-party Python deps. Loudness target
matches gen_music.py (-20 LUFS, -1.5 dBFS ceiling) so a mix's bed gain is perceptually
meaningful, and the encode runs once (no round-trips — the codec-hygiene rule from #18).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)

MUSIC_DIR = os.path.join(ROOT, "media", "library", "music")
CLIPS_DIR = os.path.join(MUSIC_DIR, "clips")
CATALOG = os.path.join(MUSIC_DIR, "catalog.json")

TARGET_LUFS = -20.0
CEILING_DB = -1.5

# cp1252 consoles can't encode Hebrew/em-dashes in catalog text.
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


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


def encode_to_mp3(src, dst):
    """Encode a clean, loudness-ready mp3 from the source in ONE pass (codec-hygiene #18).

    Resample to 44.1k stereo, normalize loudness to the bed target via the ebur128-measured
    gain, and brickwall-limit with the oversampled alimiter (level 0) so the true peak sits
    under the ceiling. No intermediate re-encodes — decode the source to float once, encode
    the final mp3 once.
    """
    # loudnorm sets integrated loudness + true peak; follow with an oversampled alimiter as
    # the final brickwall so nothing exceeds the ceiling even on inter-sample peaks.
    # alimiter: `limit` is a LINEAR ceiling [0.0625-1] (dB = 20*log10), `level` is a bool.
    limit_lin = 10 ** (CEILING_DB / 20.0)
    cmd = [
        ffw.path(), "-y", "-hide_banner", "-i", src,
        "-vn", "-af",
        f"aresample=96000,loudnorm=I={TARGET_LUFS:.1f}:TP={CEILING_DB:.2f}:LRA=11,"
        f"alimiter=limit={limit_lin:.4f}:level=false:level_in=1:level_out=1,aresample=44100",
        "-c:a", "libmp3lame", "-q:a", "2", dst,
    ]
    run_capture(cmd)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        # verify: re-measure the delivered file
        out_lufs = measure_lufs(dst)
        out_peak = measure_peak_db(dst)
        return out_lufs, out_peak
    return None, None


def main():
    args = sys.argv[1:]
    force = "--force" in args
    dry = "--dry-run" in args
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    positional = [a for a in args if not a.startswith("--")]
    if not positional:
        sys.exit("usage: python tools/import_music.py manifest.json [--dry-run] [--only ids] [--force]")
    manifest_path = os.path.abspath(positional[0])

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    clips = manifest.get("clips", [])
    if not clips:
        sys.exit("manifest has no clips.")

    if not dry:
        ffw.require_full()

    catalog = {"note": "", "clips": []}
    if os.path.exists(CATALOG):
        with open(CATALOG, encoding="utf-8") as f:
            catalog = json.load(f)
    by_id = {c["id"]: c for c in catalog.get("clips", [])}

    os.makedirs(CLIPS_DIR, exist_ok=True)

    imported, skipped, errors = 0, 0, 0
    for c in clips:
        cid = c["id"]
        if only and cid not in only:
            continue
        src = c["src"] if os.path.isabs(c["src"]) else os.path.join(ROOT, c["src"])
        rel = f"clips/{cid}.mp3"
        dst = os.path.join(MUSIC_DIR, rel)

        if not os.path.exists(src):
            print(f"  !! {cid}: source missing -> {src}")
            errors += 1
            continue
        if os.path.exists(dst) and not force:
            skipped += 1
            continue

        if dry:
            print(f"  WOULD import {cid:<22} <- {os.path.basename(src)} -> clips/ (committed)")
            continue

        lufs, peak = encode_to_mp3(src, dst)
        if lufs is None:
            print(f"  !! {cid}: encode failed for {src}")
            errors += 1
            continue
        dur = probe_duration(dst)
        print(f"  {cid:<22} dur={dur}s peak={peak}dB lufs={lufs}  [{c.get('license','')[:22]}] -> {rel}")

        by_id[cid] = {
            "id": cid, "file": rel, "category": c.get("category", "bed"),
            "tags": c.get("tags", []), "duration_s": dur,
            "peak_dbfs": peak, "loudness_lufs": lufs,
            "source": "pixabay" if "pixabay" in c.get("license", "").lower() else "curated",
            "model": None,
            "license": c.get("license", ""), "license_url": c.get("license_url", ""),
            "bpm": c.get("bpm"), "prompt": None,
            "desc": c.get("desc", ""),
            "used_in": by_id.get(cid, {}).get("used_in", []),
        }
        imported += 1

    if dry:
        print(f"\ndry-run: {len(clips)} beds in manifest ({skipped} already present).")
        return

    catalog["clips"] = list(by_id.values())
    catalog.setdefault("note", "")
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nimported {imported}  skipped {skipped}  errors {errors}")
    print(f"catalog -> {os.path.relpath(CATALOG, ROOT)}  ({len(catalog['clips'])} clips)")
    if imported:
        print("note: clips/ beds are committed. Run /assemble or tools/mix_music.py to use them.")


if __name__ == "__main__":
    main()
