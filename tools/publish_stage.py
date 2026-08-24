#!/usr/bin/env python3
"""publish_stage.py — stage a mastered learn-shorts mp4 for a HUMAN to post to the channel.

This is the STAGED HAND-OFF (no platform APIs yet): it copies the mastered video into
publish/<date>-<type>-<key>/ with a generated caption (Hebrew title + hashtags) and a
one-line NOTE for the poster. The daily engine (learn_daily.py) calls stage() after a
successful master; the poster opens the folder and taps upload on TikTok/IG/YouTube.

Layout:
  publish/<YYYY-MM-DD>-<type>-<key>/
    video.mp4      — the mastered final (copy)
    caption.txt    — Hebrew title + hashtags (copy-paste into the post)
    NOTE.md        — "post to TikTok / Instagram / YouTube" + the caption, for the human

Upgrade path (deferred): a future `upload=True` flag can call YouTube Data API / IG Graph /
TikTok Content-Posting without touching learn_daily.py. Not in scope today.
"""
import json
import os
import shutil
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLISH_ROOT = os.path.join(ROOT, "publish")

_HASHTAGS = "#לימודעברית #קריאה #ניקוד #ילדים #גןחובה #כיתהא"


def caption_for(type_, key, title=None):
    """Compose the post caption. title comes from beats.json (בּוּ מְלַמֵּד <name>)."""
    t = title or f"בּוּ מְלַמֵּד {key}"
    return f"{t}\n\nלימוד קריאה לילדים — {key}.\n{_HASHTAGS}"


def stage(mastered_path, type_, key, title=None, when=None, out_root=None):
    """Copy the mastered video into a dated publish folder with caption + NOTE. Returns the
    folder path. Pure file ops — no network, no API keys."""
    when = when or date.today().isoformat()
    out_root = out_root or PUBLISH_ROOT
    folder = os.path.join(out_root, f"{when}-{type_}-{key}")
    os.makedirs(folder, exist_ok=True)

    dst = os.path.join(folder, "video.mp4")
    shutil.copy2(mastered_path, dst)

    cap = caption_for(type_, key, title)
    with open(os.path.join(folder, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(cap)

    note = (f"# Post this video\n\n"
            f"Upload `video.mp4` to **TikTok**, **Instagram Reels**, and **YouTube Shorts**.\n"
            f"Paste this caption:\n\n```\n{cap}\n```\n\n"
            f"_Staged by tools/publish_stage.py — a human posts from this folder._\n")
    with open(os.path.join(folder, "NOTE.md"), "w", encoding="utf-8") as f:
        f.write(note)

    print(f"[publish_stage] staged -> {os.path.relpath(folder, ROOT)}")
    return folder


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Stage a mastered mp4 for a human to post")
    ap.add_argument("mp4", help="path to the mastered final mp4")
    ap.add_argument("--type", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--title")
    a = ap.parse_args()
    if not os.path.exists(a.mp4):
        sys.exit(f"mp4 not found: {a.mp4}")
    stage(a.mp4, a.type, a.key, title=a.title)
