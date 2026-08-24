#!/usr/bin/env python3
"""ffw.py — resolved-ffmpeg wrapper.

Single source of truth for the ffmpeg/ffprobe binary path across all tools.

WHY: tools historically called bare "ffmpeg"/"ffprobe" and resolved to whatever was
first on PATH — in this repo that is often the Remotion-BUNDLED minimal build
(remotion/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe), which is built
with --disable-filters and LACKS sidechaincompress/alimiter/highpass/loudnorm/asplit.
That silently produces broken/blank AAC (the silent-voice bug). ffw resolves a FULL
build and FAILS FAST if the resolved binary is the minimal one when full filters are
required.

Resolution order (first match wins):
    1. explicit --ffmpeg flag  (handled by the caller, passed via FFMPEG env here)
    2. FFMPEG_PATH  env var
    3. tools/bin/ffmpeg.exe  (a full build, installed by bootstrap(), kept out of git)
    4. error -> run bootstrap()

Usage (from any tool, repo-relative or absolute):
    import sys, os; sys.path.insert(0, os.path.join(ROOT, "tools"))
    import ffw
    ffw.ffmpeg(...)     # subprocess.run(["ffmpeg", ...]) -> CompletedProcess
    ffw.ffprobe(...)    # subprocess.run(["ffprobe", ...])
    ffw.path()          # the resolved ffmpeg.exe path
    ffw.ffprobe_path()
    ffw.require_full()  # raise SystemExit if the resolved build lacks full filters
    ffw.bootstrap()     # download a full build into tools/bin (kept out of git)
"""
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile

# Repo root = parent of tools/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN_DIR = os.path.join(ROOT, "tools", "bin")
FFMPEG_EXE = os.path.join(BIN_DIR, "ffmpeg.exe")
FFPROBE_EXE = os.path.join(BIN_DIR, "ffprobe.exe")

# Filters that a full build MUST have for the duck/limiter/loudness audio chain.
# The Remotion-bundled minimal build has none of these.
FULL_FILTERS = ("sidechaincompress", "alimiter", "highpass", "loudnorm")

# gyan.dev "essentials" full build (same one used successfully this session).
DOWNLOAD_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
_ZIP = os.path.join(BIN_DIR, "ffmpeg-release-essentials.zip")


def _candidate():
    """Return the resolved ffmpeg.exe path per the resolution order, or None."""
    p = os.environ.get("FFMPEG_PATH")
    if p:
        p = os.path.abspath(p)  # resolve relative paths against CWD
        if os.path.exists(p):
            return p
    if os.path.exists(FFMPEG_EXE):
        return FFMPEG_EXE
    # bare-name fallback: only trust it if it's NOT the remotion minimal build
    b = shutil.which("ffmpeg")
    if b and "remotion" not in b.replace("\\", "/").lower():
        return b
    return None


def path():
    """Resolved ffmpeg.exe path (may trigger bootstrap). Raises SystemExit if none."""
    c = _candidate()
    if c:
        return c
    print("ffw: no full ffmpeg found. Bootstrapping a full build into tools/bin/ ...",
          file=sys.stderr)
    bootstrap()
    c = _candidate()
    if not c:
        sys.exit("ffw: failed to resolve ffmpeg after bootstrap")
    return c


def ffprobe_path():
    """Resolved ffprobe.exe path, mirroring ffmpeg resolution."""
    # prefer the ffprobe sitting next to the resolved ffmpeg
    ff = path()
    probe = os.path.join(os.path.dirname(ff), "ffprobe.exe")
    if os.path.exists(probe):
        return probe
    b = shutil.which("ffprobe")
    if b and "remotion" not in b.replace("\\", "/").lower():
        return b
    return probe  # may not exist yet; caller surfaces the error


def _run(argv, **kw):
    kw.setdefault("stdout", subprocess.PIPE)
    kw.setdefault("stderr", subprocess.STDOUT)
    kw.setdefault("text", True)
    return subprocess.run(argv, **kw)


def ffmpeg(*args, **kw):
    """subprocess.run(['ffmpeg', *args], ...) -> CompletedProcess."""
    return _run([path(), *args], **kw)


def ffprobe(*args, **kw):
    """subprocess.run(['ffprobe', *args], ...) -> CompletedProcess."""
    return _run([ffprobe_path(), *args], **kw)


def has_filters(exe):
    """Return True if the given ffmpeg build declares ALL FULL_FILTERS."""
    r = _run([exe, "-hide_banner", "-filters"], text=True)
    if r.returncode != 0:
        return False
    body = r.stdout or ""
    return all(f in body for f in FULL_FILTERS)


def require_full():
    """Ensure the resolved ffmpeg has the full audio filters; else SystemExit."""
    exe = path()
    if not has_filters(exe):
        sys.exit(
            f"ffw: resolved ffmpeg '{exe}' is the MINIMAL build and lacks "
            f"{'/'.join(FULL_FILTERS)}.\n"
            f"Install a full build: set FFMPEG_PATH or run `python tools/ffw.py --bootstrap`."
        )
    return exe


def bootstrap():
    """Download and unpack a full ffmpeg build into tools/bin/ (out of git)."""
    os.makedirs(BIN_DIR, exist_ok=True)
    if not os.path.exists(_ZIP):
        print(f"ffw: downloading {DOWNLOAD_URL}", file=sys.stderr)
        urllib.request.urlretrieve(DOWNLOAD_URL, _ZIP)
    print("ffw: extracting...", file=sys.stderr)
    with zipfile.ZipFile(_ZIP) as z:
        for name in z.namelist():
            base = os.path.basename(name)
            if base in ("ffmpeg.exe", "ffprobe.exe"):
                with z.open(name) as src, open(os.path.join(BIN_DIR, base), "wb") as dst:
                    shutil.copyfileobj(src, dst)
    # tidy
    if os.path.exists(_ZIP):
        os.remove(_ZIP)
    if not os.path.exists(FFMPEG_EXE):
        sys.exit("ffw: bootstrap failed to produce " + FFMPEG_EXE)
    print("ffw: installed full ffmpeg ->", FFMPEG_EXE, file=sys.stderr)


def main():
    """CLI: python tools/ffw.py --path | --require-full | --bootstrap"""
    args = sys.argv[1:]
    if "--bootstrap" in args:
        bootstrap()
        print(path())
    elif "--require-full" in args:
        print(require_full())
    elif "--path" in args:
        print(path())
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
