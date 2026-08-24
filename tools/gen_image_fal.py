#!/usr/bin/env python3
"""
gen_image_fal.py — AI images via the DIRECT fal.ai queue API.

Sibling of gen_image.py (Gemini) / gen_clip.py (fal video): generates an
illustration/still for a video beat, saves PNG + a sidecar .json (prompt, model,
ref, seed) so any render can be reproduced. Model-agnostic: the fal model id is
just a string.

For character consistency, pass --ref <image>: uses an image-edit model
(fal-ai/flux-pro/kontext by default when --ref is set) and sends the reference as
image_url (local files are uploaded to fal's CDN first via the storage API).

Usage:
  python tools/gen_image_fal.py --prompt "..." --out x.png
  python tools/gen_image_fal.py --prompt "..." --ref ref.png --out x.png
  --model  fal model id (default text-to-image: fal-ai/flux/schnell;
           with --ref defaults to fal-ai/flux-pro/kontext)
  --aspect 9:16 | 16:9 | 1:1 | 4:5 ...   --seed N   --dry-run

Needs FAL_KEY in .env (https://fal.ai/dashboard/keys). Costs per model on fal's
pricing page — state the cost before generating.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_T2I = "fal-ai/flux/schnell"          # cheap, fast text-to-image
DEFAULT_KONTEXT = "fal-ai/flux-pro/kontext"  # reference-locked image edit
QUEUE = "https://queue.fal.run"
UPLOAD = "https://rest.alpha.fal.ai/storage/upload"

ASPECT_MAP = {  # fal image_size presets (flux models take image_size names or w/h)
    "9:16": {"width": 720, "height": 1280},
    "16:9": {"width": 1280, "height": 720},
    "1:1": {"width": 1024, "height": 1024},
    "4:5": {"width": 896, "height": 1120},
    "3:4": {"width": 960, "height": 1280},
}


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


def get_args_multi(args, name):
    return [args[i + 1] for i, a in enumerate(args) if a == name]


def rel(p):
    try:
        return os.path.relpath(p, ROOT)
    except ValueError:
        return p


def req_json(url, key, body=None, method=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Authorization": f"Key {key}",
                                        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"fal API error {e.code} at {url}:\n{e.read().decode()[:800]}")


def find_image_url(obj):
    """Walk the response for the first image-looking url."""
    if isinstance(obj, dict):
        for k in ("images", "image"):
            if k in obj:
                v = obj[k]
                if isinstance(v, list) and v and isinstance(v[0], dict) and v[0].get("url"):
                    return v[0]["url"]
                if isinstance(v, dict) and v.get("url"):
                    return v["url"]
        u = obj.get("url")
        if isinstance(u, str) and any(x in u for x in (".png", ".jpg", ".jpeg", ".webp")):
            return u
        for v in obj.values():
            found = find_image_url(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_image_url(v)
            if found:
                return found
    return None


def upload_to_fal(path, key):
    """Inline the reference image as a data URI (works for kontext image_url)."""
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{b64}"


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    prompt = get_arg(args, "--prompt")
    out = get_arg(args, "--out")
    if not prompt or not out:
        sys.exit("need --prompt and --out (see file header)")

    refs = [r for r in get_args_multi(args, "--ref") if os.path.exists(r)]
    model = get_arg(args, "--model") or (DEFAULT_KONTEXT if refs else DEFAULT_T2I)
    aspect = get_arg(args, "--aspect", "9:16")
    size = ASPECT_MAP.get(aspect, ASPECT_MAP["9:16"])
    seed = get_arg(args, "--seed")
    seed = int(seed) if seed is not None else None
    timeout = float(get_arg(args, "--timeout", "600"))

    key = load_env().get("FAL_KEY", "").strip()
    if not key:
        sys.exit("FAL_KEY not set in .env (get one at https://fal.ai/dashboard/keys)")

    payload = {"prompt": prompt, "num_images": 1}
    if refs:
        payload["image_url"] = upload_to_fal(refs[0], key)
    else:
        payload["image_size"] = size
    if seed is not None:
        payload["seed"] = seed

    print(f"model = {model}")
    print(f"aspect = {aspect}  size = {size}  seed = {seed}  refs = {[rel(r) for r in refs] or '(none)'}")
    print("payload keys:", list(payload.keys()))
    if dry:
        print("[dry-run] no API call.")
        return

    sub = req_json(f"{QUEUE}/{model}", key, body=payload)
    status_url = sub.get("status_url") or f"{QUEUE}/{model}/requests/{sub['request_id']}/status"
    response_url = sub.get("response_url") or f"{QUEUE}/{model}/requests/{sub['request_id']}"
    print("queued:", sub.get("request_id"))

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
            sys.exit(f"timeout after {int(timeout)}s")
        time.sleep(3)

    result = req_json(response_url, key)
    url = find_image_url(result)
    if not url:
        sys.exit("no image url in response:\n" + json.dumps(result)[:800])

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    urllib.request.urlretrieve(url, out)
    print(f"  png  -> {rel(out)}  ({os.path.getsize(out)//1024}KB)")

    sidecar = os.path.splitext(out)[0] + ".json"
    with open(sidecar, "w", encoding="utf-8") as f:
        json.dump({"prompt": prompt, "model": model, "aspect_ratio": aspect,
                   "seed": seed, "refs": [rel(r) for r in refs],
                   "created": time.strftime("%Y-%m-%dT%H:%M:%S")}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  meta -> {rel(sidecar)}")


if __name__ == "__main__":
    main()
