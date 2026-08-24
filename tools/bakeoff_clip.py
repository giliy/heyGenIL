#!/usr/bin/env python3
"""
bakeoff_clip.py — SAME prompt + SAME reference image across N fal video models -> labelled grid.

gen_clip.py fires ONE model; this is the missing comparison harness (the "audition for Hasan's
eye" pattern, like mix_music.py auditions beds for his ear). One prompt + one reference still ->
fan out to N image-to-video models IN PARALLEL -> per-model mp4 + sidecar json -> one stitched
side-by-side grid.mp4 with the model id and cost burned into each panel.

ALWAYS audio-off (voice is ElevenLabs, sound is the SFX pipeline): generate_audio:false is forced
wherever the model has the flag — on Seedance it halves the token rate.

COSTS ARE DERIVED, NOT QUOTED (the 2026-07-14 lesson in ai-video/IDEAS.md):
  - Seedance is TOKEN-priced: tokens = h*w*fps*dur/1024 at 24fps; audio-off = $1.2/1M tokens
    (rate confirmed via api.fal.ai/v1/models/pricing 2026-07-14). The formula reproduces fal's
    own worked example ($0.26 for 5s 720p WITH audio at $2.4/1M) to the cent.
  - Per-second models use the audio-off / per-resolution rates from each fal model page
    (read 2026-07-14). NOTE the two traps found that day: Wan 2.5 is resolution-tiered
    ($0.05/0.10/0.15 per second at 480p/720p/1080p — the flat $0.05 people quote is the 480p
    rate), and the cheap "$0.03-0.05/s Veo" numbers belong to Veo 3.1 LITE, not Fast.
  After the run we also try GET api.fal.ai/v1/models/usage for the ACTUAL billed cost; that
  endpoint needs an ADMIN-scoped key, so with a regular key panels are labelled "est".

Usage (from a type workspace, via the core venv):
  ../core/venv/Scripts/python.exe ../core/tools/bakeoff_clip.py \
      --prompt "the character walks slowly toward the huge door..." \
      --ref blue-man/shots/01-door.png --out blue-man/bakeoff/round1

  --models a,b,c   registry keys (default: seedance,seedance-2,ltx-fast,wan-27 — the T13
                   roster; the legacy cheap 1080p roster is seedance,kling,veo-lite)
  --duration 5     requested seconds; snapped DOWN to each model's allowed values
                   (note: ltx-fast minimum is 6s, wan-27 accepts 2-10s, seedance-2 4-15s)
  --resolution 1080p   480p|720p|1080p|4k where the model has the knob (kling is fixed 1080p)
  --ref PATH       local reference image -> uploaded once to fal storage (all models get the
                   same file_url); or pass --image-url to skip the upload
  --set k=v        extra payload field for ALL models; --set model:k=v for one model only
  --timeout 900    per-model wait  ·  --dry-run  payloads + derived costs, no API calls
  --verify-prices  READ-ONLY: query the fal pricing API for every Seedance/Wan/LTX tier
                   (PRICE_TABLE) + the registered panels, print the verified $/clip, and
                   write pricing.json to --out. No generation, no spend.

Registry ($ for a ~5-6s 1080p audio-off panel, derived/verified 2026-08-22):
  seedance     fal-ai/bytedance/seedance/v1.5/pro/image-to-video  5s $0.29  (end_image_url!)
  seedance-2   bytedance/seedance-2.0/image-to-video              5s ~$0.07 (unit-priced; VERIFY)
  ltx-fast     lightricks/ltx-2.5/image-to-video/fast             6s $0.78  (min dur 6s; $0.13/s)
  wan-27       fal-ai/wan/v2.7/reference-to-video                 5s $0.50  (char lock; $0.10/s)
  kling        fal-ai/kling-video/v2.5-turbo/pro/image-to-video   5s $0.35  (tail_image_url!)
  veo-lite     fal-ai/veo3.1/lite/image-to-video                  4s $0.20
  veo-fast     fal-ai/veo3.1/fast/image-to-video                  4s $0.40
  wan          fal-ai/wan-25-preview/image-to-video               5s $0.75  (priciest at 1080p)

Needs FAL_KEY in core/.env; ffmpeg/ffprobe on PATH for the grid.
"""
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import ffw  # resolved ffmpeg/ffprobe (full build, fails fast on the minimal one)
QUEUE = "https://queue.fal.run"
STORAGE_INITIATE = "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3"
USAGE_API = "https://api.fal.ai/v1/models/usage"
FPS = 24  # validated against fal's Seedance worked example

# 9:16 / 16:9 pixel counts per resolution tier (Seedance token maths)
PX = {"480p": 480 * 854, "720p": 720 * 1280, "1080p": 1080 * 1920}


def seedance_cost(dur, res):
    tokens = PX[res] * FPS * dur / 1024
    return tokens * 1.2 / 1e6  # $1.2/1M tokens, audio off


PRICING_API = "https://api.fal.ai/v1/models/pricing"

# Pricing-verification table: every model/tier we might be tempted to "upgrade" to, with the
# CURRENT rate verified live via the fal pricing API (GET api.fal.ai/v1/models/pricing?
# endpoint_id=...) BEFORE any spend. price_usd+unit come straight from the API (refreshed by
# --verify-prices); note records the human-readable per-clip/per-second reading + any trap.
# Verified 2026-08-22:
#   - Seedance v1.5 pro is TOKEN-priced ($1.2/1M audio-off) -> $0.29 for 5s 1080p.
#   - Seedance 2.0 / 2.5 jump to per-"unit"/per-1K-token rates that are several x v1.5.
#   - Wan is resolution-tiered: 2.5-preview is flat $0.05/s; Wan 2.7 is flat $0.10/s.
#   - LTX-2.5 fast is resolution-tiered per second (~$0.13/s @1080p; compute-second metered).
PRICE_TABLE = [
    # endpoint_id, price_usd, unit, note
    ("fal-ai/bytedance/seedance/v1.5/pro/image-to-video", 1.2, "1m tokens",
     "seedance v1.5 pro (current default) — token-priced; ~$0.29 / 5s 1080p audio-off"),
    ("fal-ai/bytedance/seedance/v1.5/lite/image-to-video", None, "",
     "seedance v1.5 lite tier"),
    ("fal-ai/bytedance/seedance/v1/pro/image-to-video", 2.5, "1m tokens",
     "seedance v1 pro — ~2x v1.5 token rate"),
    ("bytedance/seedance-2.0/image-to-video", 0.014, "units",
     "Seedance 2.0 i2v — per-unit; several x v1.5 per clip (verify before switching)"),
    ("bytedance/seedance-2.0/reference-to-video", 0.014, "units", "Seedance 2.0 reference-to-video"),
    ("bytedance/seedance-2.5/image-to-video", 0.0214, "1000 tokens",
     "Seedance 2.5 i2v — token-priced; several x v1.5 (verify before switching)"),
    ("bytedance/seedance-2.5/reference-to-video", 0.0214, "1000 tokens", "Seedance 2.5 reference-to-video"),
    ("bytedance/seedance-2.5/text-to-video", 0.0214, "1000 tokens", "Seedance 2.5 text-to-video"),
    ("lightricks/ltx-2.5/image-to-video/fast", 0.00017, "compute seconds",
     "LTX-2.5 fast — Apache-2.0; ~$0.13/s @1080p / $0.09/s @720p (resolution-tiered)"),
    ("fal-ai/wan/v2.7/image-to-video", 0.1, "seconds", "Wan 2.7 image-to-video — flat $0.10/s"),
    ("fal-ai/wan/v2.7/reference-to-video", 0.1, "seconds",
     "Wan 2.7 reference-to-video (built-in character lock) — flat $0.10/s"),
    ("fal-ai/wan/v2.7/text-to-video", 0.1, "seconds", "Wan 2.7 text-to-video — flat $0.10/s"),
    ("fal-ai/wan-25-preview/image-to-video", 0.05, "seconds",
     "Wan 2.5 preview i2v — flat $0.05/s (480p rate; 720p/1080p cost more)"),
    ("fal-ai/wan/v2.6/image-to-video", 0.00017, "compute seconds", "Wan 2.6 image-to-video"),
    ("fal-ai/wan/v2.2-a14b/image-to-video", 0.08, "seconds", "Wan 2.2-a14b image-to-video — flat $0.08/s"),
]


MODELS = {
    "seedance": {
        "endpoint": "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
        "snap": lambda d: max(4, min(12, int(d))),
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": str(d),
            "resolution": r, "aspect_ratio": "auto", "generate_audio": False},
        "res": lambda r: r if r in ("480p", "720p", "1080p") else "1080p",
        "cost": seedance_cost,
    },
    "kling": {
        "endpoint": "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
        "snap": lambda d: 10 if d >= 10 else 5,
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": str(d)},
        "res": lambda r: "1080p",  # no knob; fixed output
        "cost": lambda d, r: 0.07 * d,
    },
    "wan": {
        "endpoint": "fal-ai/wan-25-preview/image-to-video",
        "snap": lambda d: 10 if d >= 10 else 5,
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": str(d), "resolution": r},
        "res": lambda r: r if r in ("480p", "720p", "1080p") else "1080p",
        "cost": lambda d, r: {"480p": 0.05, "720p": 0.10, "1080p": 0.15}[r] * d,
    },
    "veo-fast": {
        "endpoint": "fal-ai/veo3.1/fast/image-to-video",
        "snap": lambda d: 8 if d >= 8 else (6 if d >= 6 else 4),
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": f"{d}s",
            "resolution": r, "aspect_ratio": "auto", "generate_audio": False},
        "res": lambda r: r if r in ("720p", "1080p", "4k") else "1080p",
        "cost": lambda d, r: (0.30 if r == "4k" else 0.10) * d,
    },
    "veo-lite": {
        "endpoint": "fal-ai/veo3.1/lite/image-to-video",
        "snap": lambda d: 8 if d >= 8 else (6 if d >= 6 else 4),
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": f"{d}s",
            "resolution": r, "aspect_ratio": "auto", "generate_audio": False},
        "res": lambda r: r if r in ("720p", "1080p") else "1080p",
        "cost": lambda d, r: {"720p": 0.03, "1080p": 0.05}[r] * d,
    },
    # --- T13 additions ---------------------------------------------------------------
    "seedance-2": {
        # Seedance 2.x i2v. "unit" priced (verified $0.014/unit); real per-clip cost is
        # duration/resolution-scaled and several x v1.5 -- --verify-prices before relying.
        "endpoint": "bytedance/seedance-2.0/image-to-video",
        "snap": lambda d: max(4, min(15, int(d))),
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": str(d),
            "resolution": r, "aspect_ratio": "auto", "generate_audio": False},
        "res": lambda r: r if r in ("480p", "720p", "1080p", "4k") else "1080p",
        "cost": lambda d, r: 0.014 * d,  # ESTIMATE: unit-priced; treat as floor, verify first
    },
    "ltx-fast": {
        # LTX-2.5 fast image-to-video (Apache-2.0). Duration enum starts at 6s.
        # Resolution-tiered: ~$0.09/s @720p, ~$0.13/s @1080p (docs; compute-second metered).
        "endpoint": "lightricks/ltx-2.5/image-to-video/fast",
        "snap": lambda d: 6 if d < 8 else (8 if d < 10 else 10),
        "payload": lambda p, img, d, r: {
            "prompt": p, "image_url": img, "duration": str(d),
            "resolution": r, "aspect_ratio": "auto", "generate_audio": False},
        "res": lambda r: r if r in ("720p", "1080p", "1440p", "2160p") else "1080p",
        "cost": lambda d, r: {"720p": 0.09, "1080p": 0.13, "1440p": 0.19, "2160p": 0.30}[r] * d,
    },
    "wan-27": {
        # Wan 2.7 reference-to-video (built-in character lock). Reference images go in
        # reference_image_urls (list), not image_url. Flat $0.10/s. Duration enum 2-10s.
        "endpoint": "fal-ai/wan/v2.7/reference-to-video",
        "snap": lambda d: max(2, min(10, int(d))),
        "payload": lambda p, img, d, r: {
            "prompt": p, "reference_image_urls": [img], "duration": str(d),
            "resolution": r, "aspect_ratio": "auto"},
        "res": lambda r: r if r in ("720p", "1080p") else "1080p",
        "cost": lambda d, r: 0.10 * d,
    },
}
DEFAULT_MODELS = "seedance,seedance-2,ltx-fast,wan-27"

PRINT_LOCK = threading.Lock()


def say(msg):
    with PRINT_LOCK:
        print(msg, flush=True)


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


def show(p):
    try:
        return os.path.relpath(p, os.getcwd())
    except ValueError:
        return p


def req_json(url, key, body=None, method=None, timeout=120):
    """Like gen_clip's, but RAISES instead of sys.exit (we run inside threads)."""
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Authorization": f"Key {key}",
                                        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"fal API {e.code} at {url}: {e.read().decode()[:400]}")


def upload_ref(path, key):
    """Upload a local image to fal storage once; every model gets the same public file_url."""
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    init = req_json(STORAGE_INITIATE, key,
                    body={"file_name": os.path.basename(path), "content_type": ctype})
    with open(path, "rb") as f:
        data = f.read()
    put = urllib.request.Request(init["upload_url"], data=data, method="PUT",
                                 headers={"Content-Type": ctype})
    with urllib.request.urlopen(put, timeout=300) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"storage PUT failed: {resp.status}")
    return init["file_url"]


def find_video_url(obj):
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


def run_model(mkey, spec, payload, out_file, key, timeout, result):
    t0 = time.time()
    try:
        sub = req_json(f"{QUEUE}/{spec['endpoint']}", key, body=payload)
        rid = sub.get("request_id")
        status_url = sub.get("status_url") or f"{QUEUE}/{spec['endpoint']}/requests/{rid}/status"
        response_url = sub.get("response_url") or f"{QUEUE}/{spec['endpoint']}/requests/{rid}"
        say(f"  [{mkey}] queued {rid}")
        last = ""
        while True:
            st = req_json(status_url, key)
            s = st.get("status", "?")
            if s != last:
                say(f"  [{mkey}] {s}  (+{int(time.time() - t0)}s)")
                last = s
            if s == "COMPLETED":
                break
            if s in ("FAILED", "ERROR", "CANCELLED"):
                raise RuntimeError(f"generation {s}: {json.dumps(st)[:300]}")
            if time.time() - t0 > timeout:
                raise RuntimeError(f"timeout after {int(timeout)}s (request {rid})")
            time.sleep(5)
        resp = req_json(response_url, key)
        url = find_video_url(resp)
        if not url:
            raise RuntimeError("no video url in response: " + json.dumps(resp)[:300])
        urllib.request.urlretrieve(url, out_file)
        result.update(ok=True, file=out_file, request_id=rid, source_url=url,
                      elapsed=round(time.time() - t0, 1))
        say(f"  [{mkey}] done -> {show(out_file)}  ({os.path.getsize(out_file)//1024}KB, "
            f"{result['elapsed']}s)")
    except Exception as e:
        result.update(ok=False, error=str(e), elapsed=round(time.time() - t0, 1))
        say(f"  [{mkey}] FAILED: {e}")


def verify_prices(key, dur, resolution):
    """Query the fal pricing API for the CURRENT rate of every PRICE_TABLE row + every
    registered panel, and print a verified $/clip report at the given duration/resolution.
    READ-ONLY (no generation, no spend). Returns a list of report rows."""
    print("=" * 96)
    print("VERIFIED PRICING  (fal pricing API, read-only — no generation)")
    print(f"  panel clip = {dur:.0f}s @ {resolution} (audio off where the flag exists)")
    print("=" * 96)
    report = []
    for endpoint, _usd, _unit, note in PRICE_TABLE:
        url = f"{PRICING_API}?endpoint_id={urllib.parse.quote(endpoint, safe='')}"
        live = "(no price row)"
        for attempt in range(4):  # retry through the pricing API's 429 rate limit
            try:
                data = req_json(url, key)
                prices = data.get("prices", [])
                if prices:
                    live = ", ".join(f"${p.get('unit_price')}/{p.get('unit')}" for p in prices)
                break
            except Exception as e:
                if "429" in str(e) and attempt < 3:
                    time.sleep(3 * (attempt + 1))
                    continue
                live = f"query failed: {str(e)[:80]}"
                break
        report.append({"endpoint": endpoint, "live_price": live, "note": note})
        print(f"  {endpoint:52} {live:28} {note}")
        time.sleep(1.2)  # be gentle with the pricing API rate limit

    # Verified $/clip for the registered panels at this duration/resolution.
    panels = []
    for mk in [m.strip() for m in DEFAULT_MODELS.split(",")]:
        spec = MODELS[mk]
        d, r = spec["snap"](dur), spec["res"](resolution)
        panels.append({"key": mk, "endpoint": spec["endpoint"], "duration_s": d,
                       "resolution": r, "verified_cost_usd": round(spec["cost"](d, r), 4)})
    print("\n  Verified $/clip for the bakeoff panels "
          f"({dur:.0f}s@{resolution}, audio off):")
    total = 0.0
    for p in panels:
        total += p["verified_cost_usd"]
        print(f"    {p['key']:12} {p['endpoint']:52} {p['duration_s']}s {p['resolution']:6}"
              f"  ${p['verified_cost_usd']:.4f}")
    print(f"    {'TOTAL':12} {'':52} {'':9}{'':6}  ${total:.4f}")
    return {"duration_s": dur, "resolution": resolution,
            "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "verified": True, "price_table": report, "panels": panels,
            "total_panel_usd": round(total, 4)}


def billed_costs(key, endpoints, start_iso):
    """Try the usage API for ACTUAL billed cost per endpoint. Needs an ADMIN-scoped key;
    with a regular key this 403s and we fall back to derived costs (labelled 'est')."""
    try:
        q = [("expand", "summary"), ("start", start_iso)] + [("endpoint_id", e) for e in endpoints]
        data = req_json(f"{USAGE_API}?{urllib.parse.urlencode(q)}", key)
        costs = {}

        def walk(o):
            if isinstance(o, dict):
                if o.get("endpoint_id") in endpoints and isinstance(o.get("cost"), (int, float)):
                    costs[o["endpoint_id"]] = costs.get(o["endpoint_id"], 0) + o["cost"]
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(data)
        return costs
    except Exception as e:
        say(f"  (usage API not available with this key -> costs are derived: {str(e)[:120]})")
        return {}


def ffrun(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.stderr.write("\nFFMPEG FAILED:\n  " + " ".join(cmd) + "\n" + r.stdout[-3000:] + "\n")
        raise SystemExit(1)
    return r.stdout


def probe_duration(path):
    out = ffrun([ffw.ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nw=1:nk=1", path]).strip()
    return float(out)


def find_font():
    for p in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return p.replace(":", r"\:")
    return None


def dt_escape(text):
    return text.replace("\\", "").replace("'", "").replace(":", r"\:").replace(",", r"\,")


def build_grid(panels, out_file):
    """panels: [(file, line1, line2)] -> uniform 540x960 panels, padded to the longest
    duration (frozen last frame), label bar burned in, hstacked. Video only."""
    max_dur = max(probe_duration(f) for f, _, _ in panels)
    font = find_font()
    fontarg = f"fontfile='{font}':" if font else ""
    cmd = [ffw.path(), "-y", "-hide_banner"]
    for f, _, _ in panels:
        cmd += ["-i", f]
    parts, refs = [], []
    for i, (f, l1, l2) in enumerate(panels):
        pad = max(0.0, max_dur - probe_duration(f))
        chain = (
            f"[{i}:v]scale=540:960:force_original_aspect_ratio=decrease,"
            f"pad=540:960:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={FPS},"
            f"tpad=stop_mode=clone:stop_duration={pad:.3f},"
            f"drawbox=y=ih-110:w=iw:h=110:color=black@0.65:t=fill,"
            f"drawtext={fontarg}text='{dt_escape(l1)}':fontcolor=white:fontsize=26:"
            f"x=(w-text_w)/2:y=h-96,"
            f"drawtext={fontarg}text='{dt_escape(l2)}':fontcolor=#ffd34d:fontsize=30:"
            f"x=(w-text_w)/2:y=h-56[p{i}]"
        )
        parts.append(chain)
        refs.append(f"[p{i}]")
    if len(panels) == 1:
        parts[-1] = parts[-1].replace("[p0]", "[grid]")  # hstack needs >=2 inputs
    else:
        parts.append("".join(refs) + f"hstack=inputs={len(panels)}[grid]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[grid]", "-an",
            "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", out_file]
    ffrun(cmd)


def main():
    args = sys.argv[1:]
    prompt = get_arg(args, "--prompt")
    out_dir = get_arg(args, "--out")
    ref = get_arg(args, "--ref")
    image_url = get_arg(args, "--image-url")
    duration = float(get_arg(args, "--duration", "5"))
    resolution = get_arg(args, "--resolution", "1080p")
    timeout = float(get_arg(args, "--timeout", "900"))
    model_keys = [m.strip() for m in get_arg(args, "--models", DEFAULT_MODELS).split(",")]
    dry = "--dry-run" in args
    verify = "--verify-prices" in args

    bad = [m for m in model_keys if m not in MODELS]
    if bad:
        sys.exit(f"unknown model key(s) {bad}; registry: {', '.join(MODELS)}")

    if verify:  # read-only pricing report; no reference image or prompt required
        key = load_env().get("FAL_KEY", "").strip()
        if not key:
            sys.exit("FAL_KEY not set in .env")
        report = verify_prices(key, duration, resolution)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            rp = os.path.join(out_dir, "pricing.json")
            with open(rp, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"\npricing report -> {show(rp)}")
        return

    if not prompt or not out_dir:
        sys.exit("need --prompt and --out DIR (see file header)")
    if not dry and not ref and not image_url:
        sys.exit("need --ref (local image) or --image-url")

    # global and per-model --set overrides
    overrides = {"*": {}}
    for i, a in enumerate(args):
        if a == "--set":
            kv, _, v = args[i + 1].partition("=")
            mk, _, k = kv.rpartition(":")
            overrides.setdefault(mk or "*", {})[k] = parse_val(v)

    plan, total = [], 0.0
    for mk in model_keys:
        spec = MODELS[mk]
        d = spec["snap"](duration)
        r = spec["res"](resolution)
        payload = spec["payload"](prompt, image_url or "<ref upload>", d, r)
        payload.update(overrides["*"])
        payload.update(overrides.get(mk, {}))
        cost = spec["cost"](d, r)
        total += cost
        plan.append({"key": mk, "spec": spec, "dur": d, "res": r,
                     "payload": payload, "cost": cost})

    print(f"prompt: {prompt[:120]}{'...' if len(prompt) > 120 else ''}")
    print(f"ref:    {ref or image_url}")
    for p in plan:
        print(f"  {p['key']:10} {p['spec']['endpoint']:55} {p['dur']}s {p['res']:6}"
              f"  ${p['cost']:.3f}")
    print(f"TOTAL derived cost: ${total:.2f}  (audio off everywhere the flag exists)")
    if dry:
        print("[dry-run] no API calls.")
        return

    key = load_env().get("FAL_KEY", "").strip()
    if not key:
        sys.exit("FAL_KEY not set in core/.env")

    os.makedirs(out_dir, exist_ok=True)
    start_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if not image_url:
        print("uploading reference to fal storage...")
        image_url = upload_ref(ref, key)
        print(f"  -> {image_url}")
        for p in plan:
            p["payload"]["image_url"] = image_url

    threads, results = [], {}
    for p in plan:
        results[p["key"]] = {}
        t = threading.Thread(target=run_model, args=(
            p["key"], p["spec"], p["payload"],
            os.path.join(out_dir, f"{p['key']}.mp4"), key, timeout, results[p["key"]]))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    ok = [p for p in plan if results[p["key"]].get("ok")]
    if not ok:
        sys.exit("all models failed; no grid.")

    actual = billed_costs(key, [p["spec"]["endpoint"] for p in ok], start_iso)

    panels, manifest = [], []
    for p in plan:
        r = results[p["key"]]
        billed = actual.get(p["spec"]["endpoint"])
        cost_label = (f"${billed:.3f} billed" if billed is not None
                      else f"${p['cost']:.3f} est")
        meta = {"model": p["spec"]["endpoint"], "payload": p["payload"],
                "request_id": r.get("request_id"), "source_url": r.get("source_url"),
                "derived_cost_usd": round(p["cost"], 4), "billed_cost_usd": billed,
                "elapsed_s": r.get("elapsed"), "error": r.get("error"),
                "created": time.strftime("%Y-%m-%dT%H:%M:%S")}
        with open(os.path.join(out_dir, f"{p['key']}.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
            f.write("\n")
        manifest.append({"key": p["key"], **meta})
        if r.get("ok"):
            panels.append((r["file"], f"{p['key']} - {p['res']} - {p['dur']}s", cost_label))

    grid = os.path.join(out_dir, "grid.mp4")
    print("stitching grid...")
    build_grid(panels, grid)
    with open(os.path.join(out_dir, "bakeoff.json"), "w", encoding="utf-8") as f:
        json.dump({"prompt": prompt, "ref": ref, "image_url": image_url,
                   "requested": {"duration": duration, "resolution": resolution},
                   "total_derived_usd": round(total, 4), "models": manifest,
                   "grid": grid, "created": time.strftime("%Y-%m-%dT%H:%M:%S")},
                  f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\ngrid -> {show(grid)}   ({len(panels)}/{len(plan)} models, "
          f"~${sum(p['cost'] for p in ok):.2f})")


if __name__ == "__main__":
    main()
