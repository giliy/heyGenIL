#!/usr/bin/env python3
"""new_ad.py — scaffold a Hebrew /make-ad project from a business brief, in seconds.

The TEMPLATE SYSTEM for the ad track. One command turns a vertical + business into the full
starting point the /make-ad skill expects — so a new ad starts from a register-correct scaffold
instead of a blank page:

  shorts/ad-N-<slug>/brief.md     — the interrogation answers, pre-filled from the lexicon
  shorts/ad-N-<slug>/script.md    — a beat table (time | on screen | VO) skeleton
  shorts/ad-N-<slug>/beats.json   — mode:"ad" contract that PASSES tools/contracts.validate_ad_beats
                                    on first emit (id/title/format/vo/beats + a valid ad{} block,
                                    hook tagged beat:"hook", a >=2s-holding cta beat)
  remotion/src/shots/ad-N/AdN<Name>.tsx — a compile-ready composition stub (scenes over one
                                    canvas, Captions rtl, PriceBadge on the offer, AdEndCard on
                                    the cta) — the FILL-ME markers are where the craft goes.

The vertical drives everything the lexicon knows — register, address pronoun, edge-tts voice,
hook styles, magic phrases, the CTA (and the CTA to never use) — so the scaffold is born
on-register. You supply the one thing the lexicon can't: the actual OFFER (headline + price).

This is the SCAFFOLD, not the ad. The hook line, the per-beat visuals, and the QA pass are
still the human/agent craft the /make-ad skill gates. What this removes is the hour of setup.

Run from the repo root, in the voice venv (it reads tools/lexicons.json via lexicon.py):

  .venv-voice312\\Scripts\\python.exe tools/new_ad.py <vertical> <slug> \
      --business "שם העסק" --headline "ההצעה בעברית" --price 199 \
      [--old-price 299] [--cta whatsapp] [--phone 050-123-4567] [--website example.co.il] \
      [--accent "#E11D48"] [--hook-style pain-question] [--city "תל אביב"]

  --list                              # the vertical keys + labels, then exit
  --force                             # overwrite an existing ad-N-<slug> dir

The next step after scaffolding: edit script.md + beats.json (the real hook + offer copy),
then run the /make-ad pipeline from Stage 2. Voice gen uses gen_voice_edge.py --nikkud, which
routes through tools/hebrew_pronounce.py — so the guttural letter-names and code-switch fixes
apply automatically.
"""
import argparse
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon  # per-vertical playbooks (register, voice, CTA, magic phrases, taboos)

FPS = 30
W, H = 1080, 1920

# Default per-beat visual one-liners (the craft pass rewrites these; they exist so beats.json
# is complete and the TSX stub has a scene per beat). The five canonical ad beats.
_BEAT_VISUALS = {
    "hook": "HOOK fully composed at frame 0 — the payoff visible on the first frame (no build-up).",
    "intro": "the business name + what it is, one line, brand accent.",
    "offer": "the PriceBadge pops with the real numbers; oldPrice struck through if a sale.",
    "proof": "the freier-proof: show the math / a concrete reason this is smart, not just cheap.",
    "cta": "the AdEndCard pops and HOLDS to the last frame — WhatsApp/phone + website, tappable.",
}


def _pascal(slug):
    """ad slug 'liat-studio' -> 'LiatStudio' (the composition suffix)."""
    return "".join(p.capitalize() for p in re.split(r"[-_\s]+", slug) if p)


def _next_n(shorts_dir, slug):
    """The next free ad-N index for this slug (ad-1-foo, ad-2-foo, ...)."""
    n = 1
    existing = {d for d in os.listdir(shorts_dir)
                if os.path.isdir(os.path.join(shorts_dir, d)) and d.startswith("ad-")}
    while f"ad-{n}-{slug}" in existing:
        n += 1
    return n


def _build_beats(vo_lines):
    """Derive the beats[] visual timeline from the vo[] lines (each vo line carries a beat tag).
    Each beat's window = its vo line's start..end; the cta beat extends to the format duration
    so the end card holds. Times here are DRAFT estimates — gen_voice_edge rewrites the real
    word times into vo[].words[] and the timing audit re-checks them."""
    beats = []
    for ln in vo_lines:
        beats.append({
            "name": ln["beat"],
            "start_s": round(ln["start"], 2),
            "end_s": round(ln["end"], 2),
            "visual": _BEAT_VISUALS.get(ln["beat"], ""),
        })
    return beats


def _draft_vo(args, lx):
    """Draft the 5 canonical vo[] lines with rough speech-driven windows (~2.7 words/sec + gap).

    These start/end are ESTIMATES so beats.json is structurally complete pre-voice-gen.
    gen_voice_edge.py --nikkud overwrites them with REAL edge-tts word times; the contract's
    timing audit then validates no-overlap / no-dead-tail against the real numbers. The hook is
    tagged beat:"hook" so the hook gate runs. The cta line is last and the cta beat holds >=2s.
    """
    name = args.business
    headline = args.headline
    cta_text = lexicon.cta(args.vertical)
    # A register-correct hook skeleton from the vertical's allowed styles; the craft pass rewrites.
    hook = args.hook or f"{headline}."   # default hook = the offer headline (tight, front-loaded)
    # The proof line must be the freier-proof (show the math — "שווה beats cheap"), written in
    # the vertical's register by the craft pass. We emit a Hebrew TODO, never the English lexicon
    # hint. Address pronoun comes from the vertical (את/אתה/אתם).
    addr = lx.get("address", "אתם")
    proof = args.proof or f"TODO: משפט הוכחה — הראי את החשבון, למה זה שווה ל{addr} (לא סתם זול)."
    lines = [
        ("hook", hook),
        ("intro", f"{name}."),
        ("offer", headline),
        ("proof", proof),
        ("cta", cta_text + "."),
    ]
    vo = []
    t = 0.0
    for beat, text in lines:
        words = text.split()
        # Speech estimate: ~2.7 words/sec, a 0.4s onset buffer, and a per-line floor, so the
        # window is never narrower than the clip (gen_voice_edge atempo-squeezes an over-tight
        # window — the OVERFLOW defect). Gaps are generous (0.5s) so the next line starts only
        # after this line's real speech ends — the no-VO-overlap rule the timing audit enforces.
        dur = max(2.0, len(words) / 2.7 + 0.6)
        vo.append({"beat": beat, "text": text,
                   "start": round(t, 2), "end": round(t + dur, 2)})
        t += dur + 0.5                             # generous inter-line gap (no overlap)
    return vo, t


def build(args):
    lx = lexicon.get(args.vertical)
    slug = args.slug
    shorts_dir = os.path.join(ROOT, "shorts")
    n = _next_n(shorts_dir, slug)
    ad_id = f"ad-{n}-{slug}"
    comp = f"Ad{n}{_pascal(slug)}"
    proj_dir = os.path.join(shorts_dir, ad_id)
    shot_dir = os.path.join(ROOT, "remotion", "src", "shots", f"ad-{n}")
    if os.path.exists(proj_dir) and not args.force:
        sys.exit(f"{proj_dir} already exists — pass --force to overwrite")

    vo, speech_end = _draft_vo(args, lx)
    # Dead-tail rule: the video ends ~2.5-3s after the last spoken word, NOT a round number.
    total = round(speech_end + 2.6, 2)
    beats = _build_beats(vo)
    # the cta beat holds to the end
    beats[-1]["end_s"] = total

    cta_type = args.cta
    beats_json = {
        "id": ad_id,
        "title": args.headline,
        "composition": comp,
        "mode": "ad",
        "language": "he",
        "format": {"width": W, "height": H, "fps": FPS, "durationSec": total},
        "voicePlan": f"edge-tts:{lexicon.voice(args.vertical)} (Hebrew, word-exact, --nikkud via hebrew_pronounce)",
        "ad": {
            "business": {"name": args.business, "vertical": args.vertical,
                         **({"phone": args.phone} if args.phone else {}),
                         **({"whatsapp": args.whatsapp or args.phone} if (args.whatsapp or args.phone) else {}),
                         **({"website": args.website} if args.website else {}),
                         **({"city": args.city} if args.city else {})},
            "offer": {"headline": args.headline, "price": args.price,
                      **({"oldPrice": args.old_price} if args.old_price else {})},
            # A discount/urgency offer legally requires a scope + total-price disclosure
            # (Consumer Protection §15/§2). Auto-add it when a sale is present.
            **({"disclosure": {"scope": args.disclosure_scope,
                               "totalPrice": f"{args.price:g} ₪"}} if args.old_price else {}),
            "cta": {"type": cta_type, "text": lexicon.cta(args.vertical),
                    **({"phoneDisplay": args.phone} if args.phone else {}),
                    **({"website": args.website} if args.website else {})},
            "brand": {"accent": args.accent, "hookStyle": args.hook_style},
        },
        "vo": vo,
        "beats": beats,
    }

    os.makedirs(proj_dir, exist_ok=True)
    os.makedirs(shot_dir, exist_ok=True)

    with open(os.path.join(proj_dir, "beats.json"), "w", encoding="utf-8") as f:
        json.dump(beats_json, f, ensure_ascii=False, indent=2)

    _write_brief(os.path.join(proj_dir, "brief.md"), args, lx, ad_id)
    _write_script(os.path.join(proj_dir, "script.md"), args, lx, beats_json)
    _write_tsx(os.path.join(shot_dir, f"{comp}.tsx"), args, lx, beats_json, comp)

    return ad_id, comp, proj_dir, shot_dir, total


def _write_brief(path, args, lx, ad_id):
    body = f"""# brief.md — {ad_id}

> Scaffolded by tools/new_ad.py from the `{args.vertical}` lexicon. Edit the offer/hook to the
> real business before building. Register is pre-set; do NOT fight it (the lexicon owns it).

## business
- **name:** {args.business}
- **vertical:** {args.vertical} — {lx.get('label','')}
- **city:** {args.city or '—'}
- **phone:** {args.phone or '—'}   **whatsapp:** {args.whatsapp or args.phone or '—'}   **website:** {args.website or '—'}

## offer
- **headline:** {args.headline}
- **price:** {args.price} ₪   **oldPrice:** {args.old_price or '—'}
- **offer structure (lexicon):** {lx.get('offer_structure','')}
- **magic phrases (lexicon):** {' · '.join(lx.get('magic_phrases', [])) or '—'}

## cta
- **type:** {args.cta}   **text (lexicon):** {lexicon.cta(args.vertical)}
- **NEVER (lexicon):** {lexicon.cta_never(args.vertical) or '—'}

## brand
- **accent:** {args.accent}   **hookStyle:** {args.hook_style}

## register (the lexicon owns this)
- **register:** {lx.get('register','')}   **address pronoun:** {lx.get('address','')}
- **gender note:** {lx.get('gender_note','')}
- **edge-tts voice:** {lexicon.voice(args.vertical)}
- **allowed hook styles:** {' · '.join(lx.get('hook_styles', []))}
- **taboos:** {' · '.join(lx.get('taboos', [])) or '—'}

## voice command (Stage 4)
```
.venv-voice312\\Scripts\\python.exe tools/gen_voice_edge.py --beats shorts/{ad_id}/beats.json \\
    --voice {lexicon.voice(args.vertical)} --nikkud --emit-ts remotion/src/shots/ad-{ad_id.split('-')[1]}/vo.gen.ts
```
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)


def _write_script(path, args, lx, bj):
    rows = []
    for ln in bj["vo"]:
        vis = next((b["visual"] for b in bj["beats"] if b["name"] == ln["beat"]), "")
        rows.append(f"| {ln['start']:5.2f}–{ln['end']:5.2f} | {ln['beat']:6} | {ln['text']} | {vis} |")
    table = "\n".join(rows)
    body = f"""# script.md — {bj['id']}

> Draft from tools/new_ad.py. The hook + offer copy are the craft — rewrite them against the
> `{args.vertical}` playbook (`python tools/lexicon.py {args.vertical}`) and lint with
> `python tools/lexicon.py --check {args.vertical} "<line>"`. Gate the hook with
> `python tools/hook_craft.py check {args.vertical} {args.hook_style} "<hook>"`.

**hook style:** {args.hook_style}   **register:** {lx.get('register','')} ({lx.get('address','')})   **voice:** {lexicon.voice(args.vertical)}

| window (est) | beat  | VO (Hebrew) | on screen |
|---|---|---|---|
{table}

The windows above are speech ESTIMATES; `gen_voice_edge.py --nikkud` writes the REAL word
times back into beats.json. Total duration ≈ last-speech-end + ~2.6s (the CTA hold), not a
round number.
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)


def _write_tsx(path, args, lx, bj, comp):
    scenes = ",\n    ".join(
        "{ id: '%s', durationSec: %s, beatId: '%s', visual: '%s', overlays: [] }"
        % (b["name"], b["end_s"] - b["start_s"], b["name"], b["visual"].replace("'", "\\'"))
        for b in bj["beats"])
    body = f"""// {comp}.tsx — SCAFFOLDED by tools/new_ad.py. Compile-ready stub for the /make-ad
// pipeline: scenes over one persistent canvas, RTL Captions at the root, PriceBadge on the
// offer beat, AdEndCard on the cta beat (holds to the last frame). The FILL-ME markers are the
// craft — per-beat visuals follow vidtsx-2d-generator's hard rules (frame-based, monotonic).
// Register with: cd remotion && npm run gen
import React from 'react';
import {{ AbsoluteFill, Sequence, useCurrentFrame }} from 'remotion';
import {{ Captions, SAFE }} from '../../lib/shorts';
import {{ AdEndCard, PriceBadge }} from '../../lib/ads';
import {{ VO }} from './vo.gen';

export const compositionConfig = {{
  id: '{comp}',
  width: {W},
  height: {H},
  fps: {FPS},
  durationInSeconds: {bj['format']['durationSec']},
  defaultProps: {{
    scenes: [
    {scenes}
    ],
  }},
}};

export const {comp}: React.FC<{{ scenes: any[] }}> = ({{ scenes }}) => {{
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{{{ background: '{args.accent}' }}}}>
      {{/* FILL-ME: per-scene visuals. frames inside a <Sequence> are LOCAL:
          local_f = global_s * fps - sequence_from. Check every cue twice. */}}
      {{scenes.map((s, i) => {{
        const from = scenes.slice(0, i).reduce((a, x) => a + x.durationSec, 0) * {FPS};
        return (
          <Sequence key={{s.id}} from={{from}} durationInFrames={{Math.round(s.durationSec * {FPS})}}>
            <AbsoluteFill style={{{{ alignItems: 'center', justifyContent: 'center' }}}}>
              {{/* FILL-ME: the {{s.id}} visual */}}
            </AbsoluteFill>
          </Sequence>
        );
      }})}}
      <Captions lines={{VO}} rtl />
    </AbsoluteFill>
  );
}};
export default {comp};
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)


def main():
    ap = argparse.ArgumentParser(description="Scaffold a Hebrew /make-ad project (template system).",
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("vertical", nargs="?", help="lexicon vertical key (see --list)")
    ap.add_argument("slug", nargs="?", help="business slug, e.g. liat-studio -> ad-N-liat-studio")
    ap.add_argument("--business", help="business name (Hebrew)")
    ap.add_argument("--headline", help="the ONE offer headline (Hebrew)")
    ap.add_argument("--price", type=float, help="offer price in ₪")
    ap.add_argument("--old-price", type=float, help="old price in ₪ (for a sale)")
    ap.add_argument("--disclosure-scope", default="עד גמר המלאי",
                    help="the sale's scope disclosure (Consumer Protection §15/§2), e.g. "
                         "'עד גמר המלאי' / 'ל-30 הראשונות'. Auto-added when --old-price is set.")
    ap.add_argument("--cta", default="whatsapp", choices=["phone", "whatsapp", "both", "visit"])
    ap.add_argument("--phone", help="phone / WhatsApp number (for phone/whatsapp CTA)")
    ap.add_argument("--whatsapp", help="WhatsApp number if different from phone")
    ap.add_argument("--website", help="website / landing page")
    ap.add_argument("--city", help="city")
    ap.add_argument("--accent", default="#E11D48", help="brand accent color (hex)")
    ap.add_argument("--hook-style", default="pain-question",
                    help="hook style — must be in the vertical's allowed hook_styles")
    ap.add_argument("--hook", help="optional explicit hook line (default: the offer headline)")
    ap.add_argument("--proof", help="optional explicit proof line (the freier-proof / show-the-math)")
    ap.add_argument("--list", action="store_true", help="list vertical keys + labels, then exit")
    ap.add_argument("--force", action="store_true", help="overwrite an existing ad-N-<slug> dir")
    args = ap.parse_args()

    if args.list:
        for k, label in lexicon.list_verticals().items():
            print(f"  {k:12} {label}")
        return 0

    if not args.vertical or not args.slug:
        ap.print_help()
        sys.exit("\nerror: need <vertical> <slug> (or --list)")

    # Validate the brief is complete enough to build a real ad (the /make-ad human gate).
    missing = [f"--{k}" for k in ("business", "headline") if not getattr(args, k)]
    if args.price is None:
        missing.append("--price")
    if missing:
        sys.exit(f"brief incomplete — missing: {', '.join(missing)}\n"
                 f"(an offer without a headline+price is not ready to scaffold)")
    if args.cta in ("phone", "whatsapp", "both") and not (args.phone or args.whatsapp):
        sys.exit(f"cta type '{args.cta}' needs --phone (or --whatsapp) for the end card to be tappable")

    # Hook style must be one the vertical allows.
    allowed = lexicon.hooks(args.vertical)
    if allowed and args.hook_style not in allowed:
        print(f"[warn] hook-style '{args.hook_style}' not in {args.vertical}'s allowed {allowed}; "
              f"the hook gate will check against it", file=sys.stderr)

    ad_id, comp, proj_dir, shot_dir, total = build(args)

    # Validate the emitted beats.json against the real contract before declaring success.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import contracts
    beats_path = os.path.join(proj_dir, "beats.json")
    try:
        contracts.validate_ad_beats(beats_path)
        ver = "PASS"
    except Exception as e:
        ver = f"FAIL: {e}"

    print(f"scaffolded {ad_id}  (comp: {comp}, ~{total}s)")
    print(f"  {os.path.relpath(proj_dir, ROOT)}\\brief.md, script.md, beats.json")
    print(f"  {os.path.relpath(os.path.join(shot_dir, comp + '.tsx'), ROOT)}")
    print(f"  contract validate_ad_beats: {ver}")
    print()
    print("next: edit script.md + beats.json (the hook + offer copy are the craft), then")
    print(f"  cd remotion && npm run gen   # register {comp}")
    print(f"  .venv-voice312\\Scripts\\python.exe tools/gen_voice_edge.py --beats shorts/{ad_id}/beats.json \\")
    print(f"      --voice {lexicon.voice(args.vertical)} --nikkud --emit-ts remotion/src/shots/ad-{ad_id.split('-')[1]}/vo.gen.ts")
    return 0 if ver == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
