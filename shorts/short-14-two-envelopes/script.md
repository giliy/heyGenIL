# short-14 · Probability — "The Two Envelopes Paradox"

Format: 1080×1920 @ 30fps, ~38s. 100% TSX. Voice: ElevenLabs (Liam), per-line via
tools/gen_voice.py. Reuses `remotion/src/lib/prob.tsx` (Door→Envelope, Chip, Brace, BigPct,
TallyGrid) + the shorts kit. Fits the prob/algo/math series (short-2, short-3, short-5).

## The paradox (verified — textbook two-envelopes)

Two sealed envelopes. One holds **exactly double** the other. You pick one. Before you open
it you're offered: **switch?**

**The switching argument (the fallacy):** "Say mine has $X$. The other has $X/2$ or $2X$,
fifty-fifty. So its expected value is ½·($X/2$) + ½·($2X$) = **1.25X** — more than $X$. So
switching is always better." 1.25X says you should switch *forever* — absurd by symmetry.

**The flaw:** the two cases aren't fifty-fifty once you're holding $X$, and the argument treats
both outcomes symmetrically while conditioning on $X$. Concretely, the pair is {$10, $20}:
- You hold **$10** → switch → you gain **+$10**.
- You hold **$20** → switch → you lose **−$10**.

Both picks are equally likely, so the expected gain from switching is
(+$10 + −$10)/2 = **$0**. No free lunch — switching changes nothing. The 1.25X sleight hides
that "2X when you're low" and "X/2 when you're high" are the *same* $10 swing, not a bonus.

Fixed walkthrough pair so every scene is consistent: the envelopes hold **$10 and $20**.

## Beat sheet

| Beat | Time | On screen | VO |
|------|------|-----------|-----|
| HOOK | 0–3.4s | Frame 0 composed: two sealed envelopes side by side, left one stamped "YOURS". Kicker "ONE HAS DOUBLE". Title "TWO ENVELOPES / SWITCH OR KEEP?". Punch-in settle. | "Two envelopes. One has double the other. Should you switch?" |
| SETUP | 3.4–12.6s | Kicker legend "$10 and $20". Left envelope → "YOURS" + "$X" chip. A "? $2X or $X/2" brace appears over the right envelope. | "Mine has some amount — call it X." / "So yours has half X, or double X. Fifty-fifty." |
| TRICK | 12.6–20.4s | The EV equation builds on the right envelope: ½·(X/2) + ½·(2X) → "= 1.25X" pops teal, an up-arrow + "ALWAYS SWITCH?" glow. PauseCard "SWITCH?" countdown. | "Half of half-X, plus half of two-X…" / "…is one-point-two-five X. Switch and you win? Pause." |
| FLAW | 20.4–30.4s | The paradox cracks: "1.25X" splits apart. The pair resolves to a concrete "$10 / $20". Two rows stack: "hold $10 → +$10" (teal) and "hold $20 → −$10" (pink). They cancel to "= $0". | "But it's the same ten dollars." / "Win it when you're low. Lose it when you're high." / "Those cancel. Switching gains you nothing." |
| PAYOFF | 30.4–35.0s | Big clean takeaway card: "NO FREE LUNCH" — "$0 EXPECTED GAIN". The 1.25X ghost fades. | "One-twenty-five was an illusion. The math cancels out." |
| LOOP | 35.0–38.0s | Back to the two sealed envelopes, "YOURS" on the left, kicker "ONE HAS DOUBLE" — rhymes with frame 0 and dissolves into the intro. No CTA. | "Two envelopes. Symmetric. Now you know." |

## Production notes

- Persistent canvas = the **two envelopes**; scenes annotate/resolve them on one timeline
  (setup tags X, trick builds the EV sum, flaw splits it into the concrete $10/$20 rows, loop
  returns to the sealed pair) — continuity, not cuts.
- Every cue syncs to its VO word (the "1.25X" pop on "one-point-two-five", the "+$10 / −$10"
  rows on "win it / lose it", the "= $0" on "cancel"). Cue frames retuned to REAL word times
  after Stage 4.
- VO windows estimated ~2.7 words/sec (matches short-2/short-5 pacing) so no line needs an
  atempo squeeze.
- Outro: no engagement-CTA. Ends on the payoff; the LOOP returns to the sealed-pair hook state.
- SFX plan (Stage 5), library-first: envelope slide (whoosh-soft), the X chip lock
  (ui-click-soft), the EV build ticks (ui-click-soft ×2), the 1.25X pop (pop-reveal), the crack
  into two rows (impact-soft), the $0 cancel (chime-reward). The `ui-toggle-on` motif fits the
  literal "switch".
