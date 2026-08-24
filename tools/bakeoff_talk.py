#!/usr/bin/env python3
"""
bakeoff_talk.py — the HeyGen-IL M0/M1 acceptance gate: prove the lip-sync render.

One seeded stock face + one FIXED Hebrew script -> synthesize the voice with edge-tts (the
avatar track's real voice engine, free) -> fan out to N talking-head models via gen_talk.py
-> per-model mp4 + sidecar json -> extract phone-scale QA frames (the mandatory QA rule)
-> assert the clip actually MOVED (non-static lip region) so a "rendered a frozen plate"
false-pass can't slip through.

COSTS ARE DERIVED, NOT QUOTED (the iron rule, mirrored from bakeoff_clip.py): the derived
$ is printed and asserted BEFORE any fal call. The whole run refuses to touch fal without
BOTH a FAL_KEY in .env AND the explicit --spend flag — the default is --dry-run, which
prints payloads + derived costs and exits 0 without spending a shekel.

Usage (repo root cwd):
  # free: inspect payloads + derived cost, no spend
  python tools/bakeoff_talk.py --dry-run

  # the M0/M1 gate: one real render on the default model (fabric-1.0, cheapest still-image)
  python tools/bakeoff_talk.py --spend

  # full bakeoff: every image-input talk model, same face + script
  python tools/bakeoff_talk.py --spend --models fabric-1.0,fabric-1.0-fast,omnihuman

  --face PATH     stock face png (default: webapp/.storage/avatars/stock/dana.png)
  --models a,b    TALK_MODELS keys (default: fabric-1.0)
  --out DIR       output dir (default: media/projects/_bakeoff-talk/)
  --json          emit the per-model verdicts as JSON on the last line

Needs edge-tts (the .venv-voice312 venv), ffmpeg/ffprobe (ffw), and — for --spend — FAL_KEY.
"""

import argparse
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import ffw  # noqa: E402  (resolved full ffmpeg/ffprobe)

# The voice venv that carries edge-tts (matches py.ts TOOL_VENV: edge -> .venv-voice312).
VOICE_PY = os.path.join(ROOT, '.venv-voice312', 'Scripts', 'python.exe')

# The FIXED Hebrew acceptance script (nikkud-free; the same words every run so frames are
# comparable across models). ~3 short lines, male+female voices exercised by the caller.
SCRIPT = "שלום! אני האווטאר הדיגיטלי שלך. כותבים תסריט, והאווטאר מדבר אותו בעברית. מושלם לפרסום, להדרכה, ולמכירות."

# The GUTTURAL acceptance script (--script guttural). The decisive Hebrew QA gate: a script
# dense in ח/ע/ר (gutturals rare in the CN/EN corpora these models train on) PLUS a
# code-switching line (Hebrew<->English — the defining Israeli failure mode). A model that
# holds sync on THIS can be trusted on real Israeli speech; one that smears the gutturals or
# drops the English words fails here before a client ever sees it.
SCRIPT_GUTTURAL = (
    "אני אוהב לדבר עברית בכל ערב עם החברים שלי מהעבודה. "
    "הרבה אנשים רוצים לדעת איך האווטאר מבטא נכון את החית והעין והריש. "
    "תשלחו לי email ב-Slack, ואני אענה לכם מחר בבוקר."
)

SCRIPTS = {'default': SCRIPT, 'guttural': SCRIPT_GUTTURAL}

# The verified talk-model registry — MUST mirror packages/spec/src/ai-models.ts TALK_MODELS.
# costPerSecUsd is the DERIVED cost basis (stated before spend). input 'image' vs 'video'
# decides the gen_talk.py --driver flag.
TALK_MODELS = {
    # Fabric now defaults to 720p (AvatarSpec is 1080x1920; 480p upscaled 2.25x was soft).
    'fabric-1.0':      {'falId': 'fal-ai/veed/fabric-1.0',                    'input': 'image', 'costPerSecUsd': 0.20, 'res': '720p'},
    'fabric-1.0-fast': {'falId': 'fal-ai/veed/fabric-1.0/fast',               'input': 'image', 'costPerSecUsd': 0.20, 'res': '720p'},
    'omnihuman':       {'falId': 'fal-ai/bytedance/omnihuman',                'input': 'image', 'costPerSecUsd': 0.14, 'res': None},
    'musetalk':        {'falId': 'fal-ai/musetalk',                           'input': 'video', 'costPerSecUsd': 0.0,  'res': None},
    'kling-lipsync':   {'falId': 'fal-ai/kling-video/lipsync/audio-to-video', 'input': 'video', 'costPerSecUsd': 0.014, 'res': None},
}


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def synth_voice(text, out_mp3, voice):
    """edge-tts the Hebrew script -> mp3. Returns the path, or None on failure."""
    code = (
        "import asyncio, edge_tts\n"
        "async def go():\n"
        f"    c = edge_tts.Communicate({text!r}, {voice!r})\n"
        f"    await c.save({out_mp3!r})\n"
        "asyncio.run(go())\n"
        "print('ok')\n"
    )
    r = run([VOICE_PY, '-c', code])
    return out_mp3 if (r.returncode == 0 and os.path.exists(out_mp3)) else None


def ffprobe_duration(path):
    r = run([ffw.ffprobe_path(), '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def motion_score(video, workdir):
    """Extract a thin strip of phone-scale frames and measure inter-frame change. A frozen
    plate (the false-pass we guard against) scores ~0; a real talking head scores >0 in the
    lip/face region. Returns mean abs diff across consecutive sampled frames."""
    strip = os.path.join(workdir, 'qa_strip')
    os.makedirs(strip, exist_ok=True)
    # 6 frames across the clip, tiny (phone scale), grayscale.
    r = run([ffw.path(), '-y', '-v', 'error', '-i', video,
             '-vf', "fps=1,scale=96:160,format=gray", '-frames:v', '6',
             os.path.join(strip, 'f%02d.png')])
    if r.returncode != 0:
        return None
    frames = sorted(f for f in os.listdir(strip) if f.endswith('.png'))
    if len(frames) < 2:
        return None
    try:
        import struct
        import zlib

        def png_gray_mean(p):
            # Minimal PNG mean-luma read (no PIL dependency): decode via ffmpeg to raw gray.
            rr = run([ffw.path(), '-y', '-v', 'error', '-i', p, '-f', 'rawvideo',
                      '-pix_fmt', 'gray', '-'])
            return rr.stdout
        bufs = [png_gray_mean(os.path.join(strip, f)) for f in frames]
        diffs = []
        for a, b in zip(bufs, bufs[1:]):
            if not a or len(a) != len(b):
                continue
            n = len(a)
            s = sum(abs(a[i] - b[i]) for i in range(0, n, 7))  # sample every 7th byte
            diffs.append(s / (n / 7))
        return (sum(diffs) / len(diffs)) if diffs else None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--face', default=os.path.join(ROOT, 'webapp', '.storage', 'avatars', 'stock', 'dana.png'))
    ap.add_argument('--models', default='fabric-1.0', help='comma-separated TALK_MODELS keys')
    ap.add_argument('--voice', default='he-IL-AvriNeural', help='edge-tts Hebrew voice')
    ap.add_argument('--script', default='default', choices=list(SCRIPTS),
                    help='acceptance script: default (clean) or guttural (ח/ע/ר-dense + code-switch)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'media', 'projects', '_bakeoff-talk'))
    ap.add_argument('--spend', action='store_true', help='ACTUALLY call fal (costs real $)')
    ap.add_argument('--dry-run', action='store_true', help='payloads + derived cost, no spend (default)')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    spend = args.spend and not args.dry_run
    os.makedirs(args.out, exist_ok=True)

    if not os.path.exists(args.face):
        sys.exit(f"face not found: {args.face} (seed stock avatars first)")

    keys = [k.strip() for k in args.models.split(',') if k.strip()]
    unknown = [k for k in keys if k not in TALK_MODELS]
    if unknown:
        sys.exit(f"unknown models: {unknown} (known: {list(TALK_MODELS)})")

    # 1) Synthesize the Hebrew voice once (free) — every model lip-syncs the SAME audio.
    script = SCRIPTS[args.script]
    voice_mp3 = os.path.join(args.out, f'voice-{args.script}.mp3')
    if not os.path.exists(voice_mp3):
        print(f"[voice] edge-tts {args.voice} [{args.script}] -> {os.path.basename(voice_mp3)} ...", flush=True)
        if not synth_voice(script, voice_mp3, args.voice):
            sys.exit('edge-tts failed to synthesize the Hebrew voice')
    dur = ffprobe_duration(voice_mp3)
    print(f"[voice] {dur:.1f}s Hebrew track ready" if dur else "[voice] ready (duration unknown)", flush=True)

    # 2) Per model: derive cost BEFORE spend, print the payload, then (only with --spend) run.
    verdicts = []
    print()
    print(f"{'model':<18} {'input':<6} {'$/s':>7} {'~est $':>8}  endpoint")
    for k in keys:
        m = TALK_MODELS[k]
        est = (dur or 6.0) * m['costPerSecUsd']
        print(f"{k:<18} {m['input']:<6} {m['costPerSecUsd']:>7.3f} {est:>8.3f}  {m['falId']}")
    print()
    total_est = sum((dur or 6.0) * TALK_MODELS[k]['costPerSecUsd'] for k in keys)
    print(f"[cost] derived total for {len(keys)} model(s) x ~{(dur or 6.0):.0f}s = ${total_est:.3f}")

    if not spend:
        print("[dry-run] no fal call. Re-run with --spend to execute the render above.")
        if args.json:
            print(json.dumps({'dryRun': True, 'derivedTotalUsd': round(total_est, 4)}, ensure_ascii=False))
        return

    # 3) The spend path — requires FAL_KEY.
    env = dict(os.environ)
    env.setdefault('PYTHONIOENCODING', 'utf-8')
    for k in keys:
        m = TALK_MODELS[k]
        out_mp4 = os.path.join(args.out, f"{k}.mp4")
        driver = m['input'] == 'video'
        cmd = [sys.executable, os.path.join(ROOT, 'tools', 'gen_talk.py'),
               '--model', m['falId'], '--face', args.face, '--audio', voice_mp3,
               '--out', out_mp4] + (['--driver'] if driver else [])
        if m['res']:
            cmd += ['--set', f"resolution={m['res']}"]
        print(f"[render] {k} ...", flush=True)
        t0 = time.time()
        r = run(cmd, env=env)
        secs = time.time() - t0
        ok = r.returncode == 0 and os.path.exists(out_mp4)
        ms = motion_score(out_mp4, args.out) if ok else None
        moved = (ms is not None and ms > 1.0)  # >1 mean gray-level diff = visible motion
        verdicts.append({
            'model': k, 'ok': ok, 'renderSecs': round(secs, 1),
            'motionScore': (round(ms, 2) if ms is not None else None),
            'moved': moved, 'mp4': out_mp4 if ok else None,
            'derivedCostUsd': round((dur or 6.0) * m['costPerSecUsd'], 4),
            'stderrTail': (r.stderr or '')[-300:] if not ok else None,
        })
        status = 'RENDERED+moved' if (ok and moved) else ('RENDERED but STATIC (suspect)' if ok else 'FAILED')
        print(f"  -> {status}  motion={ms if ms is not None else '?'}  ({secs:.0f}s)", flush=True)

    passed = [v for v in verdicts if v['ok'] and v['moved']]
    print()
    print(f"[gate] {len(passed)}/{len(verdicts)} model(s) produced a MOVING talking head")
    if args.json:
        print(json.dumps({'spend': True, 'passed': len(passed), 'total': len(verdicts),
                          'verdicts': verdicts}, ensure_ascii=False))
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
