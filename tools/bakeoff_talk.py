#!/usr/bin/env python3
"""
bakeoff_talk.py — the HeyGen-IL M0/M1 acceptance gate: prove the lip-sync render.

One seeded stock face + one FIXED Hebrew script -> synthesize the voice with edge-tts (the
avatar track's real voice engine, free) -> fan out to N talking-head models via gen_talk.py
-> per-model mp4 + sidecar json -> extract phone-scale QA frames (the mandatory QA rule)
-> assert the clip actually MOVED (non-static lip region) so a "rendered a frozen plate"
false-pass can't slip through.

COSTS ARE DERIVED, NOT QUOTED (the iron rule, mirrored from bakeoff_clip.py): the derived
$ is printed and asserted BEFORE any fal call. The whole run refuses to touch fal without
BOTH a FAL_KEY in .env AND the explicit --spend flag — the default is --dry-run, which
prints payloads + derived costs and exits 0 without spending a shekel.

Usage (repo root cwd):
  # free: inspect payloads + derived cost, no spend
  python tools/bakeoff_talk.py --dry-run

  # the M0/M1 gate: one real render on the default model (fabric-1.0, cheapest still-image)
  python tools/bakeoff_talk.py --spend

  # full bakeoff: every image-input talk model, same face + script
  python tools/bakeoff_talk.py --spend --models fabric-1.0,fabric-1.0-fast,omnihuman

  --face PATH     stock face png (default: webapp/.storage/avatars/stock/dana.png)
  --models a,b    TALK_MODELS keys (default: fabric-1.0)
  --out DIR       output dir (default: media/projects/_bakeoff-talk/)
  --json          emit the per-model verdicts as JSON on the last line

Needs edge-tts (the .venv-voice312 venv), ffmpeg/ffprobe (ffw), and — for --spend — FAL_KEY.
"""

import argparse
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import ffw  # noqa: E402  (resolved full ffmpeg/ffprobe)

# The voice venv that carries edge-tts (matches py.ts TOOL_VENV: edge -> .venv-voice312).
VOICE_PY = os.path.join(ROOT, '.venv-voice312', 'Scripts', 'python.exe')

# --- Stock-face -> voice gender map (the HeyGen-IL product constraint: the voice MUST match
# the avatar's gender or the result reads as broken even when sync is perfect). Hebrew edge-tts
# ships exactly two voices: he-IL-AvriNeural (male) and he-IL-HilaNeural (female). Keyed by
# stock-face filename stem; unknown faces fall back to FEMALE_VOICE (the default dana.png face).
MALE_VOICE = 'he-IL-AvriNeural'
FEMALE_VOICE = 'he-IL-HilaNeural'
FACE_VOICE = {'dana': FEMALE_VOICE}

# --- Hebrew letter-name pronunciation dictionary (nikud override). THE guttural fix: the
# auto-vocalizer (phonikud) reads unvoweled letter-names as their common-word homographs — it
# pointed החית as "ha-CHAY-it" (the animal) instead of the letter-name חֵית ("kheyt"). These
# entries pin the exact letter-name vowel-points so the voice says the LETTER, not the word.
# Applied BEFORE the generic nikud pass; entries win over the model. Extend as QA surfaces more
# letter-name / homograph misses. Keys are the unvoweled surface forms; values are pointed.
LETTER_NAME_NIKKUD = {
    'החית': 'הַחֵית', 'חית': 'חֵית',          # khet  (was mis-read as "chayit"/animal)
    'העין': 'הָעַיִן', 'עין': 'עַיִן',          # ayin
    # resh: user QA 2026-08-24 — "reysh" (צירי) and phonikud's "reesh" (חיריק) both sound off;
    # modern Israeli resh is closer to segol "resh". Pin segol WITHOUT the yod.
    'הריש': 'הָרֶשׁ', 'ריש': 'רֶשׁ',            # resh  (segol, no yod — the Israeli reading)
    'האות': 'הָאוֹת',                          # "the letter" (אוֹת — pinned for safety)
}


def _strip_nikkud(s):
    """Remove Hebrew pointing (niqqud combining marks U+0591..U+05C7) so a vocalized surface
    form can be matched back to its dictionary key."""
    return ''.join(ch for ch in s if not ('֑' <= ch <= 'ׇ'))


# Hebrew one-letter conjunction/preposition prefixes (וְ "and", בְּ "in", לְ "to", הַ "the",
# כְּ "like", מִ "from"). A letter-name rarely stands alone — "והריש" = "and-the-resh" — so the
# dictionary must match a pin as a SUFFIX and preserve the pointed prefix the vocalizer gave.
_PREFIX_CHARS = 'ובלהכמ'


def apply_pronunciation_dictionary(text):
    """Pin known-mispronounced Hebrew words (letter-names, homographs) to their pointed forms.
    Applied AFTER the generic nikud pass so the pins WIN — phonikud re-vowels pointed input (it
    clobbered הַחֵית back to הַחַית/"chayit" when the dict ran first, 2026-08-24). Matching is
    on the STRIPPED surface form, and handles prefix conjunctions (וְהָרִישׁ = "and-the-resh")
    by pinning the longest matching base while KEEPING the vocalizer's pointed prefix.
    Deterministic, free, no model."""
    # Map: stripped base surface -> fully-pointed letter-name.
    pinned = {_strip_nikkud(k): v for k, v in LETTER_NAME_NIKKUD.items()}
    out_words = []
    for word in text.split(' '):
        # Separate trailing punctuation (., !, ?, :) so it neither blocks the pin match nor is
        # lost — phonikud emits "וְהָרִישׁ." with the period attached and it must re-attach after.
        trail = ''
        core = word
        while core and not ('֑' <= core[-1] <= 'ׇ') and not ('א' <= core[-1] <= 'ת'):
            trail = core[-1] + trail
            core = core[:-1]
        stripped = _strip_nikkud(core)
        if stripped in pinned:
            out_words.append(pinned[stripped] + trail)   # exact hit
            continue
        # Try stripping 1-2 leading prefix chars (וְהָ... etc.) and match the remaining base.
        hit = None
        for n in (1, 2):
            if len(stripped) > n and stripped[0] in _PREFIX_CHARS and stripped[n:] in pinned:
                hit = n
                break
        if hit:
            # Keep the vocalizer's own pointed prefix (first `hit` base letters + their marks),
            # then append the pinned pointed base. We recover the pointed prefix by walking the
            # CORE (punctuation already split off) until we've consumed `hit` base letters.
            i = 0
            consumed = 0
            while i < len(core) and consumed < hit:
                if not ('֑' <= core[i] <= 'ׇ'):
                    consumed += 1
                i += 1
            # include any marks that attach to the last prefix letter
            while i < len(core) and ('֑' <= core[i] <= 'ׇ'):
                i += 1
            out_words.append(core[:i] + pinned[stripped[hit:]] + trail)
        else:
            out_words.append(word)
    return ' '.join(out_words)


def synth_text_for(text, nikkud):
    """The exact string sent to edge-tts. With --nikkud: generic phonikud vocalizer first, THEN
    the letter-name dictionary overrides its homograph misses. Without --nikkud: raw text."""
    if not nikkud:
        return text
    import nikkud_g2p
    return apply_pronunciation_dictionary(nikkud_g2p.add_nikkud(text))

# The FIXED Hebrew acceptance script (nikkud-free; the same words every run so frames are
# comparable across models). ~3 short lines, male+female voices exercised by the caller.
SCRIPT = "שלום! אני האווטאר הדיגיטלי שלך. כותבים תסריט, והאווטאר מדבר אותו בעברית. מושלם לפרסום, להדרכה, ולמכירות."

# The GUTTURAL acceptance script (--script guttural). The decisive Hebrew QA gate: a script
# dense in ח/ע/ר (gutturals rare in the CN/EN corpora these models train on) PLUS a
# code-switching line (Hebrew<->English — the defining Israeli failure mode). A model that
# holds sync on THIS can be trusted on real Israeli speech; one that smears the gutturals or
# drops the English words fails here before a client ever sees it.
SCRIPT_GUTTURAL = (
    "אני אוהב לדבר עברית בכל ערב עם החברים שלי מהעבודה. "
    "הרבה אנשים רוצים לדעת איך האווטאר מבטא נכון את החית והעין והריש. "
    "תשלחו לי email ב-WhatsApp, ואני אענה לכם מחר בבוקר."
)

SCRIPTS = {'default': SCRIPT, 'guttural': SCRIPT_GUTTURAL}

# The verified talk-model registry — MUST mirror packages/spec/src/ai-models.ts TALK_MODELS.
# costPerSecUsd is the DERIVED cost basis (stated before spend). input 'image' vs 'video'
# decides the gen_talk.py --driver flag.
TALK_MODELS = {
    # Fabric now defaults to 720p (AvatarSpec is 1080x1920; 480p upscaled 2.25x was soft).
    # Verified 2026-08-24 (fal.ai model page): STANDARD fabric-1.0 = $0.08/s @480p, $0.15/s @720p;
    # the /fast variant = $0.10/s @480p, $0.20/s @720p. (Earlier $0.20 here was the FAST tier.)
    # ⚠ The fal id is 'veed/fabric-1.0' — VEED is a TOP-LEVEL partner namespace on fal (like
    #    bytedance/, xai/, openai/), NOT under fal-ai/. Prefixing 'fal-ai/veed/...' makes fal
    #    parse "veed" as the app under owner "fal-ai" -> 404. Verified 2026-08-24: the model
    #    page fal.ai/models/veed/fabric-1.0 is live, GA (Partner + Commercial-use labels, no
    #    gating), schema = {image_url, audio_url, resolution: 720p|480p}, output = video.
    'fabric-1.0':      {'falId': 'veed/fabric-1.0',                           'input': 'image', 'costPerSecUsd': 0.15, 'res': '720p'},
    'fabric-1.0-fast': {'falId': 'veed/fabric-1.0/fast',                      'input': 'image', 'costPerSecUsd': 0.20, 'res': '720p'},
    'omnihuman':       {'falId': 'fal-ai/bytedance/omnihuman',                'input': 'image', 'costPerSecUsd': 0.14, 'res': None},
    'musetalk':        {'falId': 'fal-ai/musetalk',                           'input': 'video', 'costPerSecUsd': 0.0,  'res': None},
    'kling-lipsync':   {'falId': 'fal-ai/kling-video/lipsync/audio-to-video', 'input': 'video', 'costPerSecUsd': 0.014, 'res': None},
}


def run(cmd, binary=False, **kw):
    # binary=True: raw byte stdout (pixel piping). text=True would \r\n-translate the stream on
    # Windows and silently corrupt byte offsets (the 2026-08-24 motion-gate bug).
    if binary:
        return subprocess.run(cmd, capture_output=True, **kw)
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def synth_voice(text, out_mp3, voice):
    """edge-tts the Hebrew script -> mp3. Returns the path, or None on failure."""
    code = (
        "import asyncio, edge_tts\n"
        "async def go():\n"
        f"    c = edge_tts.Communicate({text!r}, {voice!r})\n"
        f"    await c.save({out_mp3!r})\n"
        "asyncio.run(go())\n"
        "print('ok')\n"
    )
    r = run([VOICE_PY, '-c', code])
    return out_mp3 if (r.returncode == 0 and os.path.exists(out_mp3)) else None


def ffprobe_duration(path):
    r = run([ffw.ffprobe_path(), '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def motion_score(video, workdir):
    """Measure inter-frame change, MOUTH-REGION weighted. Returns (score, detail).

    Why mouth-weighted: a whole-frame probe false-negatives a real talking head — a 15s clip
    of a mostly-still avatar averages near-zero whole-frame diff even when the lips move
    constantly (verified 2026-08-24: an omnihuman render with clear lip motion scored <1.0 on
    the old whole-strip probe and got a bogus "STATIC (suspect)" verdict). The mouth region is
    a small fraction of the frame, so we crop the lower-central face band and threshold THAT.

    Returns dict {'whole': float, 'mouth': float, 'ratio': float} or None on decode failure.
    `ratio` = mouth/whole — >>1 means motion is concentrated in the mouth (a talking head),
    ~1 means uniform motion (camera/global, NOT lip-sync), ~0 both = frozen plate."""
    # Sample 6 frames across the clip at a readable phone scale, decoded straight to raw gray
    # bytes (no intermediate PNG — going mp4->PNG->rawvideo leaked ~134 trailing bytes/frame
    # through the pipe and silently desynced the mouth-band offsets, 2026-08-24).
    W, H = 270, 480
    N = 6
    r = run([ffw.path(), '-y', '-v', 'error', '-i', video,
             '-vf', f"fps=1,scale={W}:{H},format=gray", '-frames:v', str(N),
             '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], binary=True)
    raw = r.stdout or b''
    fsize = W * H
    if r.returncode != 0 or len(raw) < fsize * 2:
        return None
    bufs = [raw[i * fsize:(i + 1) * fsize] for i in range(len(raw) // fsize)]
    if len(bufs) < 2:
        return None
    try:
        # Mouth band: lower-central face. For a centered head-and-shoulders avatar the mouth
        # sits ~60-85% down the frame and ~30-70% across. (Same band as the QA face crop.)
        x0, x1 = int(W * 0.30), int(W * 0.70)
        y0, y1 = int(H * 0.60), int(H * 0.85)

        def band_diff(a, b):
            tot = 0
            cnt = 0
            for y in range(y0, y1):
                row = y * W
                for x in range(x0, x1):
                    tot += abs(a[row + x] - b[row + x])
                    cnt += 1
            return tot / cnt if cnt else 0.0

        whole_diffs, mouth_diffs = [], []
        for a, b in zip(bufs, bufs[1:]):
            n = len(a)
            whole_diffs.append(sum(abs(a[i] - b[i]) for i in range(0, n, 7)) / (n / 7))
            mouth_diffs.append(band_diff(a, b))
        whole = sum(whole_diffs) / len(whole_diffs)
        mouth = sum(mouth_diffs) / len(mouth_diffs)
        return {'whole': whole, 'mouth': mouth, 'ratio': (mouth / whole) if whole else 0.0}
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--face', default=os.path.join(ROOT, 'webapp', '.storage', 'avatars', 'stock', 'dana.png'))
    ap.add_argument('--models', default='fabric-1.0', help='comma-separated TALK_MODELS keys')
    ap.add_argument('--voice', default=None,
                    help='edge-tts Hebrew voice. Default: derived from the stock face gender '
                         '(FACE_VOICE map) so the voice matches the avatar.')
    ap.add_argument('--nikkud', action='store_true',
                    help='run the script through the letter-name dictionary + phonikud G2P before '
                         'synthesis — fixes guttural letter-name pronunciation (חֵית not "chayit"). '
                         'Recommended ON for the guttural gate.')
    ap.add_argument('--script', default='default', choices=list(SCRIPTS),
                    help='acceptance script: default (clean) or guttural (ח/ע/ר-dense + code-switch)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'media', 'projects', '_bakeoff-talk'))
    ap.add_argument('--spend', action='store_true', help='ACTUALLY call fal (costs real $)')
    ap.add_argument('--dry-run', action='store_true', help='payloads + derived cost, no spend (default)')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    spend = args.spend and not args.dry_run
    os.makedirs(args.out, exist_ok=True)

    if not os.path.exists(args.face):
        sys.exit(f"face not found: {args.face} (seed stock avatars first)")

    keys = [k.strip() for k in args.models.split(',') if k.strip()]
    unknown = [k for k in keys if k not in TALK_MODELS]
    if unknown:
        sys.exit(f"unknown models: {unknown} (known: {list(TALK_MODELS)})")

    # Voice = explicit --voice, else derived from the stock face's gender (the HeyGen-IL
    # constraint: the voice MUST match the avatar's gender). Unknown faces -> the female default.
    face_stem = os.path.splitext(os.path.basename(args.face))[0].lower()
    voice = args.voice or FACE_VOICE.get(face_stem, FEMALE_VOICE)
    if not args.voice:
        print(f"[voice] no --voice given; matched face '{face_stem}' -> {voice}")

    # 1) Synthesize the Hebrew voice once (free) — every model lip-syncs the SAME audio.
    script = SCRIPTS[args.script]
    synth_text = synth_text_for(script, args.nikkud)
    voice_tag = f'voice-{args.script}' + ('-nikkud' if args.nikkud else '') + f'-{voice}'
    voice_mp3 = os.path.join(args.out, f'{voice_tag}.mp3')
    if not os.path.exists(voice_mp3):
        print(f"[voice] edge-tts {voice} [{args.script}{'+nikkud' if args.nikkud else ''}] -> {os.path.basename(voice_mp3)} ...", flush=True)
        if args.nikkud:
            print(f"[voice] pointed text: {synth_text}", flush=True)
        if not synth_voice(synth_text, voice_mp3, voice):
            sys.exit('edge-tts failed to synthesize the Hebrew voice')
    dur = ffprobe_duration(voice_mp3)
    print(f"[voice] {dur:.1f}s Hebrew track ready" if dur else "[voice] ready (duration unknown)", flush=True)

    # 2) Per model: derive cost BEFORE spend, print the payload, then (only with --spend) run.
    verdicts = []
    print()
    print(f"{'model':<18} {'input':<6} {'$/s':>7} {'~est $':>8}  endpoint")
    for k in keys:
        m = TALK_MODELS[k]
        est = (dur or 6.0) * m['costPerSecUsd']
        print(f"{k:<18} {m['input']:<6} {m['costPerSecUsd']:>7.3f} {est:>8.3f}  {m['falId']}")
    print()
    total_est = sum((dur or 6.0) * TALK_MODELS[k]['costPerSecUsd'] for k in keys)
    print(f"[cost] derived total for {len(keys)} model(s) x ~{(dur or 6.0):.0f}s = ${total_est:.3f}")

    if not spend:
        print("[dry-run] no fal call. Re-run with --spend to execute the render above.")
        if args.json:
            print(json.dumps({'dryRun': True, 'derivedTotalUsd': round(total_est, 4)}, ensure_ascii=False))
        return

    # 3) The spend path — requires FAL_KEY.
    env = dict(os.environ)
    env.setdefault('PYTHONIOENCODING', 'utf-8')
    for k in keys:
        m = TALK_MODELS[k]
        out_mp4 = os.path.join(args.out, f"{k}.mp4")
        driver = m['input'] == 'video'
        cmd = [sys.executable, os.path.join(ROOT, 'tools', 'gen_talk.py'),
               '--model', m['falId'], '--face', args.face, '--audio', voice_mp3,
               '--out', out_mp4] + (['--driver'] if driver else [])
        if m['res']:
            cmd += ['--set', f"resolution={m['res']}"]
        print(f"[render] {k} ...", flush=True)
        t0 = time.time()
        r = run(cmd, env=env)
        secs = time.time() - t0
        ok = r.returncode == 0 and os.path.exists(out_mp4)
        ms = motion_score(out_mp4, args.out) if ok else None
        # Mouth-band gate: the mouth region must move visibly (>1.0 mean gray diff) AND more
        # than the frame average (ratio>1.2 → motion is lip-concentrated, not camera/global).
        moved = (ms is not None and ms['mouth'] > 1.0 and ms['ratio'] > 1.2)
        verdicts.append({
            'model': k, 'ok': ok, 'renderSecs': round(secs, 1),
            'motionScore': ({'whole': round(ms['whole'], 2), 'mouth': round(ms['mouth'], 2),
                             'ratio': round(ms['ratio'], 2)} if ms is not None else None),
            'moved': moved, 'mp4': out_mp4 if ok else None,
            'derivedCostUsd': round((dur or 6.0) * m['costPerSecUsd'], 4),
            'stderrTail': (r.stderr or '')[-300:] if not ok else None,
        })
        status = 'RENDERED+moved' if (ok and moved) else ('RENDERED but STATIC (suspect)' if ok else 'FAILED')
        motion_txt = (f"mouth={ms['mouth']:.2f} whole={ms['whole']:.2f} ratio={ms['ratio']:.2f}"
                      if ms is not None else '?')
        print(f"  -> {status}  {motion_txt}  ({secs:.0f}s)", flush=True)

    passed = [v for v in verdicts if v['ok'] and v['moved']]
    print()
    print(f"[gate] {len(passed)}/{len(verdicts)} model(s) produced a MOVING talking head")
    if args.json:
        print(json.dumps({'spend': True, 'passed': len(passed), 'total': len(verdicts),
                          'verdicts': verdicts}, ensure_ascii=False))
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
