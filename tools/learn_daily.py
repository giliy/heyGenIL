#!/usr/bin/env python3
"""learn_daily.py — the DAILY runner for the Hebrew learn-shorts channel.

Picks the next `queued` video in learn-shorts/curriculum.json, auto-generates its
transcript script.md from the lesson-type data pack (a templated video needs no human
authoring), then drives it through the deterministic pipeline: derive -> gen -> voice ->
QA -> render -> mux -> audio-gate -> master, and stages the mastered mp4 for a human to
post. One video per run; a scheduler (Windows Task Scheduler) calls it once a day.

Pipeline stages per item (mirror make_reading.py + batch_reading.py):
  A. script    auto-generate script.md from the pack row (unless 'script' is set)
  B. derive    tools/make_learn.py <script> --type <type> --key <key> --force
  C. gen       cd remotion && npm run gen                    (register the wrapper)
  D. voice     gen_voice_reading.py --beats --reading --emit-ts vo.gen.ts
  E. gen       npm run gen again                             (re-stamp duration)
  F. QA        qa_frames.mjs <CompId> <boundaries> + release_gate.py learn (auto)
  G. render    render-all.mjs <CompId> --scale=1
  H. mux+gate  ffmpeg voice onto render, audio_gate.py PASS
  I. master    master.py -> -13 LUFS / -1 dBTP, audio_gate --delivery-report PASS
  J. stage     publish_stage.py -> publish/<date>-<type>-<key>/ (mp4 + caption + NOTE)

Any gate failure STOPS the item, marks it status:"failed" with the failing stage + a
message, writes a run report, and exits non-zero so the scheduler surfaces it. --dry-run
prints the plan without touching anything.

Usage (run from repo root):
  python tools/learn_daily.py                 # build ONE queued video, stage for publish
  python tools/learn_daily.py --type nikkud   # build the next queued nikkud specifically
  python tools/learn_daily.py --all           # build every queued video this run
  python tools/learn_daily.py --dry-run       # print the plan, write nothing
  python tools/learn_daily.py --track         # update learn-shorts/curriculum.json status

Cost: $0 — edge-tts voice, in-TSX koala, kids music beds. No ElevenLabs/FAL/Gemini.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import learn_data  # noqa: E402

QUEUE_PATH = os.path.join(ROOT, "learn-shorts", "curriculum.json")
PUBLISH_ROOT = os.path.join(ROOT, "publish")


def log(msg):
    print(f"[daily] {msg}", flush=True)


def run(cmd, cwd=None, allow_fail=False, timeout=None):
    """Run a subprocess; raise on non-zero (unless allow_fail) or on timeout. npm/node are
    .cmd shims on Windows — invoke via shell so CreateProcess finds them. `timeout` (seconds)
    guards against a stalled network call (e.g. edge-tts) hanging the whole daily run: a hung
    step raises TimeoutExpired -> the item is marked failed, and the run moves on."""
    shell = False
    if isinstance(cmd, list) and cmd and cmd[0] in ("npm", "node", "npx") and os.name == "nt":
        shell = True
        cmd = subprocess.list2cmdline(cmd)
    log(f"$ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    if timeout is None:
        r = subprocess.run(cmd, cwd=cwd, shell=shell)
        if r.returncode != 0 and not allow_fail:
            raise RuntimeError(f"command failed ({r.returncode}): {cmd}")
        return r
    # Timed path: Popen so that on timeout we can kill the WHOLE process tree. A bare
    # subprocess.run(timeout=...) kills only the direct child — its ffprobe/ffmpeg grandchildren
    # (edge-tts probes) survive as orphans, hold the mp3 open, and wedge the NEXT item's ffprobe
    # in communicate() forever. That was the recurring wordclass hang. taskkill /T /F kills the tree.
    proc = subprocess.Popen(cmd, cwd=cwd, shell=shell)
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            try:
                proc.kill()
            except OSError:
                pass
        proc.wait()
        raise RuntimeError(f"command timed out after {timeout}s (tree killed): {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    if proc.returncode != 0 and not allow_fail:
        raise RuntimeError(f"command failed ({proc.returncode}): {cmd}")
    return proc


def load_queue():
    with open(QUEUE_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_queue(q):
    with open(QUEUE_PATH, "w", encoding="utf-8") as f:
        json.dump(q, f, ensure_ascii=False, indent=2)


_VO_PLACEHOLDER = """// AUTO-GENERATED placeholder — voice not yet run for this queued video.
// The renderer falls back to beats.json text until gen_voice_reading.py fills real bounds.
import type { VoLine } from '../../lib/shorts';

export const VO: VoLine[] = [];
"""


def _ensure_vo_placeholders():
    """Write an empty vo.gen.ts into every read-*/learn-*/shots group that has a wrapper but no
    vo.gen.ts, so the all-compositions bundle compiles even for not-yet-voiced queued videos."""
    shots = os.path.join(ROOT, "remotion", "src", "shots")
    if not os.path.isdir(shots):
        return
    for name in sorted(os.listdir(shots)):
        if not re.match(r"^(read-\d+|learn-\d+|letter-\d+|number-\d+|wordclass-\d+)", name):
            continue
        d = os.path.join(shots, name)
        if not os.path.isdir(d):
            continue
        vo = os.path.join(d, "vo.gen.ts")
        has_tsx = any(f.endswith(".tsx") and f != "vo.gen.tsx" for f in os.listdir(d))
        if has_tsx and not os.path.exists(vo):
            with open(vo, "w", encoding="utf-8") as f:
                f.write(_VO_PLACEHOLDER)


def next_queued(q, type_filter=None):
    for v in sorted(q["videos"], key=lambda x: x.get("order", 999)):
        if v.get("_running"):  # already claimed this --all run; skip so the loop terminates
            continue
        if v.get("status") != "queued":
            continue
        if type_filter and v.get("type") != type_filter:
            continue
        return v
    return None


def auto_script(row, type, key, pack=None):
    """Compose a templated script.md from a data-pack row. A pack may supply its own
    'auto_script(row)' (letters/numbers/wordclass); nikkud uses the cv/blend shape below.
    Returns the script text."""
    if pack and pack.get("auto_script"):
        return pack["auto_script"](row)
    cv = row.get("cv") or []
    blends = row.get("blendWords") or []
    name_he = row.get("name_he") or key
    sound = row.get("sound", "")
    # pick the anchor: a blend word that is ALSO a single-word read (vetted) — else first blend.
    anchor = blends[0]["word"] if blends else (cv[0] if cv else "")
    lines = [
        f"---\ntitle: בּוּ מְלַמֵּד {name_he}\nnikkud: {key}\nmusicBed: kids-play-ukulele\n---",
        "",
        f"hook: בּוּ בּוּ! הַיּוֹם לוֹמְדִים {name_he}!",
        "",
        f"isolated: {cv[0] if cv else ''}",
        f"sub: {name_he} — אוֹמְרִים \"{sound}\"",
        "",
        f"cv: {' '.join(cv)}",
        "",
        f"blend: {anchor}",
        f"word: {anchor}!",
        "sub: יוֹפִי! קָרָאתָ מִלָּה!",
        "",
        "call: אַתֶּם!",
        "sub: עַכְשָׁו אַתֶּם אוֹמְרִים!",
        "",
    ]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Daily learn-shorts runner (one video per run)")
    ap.add_argument("--type", help="only build the next queued video of this type")
    ap.add_argument("--all", action="store_true", help="build every queued video this run")
    ap.add_argument("--dry-run", action="store_true", help="print the plan, write nothing")
    ap.add_argument("--track", action="store_true", help="update curriculum.json statuses")
    ap.add_argument("--no-publish", action="store_true", help="stop after master (skip publish stage)")
    args = ap.parse_args()

    q = load_queue()
    if args.type and args.type not in learn_data.types():
        sys.exit(f"unknown type {args.type!r} — registered: {', '.join(learn_data.types())}")

    items = []
    if args.all:
        while True:
            v = next_queued(q, args.type)
            if v is None:
                break
            items.append(v)
            v["_running"] = True
    else:
        v = next_queued(q, args.type)
        if v is None:
            print("[daily] no queued video — queue is empty or all built. Nothing to do.")
            return 0
        items = [v]
        v["_running"] = True

    today = date.today().isoformat()
    report = {"run": today, "results": []}
    exit_code = 0

    for v in items:
        res = {"dir": v.get("proj", v.get("dir")), "type": v["type"], "key": v["key"], "ok": False}
        proj = os.path.join(ROOT, v.get("proj", v.get("dir", "")))
        try:
            pack = learn_data.get_pack(v["type"])
            row = pack["get_row"](v["key"]) if pack else None
            if row is None:
                raise RuntimeError(f"unknown {v['type']} key {v['key']!r}")

            # A. script ----------------------------------------------------------
            script_path = v.get("script") or os.path.join(proj, "script.md")
            if args.dry_run:
                print(f"  [A script ] would write {os.path.relpath(script_path, ROOT)}")
            else:
                os.makedirs(proj, exist_ok=True)
                if not os.path.exists(script_path):
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(auto_script(row, v["type"], v["key"], pack))
                    log(f"auto-script written -> {os.path.relpath(script_path, ROOT)}")

            # B. derive ----------------------------------------------------------
            if args.dry_run:
                print(f"  [B derive ] python tools/make_learn.py {script_path} --type {v['type']} --key {v['key']} --force")
            else:
                run([sys.executable, os.path.join("tools", "make_learn.py"),
                     script_path, "--type", v["type"], "--key", v["key"], "--force"])

            beats_path = os.path.join(proj, "beats.json")
            reading_path = os.path.join(proj, "reading.json")
            if os.path.exists(beats_path):
                b = json.load(open(beats_path, encoding="utf-8"))
                comp = b.get("composition")
                fps = b.get("format", {}).get("fps", 30)
                dur = b.get("format", {}).get("durationSec", 0)
                title = b.get("title")
            else:
                comp = fps = dur = title = None  # dry-run: no derive output yet
            res["compId"] = comp
            # Mirror make_learn.write_wrapper's shots-group regex exactly — otherwise voice
            # emits vo.gen.ts into the wrong dir (e.g. letter-4-dalet/ instead of letter-4/).
            m = re.match(r"^(read-\d+|learn-\d+|letter-\d+|number-\d+|wordclass-\d+)", os.path.basename(proj))
            shots_group = m.group(1) if m else os.path.basename(proj)
            vo_ts = os.path.join(ROOT, "remotion", "src", "shots", shots_group, "vo.gen.ts")

            # C. gen (register wrapper) -----------------------------------------
            if args.dry_run:
                print("  [C gen    ] cd remotion && npm run gen")
            else:
                run(["npm", "run", "gen"], cwd=os.path.join(ROOT, "remotion"))
                # The bundle compiles EVERY registered composition, so any read-/learn- wrapper
                # that has NOT yet had voice run would break the render with a missing ./vo.gen.
                # Write a valid empty placeholder for each un-voiced wrapper so queued siblings
                # stay bundle-safe; gen_voice_reading.py overwrites it with real bounds later.
                _ensure_vo_placeholders()

            # D. voice -----------------------------------------------------------
            if args.dry_run:
                print(f"  [D voice  ] gen_voice_reading.py --beats {beats_path} --reading {reading_path} --emit-ts {vo_ts}")
            else:
                # edge-tts is a network service and has proven flaky (recurring stalls that hang
                # or blow the timeout). Cap each attempt AND retry with a fresh connection: a stall
                # fails fast, a retry usually lands on a healthy edge-tts session. 3 x 5min max.
                vo_cmd = [os.path.join(ROOT, ".venv-voice312", "Scripts", "python.exe"),
                          os.path.join("tools", "gen_voice_reading.py"),
                          "--beats", beats_path, "--reading", reading_path,
                          "--emit-ts", vo_ts]
                vo_attempts = 3
                for attempt in range(1, vo_attempts + 1):
                    try:
                        run(vo_cmd, timeout=300)
                        break
                    except RuntimeError as e:
                        if "timed out" in str(e) and attempt < vo_attempts:
                            print(f"    [voice] attempt {attempt} timed out — retrying with a fresh connection ({attempt+1}/{vo_attempts})")
                            continue
                        raise

            # E. gen again (re-stamp duration) ----------------------------------
            if args.dry_run:
                print("  [E gen    ] cd remotion && npm run gen")
            else:
                run(["npm", "run", "gen"], cwd=os.path.join(ROOT, "remotion"))

            # F. QA --------------------------------------------------------------
            frames = "0"
            if comp and fps and dur:
                fr = [0]
                for beat in b.get("beats", []):
                    fr.append(int(round(beat["start_s"] * fps)))
                last = int(round((dur or 0) * fps)) - 1
                if last > 0:
                    fr.append(last)
                frames = ",".join(str(max(0, f)) for f in sorted(set(fr)))
            if args.dry_run:
                print(f"  [F QA     ] qa_frames.mjs {comp} {frames} --scale=0.333 + release_gate.py learn {beats_path}")
            else:
                run(["node", os.path.join("scripts", "qa_frames.mjs"), comp, frames, "--scale=0.333"],
                    cwd=os.path.join(ROOT, "remotion"))
                # auto release gate — it prints the rubric; pass/fail is human-judged, so we
                # treat a non-zero as informational here (the ear QA is the real gate).
                run([sys.executable, os.path.join("tools", "release_gate.py"), "learn", beats_path],
                    allow_fail=True)

            # G. render ----------------------------------------------------------
            if args.dry_run:
                print(f"  [G render ] cd remotion && node scripts/render-all.mjs {comp} --scale=1")
            else:
                # A single short renders in a few minutes even at 1080x1920; cap at 15 min so a
                # wedged bundler/chrome can't hang the daily run indefinitely.
                run(["node", os.path.join("scripts", "render-all.mjs"), comp, "--scale=1"],
                    cwd=os.path.join(ROOT, "remotion"), timeout=900)
            silent = os.path.join(ROOT, "remotion", "out", f"{comp}.mp4")

            # H. mux + gate ------------------------------------------------------
            voiced = os.path.join(ROOT, "remotion", "out", f"{comp}-voiced.mp4")
            if args.dry_run:
                print(f"  [H mux    ] ffmpeg {silent} + voice.wav -> {voiced} ; audio_gate.py {voiced}")
            else:
                run([sys.executable, "-c",
                     f"import sys,os;sys.path.insert(0,'tools');import ffw;"
                     f"ffw.ffmpeg('-y','-i',{silent!r},'-i',{os.path.join(proj, 'voice', 'voice.wav')!r},"
                     f"'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000',"
                     f"'-ac','2','-shortest',{voiced!r})"], cwd=ROOT)
                run([sys.executable, os.path.join("tools", "audio_gate.py"), voiced])

            # I. master ----------------------------------------------------------
            # master.py reads <voiced> and writes <voiced-base>-master.mp4
            voiced_base = os.path.splitext(voiced)[0]
            mastered = voiced_base + "-master.mp4"
            if args.dry_run:
                print(f"  [I master ] master.py {voiced} -> {mastered}")
            else:
                run([sys.executable, os.path.join("tools", "master.py"), voiced])

            # J. publish stage ---------------------------------------------------
            if args.dry_run:
                print(f"  [J stage  ] publish_stage.py {mastered} --type {v['type']} --key {v['key']}")
            elif not args.no_publish:
                import publish_stage
                publish_stage.stage(mastered, v["type"], v["key"], title=title)

            res["ok"] = True
            if not args.dry_run:
                v["status"] = "pass"
        except Exception as e:
            res["error"] = str(e)
            res["stage_failed"] = True
            exit_code = 1
            if not args.dry_run:
                v["status"] = "failed"
            log(f"ITEM FAILED: {v.get('proj')} — {e}")
        finally:
            v.pop("_running", None)
        report["results"].append(res)

    if not args.dry_run and args.track:
        save_queue(q)

    # write a run report
    os.makedirs(os.path.join(ROOT, "learn-shorts"), exist_ok=True)
    report_path = os.path.join(ROOT, "learn-shorts", "daily-report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    log(f"run report -> {os.path.relpath(report_path, ROOT)}")

    for r in report["results"]:
        st = "PASS" if r["ok"] else "FAIL"
        print(f"  {st:4} {r['dir']:24} {r['type']}/{r['key']}  comp={r.get('compId')} "
              f"{'err=' + r['error'] if r.get('error') else ''}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
