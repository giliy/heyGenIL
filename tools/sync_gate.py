#!/usr/bin/env python3
"""
sync_gate.py — the REAL lip-sync QA gate for the avatar track (Phase 0, optional-for-now).

The current `bakeoff_talk.py` gate only asserts the clip MOVED (motion score > 1.0). A clip
that moves but lip-syncs badly still passes. This is the drop-in replacement: it measures
SYNC accuracy between the mouth and the Hebrew audio using the publicly released SyncNet
(Chung & Zisserman 2016), via `joonson/syncnet_python` (MIT).

THIS IS A SPEC + RUNBOOK, not a runnable tool yet. It needs a GPU + a face detector, so it
cannot run on this CPU box. It is documented so the real gate can be wired into bakeoff_talk.py
the moment a GPU is available (self-host or rented 4090).

Why SyncNet:
  - Language-agnostic: it compares lip motion vs audio features, never text — so it measures
    HEBREW sync directly, which is exactly what the vendor "any language" claims never verify.
  - `syncnet_python` is MIT, current stack (python 3.10, torch 2.5.1, torchaudio 2.5.1,
    pytorch-cuda 12.4, opencv 4.13). Weights via download_model.sh.
  - A clip that moves but is out-of-sync gets a LOW confidence score here.

Thresholds (from the research in research/hebrew-avatar/04-sync-alignment.md §6):
  - PASS:      LSE-C (confidence) >= ~6.9   (real-video baseline on LRS2/LRS3 is ~7.6-7.9;
                                              Wav2Lip-class sync lands 7.5-7.9)
  - HARD REJECT: SyncNet confidence < 3.0    (LatentSync's own data-cleaning cutoff)
  - Also watch LSE-D (distance, lower = better): real ~6.4-7.0, unsynced ~12.6.

⚠ Terminology trap: MuEx (arXiv:2510.06612) REDEFINES "LSE-D" as a 26-point MediaPipe lip-
  landmark geometric error, NOT the SyncNet distance. When comparing numbers, confirm which
  LSE-D a paper means.

Runbook (once on a GPU box):
  1. `git clone https://github.com/joonson/syncnet_python && cd syncnet_python`
     `conda env create -f environment.yml`  (or pip install torch==2.5.1 torchaudio==2.5.1
      pytorch-cuda==12.4 python_speech_features opencv-python scenedetect)
     `bash download_model.sh`  (pulls the pretrained SyncNet weights)
  2. Point it at a bakeoff output:
     `python run_syncnet.py --videofile <path/to/<model>.mp4> --tmp_dir <tmp>`
     → prints AV offset / min-distance / confidence. Read the CONFIDENCE.
  3. Bake this into bakeoff_talk.py --spend as a second gate:
     verdict ok = moved AND (syncnet_confidence >= 6.9)
     verdict reject = syncnet_confidence < 3.0  (discard the clip, mark model FAILED for Hebrew)
  4. ALWAYS pair with a rendered-frame visual read at phone scale (the mandatory QA rule).
     SyncNet is a gate, not a guarantee — it can pass a lip-leaked / identity-swapped clip
     (QA frames at 96x160 + a human look catch those).

Limitations / env notes:
  - Needs a GPU; syncnet_python does face detect + tracking with a face detector (dlib).
  - On this box, ffmpeg must route via tools/ffw.py (the Remotion-bundled ffmpeg lacks audio
    filters — the same trap documented in align_words.py).
  - The current bakeoff motion_score() (96x160, 6 frames) stays as the cheap "did it move at
    all" pre-filter; sync_gate is the sync-accuracy layer on top.
"""
