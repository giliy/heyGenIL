# short-17-sign — רושם (Hebrew digital-signature demo)

A ~11s, $0 free-tier **test video** proving the upgraded Hebrew pipeline end-to-end:
edge-tts Hebrew voice → real word timings → RTL **kinetic** captions (Rubik) → a
Lottie decoration + motion helpers — all at zero cost, in a fresh folder.

## Beats (from beats.json)

1. **hook (0–3.6s)** — pain headline: "צריך לחתום על מסמך דחוף?" Red X over a paper glyph.
2. **pain (3.6–6.8s)** — "בלי מדפסת. בלי סריקה. בלי ריצה לדואר." A signature stroke
   draws itself (motion path) with a sparkles accent at the pen tip.
3. **payoff (6.8–10.6s)** — "רושם חותם בעשרים שניות. חוקי ובטוח." checkmark-circle
   Lottie stamps in beside the signature. Clean end card (no CTA outro per brand.md).
4. **loop (10.6–11s)** — restore to frame-0 so it loops cleanly.

## Pipeline

- Voice: `tools/gen_voice_edge.py --voice he-IL-AvriNeural` → real word boundaries
  into beats.json + `vo.gen.ts`. (Fallback aligner: `--lang he` — the follow-up threaded
  through gen_voice.py / align_words.py — is the offline insurance.)
- Captions: `KineticCaptions` (lib/kinetic.tsx), RTL, `FONT_HEBREW_CAPTION` (Rubik),
  ktiv maleh (stripNikkud on).
- Decoration: `LibraryLottie id="checkmark-circle"` + `id="sparkles"`.
- Motion: `moveAlongPath` for the signature stroke; `wobble` micro-jitter on the glyph.

This folder exists ONLY to validate the free-tier Hebrew upgrade — it is not a real
product short.
