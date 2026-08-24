#!/usr/bin/env python3
"""contracts.py — validators for the machine-readable contracts the agents hand off.

The whole point of the architecture is narrow seams: agents exchange PATH-refs + small JSON,
never pixels/audio/TSX. These validators keep the seams honest so a malformed handoff fails
fast at the boundary instead of surfacing as a confusing error two agents later.

Validators:
  validate_beats(path)          -> beats.json (existing) shape
  validate_ad_beats(path)       -> beats.json for mode:"ad" (base shape + the ad{} block)
  validate_asset_manifest(p)    -> asset-manifest.json (pixel -> build)
  validate_qa_contract(p)       -> qa-contract.json (build -> qa)
  validate_qa_verdicts(p)       -> qa-verdicts.json (qa -> orchestrator)
  validate_sfx_plan(p)          -> sfx-plan.json (existing) shape

Each raises ValueError with a precise message on failure, or returns None on success.
Run standalone:  python tools/contracts.py <beats|ad-beats|manifest|qa-contract|qa-verdicts|sfx> <file>
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)  # so `import nikkud_data` resolves when run as tools/contracts.py


def _load(path):
    if not os.path.exists(path):
        raise ValueError(f"missing file: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _check(cond, msg):
    if not cond:
        raise ValueError(msg)


def _abs(p, base=ROOT):
    return p if os.path.isabs(p) else os.path.join(base, p)


def validate_beats(path):
    d = _load(path)
    # `vo` is universal across tracks — it drives voice gen (gen_voice*.py reads vo[] lines).
    # `audio` is NOT required: the voice source lives in `voiceStatus`/`voicePlan` + `vo[]`
    # (16 of 18 existing shots omit `audio` — don't fail them retroactively).
    for k in ("id", "title", "format", "vo"):
        _check(k in d, f"beats.json missing key '{k}'")
    _check(isinstance(d["vo"], list) and len(d["vo"]) > 0, "beats.json 'vo' must be a non-empty list")
    for line in d["vo"]:
        _check(isinstance(line.get("text"), str) and line["text"], "vo[] line needs non-empty 'text'")
    # `beats[]` (the TSX-track visual timeline) is required for make-short but NOT for the
    # vox/collage track, whose scene timeline lives in scenes.json instead. Validate it if present.
    # Accept EITHER the canonical name/start_s/end_s OR the older id/start/end form (short-16
    # and earlier shots predate the stricter schema — don't break them retroactively).
    if "beats" in d:
        _check(isinstance(d["beats"], list) and len(d["beats"]) > 0, "beats.json 'beats' must be a non-empty list")
        for b in d["beats"]:
            has_new = "name" in b and "start_s" in b and "end_s" in b
            has_old = "id" in b and "start" in b and "end" in b
            _check(has_new or has_old, f"beats[] entry missing name/start_s/end_s (or legacy id/start/end): {b}")
    return None


# =============================================================================
# AD CONTRACT — mode:"ad" beats.json for /make-ad. Satisfies the base beats shape first
# (id/title/format/audio/vo), then layers the ad{} block. An ad's payoff IS the conversion
# CTA, so this validator exists to make sure every ad carries a real, tappable one.
#
#   mode: "ad"                         — required; switches the brand-style overrides on
#   language: "he"                     — required (RTL Hebrew); voice/RTL keyed off it
#   ad.business:  {name, vertical}     — name + one of the lexicon verticals (+ optional
#                                        phone/whatsapp/website/city for the end card)
#   ad.offer:     {headline, price}    — price numeric, currency defaults to ₪; optional
#                                        oldPrice/discountPct/urgency
#   ad.cta:       {type, text}         — type ∈ phone|whatsapp|both|visit; a phoneDisplay
#                                        or whatsapp number required for those types
#   ad.brand:     optional {accent, hookStyle, logo}
#   beats[] in an ad use the canonical name/start_s/end_s (validated by the base check above).
#
# The CTA beat must exist in beats[] and must hold — an end card that fades out can't be tapped.
# =============================================================================
# Vertical keys are the single source of truth in tools/lexicons.json (the /make-ad Stage 1
# lexicon). Derive _AD_VERTICALS from it so the contract and the lexicon can never drift apart.
def _load_ad_verticals():
    lex = os.path.join(HERE, "lexicons.json")
    try:
        with open(lex, encoding="utf-8") as f:
            d = json.load(f)
        keys = {k for k, v in d.items() if not k.startswith("_") and isinstance(v, dict)}
        if keys:
            return keys
    except Exception:
        pass
    # Fallback if lexicons.json is missing/corrupt — keep the validator working.
    return {"restaurant", "beauty", "salon", "barbershop", "realestate", "fitness",
            "trades", "clinic", "retail", "saas", "other"}


_AD_VERTICALS = _load_ad_verticals()
_AD_CTA_TYPES = {"phone", "whatsapp", "both", "visit"}


def validate_ad_beats(path):
    d = _load(path)
    validate_beats(path)  # base shape first — id/title/format/audio/vo/beats

    _check(d.get("mode") == "ad", "ad beats.json must set mode:\"ad\" (drives the style overrides)")
    _check(d.get("language") == "he", "ad beats.json must set language:\"he\" (RTL Hebrew)")

    ad = d.get("ad")
    _check(isinstance(ad, dict), "ad beats.json missing the 'ad' block")

    biz = ad.get("business")
    _check(isinstance(biz, dict), "ad.business must be an object")
    _check(isinstance(biz.get("name"), str) and biz["name"], "ad.business needs a non-empty 'name'")
    _check(biz.get("vertical") in _AD_VERTICALS,
           f"ad.business.vertical must be one of {sorted(_AD_VERTICALS)}: {biz.get('vertical')}")

    offer = ad.get("offer")
    _check(isinstance(offer, dict), "ad.offer must be an object")
    _check(isinstance(offer.get("headline"), str) and offer["headline"], "ad.offer needs a non-empty 'headline'")
    price = offer.get("price")
    _check(isinstance(price, (int, float)) and price >= 0, "ad.offer.price must be a non-negative number")
    old = offer.get("oldPrice")
    if old is not None:
        _check(isinstance(old, (int, float)) and old > price, "ad.offer.oldPrice must be a number > price")
    dp = offer.get("discountPct")
    if dp is not None:
        _check(isinstance(dp, (int, float)) and 0 < dp < 100, "ad.offer.discountPct must be in (0,100)")

    cta = ad.get("cta")
    _check(isinstance(cta, dict), "ad.cta must be an object")
    _check(cta.get("type") in _AD_CTA_TYPES, f"ad.cta.type must be one of {sorted(_AD_CTA_TYPES)}: {cta.get('type')}")
    _check(isinstance(cta.get("text"), str) and cta["text"], "ad.cta needs a non-empty 'text'")
    if cta["type"] in ("phone", "both"):
        _check(biz.get("phone") or biz.get("whatsapp"),
               "ad.cta.type phone/both requires business.phone or business.whatsapp")
    if cta["type"] in ("whatsapp", "both"):
        _check(biz.get("whatsapp") or biz.get("phone"),
               "ad.cta.type whatsapp/both requires business.whatsapp (or phone to convert)")

    # The CTA beat must exist and hold (no instant fade-out) so the end card is tappable.
    beats = d.get("beats", [])
    cta_beats = [b for b in beats if (b.get("name") or b.get("id")) == "cta"]
    _check(cta_beats, "ad beats[] must include a 'cta' beat (the end card IS the payoff)")
    cb = cta_beats[0]
    dur = (cb.get("end_s") or cb.get("end")) - (cb.get("start_s") or cb.get("start"))
    _check(dur >= 2.0, f"ad 'cta' beat should hold >= 2.0s so the CTA is tappable (got {dur:.2f}s)")

    # HOOK GATE — "hook lands <2s and hook is a good hook" was the harness's fatal ad gap
    # (pro-quality audit finding A2): a prose rule with no enforcement. The hook-craft engine
    # owns the numeric checks (land-time, concision, style-match, taboo lint); we run it here so
    # it fires on EVERY ad build, not only when the skill remembers. Conditional like the timing
    # audit: it only gates when a vo[] line is tagged beat:"hook" — drafts that haven't split the
    # hook out yet are caught by the skill's Stage-1 `hook_craft.py check-beats` step instead.
    _ad_hook_audit(d)

    # TIMING AUDIT — the two defects users actually HEAR: VO overlap and the dead tail.
    # These are numeric checks against generated data (real per-word times), not prose —
    # so they live here where they run every time, not in the skill where they can be skipped.
    _ad_timing_audit(d, beats)

    # DISCLOSURE AUDIT — Israeli Consumer Protection Law §15/§2/§7a (P1 #22). A legal
    # misstep kills trust and a paid product; the rules existed only in prose. Unconditional:
    # disclosure is a legal must, not data-dependent.
    _ad_disclosure_audit(d)
    return None


# --- ad hook gate ------------------------------------------------------------
def _ad_hook_audit(d):
    """Hard-fail an ad whose hook fails the hook-craft gate (land-time / style / taboo).

    Conditional, matching the other audits: if no vo[] line is tagged beat:"hook", the hook
    hasn't been split out yet and the skill's Stage-1 hook_craft step is the gate — we stay
    silent here rather than fail drafts that are still being structured. The moment a hook IS
    tagged (every real ad build), the gate runs and a late/generic/over-long hook hard-fails.

    hook_craft imports nothing from contracts, so this import can't cycle.
    """
    hook_lines = [l for l in d.get("vo", []) if l.get("beat") == "hook"]
    if not hook_lines:
        return
    biz = (d.get("ad") or {}).get("business") or {}
    vertical = biz.get("vertical")
    if not vertical:
        return  # the vertical check above already flags a missing/invalid vertical
    try:
        import hook_craft
    except Exception:
        return  # engine not importable (e.g. contracts run from another cwd) — don't block builds
    hook = hook_lines[0]
    words = hook.get("words") or []
    word_ends = [w.get("end") for w in words if w.get("end") is not None]
    ok, failures, _warnings, _info = hook_craft.lint_hook(
        vertical,
        hook.get("text", ""),
        style=(d.get("ad") or {}).get("brand", {}).get("hookStyle"),
        word_end_times=word_ends or None,
        hook_start_s=float(hook.get("start", 0.0)),
    )
    _check(ok, "ad hook gate FAILED — " + " | ".join(failures))


# --- ad timing audit ---------------------------------------------------------
# Dead-tail bounds: the video should end a short tappable beat after the last spoken word —
# long enough for the CTA card to be tapped, not so long the last frame sits frozen in silence.
_TAIL_MIN, _TAIL_MAX = 1.0, 4.0


def _vo_windows(d):
    """yield (index, windowStart, windowEnd, speechEnd|None) per vo[] line, in timeline order."""
    lines = sorted(d.get("vo", []), key=lambda l: (l.get("start", 0.0), l.get("end", 0.0)))
    for i, l in enumerate(lines):
        ws, we = l.get("start"), l.get("end")
        words = l.get("words") or []
        speech_end = max((w.get("end", 0.0) for w in words), default=None)
        yield i, ws, we, speech_end


def _ad_timing_audit(d, beats):
    """Hard-fail on VO overlap + dead tail when the data exists to check them.

    vo[].words[] real end-times exist only AFTER voice gen. So this is a CONDITIONAL gate:
    it hard-fails the moment real speech data is present and overlapping / mistimed, and stays
    silent on drafts that have no word-times yet (those get re-validated after voice gen anyway).
    Overlap of *scheduled windows* is always a hard fail — windows must never overlap regardless.
    """
    lines = list(_vo_windows(d))

    # 1. No overlap — gated on REAL word-times only. Windows are scheduling targets and may
    #    legitimately touch/overlap (slack); what must never overlap is the actual audio. So this
    #    fires only once voice gen has written vo[].words[], and only when line N's real speech
    #    runs past line N+1's start (the exact "bleeds under the next beat" bug).
    for (i, s, e, se), (j, s2, e2, se2) in zip(lines, lines[1:]):
        if se is not None and s2 is not None:
            _check(s2 >= se - 1e-6,
                   f"VO overlap: vo[{j}] starts {s2}s but vo[{i}] speech ends {se:.3f}s — line {i} "
                   f"bleeds under line {j}. Widen the gap past the real word-times (vo[].words[].end).")

    # 2. No dead tail — video ends ~2.5s after the LAST spoken word, not on a round number.
    #    Needs both a real last-speech-end (word-times) and a declared total duration.
    last_se = next((se for _, _, _, se in reversed(lines) if se is not None), None)
    total = (d.get("format") or {}).get("durationSec")
    if last_se is not None and isinstance(total, (int, float)):
        tail = total - last_se
        _check(tail >= _TAIL_MIN - 1e-6,
               f"dead-tail/audio cut: total {total}s ends BEFORE the last spoken word "
               f"(last speech {last_se:.3f}s, tail {tail:.2f}s). Total must clear the voice.")
        _check(tail <= _TAIL_MAX + 1e-6,
               f"dead tail: total {total}s runs {tail:.2f}s past the last spoken word "
               f"({last_se:.3f}s) — a frozen silent frame. Retime to last-speech + ~{_TAIL_MIN}-{_TAIL_MAX}s.")


# --- ad disclosure gate (Israeli Consumer Protection Law §15/§2/§7a) ---------
# A discount/urgency offer must carry a scope + total-price disclosure so the price is not
# misleading (§15 — misleading advertising; §2 — full disclosure). A native/influencer ad
# must be labeled שת"פ ממומן (sponsored content) under §7a. These existed only in prose.
_SPONSORED_MARKERS = ("שת\"פ", "שת״פ", "בשיתוף", "ממומן", "sponsored")


def _vo_text(d):
    return " ".join((l.get("text") or "") for l in d.get("vo", []) or [])


def _ad_disclosure_audit(d):
    """Hard-fail an ad that needs a disclosure and lacks one. Unconditional (legal must).

    §15/§2 — urgency/discount/oldPrice present -> the offer must state scope + total price.
    §7a      — the ad declares itself native/influencer -> it must be labeled שת"פ ממומן.
    """
    ad = d.get("ad") or {}
    offer = ad.get("offer") or {}
    disclosure = d.get("disclosure") or ad.get("disclosure") or {}
    body_text = _vo_text(d) + " " + json.dumps(disclosure, ensure_ascii=False)

    has_promo = bool(
        offer.get("urgency") or offer.get("oldPrice") or offer.get("discountPct")
    )

    # §15/§2 — a promotion (discount / old price / urgency) must disclose scope + total price.
    if has_promo:
        # Require an explicit disclosure record OR an in-copy scope/total statement.
        scope_ok = bool(disclosure.get("scope") or disclosure.get("totalPrice") or disclosure.get("terms"))
        # Heuristic fallback: the copy itself states the scope ("ל-30 הראשונים", "עד גמר המלאי").
        copy_has_scope = any(m in body_text for m in ("עד גמר", "המלאי", "כמות", "ללקוחות", "מוגבל", "תוקף"))
        _check(
            scope_ok or copy_has_scope,
            "disclosure (§15/§2): the offer uses urgency/oldPrice/discountPct but has no "
            "scope/total-price disclosure. Add a `disclosure` block with 'scope'/'terms'/'totalPrice', "
            "or state the scope in the copy (e.g. 'עד גמר המלאי' / 'ל-30 הראשונים').",
        )

    # §7a — a native/influencer placement must be labeled שת"פ ממומן (sponsored content).
    placement = (ad.get("placement") or d.get("placement") or "").lower()
    is_native = bool(disclosure.get("sponsored")) or placement in ("native", "influencer", "ugc", "sponsored")
    if is_native:
        labeled = any(m in body_text for m in _SPONSORED_MARKERS)
        _check(
            labeled,
            "disclosure (§7a): this is a native/influencer ad but is not labeled שת\"פ ממומן. "
            "Add the sponsored-content label to the copy or a disclosure block.",
        )

# =============================================================================
# READING CONTRACT — mode:"reading" beats.json for /make-reading-short. Satisfies the base
# beats shape first (id/title/format/vo), then layers the reading{} block. A reading short's
# promise is the on-screen pointed letter/syllable highlighting in EXACT sync with the sound
# (one level finer than whole-word), so this validator guards the per-grapheme unit schedule.
#
#   mode: "reading"                    — required
#   language: "he"                     — required (RTL pointed Hebrew)
#   reading.nikkud                     — key into nikkud_data.CURRICULUM (single source of truth)
#   reading.progression                — [isolated,cv,blend,word] in order, or a suffix;
#                                        `isolated` is ALWAYS present and ALWAYS first
#   beats[] must carry the 4 canonical beats (teach-isolated/teach-cv/blend/read-word) in
#                                        progression order (a step dropped from progression may
#                                        drop its beat; the present ones must still be ordered)
#   vo[].units[] = [{g,start,end}]     — OPTIONAL per line; the highlight schedule. When present:
#                                        numeric start<end, sorted, non-overlapping, ⊆ parent
#                                        line span. Once ANY line has units, teach-isolated /
#                                        teach-cv lines may NOT be unit-less (blend/word may).
# =============================================================================
_READING_PROGRESSION = ["isolated", "cv", "blend", "word"]
# canonical beat name that realizes each progression step
_READING_BEAT_FOR = {"isolated": "teach-isolated", "cv": "teach-cv", "blend": "blend", "word": "read-word"}


def _load_reading_nikkud_keys():
    try:
        import nikkud_data
        return set(nikkud_data.keys())
    except Exception:
        return set()


_READING_NIKKUD_KEYS = _load_reading_nikkud_keys()


def validate_reading_beats(path):
    d = _load(path)
    validate_beats(path)  # base shape first — id/title/format/vo/beats
    return validate_reading_beats_dict(d)


def validate_reading_beats_dict(d):
    """In-memory overload of validate_reading_beats: validate an already-parsed dict.

    The path-based wrapper delegates here so tools/make_reading.py can validate the
    assembled beats.json in memory (no temp file) before writing it. The base-shape check
    (id/title/format/vo/beats) is re-run here on the dict so a direct dict caller gets the
    same gate without going through the file."""
    if not isinstance(d, dict):
        raise ValueError("reading beats must be a JSON object")
    # base shape on the dict (mirrors validate_beats, minus the file read)
    for k in ("id", "title", "format", "vo"):
        _check(k in d, f"beats.json missing key '{k}'")
    _check(isinstance(d["vo"], list) and len(d["vo"]) > 0, "beats.json 'vo' must be a non-empty list")
    for line in d["vo"]:
        _check(isinstance(line.get("text"), str) and line["text"], "vo[] line needs non-empty 'text'")
    if "beats" in d:
        _check(isinstance(d["beats"], list) and len(d["beats"]) > 0, "beats.json 'beats' must be a non-empty list")
        for b in d["beats"]:
            has_new = "name" in b and "start_s" in b and "end_s" in b
            has_old = "id" in b and "start" in b and "end" in b
            _check(has_new or has_old, f"beats[] entry missing name/start_s/end_s (or legacy id/start/end): {b}")

    _check(d.get("mode") == "reading", "reading beats.json must set mode:\"reading\"")
    _check(d.get("language") == "he", "reading beats.json must set language:\"he\" (RTL pointed Hebrew)")

    reading = d.get("reading")
    _check(isinstance(reading, dict), "reading beats.json missing the 'reading' block")

    nk = reading.get("nikkud")
    _check(isinstance(nk, str) and nk, "reading.nikkud must be a non-empty string key")
    if _READING_NIKKUD_KEYS:
        _check(nk in _READING_NIKKUD_KEYS,
               f"reading.nikkud must be a key in nikkud_data.CURRICULUM: {nk!r} "
               f"(known: {sorted(_READING_NIKKUD_KEYS)})")

    # progression: the 4 steps in order, or a suffix — but isolated always present + first.
    prog = reading.get("progression")
    _check(isinstance(prog, list) and prog, "reading.progression must be a non-empty list")
    _check(prog[0] == "isolated",
           f"reading.progression must start with 'isolated' (always first): {prog}")
    _check(all(p in _READING_PROGRESSION for p in prog),
           f"reading.progression steps must be drawn from {_READING_PROGRESSION}: {prog}")
    idx = [_READING_PROGRESSION.index(p) for p in prog]
    _check(idx == sorted(idx) and len(set(idx)) == len(idx),
           f"reading.progression must be the 4 steps in order (or a suffix, no repeats): {prog}")

    # the canonical beats must appear in beats[] in progression order.
    beats = d.get("beats", [])
    names = [b.get("name") or b.get("id") for b in beats]
    want_beats = [_READING_BEAT_FOR[p] for p in prog]            # only steps in this video's progression
    pos = []
    for wb in want_beats:
        _check(wb in names, f"reading beats[] must include a '{wb}' beat (progression step)")
        pos.append(names.index(wb))
    _check(pos == sorted(pos),
           f"reading canonical beats must appear in progression order {want_beats}; got order {names}")

    # conditional units audit — only once voice gen has written vo[].units[] somewhere.
    _reading_units_audit(d)
    # conditional call-and-response pause audit — the kids differentiation.
    _reading_call_pause_audit(d)
    return None


def _beat_of_line(line):
    return line.get("beat") or ""


def _reading_units_audit(d):
    """Validate vo[].units[] when present. CONDITIONAL: drafts with no units anywhere pass
    silently (units are written by gen_voice_reading.py); the moment ANY line carries units,
    teach-isolated / teach-cv lines must too, and every unit must be well-formed."""
    vo = d.get("vo", [])
    any_units = any(isinstance(l.get("units"), list) and l["units"] for l in vo)

    for li, line in enumerate(vo):
        units = line.get("units")
        if units is None:
            continue
        _check(isinstance(units, list), f"vo[{li}].units must be a list")
        ls, le = line.get("start"), line.get("end")
        prev_end = None
        for ui, u in enumerate(units):
            _check(isinstance(u.get("g"), str) and u["g"],
                   f"vo[{li}].units[{ui}] needs a non-empty 'g' (the displayed grapheme)")
            us, ue = u.get("start"), u.get("end")
            _check(isinstance(us, (int, float)) and isinstance(ue, (int, float)),
                   f"vo[{li}].units[{ui}] start/end must be numeric: {u}")
            _check(us < ue, f"vo[{li}].units[{ui}] must have start<end: {us} !< {ue}")
            if prev_end is not None:
                _check(us >= prev_end - 1e-6,
                       f"vo[{li}].units[{ui}] overlaps/unsorted: start {us} < prev end {prev_end}")
            if isinstance(ls, (int, float)) and isinstance(le, (int, float)):
                _check(us >= ls - 1e-6 and ue <= le + 1e-6,
                       f"vo[{li}].units[{ui}] [{us},{ue}] must be ⊆ parent line span [{ls},{le}]")
            prev_end = ue

    if any_units:
        for li, line in enumerate(vo):
            b = _beat_of_line(line)
            if b in ("teach-isolated", "teach-cv"):
                _check(isinstance(line.get("units"), list) and line["units"],
                       f"vo[{li}] beat '{b}' must carry units[] once voice data exists "
                       f"(the sub-word highlight schedule is the product's promise)")


# The kids differentiator is a genuine engineered pause: the on-screen prompt asks the child
# ("תורכם! / you!"), then WAITS 2-4s for them to answer before the next beat. That pause is
# the Ms. Rachel / SLP method, and the repo's calm-pacing differentiator — if it gets trimmed
# to <~1.5s the video reads rushed and the participation is lost. Nothing enforced this before.
_CALL_PAUSE_MIN = 2.0   # s of real silence between the call prompt's speech and the next line
_CALL_PAUSE_MAX = 5.0   # beyond this the video drags


def _reading_call_pause_audit(d):
    """Conditional gate: the call-response beat's REAL silent pause (question-end -> next
    line's first spoken word) must be a genuine 2-4s. Gated on real word-times exactly like
    _ad_timing_audit: silent on drafts with no words[] yet, hard-fails once voice gen has
    written real word-times and the pause was trimmed/never created."""
    vo = d.get("vo", [])
    if not isinstance(vo, list) or not vo:
        return
    lines = sorted(vo, key=lambda l: (l.get("start", 0.0), l.get("end", 0.0)))
    # locate the call-response prompt line
    call_idx = None
    for i, l in enumerate(lines):
        if _beat_of_line(l) == "call-response":
            call_idx = i
            break
    if call_idx is None:
        return  # no call beat — nothing to enforce (default-generated call always exists, but be safe)
    call = lines[call_idx]
    if call_idx + 1 >= len(lines):
        return  # call is the last line (no response window to check — fine, no answer to wait for)
    nxt = lines[call_idx + 1]

    words = call.get("words") or []
    nxt_words = nxt.get("words") or []
    # only enforce once REAL speech data exists (post voice-gen)
    if not words or not nxt_words:
        return
    call_speech_end = max((w.get("end", 0.0) for w in words), default=None)
    nxt_speech_start = min((w.get("start", 0.0) for w in nxt_words), default=None)
    if call_speech_end is None or nxt_speech_start is None:
        return
    pause = nxt_speech_start - call_speech_end
    _check(pause >= _CALL_PAUSE_MIN - 1e-6,
           f"call-and-response pause too short: the '{_beat_of_line(call)}' prompt ends at "
           f"{call_speech_end:.2f}s but the next line starts at {nxt_speech_start:.2f}s — only "
           f"{pause:.2f}s of silence for the child to answer (need {_CALL_PAUSE_MIN}-{_CALL_PAUSE_MAX}s). "
           f"This is the calm, participatory kids differentiator — do not trim it.")
    _check(pause <= _CALL_PAUSE_MAX + 1e-6,
           f"call-and-response pause too long: {pause:.2f}s between the prompt and the next "
           f"line drags (want {_CALL_PAUSE_MIN}-{_CALL_PAUSE_MAX}s).")


def validate_asset_manifest(path):
    d = _load(path)
    for k in ("project", "track", "layers", "clips", "hero", "cost"):
        _check(k in d, f"asset-manifest missing key '{k}'")
    for lyr in d["layers"]:
        _check("id" in lyr and "file" in lyr, f"layers[] entry needs id+file: {lyr}")
        _check(os.path.exists(_abs(lyr["file"])), f"layer file missing: {lyr['file']}")
    for c in d["clips"]:
        _check("id" in c and "file" in c, f"clips[] entry needs id+file: {c}")
        _check(os.path.exists(_abs(c["file"])), f"clip file missing: {c['file']}")
    if d.get("hero"):
        _check(os.path.exists(_abs(d["hero"])), f"hero file missing: {d['hero']}")
    return None


def validate_qa_contract(path):
    d = _load(path)
    for k in ("compId", "master", "frames", "loop", "scale", "jpegQuality"):
        _check(k in d, f"qa-contract missing key '{k}'")
    _check(os.path.exists(_abs(d["master"])), f"qa-contract master missing: {d['master']}")
    _check(isinstance(d["frames"], list) and len(d["frames"]) > 0, "qa-contract frames[] must be non-empty")
    for fr in d["frames"]:
        _check("f" in fr and "at" in fr, f"frames[] entry needs f+at: {fr}")
        _check(isinstance(fr["f"], int), f"frames[] 'f' must be an int: {fr}")
    _check("f0" in d["loop"] and "flast" in d["loop"], "qa-contract loop needs f0+flast")
    return None


def validate_qa_verdicts(path):
    d = _load(path)
    for k in ("compId", "verdict", "perFrame", "loop_match", "issues"):
        _check(k in d, f"qa-verdicts missing key '{k}'")
    _check(d["verdict"] in ("PASS", "FAIL"), f"qa-verdicts verdict must be PASS/FAIL: {d['verdict']}")
    _check(isinstance(d["perFrame"], list), "qa-verdicts perFrame must be a list")
    for pf in d["perFrame"]:
        _check("f" in pf and "pass" in pf, f"perFrame[] entry needs f+pass: {pf}")
    return None


def validate_sfx_plan(path):
    d = _load(path)
    for k in ("master", "master_fps", "catalog", "render", "events"):
        _check(k in d, f"sfx-plan missing key '{k}'")
    _check("out" in d["render"] and "end_s" in d["render"], "sfx-plan render needs out+end_s")
    _check(isinstance(d["events"], list), "sfx-plan events must be a list")
    for e in d["events"]:
        _check("at_s" in e and "sfx_id" in e, f"events[] entry needs at_s+sfx_id: {e}")
    return None


_VALIDATORS = {
    "beats": validate_beats,
    "ad-beats": validate_ad_beats,
    "reading-beats": validate_reading_beats,
    "manifest": validate_asset_manifest,
    "qa-contract": validate_qa_contract,
    "qa-verdicts": validate_qa_verdicts,
    "sfx": validate_sfx_plan,
}


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in _VALIDATORS:
        sys.exit("usage: python tools/contracts.py <beats|ad-beats|reading-beats|manifest|qa-contract|qa-verdicts|sfx> <file>")
    kind, path = sys.argv[1], sys.argv[2]
    try:
        _VALIDATORS[kind](path)
        print(f"OK: {kind} <- {path}")
    except ValueError as e:
        sys.exit(f"CONTRACT FAIL [{kind}]: {e}")


if __name__ == "__main__":
    main()
