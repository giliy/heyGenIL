#!/usr/bin/env python3
"""voice_cleanup.py — the shared TTS-voice cleanup front (presence + de-ess + sit-louder).

This is the "produced" sound the free edge-tts tracks were missing. It is the SAME cleanup
front the paid path (`gen_voice.py`) applies — highpass rolls off codec sub-rumble, deesser
tames the hyped sibilance neural Hebrew voices have, compand makes the voice sit louder and
more present on phones. Loudness normalization is deliberately NOT here: it belongs to the
final master (`tools/master.py`), which targets the delivery loudness + true-peak ceiling on
the whole mix. This module only shapes the voice tone.

Use `voice_cleanup(...)` in place of a bare `loudnorm=I=-16...` at the end of voice assembly.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ffw

# The cleanup front, identical to gen_voice.py's. Keep them in sync — this front is the
# brand's "produced voice" sound. (compand points: leave quiet/room untouched, gently lift
# and compress the speech band, soft knee so it never pumps.)
CLEANUP_FRONT = (
    "highpass=f=80,"
    "deesser=i=0.3:m=0.5:f=0.5,"
    "compand=attacks=0.02:decays=0.25:points=-80/-80|-45/-45|-27/-20|0/-7:soft-knee=6:gain=0:volume=0"
)


def cleanup_filter(extra=""):
    """The cleanup filter-chain string, optionally followed by `extra` filters."""
    return CLEANUP_FRONT + ("," + extra if extra else "")


def voice_cleanup(inp, out, extra=""):
    """Apply the cleanup front to a voice wav -> out wav. Pure ffmpeg, full build via ffw."""
    af = cleanup_filter(extra)
    r = subprocess.run([ffw.path(), "-y", "-v", "error", "-i", inp,
                        "-af", af, "-ar", "44100", "-ac", "2", out],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.stderr.write("\nvoice_cleanup FFMPEG FAILED:\n" + (r.stdout or "")[-3000:] + "\n")
        raise SystemExit(1)
    return out
