#!/usr/bin/env python3
"""
gen_talk.py — HeyGen-IL talking-head lip-sync via the DIRECT fal.ai queue API.

Model-agnostic BY DESIGN (mirrors gen_clip.py): the fal model id is a string, so swapping
lip-sync backends (MuseTalk / LivePortrait / OmniHuman / Kling-Lipsync / etc.) is a --model
flag, never a code change. The face ref is either an IMAGE (photo avatar — image-input
models) or a DRIVER VIDEO (digital twin — video-input models). The Hebrew voice track
(voice.wav) drives the mouth. Saves the mp4 + a sidecar .json for reproducibility.

Usage:
  python tools/gen_talk.py --face /path/face.jpg --audio /path/voice.wav \\
      --out /abs/out/talk.mp4
  python tools/gen_talk.py --face /path/face.jpg --audio voice.wav \\
      --model fal-ai/musetalk --out out.mp4
  python tools/gen_talk.py --face /path/twin-driver.mp4 --audio voice.wav \\
      --model <video-input-model> --driver --out out.mp4
  python tools/gen_talk.py --face f.jpg --audio v.wav --out out.mp4 --dry-run

  --face     avatar face: a portrait IMAGE, or (--driver) a short driver VIDEO
  --audio    the Hebrew voice .wav (the lip-sync source) — required
  --model    fal model id (default fal-ai/musetalk; browse fal.ai/models)
  --driver   treat --face as a driver VIDEO (digital-twin path)
  --set k=v  any extra payload field, repeatable (numbers/bools auto-parsed; JSON accepted)
  --timeout  seconds to wait (default 900)
  --dry-run  print the payload, no API call

Needs FAL_KEY in .env (https://fal.ai/dashboard/keys). Costs are per-model on fal's pricing
page — state the cost when proposing a talking-head clip (see the CREDIT_TABLE talkSec rates
in @shorts/spec).
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Default = VEED Fabric 1.0 (still image + audio → talking head). The worker always passes
# --model from resolveTalkModel, so this only kicks in for direct CLI use.
DEFAULT_MODEL = "fal-ai/veed/fabric-1.0"
QUEUE = "https://queue.fal.run"


def load_env():
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


def get_arg(args, name, default=None):
    return args[args.index(name) + 1] if name in args else default


def parse_val(v):
    try:
        return json.loads(v)
    except (ValueError, json.JSONDecodeError):
        return v


def req_json(url, key, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Authorization": f"Key {key}",
                                        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"fal API error {e.code} at {url}:\n{e.read().decode()[:800]}")


# fal's old REST upload (rest.alpha.fal.ai/media/upload) is DEAD (404, verified 2026-08-24).
# The supported upload is fal_client.upload_file -> returns a v3b.fal.media URL ready to pass
# as image_url/audio_url. gen_talk.py is stdlib-only by convention, so we call fal_client in a
# subprocess using the voice venv (.venv-voice312) where fal-client is installed. FAL_KEY is
# passed via env (fal_client reads it). Falls back to a data: URI if the venv/fal_client is absent.
VOICE_PY = os.path.join(ROOT, '.venv-voice312', 'Scripts', 'python.exe')


def upload_media(path, key, ext):
    """Upload a local image/video to fal CDN, return a URL usable as image_url/audio_url."""
    if os.path.exists(VOICE_PY):
        code = (
            "import sys, fal_client\n"
            f"print(fal_client.upload_file({path!r}))\n"
        )
        env = dict(os.environ)
        env["FAL_KEY"] = key
        r = subprocess.run([VOICE_PY, "-c", code], capture_output=True, text=True, env=env)
        url = (r.stdout or "").strip().splitlines()
        if r.returncode == 0 and url and url[-1].startswith("http"):
            return url[-1]
        sys.stderr.write(f"[warn] fal_client upload failed ({(r.stderr or '')[-200:]}); "
                         "falling back to data URI\n")
    # Fallback: inline the media as a data URI (works for small files; not ideal for video).
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    content_type = "image/jpeg" if ext in (".jpg", ".jpeg") else \
                   "image/png" if ext == ".png" else \
                   "audio/mpeg" if ext in (".mp3", ".mpeg") else \
                   "audio/wav" if ext == ".wav" else "video/mp4"
    return f"data:{content_type};base64,{b64}"


def find_video_url(obj):
    """Walk any response schema for the first video-looking url."""
    if isinstance(obj, dict):
        u = obj.get("url")
        if isinstance(u, str) and (".mp4" in u or "video" in obj.get("content_type", "")):
            return u
        for v in obj.values():
            found = find_video_url(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_video_url(v)
            if found:
                return found
    return None


def main():
    args = sys.argv[1:]
    model = get_arg(args, "--model", DEFAULT_MODEL)
    face = get_arg(args, "--face")
    audio = get_arg(args, "--audio")
    out = get_arg(args, "--out")
    timeout = float(get_arg(args, "--timeout", "900"))
    dry = "--dry-run" in args
    driver = "--driver" in args

    if not face or not audio or not out:
        sys.exit("need --face, --audio, and --out (see file header)")

    key = load_env().get("FAL_KEY", "").strip()
    # Upload local inputs to fal storage so the model can read them. The worker passes
    # ABSOLUTE local paths (resolveKey output); the caller may also hand us a URL already.
    # On --dry-run, skip FAL_KEY + the upload entirely and echo the path as a pseudo-URL so
    # the payload is inspectable without touching fal.
    def to_url(p):
        if p.startswith("http://") or p.startswith("https://"):
            return p
        if dry:
            return f"file://{p}"
        ext = os.path.splitext(p)[1].lower()
        return upload_media(p, key, ext)

    if not key and not dry:
        sys.exit("FAL_KEY not set in .env (get one at https://fal.ai/dashboard/keys)")

    payload = {}
    if driver:
        payload["video_url"] = to_url(face)  # driver video (digital twin)
    else:
        payload["image_url"] = to_url(face)  # photo avatar
    payload["audio_url"] = to_url(audio)

    # VEED Fabric is resolution-priced ($0.10/s @480p, $0.20/s @720p). AvatarSpec renders at
    # 1080x1920, so 480p upscales 2.25x = soft. DEFAULT TO 720p (the sharp render); drop to
    # 480p only via TALK_RESOLUTION=480p when cost matters more than mouth-region sharpness.
    if "fabric" in model:
        payload.setdefault("resolution", load_env().get("TALK_RESOLUTION", "720p").strip() or "720p")

    for i, a in enumerate(args):
        if a == "--set":
            k, _, v = args[i + 1].partition("=")
            payload[k] = parse_val(v)

    print(f"model = {model}  ({'driver-video' if driver else 'photo-image'} face)")
    print("payload =", json.dumps(payload, indent=2)[:600])
    if dry:
        print("[dry-run] no API call.")
        return

    sub = req_json(f"{QUEUE}/{model}", key, body=payload)
    status_url = sub.get("status_url") or f"{QUEUE}/{model}/requests/{sub['request_id']}/status"
    response_url = sub.get("response_url") or f"{QUEUE}/{model}/requests/{sub['request_id']}"
    print(f"queued: {sub.get('request_id')}")

    t0 = time.time()
    last = ""
    while True:
        st = req_json(f"{status_url}?logs=1", key)
        s = st.get("status", "?")
        if s != last:
            print(f"  {s}  (+{int(time.time()-t0)}s)")
            last = s
        if s == "COMPLETED":
            break
        if s in ("FAILED", "ERROR", "CANCELLED"):
            sys.exit(f"generation {s}: {json.dumps(st)[:800]}")
        if time.time() - t0 > timeout:
            sys.exit(f"timeout after {int(timeout)}s (request {sub.get('request_id')} may still finish; "
                     f"re-poll {response_url})")
        time.sleep(5)

    result = req_json(response_url, key)
    url = find_video_url(result)
    if not url:
        sys.exit("no video url in response:\n" + json.dumps(result)[:800])

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    urllib.request.urlretrieve(url, out)
    print(f"talk video -> {os.path.relpath(out, ROOT)}  ({os.path.getsize(out)//1024}KB)")

    sidecar = os.path.splitext(out)[0] + ".json"
    with open(sidecar, "w", encoding="utf-8") as f:
        json.dump({"model": model, "driver": driver, "payload": payload,
                   "request_id": sub.get("request_id"), "source_url": url,
                   "created": time.strftime("%Y-%m-%dT%H:%M:%S")},
                  f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"meta  -> {os.path.relpath(sidecar, ROOT)}")


if __name__ == "__main__":
    main()
