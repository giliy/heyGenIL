#!/usr/bin/env python3
"""instagram_upload.py — publish the א–ת letter series to Instagram Reels (Graph API).

Mirrors tools/youtube_upload.py but for Instagram. Reads publish/manifest.json and
publishes the DUE letters as Reels via the Instagram Graph API two-phase flow:

    POST /{ig-user-id}/media            media_type=REELS, video_url=<public URL>, caption
    GET  /{container-id}?fields=status_code      (poll until FINISHED)
    POST /{ig-user-id}/media_publish    creation_id=<container-id>

CRITICAL CONSTRAINT: Meta's servers fetch the video from `video_url` — the file must
be reachable at a PUBLIC https URL at publish time. This tool therefore needs a base
URL that maps to the local publish/ directory (see --base-url, or serve publish/ and
tunnel it: `python -m http.server 8765 --directory publish` + `cloudflared tunnel
--url http://localhost:8765`). Instagram does NOT accept direct local-file uploads on
the standard flow.

Credentials come from .env (never committed):
    META_ACCESS_TOKEN   — long-lived token w/ instagram_basic, instagram_content_publish,
                          pages_read_engagement (Facebook Login flow)
    IG_USER_ID          — the Instagram Business/Creator account ID (numeric)

Per-entry IG state is stored on the manifest entry under "instagram":
    {"state": "published", "mediaId": ..., "permalink": ..., "publishedAt": ...}
Re-running never re-publishes an entry whose instagram.state == "published".

  .venv-image312\\Scripts\\python.exe tools\\instagram_upload.py --dry-run --base-url https://xxx.trycloudflare.com
  .venv-image312\\Scripts\\python.exe tools\\instagram_upload.py --limit 1 --base-url https://xxx.trycloudflare.com

Gating per entry (same cadence as YouTube): state == 'uploaded' on YouTube is NOT
required; we gate on the manifest's own schedule + vetting:
  * vetting.status in ('approved','vetted')
  * scheduledFor <= today
  * instagram.state != 'published'
  * this run <= --limit and <= --max-per-day (IG limit is 100/24h; we stay well under)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "publish" / "manifest.json"
ENV_FILE = ROOT / ".env"

GRAPH = "https://graph.facebook.com/v21.0"
MAX_PER_DAY = 25            # IG allows 100/24h; we cap far lower for a sane batch
CONTAINER_POLL_S = 20       # seconds between status polls
CONTAINER_TIMEOUT_S = 300   # give up on a container after 5 min


# ---------- env ----------

def _load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


# ---------- manifest ----------

def _load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _save_manifest(entries: list[dict]) -> None:
    MANIFEST.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


# ---------- graph API helpers ----------

def _post(url: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _get(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(full, method="GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _caption_for(entry: dict) -> str:
    # Reuse the YouTube title + description (already Hebrew, already has hashtags).
    return f"{entry['title']}\n\n{entry['description']}"


# ---------- publish one ----------

def _video_public_url(entry: dict, base_url: str) -> str:
    # entry['video'] is like "publish/letter-3-gimel-FINAL.mp4"
    fname = Path(entry["video"]).name
    if base_url == "github":
        # Serve from raw.githubusercontent.com (committed to media/projects/letter-ig/)
        return f"https://raw.githubusercontent.com/giliy/heyGenIL/main/media/projects/letter-ig/{urllib.parse.quote(fname)}"
    # Local tunnel: serve just the basename under the tunnel root that maps to publish/.
    return base_url.rstrip("/") + "/" + urllib.parse.quote(fname)


def _publish_one(entry: dict, token: str, ig_id: str, base_url: str, dry_run: bool) -> dict:
    ig = entry.setdefault("instagram", {})
    video_url = _video_public_url(entry, base_url)
    caption = _caption_for(entry)

    if dry_run:
        print(f"  [dry-run] would publish Reel order {entry['order']} ({entry['key']})")
        print(f"            video_url={video_url}")
        print(f"            caption[:60]={caption[:60]!r}...")
        return entry

    # Phase 1: create the REELS container.
    print(f"  creating container for {Path(entry['video']).name} ...", flush=True)
    cont = _post(f"{GRAPH}/{ig_id}/media", {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": caption,
        "access_token": token,
    })
    cid = cont.get("id")
    if not cid:
        raise RuntimeError(f"no container id returned: {cont}")
    print(f"    container id={cid}", flush=True)

    # Poll until FINISHED.
    deadline = time.time() + CONTAINER_TIMEOUT_S
    while True:
        st = _get(f"{GRAPH}/{cid}", {"fields": "status_code", "access_token": token})
        code = st.get("status_code")
        if code == "FINISHED":
            break
        if code in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"container {cid} status={code}")
        if time.time() > deadline:
            raise RuntimeError(f"container {cid} not FINISHED within {CONTAINER_TIMEOUT_S}s (last={code})")
        print(f"    status={code} — waiting {CONTAINER_POLL_S}s ...", flush=True)
        time.sleep(CONTAINER_POLL_S)

    # Phase 2: publish.
    print("    publishing ...", flush=True)
    pub = _post(f"{GRAPH}/{ig_id}/media_publish", {
        "creation_id": cid,
        "access_token": token,
    })
    media_id = pub.get("id")
    if not media_id:
        raise RuntimeError(f"no media id returned: {pub}")

    ig["state"] = "published"
    ig["mediaId"] = media_id
    ig["publishedAt"] = _now_iso()
    ig["videoUrl"] = video_url
    # Best-effort permalink (non-fatal if it fails).
    try:
        pl = _get(f"{GRAPH}/{media_id}", {"fields": "permalink", "access_token": token})
        ig["permalink"] = pl.get("permalink")
    except Exception:
        pass
    print(f"  [ok] order {entry['order']} ({entry['key']}) -> IG media {media_id} "
          f"{ig.get('permalink','')}", flush=True)
    return entry


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=1, help="max Reels to publish this run (default 1/day)")
    ap.add_argument("--max-per-day", type=int, default=MAX_PER_DAY)
    ap.add_argument("--base-url", default=None,
                    help="public base URL that maps to the local publish/ dir "
                         "(or set IG_BASE_URL in .env). Required unless --dry-run.")
    ap.add_argument("--dry-run", action="store_true", help="print what would publish, no API calls")
    args = ap.parse_args()

    if not MANIFEST.exists():
        print(f"[ERROR] {MANIFEST} not found", file=sys.stderr)
        return 2

    env = _load_env(ENV_FILE)
    base_url = args.base_url or env.get("IG_BASE_URL")
    token = env.get("META_ACCESS_TOKEN")
    ig_id = env.get("IG_USER_ID")

    today = dt.date.today()
    entries = _load_manifest()
    limit = max(0, min(args.limit, args.max_per_day))

    due = []
    for e in entries:
        if e.get("vetting", {}).get("status") not in ("approved", "vetted"):
            continue
        if e.get("instagram", {}).get("state") == "published":
            continue
        sf = e.get("scheduledFor")
        if sf and dt.date.fromisoformat(sf) > today:
            continue
        due.append(e)

    to_publish = due[:limit]
    print(f"today={today}  due&vetted&not-on-IG={len(due)}  publishing now={len(to_publish)} (limit={limit})")

    if not to_publish:
        print("nothing to publish to Instagram.")
        return 0

    if args.dry_run:
        for e in to_publish:
            _publish_one(e, token="", ig_id="", base_url=base_url or "https://BASE", dry_run=True)
        print(f"\n[dry-run] would publish {len(to_publish)} Reel(s); manifest NOT modified")
        return 0

    # Real run requires creds + a public base URL.
    if not token or not ig_id:
        print("[ERROR] META_ACCESS_TOKEN and IG_USER_ID must be set in .env", file=sys.stderr)
        return 2
    if not base_url:
        print("[ERROR] --base-url (or IG_BASE_URL in .env) is required — Meta fetches video_url "
              "from a public URL. Serve publish/ and tunnel it first.", file=sys.stderr)
        return 2

    done = 0
    for e in to_publish:
        try:
            _publish_one(e, token, ig_id, base_url, dry_run=False)
            _save_manifest(entries)   # persist after each success (crash-safe)
            done += 1
        except Exception as ex:
            print(f"  [FAIL] order {e['order']} ({e['key']}): {ex}", file=sys.stderr)
            _save_manifest(entries)
            break  # stop on first failure; resume next run

    print(f"\npublished {done}/{len(to_publish)} Reel(s) to Instagram")
    return 0 if done == len(to_publish) else 1


if __name__ == "__main__":
    raise SystemExit(main())
