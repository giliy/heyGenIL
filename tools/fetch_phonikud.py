#!/usr/bin/env python3
"""fetch_phonikud.py — download the Phonikud ONNX nakdan model onto this machine.

WHY PER-MACHINE: the model is ~300MB and is fetched from Hugging Face (CC BY 4.0 — free,
redistributable, no API key) rather than committed to git, matching how tools/fetch_pro_sfx.py
handles bulky per-machine assets. It lands in the GITIGNORED models/phonikud/ dir. The Hebrew
TTS nikkud front-end (tools/nikkud_g2p.py, used by gen_voice_edge.py --nikkud) reads it from
there. No paid API, no key.

The ONNX nakdan only does nikkud PREDICTION on unpointed text; the pointed->IPA step
(phonikud.phonemize) is a rule-based FST that needs no model. The dictabert tokenizer
(~500KB tokenizer.json) auto-downloads on first use and is then cached by huggingface_hub.

Usage:
  .venv-voice312\\Scripts\\python.exe tools/fetch_phonikud.py          # download if missing
  .venv-voice312\\Scripts\\python.exe tools/fetch_phonikud.py --force  # re-download
"""
import argparse
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(ROOT, "models", "phonikud")
# int8-quantized build: same diacritization quality, much faster on CPU.
MODEL_FILE = os.path.join(MODEL_DIR, "phonikud-1.0.int8.onnx")
MODEL_URL = "https://huggingface.co/thewh1teagle/phonikud-onnx/resolve/main/phonikud-1.0.int8.onnx"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")


def fetch(force=False):
    os.makedirs(MODEL_DIR, exist_ok=True)
    if os.path.exists(MODEL_FILE) and not force:
        print(f"already present: {os.path.relpath(MODEL_FILE, ROOT)} "
              f"({os.path.getsize(MODEL_FILE):,} bytes)")
        return
    print(f"downloading {MODEL_URL}\n  -> {os.path.relpath(MODEL_FILE, ROOT)} (~300MB)")
    req = urllib.request.Request(MODEL_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as r, open(MODEL_FILE, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    print(f"done: {os.path.getsize(MODEL_FILE):,} bytes")
    print("note: the dictabert tokenizer auto-downloads on first use and is cached by HF.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    fetch(force=args.force)
