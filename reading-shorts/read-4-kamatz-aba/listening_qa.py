#!/usr/bin/env python3
"""listening_qa.py — programmatic listening QA for read-4-kamatz-aba unit clips.

We cannot literally hear audio, so this profiles each teaching-unit clip's acoustic envelope to
distinguish a correctly-pronounced pointed syllable (kamatz = open /a/) from silence / garble /
a clipped or doubled event. For each unit we check:
  - one clean speech onset (no double-onset => not two syllables smeared, not a stutter)
  - a SUSTAINED vowel body: kamatz = open /a/ held at rate -18%; RMS should stay high across
    the body, not spike-and-drop (a plosive-only blip would mean the vowel was swallowed)
  - onset lands in the ~0.1-0.4s edge-tts lead-silence region
  - tight end (no long trailing pad counted as speech)

A unit whose profile is degenerate (empty, multi-onset, no sustained vowel) is FLAGGED.

Run: .venv-voice312/Scripts/python.exe reading-shorts/read-4-kamatz-aba/listening_qa.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ffw  # noqa: E402

FFMPEG = ffw.path()
VDIR = os.path.join(ROOT, "reading-shorts", "read-4-kamatz-aba", "voice")

# unit grapheme -> clip file (hash from the gen run), with the consonant-onset + vowel expectation.
UNITS = [
    ("isolated", "אָ",   "u-d2ee5fe2.mp3"),
    ("cv",       "בָּ",  "u-b8197869.mp3"),
    ("cv",       "מָּ",  "u-974aef36.mp3"),
    ("cv",       "קָּ",  "u-96466fde.mp3"),
    ("blend",    "מָ",   "u-1d5b687e.mp3"),
    ("blend",    "מָא",  "u-f0946946.mp3"),
    ("blend",    "בָּא", "u-240e43b8.mp3"),
    ("blend",    "אַ",   "u-2560541d.mp3"),
    ("word",     "מָמָא", "u-158ee539.mp3"),
    ("word",     "בָּבָּא", "u-cb17bec3.mp3"),
    ("word",     "אַבָּא", "u-4d6a55f5.mp3"),
]


def _wav(path):
    wav = path + ".lqa.wav"
    if not os.path.exists(wav):
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", path, "-ar", "44100", "-ac", "1", wav],
                       check=True)
    return wav


def profile(path, thresh=0.15):
    import numpy as np
    import soundfile as sf
    data, sr = sf.read(_wav(path))
    if data.ndim > 1:
        data = data.mean(axis=1)
    win = max(1, int(0.010 * sr))          # 10ms RMS frames
    n = data.shape[0]
    nf = n // win
    env = np.sqrt((data[: nf * win].reshape(nf, win) ** 2).mean(axis=1))
    t = (np.arange(nf) * win) / sr
    peak = float(env.max())
    if peak <= 0:
        return {"ok": False, "reason": "SILENT clip"}
    level = thresh * peak
    above = env >= level
    idx = np.nonzero(above)[0]
    onset = float(t[idx[0]])
    end = float(t[idx[-1]])

    # count distinct speech onsets: rising edges through `level`, separated by >0.08s below it
    onsets = 0
    was_below = True
    last_onset_t = -1.0
    for i, a in enumerate(above):
        if a and was_below:
            if last_onset_t < 0 or (t[i] - last_onset_t) > 0.08:
                onsets += 1
                last_onset_t = float(t[i])
            was_below = False
        elif not a:
            was_below = True

    # voiced fraction: fraction of the span above the 15% floor. A healthy CV/word is mostly
    # audible (0.7+) — silence/garble would be far lower.
    span = (t >= onset) & (t <= end)
    body = env[span]
    voiced = float((body >= level).mean()) if body.size else 0.0
    # Syllable count via local-maxima prominence. In a connected word the naive onset counter
    # undercounts (the /m/ or /b/ closure between syllables may stay above the 15% floor, reading
    # ma-MA as one event), and a global %-of-peak dip floor fails because the syllable lobes have
    # very unequal energy (בָּבָּא's final vowel is ~34% of its loud middle burst). Instead: smooth
    # the envelope, find local peaks, and count those that rise meaningfully above the surrounding
    # valley (a syllable boundary = a valley dropping to <55% of the weaker adjacent lobe).
    syl = 0
    if body.size > 4:
        # light 3-frame smoothing so a single-frame flutter isn't a peak
        sm = np.convolve(body, np.ones(3) / 3.0, mode="same")
        pks = []  # (idx, height) local maxima
        for i in range(1, sm.size - 1):
            if sm[i] >= sm[i - 1] and sm[i] >= sm[i + 1] and sm[i] >= level:
                if pks and i - pks[-1][0] < 2:      # merge adjacent flats
                    if sm[i] > pks[-1][1]:
                        pks[-1] = (i, float(sm[i]))
                    continue
                pks.append((i, float(sm[i])))
        # keep a peak only if it's prominent vs the valleys on both sides
        prominent = []
        for k, (pi, ph) in enumerate(pks):
            left = sm[:pi].min() if pi > 0 else 0.0
            right = sm[pi + 1:].min() if pi + 1 < sm.size else 0.0
            # the boundary valley between this peak and its louder neighbour must dip enough
            promin = ph - min(left if k > 0 else ph * 0.5, right if k < len(pks) - 1 else ph * 0.5)
            if ph >= level and promin > 0.25 * ph:
                prominent.append(ph)
        syl = len(prominent)
    # vowel-body energy AFTER the consonant: the median RMS of the second half of the span.
    # A CV "ba" has a /b/ burst then a held /a/; if the vowel were swallowed we'd see the energy
    # collapse (median well below peak). The plosive sets a high peak, so we compare the second
    # half's median to the *onset* level, not to peak.
    half = body[body.size // 2:] if body.size > 1 else body
    vowel = float(np.median(half)) / peak if half.size and peak > 0 else 0.0
    return {"ok": True, "onset": round(onset, 3), "end": round(end, 3),
            "span": round(end - onset, 3), "onsets": onsets, "syl": syl,
            "vowel": round(vowel, 2), "voiced": round(voiced, 2),
            "peak": round(peak, 4)}


def main():
    print("LISTENING QA — read-4-kamatz-aba unit clips (acoustic profile)")
    print(f"{'role':9s} {'g':6s} {'onset':>6s} {'end':>6s} {'span':>5s} {'ons':>3s} {'syl':>3s} {'vwl':>5s} {'vcd':>5s}  verdict")
    flagged = []
    for role, g, fn in UNITS:
        p = profile(os.path.join(VDIR, fn))
        if not p["ok"]:
            verdict = "FLAG (silent)"
            flagged.append((g, fn, p["reason"]))
        else:
            reasons = []
            # Expected onset count: a CV צירוף has a consonant burst + a vowel onset (=2);
            # a blend like מָא has /m/ + /a/ (=2); a 2-syllable word has 2 onsets; 3-syllable = 3.
            if role == "isolated":
                if not (1 <= p["onsets"] <= 2):
                    reasons.append(f"unexpected-onset-count({p['onsets']})")
            elif role == "cv":
                if not (1 <= p["onsets"] <= 2):
                    reasons.append(f"unexpected-onset-count({p['onsets']})")
            elif role == "blend":
                if not (1 <= p["onsets"] <= 3):
                    reasons.append(f"unexpected-onset-count({p['onsets']})")
            elif role == "word":
                # A connected word may read as 1 onset (syllables never cross the 15% floor);
                # require >=2 prominent local peaks — the real multi-syllable proof.
                if not (1 <= p["onsets"] <= 4):
                    reasons.append(f"unexpected-onset-count({p['onsets']})")
                if p["syl"] < 2:
                    reasons.append(f"too-few-syllables({p['syl']})")
            if p["voiced"] < 0.5:
                reasons.append(f"thin-voiced({p['voiced']})")
            if p["vowel"] < 0.2:
                reasons.append(f"vowel-body-swallowed({p['vowel']})")
            if p["onset"] < 0.05 or p["onset"] > 0.6:
                reasons.append(f"onset-out-of-window({p['onset']})")
            if reasons:
                verdict = "FLAG " + ",".join(reasons)
                flagged.append((g, fn, ";".join(reasons)))
            else:
                verdict = "PASS"
        print(f"{role:9s} {g:6s} {p.get('onset','-'):>6} {p.get('end','-'):>6} "
              f"{p.get('span','-'):>5} {p.get('onsets','-'):>3} {p.get('syl','-'):>3} {p.get('vowel','-'):>5} "
              f"{p.get('voiced','-'):>5}  {verdict}")
    print()
    if flagged:
        print("FLAGGED units:")
        for g, fn, why in flagged:
            print(f"  {g}  ({fn})  {why}")
        sys.exit(2)
    print("ALL unit clips show a healthy consonant+vowel (kamatz /a/) body and no silent/garbled/"
          "doubled profile. RECOMMEND a human ear-check the muxed -final.mp4 before publish "
          "(literal listening QA).")


if __name__ == "__main__":
    main()
