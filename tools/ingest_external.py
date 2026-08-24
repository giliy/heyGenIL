#!/usr/bin/env python3
"""
ingest_external.py — bulk-ingest a royalty-free sound-effect bundle into media/library/sfx/.

The shared SFX library (media/library/sfx/{palette.json,catalog.json,clips/}) is normally
grown one recipe at a time by tools/gen_sfx.py (ElevenLabs text-to-sfx). This tool does the
opposite scale-up: point it at an UNZIPPED folder of already-recorded sounds (e.g. a Sonniss
GDC bundle) and it walks the tree, copies every wav/aif/mp3 into clips/, loudness-normalizes
it with the SAME functions gen_sfx.py uses, probes duration/loudness, derives tags from the
source folder names, and appends the entries to catalog.json so /suggest-sfx and
tools/mix_sfx.py can find them.

It REUSES gen_sfx.py's normalize_clip / probe_duration / measure_lufs / measure_peak_db
rather than re-implementing them, and reads the same palette.json loudness defaults, so
external clips sit on exactly the same level (≈-20 LUFS, -1.5 dBFS ceiling) as generated ones
and a plan's per-cue gain_db stays perceptually meaningful.

Dedup is by CONTENT hash (sha1 of the file bytes): the GDC bundles overlap heavily across
years, so a re-run (or a second year's bundle) is a no-op for files already ingested — even
under a different filename.

Usage:
  python tools/ingest_external.py --src <unzipped-sonniss-dir> --kind sfx
  python tools/ingest_external.py --src <dir> --kind sfx --dry-run     # list only, no writes
  python tools/ingest_external.py --src <dir> --kind sfx --min-size 0  # include tiny clips

  --src       a directory containing the unzipped bundle (walked recursively)
  --kind      only "sfx" is supported today (drives the target dir + catalog)
  --dry-run   print the planned imports + total size; write nothing, normalize nothing
  --min-size  skip source files smaller than N bytes [default 1024] (kills 0-byte/truncated)

WHERE TO GET THE BUNDLES
------------------------
Sonniss "Game Audio GDC" bundles are free yearly drops: $0, royalty-free, commercial use, no
attribution. https://sonniss.com/gameaudiogdc — each year ships as a ZIP; the multi-GB years
are practically obtained as a TORRENT (links on the same page). Unzip, then point --src at the
unzipped folder. The newer "free GDC bundle" pages also have direct-download mirrors.

  - Sonniss GDC bundle (all years) — https://sonniss.com/gameaudiogdc
  - NOT ingested here (licence mismatch): BBC Sound Effects, RemArc = non-commercial.
    https://sound-effects.bbc.co.uk/licenses

ffmpeg/ffprobe must resolve (tools/ffw.py handles it). Stdlib-only otherwise.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import ffw  # noqa: E402  resolved full ffmpeg/ffprobe
import gen_sfx  # noqa: E402  reuse normalize/probe/catalog writers

# Formats we can safely re-encode to mp3 + loudness-normalize.
AUDIO_EXTS = {".wav", ".aif", ".aiff", ".mp3"}

# 'generic' tokens dropped from derived tags so we don't tag every clip "sfx"/"sound".
GENERIC_TOKENS = {
    "sfx", "sound", "sounds", "effects", "effect", "audio", "samples", "sample",
    "assets", "wav", "mp3", "aiff", "the", "of", "and", "for", "gdc", "sonniss",
}

LICENSE = ("Sonniss GDC bundle — royalty-free, commercial, no attribution")
SOURCE = "sonniss:gdc-bundle"
SOURCE_URL = "https://sonniss.com/gameaudiogdc"

KINDS = {
    "sfx": {
        "dir": os.path.join(gen_sfx.SFX_DIR, "clips"),
        "catalog": gen_sfx.CATALOG,
    },
}


# --------------------------------------------------------------------------- slug / tags


def slugify(s):
    """kebab-case slug: lowercase, non-alnum -> '-', collapse runs, trim '-'."""
    out = "".join(c if c.isalnum() else "-" for c in s.lower())
    out = "-".join(x for x in out.split("-") if x)
    return out.strip("-") or "clip"


def folder_tags(rel_dir):
    """Derive searchable tags from the source folder path.

    'ui/clicks/…' -> [ui, click]; 'Nature/Water Splash' -> [nature, water, splash].
    Only the last two directory levels feed tags (the deeper levels are the specific ones),
    tokens are slugified + de-duplicated + generic ones dropped.
    """
    parts = [p for p in rel_dir.split("/") if p]
    # keep the leaf-most meaningful levels; don't let a huge top-level tree spam tags
    keep = parts[-2:] if len(parts) >= 2 else parts
    tags = []
    seen = set()
    for p in keep:
        for tok in slugify(p).split("-"):
            if tok in GENERIC_TOKENS or tok in seen:
                continue
            seen.add(tok)
            tags.append(tok)
    return tags


# --------------------------------------------------------------------------- hashing


def sha1_file(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------- main


def load_catalog(kind):
    catalog_path = KINDS[kind]["catalog"]
    if os.path.exists(catalog_path):
        with open(catalog_path, encoding="utf-8") as f:
            return json.load(f)
    return {"note": "", "clips": []}


def write_catalog(catalog, kind):
    with open(KINDS[kind]["catalog"], "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")


def build_known(catalog):
    """Map content-hash -> existing clip id (only entries that carry a sha1), plus id->entry."""
    by_hash = {}
    by_id = {c["id"]: c for c in catalog.get("clips", [])}
    for c in catalog.get("clips", []):
        h = c.get("sha1")
        if h:
            by_hash[h] = c["id"]
    return by_hash, by_id


def plan_imports(src, min_size):
    """Walk src; return list of dicts {path, rel_dir, stem, size, tags} for ingestable files."""
    found = []
    for dirpath, _dirs, files in os.walk(src):
        for name in files:
            ext = os.path.splitext(name)[1].lower()
            if ext not in AUDIO_EXTS:
                continue
            path = os.path.join(dirpath, name)
            size = os.path.getsize(path)
            if size < min_size:
                print(f"  SKIP (too small / corrupt): {path}  ({size}B)")
                continue
            rel = os.path.relpath(path, src)
            rel_dir = os.path.dirname(rel).replace("\\", "/")
            stem = os.path.splitext(name)[0]
            found.append({"path": path, "rel_dir": rel_dir, "stem": stem, "size": size})
    return found


def unique_id(base, taken):
    """Return a catalog-unique id for a slug base."""
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def entry_for(kind, f, clip_path, tags, category, by_hash, by_id):
    """Loudness-normalize clip_path in place, probe it, return (entry, sha1, is_new)."""
    h = sha1_file(clip_path)
    if h in by_hash:  # already ingested under another name — reuse, don't re-add
        return None, h, False
    dur = gen_sfx.probe_duration(clip_path)
    # normalize with the SAME target/ceiling gen_sfx uses (from palette.json defaults)
    lufs, peak = gen_sfx.normalize_clip(clip_path, _target_lufs, _ceiling_db)
    if dur is None:
        dur = gen_sfx.probe_duration(clip_path)  # normalize may have rewritten the file
    base = unique_id(slugify(f["stem"]), set(by_id))
    entry = {
        "id": base,
        "file": os.path.relpath(clip_path, gen_sfx.SFX_DIR).replace("\\", "/"),
        "category": category,
        "tags": tags,
        "duration_s": dur,
        "peak_dbfs": peak,
        "loudness_lufs": lufs,
        "source": SOURCE,
        "license": LICENSE,
        "source_url": SOURCE_URL,
        "sha1": h,
        "used_in": [],
    }
    return entry, h, True


def main():
    ap = argparse.ArgumentParser(description="bulk-ingest a royalty-free sfx bundle into media/library/sfx/")
    ap.add_argument("--src", required=True, help="unzipped bundle directory (walked recursively)")
    ap.add_argument("--kind", choices=list(KINDS), default="sfx", help="library to ingest into [sfx]")
    ap.add_argument("--dry-run", action="store_true", help="list planned imports + total size, write nothing")
    ap.add_argument("--min-size", type=int, default=1024, help="skip source files smaller than N bytes [1024]")
    args = ap.parse_args()

    src = os.path.abspath(args.src)
    if not os.path.isdir(src):
        sys.exit(f"ingest_external: --src is not a directory: {src}")

    global _target_lufs, _ceiling_db
    with open(gen_sfx.PALETTE, encoding="utf-8") as f:
        d = json.load(f).get("defaults", {})
    _target_lufs = d.get("target_lufs", -20.0)
    _ceiling_db = d.get("ceiling_dbfs", -1.5)

    catalog = load_catalog(args.kind)
    by_hash, by_id = build_known(catalog)
    taken_ids = set(by_id)

    clips_dir = KINDS[args.kind]["dir"]
    os.makedirs(clips_dir, exist_ok=True)

    planned = plan_imports(src, args.min_size)
    total = sum(f["size"] for f in planned)
    print(f"ingest_external: {len(planned)} audio files ({total/1e6:.1f} MB) under {src}")

    # -- dry-run: report what WOULD import, honouring hash dedup against current catalog
    if args.dry_run:
        # hash files (read-only) to predict dedup accurately
        n_new = 0
        for f in planned:
            h = sha1_file(f["path"])
            tags = folder_tags(f["rel_dir"])
            cat = tags[0] if tags else "ingested"
            base = unique_id(slugify(f["stem"]), taken_ids)
            if h in by_hash:
                print(f"  DUP   {base:28} <- {f['path']}  (already in catalog as {by_hash[h]})")
                continue
            n_new += 1
            taken_ids.add(base)
            print(f"  +      {base:28} {f['size']/1e3:8.1f} KB  tags={tags}  cat={cat}")
        print(f"\ndry-run: {n_new} would be added, {len(planned)-n_new} deduped/skipped, "
              f"~{(total/1e6):.1f} MB total source")
        return

    # -- real run
    added, skipped = 0, 0
    for f in planned:
        h = sha1_file(f["path"])
        if h in by_hash:
            skipped += 1
            print(f"  dup -> {by_hash[h]}  ({f['path']})")
            continue
        base = unique_id(slugify(f["stem"]), taken_ids)
        taken_ids.add(base)
        rel = f"clips/{base}.mp3"
        clip_path = os.path.join(gen_sfx.SFX_DIR, rel)
        try:
            shutil.copyfile(f["path"], clip_path)  # copy source bytes, then normalize in place
            entry, h2, is_new = entry_for(args.kind, f, clip_path, folder_tags(f["rel_dir"]),
                                          folder_tags(f["rel_dir"])[0] if folder_tags(f["rel_dir"]) else "ingested",
                                          by_hash, by_id)
        except Exception as e:
            print(f"  FAIL {f['path']}: {e}")
            if os.path.exists(clip_path):
                os.remove(clip_path)
            continue
        if not is_new:  # hash collided after copy (shouldn't happen, but be safe)
            os.remove(clip_path)
            skipped += 1
            continue
        by_hash[h2] = entry["id"]
        by_id[entry["id"]] = entry
        catalog["clips"].append(entry)
        added += 1
        print(f"  + {entry['id']:28} {f['size']/1e3:8.1f} KB  dur={entry['duration_s']}s "
              f"peak={entry['peak_dbfs']}dBFS lufs={entry['loudness_lufs']}  tags={entry['tags']}")

    # sort clips id-wise for a stable, readable manifest
    catalog["clips"].sort(key=lambda c: c["id"])
    write_catalog(catalog, args.kind)
    print(f"\ncatalog -> {os.path.relpath(KINDS[args.kind]['catalog'], ROOT)}  "
          f"({len(catalog['clips'])} clips total; added {added}, deduped/skipped {skipped})")


if __name__ == "__main__":
    main()
