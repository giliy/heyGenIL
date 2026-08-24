#!/usr/bin/env python3
"""
fetch_stock.py — pull vertical stock b-roll and public-domain stills into the shared
media/library/broll/ library from free stock/documentary APIs.

Stdlib-only (urllib + json), mirroring tools/gen_sfx.py conventions: reads API keys
from .env, downloads to clips/ with slug names, content-hash dedup, probes metadata
(ffprobe for videos, PIL for images), and (re)writes catalog.json.

Sources:
  pexels   — videos (native orientation=portrait&size=large) and photos.
             Free tier 200 req/hr, 20k req/mo. Key: PEXELS_API_KEY in .env.
             https://www.pexels.com/api/documentation/
  pixabay  — photos (100 req/min). Key: PIXABAY_API_KEY in .env.
             https://pixabay.com/api/docs/
  commons  — Wikimedia Commons public-domain/CC documentary stills. No key needed.
             https://commons.wikimedia.org/w/api.php

Usage:
  python tools/fetch_stock.py --query "rainy city" --source pexels --orientation portrait --limit 5
  python tools/fetch_stock.py --query "paper texture" --source pexels --orientation portrait --limit 3 --dry-run
  python tools/fetch_stock.py --query "steam locomotive" --source commons --limit 3
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import ffw  # resolved ffprobe/ffmpeg (full build)

BROLL_DIR = os.path.join(ROOT, "media", "library", "broll")
CLIPS_DIR = os.path.join(BROLL_DIR, "clips")
CATALOG = os.path.join(BROLL_DIR, "catalog.json")
PALETTE = os.path.join(BROLL_DIR, "palette.json")

PEXELS_VIDEO_SEARCH = "https://api.pexels.com/videos/search"
PEXELS_PHOTO_SEARCH = "https://api.pexels.com/v1/search"
PIXABAY_SEARCH = "https://pixabay.com/api/"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

PEXELS_LICENSE = "Pexels license (free to use, no attribution required) — https://www.pexels.com/license/"
PIXABAY_LICENSE = "Pixabay Content License (free to use, no attribution required) — https://pixabay.com/service/license-summary/"

# Commons: only PD / CC0 / CC-BY / CC-BY-SA are accepted into the library.
# Non-commercial (NC) and no-derivatives (ND) are excluded — incompatible with a
# commercial shorts/vox production library.


def load_env():
    """Minimal .env reader so we don't depend on python-dotenv."""
    env = {}
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return {**env, **os.environ}


# Wikimedia Commons requires a descriptive User-Agent (blocks the default Python UA
# with HTTP 403); harmless to send it to Pexels/Pixabay too.
USER_AGENT = "fetch_stock.py/1.0 (b-roll library fetcher for the AI Video Editor repo)"


def http_json(url, headers=None, timeout=60):
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_bytes(url, headers=None, timeout=300):
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "item"


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def probe_video(path):
    """Return (duration_s, width, height) via ffprobe; (None, None, None) on failure."""
    dur_out = subprocess.run(
        [ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout.strip()
    stream_out = subprocess.run(
        [ffw.ffprobe_path(), "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", path],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout.strip()
    duration = None
    try:
        duration = round(float(dur_out), 3)
    except ValueError:
        pass
    width = height = None
    m = re.match(r"(\d+)x(\d+)", stream_out)
    if m:
        width, height = int(m.group(1)), int(m.group(2))
    return duration, width, height


def probe_image(path):
    """Return (width, height) via PIL; (None, None) on failure."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size[0], im.size[1]
    except Exception:
        return None, None


def load_catalog():
    if os.path.exists(CATALOG):
        with open(CATALOG, encoding="utf-8") as f:
            return json.load(f)
    return {"note": "", "clips": []}


def write_catalog(catalog):
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"catalog -> {os.path.relpath(CATALOG, ROOT)}  ({len(catalog['clips'])} clips)")


# ---------------- Source branches ----------------

def pexels_hits(query, orientation, limit, api_key):
    """Search Pexels videos first (portrait/size=large), fall back to photos."""
    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": str(limit)}
    if orientation:
        params["orientation"] = orientation
        params["size"] = "large"
    data = http_json(PEXELS_VIDEO_SEARCH + "?" + urllib.parse.urlencode(params), headers=headers)
    hits = []
    for v in data.get("videos", []):
        # pick the best file: prefer matching orientation + highest resolution
        files = v.get("video_files", [])
        best = None
        for f in files:
            if f.get("link") and f.get("width") and f.get("height"):
                if best is None or (f["width"] * f["height"] > best["width"] * best["height"]):
                    best = f
        if not best:
            continue
        hits.append({
            "source": "pexels",
            "source_id": str(v.get("id")),
            "kind": "video",
            "download_url": best["link"],
            "source_url": v.get("url", ""),
            "author": v.get("user", {}).get("name", ""),
            "author_url": v.get("user", {}).get("url", ""),
            "width": best.get("width"),
            "height": best.get("height"),
            "duration_s": v.get("duration"),
            "license": PEXELS_LICENSE,
            "ext": ".mp4",
        })
    if hits:
        return hits
    # fall back to photos
    data = http_json(PEXELS_PHOTO_SEARCH + "?" + urllib.parse.urlencode(params), headers=headers)
    for p in data.get("photos", []):
        src = p.get("src", {})
        dl = src.get("large2x") or src.get("large") or src.get("original")
        if not dl:
            continue
        hits.append({
            "source": "pexels",
            "source_id": str(p.get("id")),
            "kind": "image",
            "download_url": dl,
            "source_url": p.get("url", ""),
            "author": p.get("photographer", ""),
            "author_url": p.get("photographer_url", ""),
            "width": p.get("width"),
            "height": p.get("height"),
            "duration_s": None,
            "license": PEXELS_LICENSE,
            "ext": os.path.splitext(urllib.parse.urlparse(dl).path)[1] or ".jpg",
        })
    return hits


def pixabay_hits(query, orientation, limit, api_key):
    params = {
        "key": api_key,
        "q": query,
        "image_type": "photo",
        "per_page": str(limit),
    }
    if orientation:
        params["orientation"] = orientation
    data = http_json(PIXABAY_SEARCH + "?" + urllib.parse.urlencode(params))
    hits = []
    for h in data.get("hits", []):
        dl = h.get("largeImageURL") or h.get("webformatURL") or h.get("fullHDURL")
        if not dl:
            continue
        hits.append({
            "source": "pixabay",
            "source_id": str(h.get("id")),
            "kind": "image",
            "download_url": dl,
            "source_url": h.get("pageURL", ""),
            "author": h.get("user", ""),
            "author_url": "",
            "width": h.get("imageWidth"),
            "height": h.get("imageHeight"),
            "duration_s": None,
            "license": PIXABAY_LICENSE,
            "ext": os.path.splitext(urllib.parse.urlparse(dl).path)[1] or ".jpg",
        })
    return hits


def _license_ok(short_name):
    s = (short_name or "").lower()
    if not s:
        return False
    # explicit rejections first (they contain "cc by" as a substring)
    if "nc" in s or "nd" in s:
        return False
    if s.startswith("cc by") or "cc-by" in s or s.startswith("cc-by"):
        return True
    if any(w in s for w in ("public domain", "pd", "cc0")):
        return True
    return False


def commons_hits(query, limit, orientation=None):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",  # File namespace
        "gsrlimit": str(limit * 3),  # over-fetch, then license-filter
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size",
        "format": "json",
    }
    data = http_json(COMMONS_API + "?" + urllib.parse.urlencode(params))
    pages = data.get("query", {}).get("pages", {})
    hits = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        em = info.get("extmetadata", {})
        lic = (em.get("LicenseShortName", {}) or {}).get("value", "")
        if not _license_ok(lic):
            continue
        url = info.get("url")
        if not url:
            continue
        artist = re.sub(r"<[^>]+>", "", (em.get("Artist", {}) or {}).get("value", "")).strip()
        desc = re.sub(r"<[^>]+>", "", (em.get("ImageDescription", {}) or {}).get("value", "")).strip()
        attribution = ", ".join(x for x in [artist, lic, info.get("descriptionurl", "")] if x)
        hits.append({
            "source": "commons",
            "source_id": str(page.get("pageid")),
            "kind": "image",
            "download_url": url,
            "source_url": info.get("descriptionurl", ""),
            "author": artist,
            "author_url": "",
            "width": info.get("width"),
            "height": info.get("height"),
            "duration_s": None,
            "license": lic,
            "attribution": attribution,
            "description": desc,
            "ext": os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".jpg",
        })
        if len(hits) >= limit:
            break
    return hits


# ---------------- Download + catalog ----------------

def fetch(query, source, orientation, limit, dry_run, tags_extra):
    env = load_env()
    api_key = ""
    if source == "pexels":
        api_key = env.get("PEXELS_API_KEY", "").strip()
        if not api_key and not dry_run:
            sys.exit("PEXELS_API_KEY not set in .env - cannot fetch. (Add it, or use --dry-run.)")
        if not api_key and dry_run:
            sys.exit("PEXELS_API_KEY not set in .env - dry-run still needs the key to list hits.")
        hits = pexels_hits(query, orientation, limit, api_key)
    elif source == "pixabay":
        api_key = env.get("PIXABAY_API_KEY", "").strip()
        if not api_key:
            sys.exit("PIXABAY_API_KEY not set in .env - cannot fetch/list hits.")
        hits = pixabay_hits(query, orientation, limit, api_key)
    elif source == "commons":
        hits = commons_hits(query, limit, orientation)
    else:
        sys.exit(f"unknown --source {source!r} (use pexels | pixabay | commons)")

    hits = hits[:limit]
    if not hits:
        print("no hits.")
        return

    catalog = load_catalog()
    existing_source_ids = {c.get("source_id") for c in catalog.get("clips", [])}
    existing_hashes = {c.get("content_hash") for c in catalog.get("clips", [])}

    os.makedirs(CLIPS_DIR, exist_ok=True)

    print(f"source={source}  query={query!r}  orientation={orientation}  hits={len(hits)}")
    for i, h in enumerate(hits, 1):
        dims = f"{h.get('width')}x{h.get('height')}" if h.get("width") else "?"
        extra = f"  {h['duration_s']}s" if h.get("duration_s") else ""
        print(f"  [{i}] {h['kind']} {h['source_id']}  {dims}{extra}  {h['download_url'][:90]}")
        print(f"      license: {h['license']}  source: {h['source_url'][:90]}")
    if dry_run:
        return

    added = 0
    for h in hits:
        if h["source_id"] in existing_source_ids:
            print(f"  skip {h['source_id']} (already in catalog by source_id)")
            continue
        slug = slugify(f"{source}-{h['source_id']}-{query}")
        rel = f"clips/{slug}{h['ext']}"
        path = os.path.join(BROLL_DIR, rel)
        tmp = path + ".part"
        try:
            blob = http_bytes(h["download_url"])
        except urllib.error.HTTPError as e:
            print(f"  !! HTTP {e.code} on {h['source_id']}: {e.read().decode('utf-8', 'ignore')[:200]}")
            continue
        chash = sha256_bytes(blob)
        if chash in existing_hashes:
            print(f"  skip {h['source_id']} (content hash already in catalog)")
            continue
        if os.path.exists(path):
            # same slug but different content/id collision — bump suffix
            n = 2
            while os.path.exists(os.path.join(BROLL_DIR, f"clips/{slug}-{n}{h['ext']}")):
                n += 1
            rel = f"clips/{slug}-{n}{h['ext']}"
            path = os.path.join(BROLL_DIR, rel)
        with open(tmp, "wb") as f:
            f.write(blob)
        os.replace(tmp, path)

        if h["kind"] == "video":
            duration, width, height = probe_video(path)
        else:
            duration, width, height = (None,) + probe_image(path)
        if h.get("duration_s") and not duration:
            duration = h["duration_s"]
        if h.get("width") and not width:
            width, height = h.get("width"), h.get("height")

        tags = sorted(set(re.findall(r"[a-z0-9]+", query.lower())) | set(tags_extra))
        row = {
            "file": rel,
            "source": h["source"],
            "source_id": h["source_id"],
            "source_url": h["source_url"],
            "author": h.get("author", ""),
            "kind": h["kind"],
            "content_hash": chash,
            "license": h["license"],
            "duration_s": duration,
            "width": width,
            "height": height,
            "tags": tags,
            "query": query,
            "orientation": orientation,
            "fetched_at": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if h.get("attribution"):
            row["attribution"] = h["attribution"]
        if h.get("description"):
            row["description"] = h["description"]
        catalog.setdefault("clips", []).append(row)
        existing_source_ids.add(h["source_id"])
        existing_hashes.add(chash)
        added += 1
        print(f"  + {rel}  {width}x{height}  {duration}s" if h["kind"] == "video" else f"  + {rel}  {width}x{height}")

    write_catalog(catalog)
    print(f"added {added} new item(s).")


def main():
    ap = argparse.ArgumentParser(description="Fetch stock b-roll / stills into media/library/broll/.")
    ap.add_argument("--query", required=True, help="search query")
    ap.add_argument("--source", required=True, choices=["pexels", "pixabay", "commons"])
    ap.add_argument("--orientation", default=None, choices=["portrait", "landscape", "square"],
                    help="portrait = vertical (Pexels videos natively support it)")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--tags", default="", help="comma-separated extra tags for the catalog row")
    ap.add_argument("--dry-run", action="store_true", help="list hits, don't download")
    args = ap.parse_args()
    tags_extra = [t.strip().lower() for t in args.tags.split(",") if t.strip()]
    fetch(args.query, args.source, args.orientation, args.limit, args.dry_run, tags_extra)


if __name__ == "__main__":
    main()
