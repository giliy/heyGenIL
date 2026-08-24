#!/usr/bin/env python3
"""
fetch_pro_sfx.py — build the local "pro" SFX tier (media/library/sfx/pro/) on this machine.

WHY PER-MACHINE: the Sonniss GDC / 99Sounds licenses allow commercial use in finished videos
with no attribution, but FORBID redistributing the raw files — so the audio can never be
committed to the distributed git repo. Instead every machine obtains the files from the source
and drops them into the GITIGNORED media/library/sfx/pro/ dir. catalog.json keeps the metadata;
mix_sfx.py warns-and-skips a pro clip that isn't present locally.

WHAT IT DOES:
  1. Tries to download the official Sonniss GDC zips into pro/_staging/ and unzip them.
     NOTE: downloads.sonniss.com sits behind a Cloudflare browser challenge, so scripted
     download usually FAILS (403). That's expected — see step 3.
  2. For the COMMITTED tiers nothing is needed here: Kenney (CC0) is vendored inside the
     soundcn repo, and soundcn itself is a git clone. See docs/sfx-sources.md.
  3. Prints clear browser instructions for any source that needs a human download, and
     validates whatever zips/files you've dropped into pro/_staging/.

Usage:
  python tools/fetch_pro_sfx.py            # try scripted fetch, then print browser instructions
  python tools/fetch_pro_sfx.py --unzip    # (re)extract + inventory zips already in pro/_staging/
  python tools/fetch_pro_sfx.py --urls     # just print the download links

After fetching, curate + import clips with tools/import_sfx.py (see docs/sfx-sources.md).
No third-party Python deps. ffmpeg NOT required for the fetch itself.
"""
import os
import sys
import urllib.request
import urllib.error
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRO_DIR = os.path.join(ROOT, "media", "library", "sfx", "pro")
STAGING = os.path.join(PRO_DIR, "_staging")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")

# Official Sonniss GDC download endpoints (from https://sonniss.com/gameaudiogdc/).
# The "N of M" multi-part naming is intentional — grab whichever parts you need.
SONNISS = {
    "GDC 2024 (9 parts)": [
        f"https://downloads.sonniss.com/Sonniss.com-GDC2024-GameAudioBundle{i}of9.zip"
        for i in range(1, 10)
    ],
    "GDC 2021-2023 combined (14 parts)": [
        f"https://downloads.sonniss.com/Sonniss.com-GDC2023-GameAudioBundle{i}of14.zip"
        for i in range(1, 15)
    ],
}
SONNISS_MIRROR = "https://hippolytus.feralhosting.com/sonniss/"
SONNISS_PAGE = "https://sonniss.com/gameaudiogdc/"

# Committed-tier sources (no per-machine fetch needed, but listed for completeness):
COMMITTED = [
    ("soundcn (MIT, 700+ modern UI sounds — also vendors all Kenney CC0 packs)",
     "git clone https://github.com/kapishdima/soundcn"),
    ("Kenney audio packs (CC0)", "https://kenney.nl/assets/category:Audio"),
    ("99Sounds free SFX (royalty-free; verify license page before any bundling)",
     "https://99sounds.org/free-sound-effects/"),
    ("Freesound (CC0-filtered; needs FREESOUND_API_KEY in .env)",
     "https://freesound.org/apiv2/apply"),
]


def try_download(url, dest):
    """Attempt a scripted download. Returns True only if we got a plausible zip (not an
    HTML challenge page). Cloudflare 403s return a small HTML body -> detected + rejected."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f"    x {os.path.basename(url)}: {e}")
        return False
    if len(data) < 100_000 or data[:2] != b"PK":
        print(f"    x {os.path.basename(url)}: got a {len(data)}-byte non-zip "
              f"(Cloudflare challenge — browser download required)")
        return False
    with open(dest, "wb") as f:
        f.write(data)
    print(f"    ok {os.path.basename(dest)}  ({len(data)/1e6:.0f} MB)")
    return True


def unzip_all():
    """Extract every zip in staging into staging/<zipname>/ and report an audio inventory."""
    if not os.path.isdir(STAGING):
        print(f"no staging dir yet: {STAGING}")
        return
    zips = [z for z in os.listdir(STAGING) if z.lower().endswith(".zip")]
    if not zips:
        print(f"no zips in {STAGING} yet.")
        return
    for z in sorted(zips):
        zpath = os.path.join(STAGING, z)
        outdir = os.path.join(STAGING, os.path.splitext(z)[0])
        if os.path.isdir(outdir):
            print(f"  already extracted: {z}")
            continue
        try:
            with zipfile.ZipFile(zpath) as zf:
                zf.extractall(outdir)
            print(f"  extracted {z} -> {os.path.relpath(outdir, ROOT)}")
        except zipfile.BadZipFile:
            print(f"  !! {z} is not a valid zip (likely a Cloudflare HTML page) — re-download it.")
    # inventory
    n = 0
    for base, _dirs, files in os.walk(STAGING):
        for fn in files:
            if fn.lower().endswith((".wav", ".mp3", ".ogg", ".aif", ".aiff", ".flac")):
                n += 1
    print(f"\naudio files under staging: {n}")


def print_instructions():
    print("\n" + "=" * 70)
    print("BROWSER DOWNLOAD REQUIRED (Sonniss is behind a Cloudflare challenge)")
    print("=" * 70)
    print(f"""
Scripted download of the Sonniss GDC zips is blocked by a Cloudflare browser check.
Do this once on this machine:

  1. Open {SONNISS_PAGE}
  2. Download the parts you want (start with GDC 2024 + the 2021-2023 combined bundle).
     Direct links (paste into a browser):
""")
    for label, urls in SONNISS.items():
        print(f"     {label}")
        for u in urls:
            print(f"       {u}")
    print(f"     Mirror base (if primary is down): {SONNISS_MIRROR}")
    print(f"""
  3. Save the .zip files into:
       {STAGING}
  4. Re-run:  python tools/fetch_pro_sfx.py --unzip
  5. Curate + import: see docs/sfx-sources.md (tools/import_sfx.py).

Committed-tier sources (no Cloudflare; clone/download freely):
""")
    for name, how in COMMITTED:
        print(f"  - {name}\n      {how}")
    print("=" * 70)


def main():
    args = sys.argv[1:]
    os.makedirs(STAGING, exist_ok=True)

    if "--urls" in args:
        print_instructions()
        return
    if "--unzip" in args:
        unzip_all()
        return

    # default: try scripted fetch of the FIRST part of each bundle as a probe, then instruct.
    print("fetch_pro_sfx: building local pro tier ->", os.path.relpath(PRO_DIR, ROOT))
    print("Attempting scripted Sonniss download (expected to fail behind Cloudflare)...\n")
    got = 0
    for label, urls in SONNISS.items():
        print(f"  {label}")
        dest = os.path.join(STAGING, os.path.basename(urls[0]))
        if try_download(urls[0], dest):
            got += 1
    if got:
        print("\nSome parts downloaded — extend SONNISS in this script to grab more, then --unzip.")
    else:
        print("\nScripted download blocked (as expected).")
    print_instructions()


if __name__ == "__main__":
    main()
