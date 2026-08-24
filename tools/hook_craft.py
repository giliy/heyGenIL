#!/usr/bin/env python3
"""
hook_craft.py — the ad hook-craft engine for /make-ad Stage 1.

The harness audit (research/pro-quality/04-harness-benchmark.md, finding A2) calls this the
fatal ad gap: "hook lands <2s and hook is a good hook have NO numeric/testable gate — it's
human-drafted. This is where ads die." The lexicon tells you WHICH hook styles a vertical
allows (`hook_styles`); it does not make the hook good, and it does not enforce the <2s rule.
Both shipped ads prove it: ad-1-liat and ad-2-noa both land the hook's LAST word at ~2.3-2.6s
from frame 0 — past the 2s wall — because nothing measured it.

This tool closes both halves:

  1. TEMPLATE BANK — per-style Hebrew hook skeletons, parameterized by the vertical's
     register/address so a feminine-singular vertical gets עצרי-forms and a plural one gets
     צריכים-forms. The model drafts from a proven pattern and fills the slot, instead of
     improvising generic AI-slop. A/B: every style emits 2 variants (a question + a statement
     cut) so the skill can pick.

  2. NUMERIC HOOK GATE — `check` lints a drafted hook line:
       - concision      (<= _MAX_HOOK_WORDS words)
       - land time      (hook's last word ends by _LAND_MAX_S; real word-times when present,
                         else a words/sec estimate)
       - style match    (the line matches the declared hookStyle's phrase pattern, or a
                         different allowed style for the vertical)
       - taboo/never-CTA (reuses lexicon.violations)
     `check-beats` runs the same gate against a beats.json's `vo[].beat=="hook"` line, using
     its REAL per-word end-times when present (post-voice-gen) and the word-rate estimate
     when they are not (draft). Conditional, like the other contracts gates.

  3. SELF-REVIEW CHECKLIST — `checklist` prints the story-writer rubric the model must
     self-score before building. The honest half of "good hook" stays human; the measurable
     half is gated. Both are required.

Used as a library by make-ad Stage 1 AND as a CLI:

  python tools/hook_craft.py list-styles                      # the 4 hook style keys
  python tools/hook_craft.py templates <vertical> [--json]    # A/B skeletons for the vertical
  python tools/hook_craft.py check <vertical> <style> "<hook line>"   # lint one drafted line
  python tools/hook_craft.py check-beats <beats.json>         # gate the hook line in a beats.json
  python tools/hook_craft.py checklist <vertical>             # the self-review rubric
"""

import argparse
import io
import json
import os
import re
import sys

# Windows consoles default to cp1252 — force UTF-8 so Hebrew prints clean.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)  # so `import lexicon` resolves when run as tools/hook_craft.py

import lexicon  # noqa: E402  (after sys.path insert)


# =============================================================================
# THE NUMERIC GATE — these are the constants A2 says are missing. Tune them to the
# research, not to taste; they are the contract.
# =============================================================================
_LAND_MAX_S = 2.0        # the hook's LAST word must land by 2.0s from frame 0
_LAND_WARN_S = 1.6       # under this is a strong hook; 1.6-2.0 is acceptable-but-tight
_MAX_HOOK_WORDS = 8      # plan item #4: hook <= 8 words, lands frame-0
# Measured from shipped edge-tts Hebrew (ad-1/ad-2): a frame-0 hook's words run ~1.6-2.2 w/s
# (slower than a full line — there's a breath/onset before the first word). Use the SLOW end so
# the draft-time estimate doesn't pass a hook the real-word-times check will then fail. Add a
# small onset pad: a hook starting at frame 0 doesn't get its first word out at t=0.
_EST_HOOK_WORDS_PER_SEC = 1.9
_EST_HOOK_ONSET_S = 0.3


# =============================================================================
# THE TEMPLATE BANK — per-style skeletons. Each style has:
#   detect:  Hebrew phrase regexes used by the GATE to recognize the style in a drafted line
#   fem / masc: register-specific A/B skeletons. {slot} is the fill-in (business/pain/offer).
# A/B = two cuts per style (a question variant + a statement variant) so the skill picks.
# The register key is derived from the vertical's `address` pronoun:
#   address == "את"  -> feminine-singular copy (עצרי / בחרי / צריכה)
#   anything else     -> plural/neutral copy (צריכים / רוצים / מחפשים)
# =============================================================================
_STYLES = {
    "pain-question": {
        "label": "שאלת כאב",
        # interrogative AND statement cuts of the pain hook: צריך/מחפש/נמאס ask it,
        # מספיק/די/אין/קשה/נמאס state it. Both are the same hook — detect both.
        "detect": [r"צריך", r"מחפש", r"נמאס", r"מספיק", r"די\b", r"אין ", r"קשה",
                   r"מתי", r"איך", r"למה", r"\?"],
        "fem": [
            "מחפשת {slot}?",
            "נמאס לך מ{slot}?",
            "מספיק {slot}.",
        ],
        "masc": [
            "מחפשים {slot}?",
            "נמאס לכם מ{slot}?",
            "מספיק {slot}.",
        ],
    },
    "surprise": {
        "label": "הפתעה",
        "detect": [r"רגע", r"חייב", r"לא תאמינ", r"זה קורה", r"תרא", r"עצר", r"חדש ב",
                   r"נפתח", r"הגיע"],
        "fem": [
            "רגע — את חייבת לראות את זה.",
            "עצרי הכל — {slot}.",
        ],
        "masc": [
            "רגע — אתם חייבים לראות את זה.",
            "זה קורה עכשיו: {slot}.",
        ],
    },
    "social-proof": {
        "label": "הוכחה חברתית",
        "detect": [r"כבר", r"הלקוחות", r"כולם", r"עסקים", r"אלפ", r"מדברים", r"כוכבים",
                   r"המומלץ", r"מבוסס"],
        "fem": [
            "הלקוחות שלנו כבר יודעות: {slot}.",
            "כולן כבר מדברות על {slot}.",
        ],
        "masc": [
            "הלקוחות שלנו כבר יודעים: {slot}.",
            "כולם כבר מדברים על {slot}.",
        ],
    },
    "free-trial": {
        "label": "ניסיון חינם",
        "detect": [r"חינם", r"ניסיון", r"מתנה", r"ראשון", r"התנסות", r"בלי", r"ללא תשלום",
                   r"בחינם"],
        "fem": [
            "{slot} — הפעם הראשונה חינם.",
            "בואי לנסות בלי לשלם: {slot}.",
        ],
        "masc": [
            "{slot} — הפעם הראשונה חינם.",
            "בואו לנסות בלי לשלם: {slot}.",
        ],
    },
}


def list_styles():
    """Return {style_key: label} for the hook styles the engine can generate/detect."""
    return {k: v["label"] for k, v in _STYLES.items()}


def _register_key(vertical):
    """Map a vertical's address pronoun to the template register bank ('fem'|'masc')."""
    addr = lexicon.get(vertical).get("address", "אתם")
    return "fem" if addr == "את" else "masc"


def templates(vertical, style=None):
    """Return {style: [variantA, variantB]} for the vertical, register-matched.

    If `style` is given, restrict to that one. Restricts to the vertical's lexicon
    `hook_styles` (you may only draft in a style the vertical allows)."""
    lx = lexicon.get(vertical)
    allowed = [s for s in lx.get("hook_styles", []) if s in _STYLES]
    reg = _register_key(vertical)
    if style:
        allowed = [s for s in allowed if s == style]
    return {s: list(_STYLES[s][reg]) for s in allowed}


def detect_styles(line):
    """Return the list of style keys whose `detect` patterns hit `line` (any match)."""
    hits = []
    for key, s in _STYLES.items():
        if any(re.search(p, line) for p in s["detect"]):
            hits.append(key)
    return hits


# =============================================================================
# THE GATE
# =============================================================================
def _words(line):
    """Split a Hebrew line into words (whitespace); strips trailing punctuation per token."""
    return [w for w in re.split(r"\s+", line.strip()) if w]


def _estimate_land_s(line, start_s=0.0):
    """Estimate when the hook's last word lands, from a drafted line with no word-times.

    land = onset pad + hook's own start on the timeline + (word count / hook words-per-sec).
    The start is ~0 for a frame-0 hook but we take the line's scheduled start when a
    beats.json gives one. Uses the measured hook rate, not the faster full-line rate.
    """
    n = len(_words(line))
    return start_s + _EST_HOOK_ONSET_S + (n / _EST_HOOK_WORDS_PER_SEC)


def lint_hook(vertical, hook_line, style=None, word_end_times=None, hook_start_s=0.0):
    """Gate one drafted hook line. Returns (ok, failures[], warnings[], info{}).

    - hook_line:       the drafted Hebrew hook text.
    - style:           the intended hookStyle (defaults to ad.brand.hookStyle if the caller
                       passes it; here None = 'must match SOME allowed style for the vertical').
    - word_end_times:  optional list of REAL per-word end times (seconds, from frame 0) for
                       the hook line. When present the land-time check is EXACT; when absent
                       it falls back to the word-rate estimate (and says so in info).
    - hook_start_s:    where the hook line starts on the timeline (default 0 = frame 0).
    """
    lx = lexicon.get(vertical)
    allowed = [s for s in lx.get("hook_styles", []) if s in _STYLES]
    failures, warnings = [], []
    info = {}

    # --- 1. concision ---------------------------------------------------------
    wc = len(_words(hook_line))
    info["word_count"] = wc
    if wc > _MAX_HOOK_WORDS:
        failures.append(
            f"hook too long: {wc} words > {_MAX_HOOK_WORDS}. A hook is one breath — cut to "
            f"the pain/offer, no setup clause.")
    elif wc > 6:
        warnings.append(f"hook is {wc} words — under the cap but long; tighter reads faster.")

    # --- 2. land time (the <2s wall) -----------------------------------------
    if word_end_times:
        land = max(word_end_times)
        info["land_s"] = round(land, 3)
        info["land_source"] = "real-word-times"
    else:
        land = _estimate_land_s(hook_line, hook_start_s)
        info["land_s"] = round(land, 3)
        info["land_source"] = "estimate(%.1f w/s + %.1fs onset)" % (
            _EST_HOOK_WORDS_PER_SEC, _EST_HOOK_ONSET_S)
    if land > _LAND_MAX_S:
        failures.append(
            f"hook lands late: last word at {land:.2f}s > {_LAND_MAX_S}s from frame 0. "
            f"Shorten the line or start it earlier — the hook must land before 2s.")
    elif land > _LAND_WARN_S:
        warnings.append(f"hook lands at {land:.2f}s — inside 2s but tight; trim a word.")

    # --- 3. style match --------------------------------------------------------
    matched = detect_styles(hook_line)
    info["matched_styles"] = matched
    if style:
        if style not in allowed:
            failures.append(
                f"hookStyle {style!r} is not an allowed style for vertical {vertical!r} "
                f"(allowed: {allowed}). Pick from the lexicon hook_styles.")
        elif style not in matched:
            failures.append(
                f"hook does not read as {style!r}: none of its phrase patterns hit "
                f"(detected: {matched or 'none'}). Draft from templates for that style.")
    else:
        if not matched:
            failures.append(
                f"hook matches NO known hook style for {vertical!r} (allowed: {allowed}). "
                f"It reads generic — ground it in a hook_style pattern.")
        elif not any(m in allowed for m in matched):
            failures.append(
                f"hook reads as {matched} but vertical {vertical!r} only allows {allowed}. "
                f"Re-cut it in an allowed style.")

    # --- 4. taboo / never-CTA lint (reuse the lexicon's) -----------------------
    for kind, frag in lexicon.violations(vertical, hook_line):
        failures.append(f"hook hits {kind}: {frag!r} — rewrite (lexicon taboo).")

    ok = not failures
    info["vertical"] = vertical
    info["style"] = style or (matched[0] if matched else None)
    return ok, failures, warnings, info


def check_beats(path):
    """Gate the hook line inside a beats.json. Returns (ok, failures[], warnings[], info{}).

    Finds the `vo[].beat=="hook"` line (there should be exactly one). Uses its REAL
    `words[].end` times when present (post-voice-gen), else the word-rate estimate. Also
    cross-checks ad.brand.hookStyle when the ad block declares one."""
    if not os.path.exists(path):
        raise ValueError(f"missing file: {path}")
    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    ad = d.get("ad") or {}
    biz = ad.get("business") or {}
    vertical = biz.get("vertical")
    if not vertical:
        raise ValueError("beats.json ad.business.vertical is required to gate the hook")
    declared_style = (ad.get("brand") or {}).get("hookStyle")

    hook_lines = [l for l in d.get("vo", []) if l.get("beat") == "hook"]
    if not hook_lines:
        raise ValueError(
            "no vo[] line tagged beat:\"hook\" — the hook must be a tagged line so the gate "
            "can find it. Tag the opening line's `beat` field \"hook\".")
    hook = hook_lines[0]
    if len(hook_lines) > 1:
        # not fatal — but worth surfacing; the hook should be ONE line
        pass

    text = hook.get("text", "")
    start_s = float(hook.get("start", 0.0))
    words = hook.get("words") or []
    word_ends = [w.get("end") for w in words if w.get("end") is not None]
    # land time is measured from FRAME 0, so real word ends are already absolute; the
    # estimate path adds the line's scheduled start.
    wets = word_ends if word_ends else None

    ok, failures, warnings, info = lint_hook(
        vertical, text, style=declared_style, word_end_times=wets, hook_start_s=start_s)
    info["beats"] = os.path.basename(path)
    info["declared_style"] = declared_style
    if len(hook_lines) > 1:
        warnings.append(f"{len(hook_lines)} vo lines tagged 'hook' — the hook should be ONE line.")
    return ok, failures, warnings, info


# =============================================================================
# THE SELF-REVIEW CHECKLIST — the honest half of "is it a good hook". The gate above
# catches what is measurable; this rubric is what the story-writer must self-score and the
# reviewer must eyeball. Printed so it lands in the transcript next to the draft.
# =============================================================================
_CHECKLIST = [
    "Does the FIRST word create the pain/curiosity? (no greeting, no 'היי', no business name up front)",
    "Is the payoff visible at FRAME 0? (the hook is composed on the first frame, not animated in later)",
    "Could a stranger repeat the hook after ONE hearing? (<= 8 words, one idea)",
    "Does it name a SPECIFIC pain/offer, not a category? ('מחפשים מספרה בחיפה?' not 'מחפשים שירות?')",
    "Is it in the vertical's register? (feminine-singular for את-verticals, no academy Hebrew)",
    "Does it make the buyer feel SMART, not cheap? (freier code — שווה, not זול)",
    "Is it free of the vertical's taboos and the never-CTA?",
    "Does the LAST word land before 2.0s on the real word-times?",
]


def checklist(vertical):
    """Return the self-review rubric as a list of strings (the engine prints/returns it)."""
    lx = lexicon.get(vertical)
    allowed = [s for s in lx.get("hook_styles", []) if s in _STYLES]
    out = [
        f"HOOK SELF-REVIEW — vertical={vertical} address={lx.get('address')} "
        f"allowed_styles={allowed}",
        f"Numeric gate: last word lands <= {_LAND_MAX_S}s (real word-times), "
        f"hook <= {_MAX_HOOK_WORDS} words. The rest is yours to answer honestly:",
    ]
    out += [f"  {i+1}. {q}" for i, q in enumerate(_CHECKLIST)]
    return out


# =============================================================================
# CLI
# =============================================================================
def _emit(ok, failures, warnings, info, as_json):
    if as_json:
        print(json.dumps({"ok": ok, "failures": failures, "warnings": warnings, "info": info},
                         ensure_ascii=False, indent=2))
        return
    print(f"vertical   : {info.get('vertical')}")
    if info.get("style"):
        print(f"style      : {info['style']}" +
              (f" (declared {info['declared_style']})" if info.get("declared_style") else ""))
    print(f"words      : {info.get('word_count')}  (cap {_MAX_HOOK_WORDS})")
    print(f"lands      : {info.get('land_s')}s from frame 0  [{info.get('land_source')}]  "
          f"(wall {_LAND_MAX_S}s)")
    if info.get("matched_styles") is not None:
        print(f"reads as   : {info.get('matched_styles') or 'NO known style'}")
    for w in warnings:
        print(f"  WARN: {w}")
    if failures:
        for f_ in failures:
            print(f"  FAIL: {f_}")
        print("HOOK: FAIL")
    else:
        print("HOOK: PASS" + (" (with warnings)" if warnings else ""))


def main():
    ap = argparse.ArgumentParser(description="ad hook-craft engine for /make-ad Stage 1")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list-styles", help="the hook style keys + labels")

    p_t = sub.add_parser("templates", help="A/B hook skeletons for a vertical")
    p_t.add_argument("vertical")
    p_t.add_argument("--style", help="restrict to one style")
    p_t.add_argument("--json", action="store_true")

    p_c = sub.add_parser("check", help="lint one drafted hook line")
    p_c.add_argument("vertical")
    p_c.add_argument("style", nargs="?", default=None, help="intended hookStyle (optional)")
    p_c.add_argument("line", help="the drafted Hebrew hook line")
    p_c.add_argument("--json", action="store_true")

    p_b = sub.add_parser("check-beats", help="gate the hook line in a beats.json")
    p_b.add_argument("beats", help="path to beats.json")
    p_b.add_argument("--json", action="store_true")

    p_k = sub.add_parser("checklist", help="the story-writer self-review rubric")
    p_k.add_argument("vertical")

    args = ap.parse_args()

    if args.cmd == "list-styles":
        for k, label in list_styles().items():
            print(f"  {k:14} {label}")
        return 0

    if args.cmd == "templates":
        t = templates(args.vertical, args.style)
        if args.json:
            print(json.dumps(t, ensure_ascii=False, indent=2))
        else:
            lx = lexicon.get(args.vertical)
            print(f"vertical={args.vertical} register={'fem' if _register_key(args.vertical)=='fem' else 'masc/plural'} "
                  f"address={lx.get('address')}")
            for style, variants in t.items():
                print(f"\n[{style}]  ({_STYLES[style]['label']})")
                for i, v in enumerate(variants):
                    print(f"  {chr(65+i)}. {v}")
                print(f"      slot = the specific pain/offer (e.g. business category, the deal)")
        return 0

    if args.cmd == "check":
        ok, failures, warnings, info = lint_hook(args.vertical, args.line, style=args.style)
        _emit(ok, failures, warnings, info, args.json)
        return 0 if ok else 1

    if args.cmd == "check-beats":
        try:
            ok, failures, warnings, info = check_beats(args.beats)
        except ValueError as e:
            print(f"FAIL: {e}")
            return 1
        _emit(ok, failures, warnings, info, args.json)
        return 0 if ok else 1

    if args.cmd == "checklist":
        for line in checklist(args.vertical):
            print(line)
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
