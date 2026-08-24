# read-1-kamatz — script.md (beat sheet)

**Video:** בּוּ מְלַמֵּד קָמָץ — *Bu teaches Kamatz* · mode:`reading` · language:`he` · ~34s · 1080x1920@30
**Nikkud:** קָמָץ (kamatz), sound /a/, sign **בָּ**
**Register:** ages **5–7** — short directive prompts + call-and-response, **NOT toddler cooing**
(master plan §1.4 register raise; the character/voice/catchphrase stay, the sentence shape grows up).
**Loop:** relaxed (`loop:false`) — a one-shot lesson; the call-and-response is the payoff, not a loop.
**CTA:** none (reading inherits mode:"kids" no-CTA).

Each beat: **on screen** · **VO (pointed Hebrew, edge-tts he-IL-HilaNeural)** · **highlight**.

| # | beat | t (s) | on screen | VO | highlight |
|---|------|-------|-----------|----|-----------|
| 1 | hook | 0–2 | frame-0 composed: בּוּ tile + the huge target sign **בָּ** already visible; warm kids bg | בּוּ בּוּ! הַיּוֹם לוֹמְדִים קָמָץ! | whole-word |
| 2 | teach-isolated | 2–8 | `GraphemeTile` **בָּ** huge, kamatz sign in its stable color; בּוּ points at it | זֶה קָמָץ. בָּ! | **grapheme pop in sync** (units[]) — the whole pointed letter lights when "ba" sounds |
| 3 | teach-cv | 8–16 | `SyllableTile`s **בָּ מָּ קָּ**, one at a time; בּוּ touches each | בָּ! מָּ! קָּ! | each צירוף pops **as spoken** (units[], touch-and-say) |
| 4 | blend | 16–26 | the two syllable tiles **slide together** → **בָּבָּא**; highlight sweeps across | בָּ… בָּא… בָּבָּא! | sweep across syllables (stitched units[], back-to-back = continuous blending) |
| 5 | read-word | 26–32 | whole word **בָּבָּא**; בּוּ celebrates | בָּבָּא! כָּל הַכָּבוֹד! | whole-word pop (existing Captions path, no units[]) |
| 6 | call-response | 32–34 | "now you!" + a genuine ~2.5s pause; no tile highlight in the silence | אַתֶּם! | **none during the pause** (silence → nothing lit) |

## Why this ladder (findings §1)
Synthetic phonics on pointed script: hear the unit → isolate the pointed letter (בָּ) → highlight it
as its sound plays → blend across syllables (continuous, no gaps) → whole word. The decodable unit is
the **צירוף (CV cluster)** — exactly what lights up.

## Voice note (P3, not this phase)
Per-unit edge-tts clips + RMS energy trim (findings §2). The call-and-response pause is **engineered**
as real silence (the trailing tail + reserved pause) after the "now you!" prompt — no filler word is
spoken.
