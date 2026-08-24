#!/usr/bin/env python3
"""
gen_vox2_layers.py — generate every painted layer for vox-2-dad-daughter.

One command; needs GEMINI_API_KEY in .env. Produces into
media/projects/vox-2-dad-daughter/layers/ with gen_image sidecars.

Design:
  - Style-lock phrase repeated in EVERY prompt for a consistent family look.
  - The hook wall + payoff wall are the SAME scene composition (for the loop),
    generated once.
  - A one-time "dad & daughter" reference portrait is painted first, then passed
    as --ref to every character scene so the family stays the same people.
  - Character cutouts for die-cut layers are painted isolated-on-white, then
    rembg-matted via cutout.py (falls back to white-key).
  - One cream paper texture is generated for the board background.

Run:  python tools/gen_vox2_layers.py
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYERS = os.path.join(ROOT, "media", "projects", "vox-2-dad-daughter", "layers")
GEN = os.path.join(ROOT, "tools", "gen_image.py")
CUT = os.path.join(ROOT, "tools", "cutout.py")

STYLE = (
    "Soft watercolor storybook illustration, warm cream paper, gentle washes and fine "
    "ink outlines, cozy and tender, warm light. Dad is a tall man in a rust-orange "
    "sweater with dark hair. His daughter is small with a sunny yellow bow in her hair. "
    "No text, no letters, no words, no watermark."
)
ISOLATED = " Isolated subject on a plain pure-white background."


def run(cmd):
    print("\n>>>", " ".join(cmd))
    r = subprocess.run([sys.executable] + cmd)
    if r.returncode != 0:
        sys.exit(f"failed: {' '.join(cmd)}")


def gen(out, prompt, aspect="9:16", size="2K", refs=None, model="fast"):
    cmd = [GEN, "--prompt", prompt, "--out", out, "--aspect", aspect, "--size", size, "--model", model]
    for r in refs or []:
        cmd += ["--ref", r]
    run(cmd)


def main():
    os.makedirs(LAYERS, exist_ok=True)
    ref = os.path.join(LAYERS, "ref-family.png")

    # 0) board paper texture (subtle, flat-ish) — reused under everything
    gen(os.path.join(LAYERS, "paper.png"),
        "Warm cream kraft paper texture, soft fibre grain, subtle mottling, empty background, "
        "no objects, no text, no watermark.", model="lite")

    # 1) reference family portrait — the consistency anchor (front-facing, isolated)
    if not os.path.exists(ref):
        gen(ref, f"{STYLE} A warm reference portrait: the dad and his daughter standing "
                 f"side by side, front-facing, full character design.{ISOLATED}", model="fast")

    # 2) shared WALL scene (hook + payoff, loop) — the heart of the video
    gen(os.path.join(LAYERS, "wall.png"),
        f"{STYLE} A framed photo of a dad holding his small daughter with a small heart "
        f"above them hangs centered on a warm hallway wall, soft warm light, cozy home "
        f"hallway, the wall has space around the frame. NO text.", model="pro", refs=[ref])

    # 3) memory cards (painted scenes, NOT die-cuts — they're collage cards)
    cards = {
        "newborn": "dad cradling a swaddled newborn baby in a warm nursery, tender, "
                   "first moment, soft light",
        "steps": "dad kneeling on the floor with arms outstretched, a small toddler girl "
                 "taking her first wobbly steps toward him, joyful",
        "bike": "a small child girl on a little red bike with training wheels, dad "
                "steadying the bike, a bandaged knee, sunny summer street",
        "storm": "dad holding a big umbrella over a small girl, walking together in the "
                 "rain, cozy warm light under the umbrella",
        "grad": "a graduation cap tossed into the air, dad cheering below, confetti, "
                "triumphant warm day",
        "grown": "a grown daughter and an older dad side by side on a porch, two cups "
                 "of tea, golden sunset, peaceful",
    }
    for name, desc in cards.items():
        gen(os.path.join(LAYERS, f"{name}.png"), f"{STYLE} {desc}. NO text.",
            aspect="4:5", model="fast", refs=[ref])

    # 4) die-cut character figures for the payoff (grown daughter + dad hanging the photo)
    for name, desc in {
        "payoff-daughter": "a grown daughter standing on tiptoe hanging a framed photo on a wall, side profile",
        "payoff-dad": "an older dad in a rust sweater standing helping hang a framed photo, side profile",
    }.items():
        raw = os.path.join(LAYERS, f"{name}-raw.png")
        gen(raw, f"{STYLE} {desc}.{ISOLATED}", aspect="1:1", model="fast", refs=[ref])
        run([CUT, raw, os.path.join(LAYERS, f"{name}.png")])

    print("\nDone. Layers in", os.path.relpath(LAYERS, ROOT))


if __name__ == "__main__":
    main()
