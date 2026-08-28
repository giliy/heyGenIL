---
name: publish-social
description: Publish videos to YouTube and Instagram. Handles daily drip cadence, credential setup, manifest gating, and resumable state. Use when the user wants to "upload to YouTube", "publish to Instagram", "post a reel", "run the daily drip", or check publishing status for the א–ת letter series or any manifest-driven batch.
---

# publish-social — YouTube + Instagram daily drip publisher

Publishes videos from `publish/manifest.json` to YouTube and Instagram Reels. Both
platforms share the same manifest gating (vetting + schedule + per-platform state) and
run at most `--limit` per invocation (default 1/day for a drip cadence).

**Run everything from the repo root.** Python via `.venv-image312` (has
`google-api-python-client`); prefix with `PYTHONIOENCODING=utf-8 PYTHONUTF8=1`.

## Architecture

```
publish/manifest.json          — top-level LIST of entries, each:
  order, key, letter, name_he, video, thumbnail, title, description, tags[],
  categoryId, defaultLanguage, madeForKids, privacyStatus,
  vetting{status,note}, state, scheduledFor, videoId, url, uploadedAt,
  thumbnailSet, instagram{state,mediaId,permalink,publishedAt,videoUrl}

tools/youtube_upload.py        — YouTube Data API v3 uploader + --publish-due flipper
tools/instagram_upload.py      — Meta Graph API two-phase Reels publisher
.env                           — META_ACCESS_TOKEN, IG_USER_ID, YOUTUBE_REFRESH_TOKEN,
                                  YOUTUBE_CLIENT_SECRET_PATH (never commit)
media/projects/letter-ig/      — committed videos for IG (served via GitHub raw)
```

## Daily drip (the normal operation)

Two cron jobs, ~25 min apart:

| Platform | Time | Command |
|---|---|---|
| YouTube | 9:23 AM | `.venv-image312\Scripts\python.exe tools\youtube_upload.py --publish-due` then `.venv-image312\Scripts\python.exe tools\youtube_upload.py` |
| Instagram | 9:47 AM | `.venv-image312\Scripts\python.exe tools\instagram_upload.py --limit 1 --base-url github` |

The YouTube cron does two things:
1. `--publish-due` — flips soaked (≥24h) unlisted uploads to public
2. Default run — uploads today's due letter as unlisted (soaks 24h before going public)

The Instagram cron publishes the same letter as a Reel, served from
`raw.githubusercontent.com/giliy/heyGenIL/main/media/projects/letter-ig/`.

## Manifest gating (both platforms)

An entry publishes only when ALL of these hold:
- `vetting.status` in `("approved", "vetted")`
- `scheduledFor <= today`
- Per-platform state is NOT already done:
  - YouTube: `state != "uploaded"` (checked via `state` field)
  - Instagram: `instagram.state != "published"` (checked via `instagram` sub-object)

Re-runs are idempotent — already-published entries are skipped automatically.

## Commands

### YouTube

```bash
# Dry-run: what would upload today
.venv-image312\Scripts\python.exe tools\youtube_upload.py --dry-run

# Upload today's due letter (unlisted, madeForKids)
.venv-image312\Scripts\python.exe tools\youtube_upload.py

# Upload multiple (respects quota: max 6/day)
.venv-image312\Scripts\python.exe tools\youtube_upload.py --limit 3

# Flip soaked uploads (unlisted -> public after 24h)
.venv-image312\Scripts\python.exe tools\youtube_upload.py --publish-due

# Flip with custom soak time
.venv-image312\Scripts\python.exe tools\youtube_upload.py --publish-due --soak-hours 48
```

### Instagram

```bash
# Dry-run: what would publish today
.venv-image312\Scripts\python.exe tools\instagram_upload.py --dry-run --base-url github

# Publish today's due letter as Reel
.venv-image312\Scripts\python.exe tools\instagram_upload.py --limit 1 --base-url github

# Publish multiple
.venv-image312\Scripts\python.exe tools\instagram_upload.py --limit 3 --base-url github

# Using a local tunnel instead of GitHub (for uncommitted videos)
.venv-image312\Scripts\python.exe tools\instagram_upload.py --limit 1 \
    --base-url https://<random>.trycloudflare.com
```

## First-time setup / credential refresh

### YouTube (already configured)

Credentials live in `.env`:
- `YOUTUBE_REFRESH_TOKEN` — OAuth refresh token (long-lived)
- `YOUTUBE_CLIENT_SECRET_PATH` — path to `client_secret.json`

If expired or missing, re-run: `tools/youtube_auth.py` (one-time OAuth bootstrap).

### Instagram / Meta

Credentials live in `.env`:
- `META_ACCESS_TOKEN` — long-lived User Access Token (~60 days)
- `IG_USER_ID` — numeric Instagram Business account ID
- `META_APP_ID`, `META_APP_SECRET` — for token exchange

**Full setup checklist:** `docs/instagram-setup.md`

**Quick health check** (verifies token + IG linkage):

```python
import json, urllib.request, urllib.parse
tok = open(".env").read().split("META_ACCESS_TOKEN=",1)[1].splitlines()[0].strip()
G = "https://graph.facebook.com/v21.0"
q = urllib.parse.urlencode({"access_token": tok, "fields": "username,name"})
print(json.loads(urllib.request.urlopen(f"{G}/17841438397414606?{q}").read()))
```

Should return `{"username": "bu.kuala", ...}`. If it errors, the token expired —
regenerate via Graph API Explorer and re-exchange for long-lived.

**Token refresh** (when META_ACCESS_TOKEN expires, ~60 days):

1. https://developers.facebook.com/tools/explorer/ → your app → Generate Access Token
2. Tick: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
3. On the Pages screen, tick the page linked to IG
4. Exchange for long-lived:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id=META_APP_ID
     &client_secret=META_APP_SECRET
     &fb_exchange_token=<short token>
   ```
5. Save to `.env` as `META_ACCESS_TOKEN`

**Known IDs (current setup):**

| What | Value |
|---|---|
| IG username | @bu.kuala |
| IG User ID | 17841438397414606 |
| FB Page | לומדים עם בובו (1333096643211232) |
| Meta App ID | 1596637465236349 |
| YouTube channel | לומדים עם בובו (UCoiA55fkMonw2vWyx-zY5Mg) |

## Video hosting for Instagram

Instagram requires a **public https URL** for each video. Two options:

**Option A — GitHub (preferred, no tunnel needed):**
Videos are committed to `media/projects/letter-ig/` and served from
`https://raw.githubusercontent.com/giliy/heyGenIL/main/media/projects/letter-ig/`.
Use `--base-url github`.

**Option B — Local tunnel (for uncommitted / one-off videos):**
```bash
python -m http.server 8765 --directory publish &
cloudflared tunnel --url http://localhost:8765 &
# Use the printed trycloudflare.com URL as --base-url
```

## Cron setup

Both crons are **session-only** (die when Claude exits, auto-expire after 7 days).
Re-arm them in a future session if the rollout is still running.

```python
# YouTube daily drip (9:23 AM)
CronCreate(cron="23 9 * * *", prompt="""Run the daily YouTube letter drip:
1. .venv-image312\\Scripts\\python.exe tools\\youtube_upload.py --publish-due
2. .venv-image312\\Scripts\\python.exe tools\\youtube_upload.py (default limit=1)
Verify publish\\manifest.json after.""", recurring=True)

# Instagram daily drip (9:47 AM)
CronCreate(cron="47 9 * * *", prompt="""Run the daily Instagram letter drip:
.venv-image312\\Scripts\\python.exe tools\\instagram_upload.py --limit 1 --base-url github
Verify publish\\manifest.json after.""", recurring=True)
```

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `me/accounts` doesn't list your page | Token generated before page was ticked in OAuth dialog | Regenerate token, tick the page on the Pages screen |
| `Unsupported get request` on page ID | Page not granted to app | Same as above — regenerate with page ticked |
| IG container stuck at IN_PROGRESS | Video URL unreachable | Check `--base-url github` works: `curl -I https://raw.githubusercontent.com/.../letter-1-alef-FINAL.mp4` |
| `Missing Permission` on `me/businesses` | `business_management` not granted | Expected — not needed for publishing |
| YouTube `invalid_scope` | SCOPES mismatch between `youtube_upload.py` and `youtube_auth.py` | Keep both files' SCOPES identical |
| Thumbnail not set | Channel not phone-verified | https://www.youtube.com/verify — video is still live, thumb can be set later |
