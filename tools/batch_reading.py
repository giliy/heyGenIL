#!/usr/bin/env python3
"""
batch_reading.py — P2 #28: fan N reading scripts through the pipeline as a QUEUE.

The reading track is batch-ready (transcript-driven: script.md -> derived everything). This
runner is the product-scale spine: give it N script.md files (or a glob / the whole
reading-shorts/ tree), and it drives each through the deterministic stages in order,
stopping on failure, collecting a per-item report, and pausing at the HUMAN gates.

Stages per item (mirrors make-reading-short SKILL.md exactly):
  A. derive     tools/make_reading.py script.md --force   (reading.json + beats.json + wrapper)
  B. gen        cd remotion && npm run gen                (register the wrapper)
  C. voice      gen_voice_reading.py --beats --reading --emit-ts vo.gen.ts
                (REAL per-unit times written back, format.durationSec = last-speech + 2.5s)
  D. gen        npm run gen again                         (re-stamp the duration literal)
  E. human QA   qa_frames.mjs <CompId> <boundaries> + release_gate.py reading (prints, pauses)
  F. render     render-all.mjs <CompId> --scale=1
  G. mux+gate   ffmpeg voice onto the render, audio_gate.py must PASS

Human gates are the point (they're not skippable craft — QA is not optional). By default the
runner PAUSES at gate E and at the final ear check (G's PASS). --autopilot opts into no-pause
runs (still prints the human checklist; use only when a human is driving the ear QA on the
rendered files afterward). --dry-run lists the queue + the exact commands, writes nothing.

Series shell: a CURRICULUM TRACKER. --track updates reading-shorts/curriculum.json (which
nikkud are taught, per video: nikkud, title, id, compId, word-count, status). The tracker is
read-first by default; --track writes it after each successful render.

Usage:
  python tools/batch_reading.py script.md [script.md ...]   # explicit scripts (queue)
  python tools/batch_reading.py --glob 'reading-shorts/read-*/script.md' --only patach,kamatz
  python tools/batch_reading.py --all                        # every script.md under reading-shorts/
  python tools/batch_reading.py --track                       # just show the curriculum tracker
  flags: --dry-run  --autopilot  --track  --only <substr,...>  --voice <edge name> --rate <pct>

Needs: python 3.10+, ffmpeg/ffprobe full build (tools/ffw.py), node/npx, and the voice venv
(.venv-voice312) for gen_voice_reading.py — same env as a single reading short.
"""
import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ffw

VOICE_VENV = os.path.join(ROOT, ".venv-voice312", "Scripts", "python.exe")
VOICE_DEFAULT = "he-IL-HilaNeural"
RATE_DEFAULT = "-18%"
CURRICULUM = os.path.join(ROOT, "reading-shorts", "curriculum.json")

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def run(cmd, cwd=None):
    """Run a subprocess, stream output, raise on non-zero exit.
    npm/node are .cmd shims on Windows — invoke them via shell so CreateProcess finds them."""
    shell = False
    if isinstance(cmd, list) and cmd and cmd[0] in ("npm", "node", "npx") and os.name == "nt":
        shell = True
        cmd = subprocess.list2cmdline(cmd)
    print(f"\n$ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    r = subprocess.run(cmd, cwd=cwd, shell=shell)
    if r.returncode != 0:
        raise RuntimeError(f"command failed ({r.returncode}): {cmd}")
    return r


def project_for(script):
    return os.path.dirname(os.path.abspath(script))


def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def comp_id_for(proj_dir):
    b = load_json(os.path.join(proj_dir, "beats.json"))
    return b.get("composition") or b.get("id"), b.get("format", {}).get("fps", 30)


def beat_boundaries(proj_dir):
    """Comma frame list for qa_frames: 0 + each beat start + last frame."""
    b = load_json(os.path.join(proj_dir, "beats.json"))
    fps = b.get("format", {}).get("fps", 30)
    dur = b.get("format", {}).get("durationSec", 0)
    frames = [0]
    for beat in b.get("beats", []):
        frames.append(int(round(beat["start_s"] * fps)))
    last = int(round((dur or 0) * fps)) - 1
    if last > 0 and last not in frames:
        frames.append(last)
    return ",".join(str(max(0, f)) for f in sorted(set(frames)))


def curriculum(script):
    """The resolved nikkud + title for the tracker, read from the derived beats."""
    proj = project_for(script)
    try:
        b = load_json(os.path.join(proj, "beats.json"))
        reading = load_json(os.path.join(proj, "reading.json"))
        nikkud = b.get("reading", {}).get("nikkud") or reading.get("nikkud") or ""
        return {
            "dir": os.path.basename(proj),
            "title": b.get("title", ""),
            "nikkud": nikkud,
            "words": len(reading.get("units", [])),
        }
    except Exception:
        return {"dir": os.path.basename(proj), "title": "", "nikkud": "", "words": None}


def process_one(script, args, report):
    proj = project_for(script)
    name = os.path.basename(proj)
    report["dir"] = name
    print(f"\n{'='*70}\nQUEUE ITEM: {name}\n{'='*70}")

    beats = os.path.join(proj, "beats.json")
    reading = os.path.join(proj, "reading.json")
    wrapper_ts = os.path.join(proj, "vo.gen.ts")

    # A. derive ---------------------------------------------------------------
    if args.dry_run:
        print(f"  [A derive ] python tools/make_reading.py {script} --force")
    else:
        run([sys.executable, "tools/make_reading.py", script, "--force"])
    comp, fps = comp_id_for(proj)
    report["compId"] = comp
    # where does gen_voice write vo.gen.ts? remotion/src/shots/read-N/vo.gen.ts
    m = re.match(r"^(read-\d+)", name)
    shots_group = m.group(1) if m else name
    vo_ts = os.path.join(ROOT, "remotion", "src", "shots", shots_group, "vo.gen.ts")

    # B. gen (register wrapper) ----------------------------------------------
    if args.dry_run:
        print("  [B gen    ] cd remotion && npm run gen")
    else:
        run(["npm", "run", "gen"], cwd=os.path.join(ROOT, "remotion"))

    # C. voice ----------------------------------------------------------------
    vpy = VOICE_VENV if os.path.exists(VOICE_VENV) else sys.executable
    if args.dry_run:
        print(f"  [C voice  ] {vpy} tools/gen_voice_reading.py --beats {beats} --reading {reading} --emit-ts {vo_ts} --rate {args.rate} --voice {args.voice}")
    else:
        # --rate=<value> (= form) so argparse never reads "-18%" as a flag.
        run([vpy, "tools/gen_voice_reading.py", "--beats", beats, "--reading", reading,
             "--emit-ts", vo_ts, f"--rate={args.rate}", "--voice", args.voice])

    # D. gen (re-stamp duration) ---------------------------------------------
    if args.dry_run:
        print("  [D gen    ] cd remotion && npm run gen  (re-stamp duration literal)")
    else:
        run(["npm", "run", "gen"], cwd=os.path.join(ROOT, "remotion"))

    # E. human QA + release gate ---------------------------------------------
    qa = beat_boundaries(proj)
    print(f"\n  --- HUMAN GATE E (reading QA) ---")
    print(f"  qa_frames:  cd remotion && node scripts/qa_frames.mjs {comp} {qa} --scale=0.333")
    print(f"  release:    python tools/release_gate.py reading {beats}")
    if not args.autopilot and not args.dry_run:
        input("  QA these frames + answer the release rubric, then <Enter> (or 'skip' to continue without this gate): ").strip()
        print("  (gate acknowledged)")
    elif args.dry_run:
        print("  [gate E listed; not run in --dry-run]")

    # F. render ---------------------------------------------------------------
    if args.dry_run:
        print(f"  [F render ] cd remotion && node scripts/render-all.mjs {comp} --scale=1")
    else:
        run(["node", "scripts/render-all.mjs", comp, "--scale=1"], cwd=os.path.join(ROOT, "remotion"))

    # G. mux + audio gate -----------------------------------------------------
    silent = os.path.join(ROOT, "remotion", "out", f"{comp}.mp4")
    voiced = os.path.join(ROOT, "remotion", "out", f"{comp}-voiced.mp4")
    voice_wav = os.path.join(proj, "voice", "voice.wav")
    if args.dry_run:
        print(f"  [G mux    ] ffmpeg -i {silent} -i {voice_wav} -> {voiced}; audio_gate.py {voiced}")
        report["status"] = "planned"
        return report
    run([ffw.path(), "-y", "-i", silent, "-i", voice_wav, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
         "-shortest", voiced])
    gate = run([sys.executable, "tools/audio_gate.py", voiced])
    report["status"] = "PASS" if gate.returncode == 0 else "FAIL-gate"
    report["output"] = os.path.relpath(voiced, ROOT)

    print(f"\n  --- HUMAN GATE (final ear) ---")
    print(f"  final: {report['output']}  (audio_gate PASS)")
    if not args.autopilot:
        input("  Ear-check the voiced file now, then <Enter>: ").strip()
    return report


def main():
    ap = argparse.ArgumentParser(description="P2 #28 batch/queue runner for reading shorts")
    ap.add_argument("scripts", nargs="*", help="script.md paths (the queue)")
    ap.add_argument("--all", action="store_true", help="every script.md under reading-shorts/")
    ap.add_argument("--glob", help="glob for script.md files, e.g. 'reading-shorts/read-*/script.md'")
    ap.add_argument("--only", help="comma list of substring filters on the project dir name")
    ap.add_argument("--track", action="store_true", help="update/print the curriculum tracker")
    ap.add_argument("--dry-run", action="store_true", help="list the queue + commands, write nothing")
    ap.add_argument("--autopilot", action="store_true", help="no pauses (still prints the human checklist)")
    ap.add_argument("--voice", default=VOICE_DEFAULT)
    ap.add_argument("--rate", default=RATE_DEFAULT)
    args = ap.parse_args()

    # Resolve the queue of script.md files.
    scripts = list(args.scripts)
    if args.all or args.glob:
        base = ROOT
        import glob
        if args.glob:
            scripts += glob.glob(os.path.join(base, args.glob))
        else:
            for d in sorted(os.listdir(os.path.join(base, "reading-shorts"))):
                if d.startswith("read-") and os.path.isdir(os.path.join(base, "reading-shorts", d)):
                    s = os.path.join(base, "reading-shorts", d, "script.md")
                    if os.path.exists(s):
                        scripts.append(s)
    if args.only:
        filt = [x.strip() for x in args.only.split(",")]
        scripts = [s for s in scripts if any(f in os.path.basename(os.path.dirname(s)) for f in filt)]
    scripts = sorted(set(os.path.abspath(s) for s in scripts))
    scripts = [s for s in scripts if os.path.exists(s)]

    if args.track and not scripts:
        return show_tracker()
    if not scripts:
        ap.error("no script.md files in the queue (give paths, or --all / --glob)")

    print(f"QUEUE: {len(scripts)} reading short(s)")
    for s in scripts:
        print(f"  - {os.path.relpath(s, ROOT)}")

    reports = []
    try:
        for s in scripts:
            r = {"script": os.path.relpath(s, ROOT)}
            process_one(s, args, r)
            reports.append(r)
    except RuntimeError as e:
        print(f"\nBATCH STOPPED: {e}")
        reports.append({"error": str(e), "status": "ERROR"})

    # Report
    print(f"\n{'='*70}\nBATCH SUMMARY\n{'='*70}")
    for r in reports:
        print(f"  {r.get('dir','?') or r.get('script','?'):<22} {r.get('compId','?'):<14} "
              f"{r.get('status','?')}  {r.get('output','')}")
    passed = sum(1 for r in reports if r.get("status") == "PASS")
    print(f"\npassed {passed}/{len(reports)}  (items with status PASS rendered + gated)")

    if args.track:
        update_tracker(reports)


def show_tracker():
    if not os.path.exists(CURRICULUM):
        print("no curriculum.json yet — run a batch with --track after a successful render")
        return
    t = load_json(CURRICULUM)
    print("=== READING CURRICULUM TRACKER ===")
    for row in t.get("videos", []):
        print(f"  {row.get('nikkud','?'):<10} {row.get('title','?'):<28} {row.get('dir','?'):<20} "
              f"{row.get('compId','?'):<14} {row.get('status','?')}")


def update_tracker(reports):
    t = {"videos": []}
    if os.path.exists(CURRICULUM):
        t = load_json(CURRICULUM)
    by_dir = {r.get("dir"): r for r in reports if r.get("dir")}
    for r in reports:
        d = r.get("dir")
        if not d:
            continue
        try:
            b = load_json(os.path.join(ROOT, "reading-shorts", d, "beats.json"))
            reading = load_json(os.path.join(ROOT, "reading-shorts", d, "reading.json"))
            nikkud = b.get("reading", {}).get("nikkud") or reading.get("nikkud") or ""
            row = {
                "dir": d, "title": b.get("title", ""), "nikkud": nikkud,
                "compId": r.get("compId", ""), "status": r.get("status", "?"),
            }
            # merge/replace by dir
            t["videos"] = [x for x in t["videos"] if x.get("dir") != d] + [row]
        except Exception as e:
            print(f"  (tracker: skip {d}: {e})")
    with open(CURRICULUM, "w", encoding="utf-8") as f:
        json.dump(t, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\ncurriculum tracker -> {os.path.relpath(CURRICULUM, ROOT)} ({len(t['videos'])} videos)")
    show_tracker()


if __name__ == "__main__":
    main()
