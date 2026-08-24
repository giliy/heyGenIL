#!/usr/bin/env python3
"""
ingest_photo.py — stage user-uploaded photo(s) into a vox collage project.

Copies one or more photos the user supplies (phone shots, scans, downloads) into
media/projects/<proj>/layers/, normalizing them for the collage engine:

  * re-encodes to PNG (fixes EXIF rotation, drops weird color profiles, consistent format)
  * auto-orients via EXIF so portrait phone photos come out upright
  * optionally downscales to a sane working size (collage layers don't need 12MP)
  * optionally runs cutout.py to make a transparent sticker layer from each photo

The tool never deletes your originals — it only writes into the project layers dir.

Usage:
  python tools/ingest_photo.py <proj> photo1.jpg photo2.png ...
  python tools/ingest_photo.py vox-3-trip IMG_1234.jpg --cutout
  python tools/ingest_photo.py vox-3-trip *.jpg --max 1600 --prefix mem

  <proj>        project name — files land in media/projects/<proj>/layers/
  photos        one or more image paths (jpg/jpeg/png/webp/bmp/tiff)
  --cutout      also emit a transparent <name>-cut.png via cutout.py (rembg if
                installed, else white-key) next to the staged copy
  --max N       longest edge in px; larger images are downscaled  [default 1600]
  --prefix P    rename staged files to P-01.png, P-02.png ...     [default: keep stem]
  --method M    cutout method passthrough: auto|rembg|key         [default auto]
  --border N    bake a white sticker border N px on cutouts       [default 0]
"""
import argparse
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def project_layers(proj: str) -> str:
    d = os.path.join(REPO, "media", "projects", proj, "layers")
    os.makedirs(d, exist_ok=True)
    return d


def stage(src: str, dst_dir: str, name: str, max_edge: int) -> str:
    """Re-encode src -> dst_dir/name.png, EXIF-corrected and downscaled. Returns dst path."""
    img = Image.open(src)
    img = ImageOps.exif_transpose(img)          # honor phone rotation flags
    img = img.convert("RGB")
    w, h = img.size
    scale = max_edge / max(w, h) if max(w, h) > max_edge else 1.0
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dst = os.path.join(dst_dir, name + ".png")
    img.save(dst, "PNG")
    return dst


def main():
    ap = argparse.ArgumentParser(description="stage user photos into a vox project's layers/")
    ap.add_argument("proj")
    ap.add_argument("photos", nargs="+")
    ap.add_argument("--cutout", action="store_true")
    ap.add_argument("--max", type=int, default=1600)
    ap.add_argument("--prefix", default=None)
    ap.add_argument("--method", choices=["auto", "rembg", "key"], default="auto")
    ap.add_argument("--border", type=int, default=0)
    args = ap.parse_args()

    layers = project_layers(args.proj)
    cutout_py = os.path.join(REPO, "tools", "cutout.py")

    staged, cutouts = [], []
    n = 0
    for src in args.photos:
        if not os.path.isfile(src):
            print(f"ingest_photo: SKIP missing file {src}", file=sys.stderr)
            continue
        ext = os.path.splitext(src)[1].lower()
        if ext not in EXTS:
            print(f"ingest_photo: SKIP unsupported type {src}", file=sys.stderr)
            continue
        n += 1
        stem = f"{args.prefix}-{n:02d}" if args.prefix else os.path.splitext(os.path.basename(src))[0]
        stem = "".join(c if (c.isalnum() or c in "-_") else "-" for c in stem).strip("-") or f"photo-{n:02d}"
        try:
            dst = stage(src, layers, stem, args.max)
        except Exception as e:  # unreadable/corrupt image — skip, don't abort the batch
            print(f"ingest_photo: SKIP {src} ({e})", file=sys.stderr)
            continue
        staged.append(dst)
        rel = os.path.relpath(dst, REPO).replace("\\", "/")
        print(f"staged: {rel}  ({Image.open(dst).width}x{Image.open(dst).height})")

        if args.cutout:
            cout = os.path.join(layers, stem + "-cut.png")
            cmd = [sys.executable, cutout_py, dst, cout, "--method", args.method, "--border", str(args.border)]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0 and os.path.isfile(cout):
                cutouts.append(cout)
                print(f"  {r.stdout.strip()}")
            else:
                print(f"ingest_photo: cutout FAILED for {dst}\n{r.stderr.strip()}", file=sys.stderr)

    print(f"\ndone: {len(staged)} staged" + (f", {len(cutouts)} cutout(s)" if args.cutout else "") + f" -> media/projects/{args.proj}/layers/")
    if not staged:
        sys.exit("ingest_photo: nothing was staged")


if __name__ == "__main__":
    main()
