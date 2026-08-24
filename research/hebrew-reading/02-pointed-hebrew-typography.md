# 02 — Displaying pointed Hebrew (nikkud) legibly for early readers

**Research question:** how should the on-screen pointed text in our reading shorts be typeset and
highlighted for ages 5–7 — which fonts, what sizing/spacing, how to color-highlight the active
grapheme, and what mnemonics exist for each nikkud sign.

> **Environment reality (read before trusting coverage).** Hebrew-language web search is effectively
> BLOCKED in this environment: Seznam's Czech crawler returns zero on Hebrew queries, Yahoo 500s,
> Brave is hard rate-limited (HTTP 429) after ~1 query, and WebSearch/DuckDuckGo/Google/Startpage are
> dead. Everything below is built on English-language sources + the fonts' own repos/docs that I could
> reach directly. Where a claim rests only on inference I flag it **[unverified inference]**; the rest
> is source-grounded with a URL. The nikkud-mnemonics section is deliberately thin and marked as such
> — do not treat it as settled curriculum.

---

## TL;DR — the five decisions this drives

1. **Keep the vendored fonts. Rubik is pointed-safe; Heebo is pointed-safe for grade-school nikkud.**
   Rubik's Hebrew was revised by a native reader (Meir Sadan) with *explicit* OpenType mark-positioning
   for nikkud, and its GitHub issue tracker has **zero** nikkud bug reports. Heebo is Hebrew-*primary*
   (designed by Oded Ezer, mastered by the same Meir Sadan). Only **biblical cantillations** are
   excluded from Rubik — irrelevant for קריאה content. No need to source a new display font. (See §A.)
2. **Set pointed text as large as the frame allows, in a clean sans (Rubik/Heebo), at generous
   line-height.** Niqqud marks are intrinsically "small compared to the letters" and sit close under/
   over them — they must not clip and must not collide with a shin/sin dot or a neighbor. The brand
   already encodes the right fix: `lineHeight ≈ 1.5` for nikkud. (See §B.)
3. **Highlight the active grapheme by COLOR (change the grapheme's own color in exact sync), the
   PlanetRead/SLS way.** Same-Language-Subtitling research — the strongest read-along evidence base —
   colors every word in perfect timing with the audio and shows large, replicated literacy gains in
   children. Do **not** rely on color *alone*: pair it with the existing size/scale pop so the cue is
   redundant (accessibility + attention). (See §C.)
4. **Treat קמץ קטן as its own teaching unit and disambiguate it visually — never rely on the bare
   glyph.** Kamatz gadol ([a]) and kamatz katan ([o]) are normally printed identically and even
   adults conflate them; teaching texts resort to a longer/bolder/encircled mark. For a decoder aimed
   at 5–7-year-olds, pick ONE consistent visual disambiguation and color it differently. (See §D.)
5. **Beware genuine glyph-identity traps that the font can't fix:** שורוק = וּ is *identical* to
   וּ (vav + dagesh); a חולם over ש collides with the shin/sin dot; דגש inside a letter can read as a
   vowel dot. Our progression (isolated unit → CV → word) must introduce these deliberately. (See §D.)

---

## A. Which font renders nikkud clearly — and is Rubik/Heebo reliable?

### The traditional pointed-book faces
- **Frank-Rühl** "became the standard for Hebrew printing, especially in newspapers and books," and
  its designer "made noticeable adjustments to similar-looking letters for educational clarity." It is
  the classic pointed-Hebrew book face. *(Source: Wikipedia, Frank-Rühl.)* Culmus ships a free
  **Frank Ruehl CLM** (and notes across the collection that fonts "with diacritics" support meteg/rafe).
  *(Source: culmus.sourceforge.io.)*
- In Wikipedia's own Hebrew-script font stack, **serif pointed faces are prioritized precisely because
  they render nikud and the sans-serif set does not**: *"The serif fonts are prioritized because it
  properly displays nikud, which the sans-serif script does not."* Faces named for clean nikkud:
  **SBL Hebrew** ("best… diacritics on smaller sizes"), **Taamey Ashkenaz**, **Taamey Frank CLM**,
  **Ezra SIL/SR**, **Frank Ruehl CLM**, **Keter YG**. *(Source: Wikipedia, Template talk:Script/Hebrew.)*

  → **Important nuance for us:** that "sans doesn't display nikud" caveat is about the *generic* sans
  fallback in that stack (Arial/FreeSans/Noto) — **not** about Rubik/Heebo, which are purpose-built
  Hebrew sans faces (below). Don't over-read it as "all sans fails."

### Rubik — verified pointed-safe
- README: *"Rubik supports the Latin, Cyrillic and Hebrew scripts."* The Hebrew was "revised by Hebrew
  native reader Meir Sadan," and the 2015 revision *"added vowel marks (nikkud)"* and *"added appropriate
  OpenType features for Hebrew vowel points (nikkud) positioning."* The only exclusion: *"Biblical
  cantillations were not … supported at this time."* *(Source: github.com/googlefonts/rubik.)*
- A search of the Rubik issue tracker for "nikkud" returns **"No results"** — no open/closed nikkud
  rendering bugs. *(Source: github.com/googlefonts/rubik/issues?q=nikkud.)* Repo archived 2024-08-26
  (stable/final).

### Heebo — Hebrew-primary, designed for pointed text
- Google Fonts metadata: `subsets: "hebrew"` + `primary_script: "Hebr"`; designer **Oded Ezer** (Tel
  Aviv), mastered by **Meir Sadan** (the same engineer who fixed Rubik's nikkud). A Nov-2023 update
  "addressed Hebrew bugs." *(Sources: google/fonts ofl/heebo METADATA.pb + DESCRIPTION.en_us.html.)*
- The metadata doesn't list OpenType `mark` tags explicitly, so absolute positioning correctness is
  **[verify in-app]** rather than doc-confirmed — but a Hebrew-*primary* face by Ezer with Sadan
  mastering is expected to position nikkud correctly. QA at render is the cheap confirmation (§F).

### Verdict for our feature
**Rubik 700/900 (display) and Heebo (body) can carry pointed early-reader text.** The classic book
faces (Frank-Rühl/Keter YG/SBL) are optimized for *print schoolbooks/siddurim* and dense vocalized
prose; for a single huge on-screen grapheme/syllable in a video, a clean, heavy, rounded sans like
Rubik is *more* legible and already matches the brand. **Do not buy/license a dedicated schoolbook
font for v1.** Keep a Frank-Ruehl-CLM fallback only if QA shows mark clipping on a specific glyph.

---

## B. Legibility of nikkud at a glance (size / placement / spacing / line-height)

Source-grounded constraints on how the marks behave (these are the properties our layout must respect):

- **Marks are intrinsically small.** Niqqud are *"small compared to the letters, so they can be added
  without retranscribing texts."* At any given pt size the *point* is a fraction of the letter — so to
  make the **point** legible at phone scale, the **letter** must be very large. *(Source: Wikipedia, Niqqud.)*
- **Placement is tight and rule-bound:** most points sit directly under the letter; **חולם sits above,
  top-left / slightly left of its consonant** (over the vav in חולם מלא); **דגש sits inside the glyph**
  near the middle, shifting beside letters with no interior space (e.g. י). *(Source: Wikipedia, Niqqud.)*
- **Adjacent-dot collisions are a real failure mode:** *"inadequate typefaces merge the holam"* with
  the shin/sin dot over ש. So a pointed ש with a חולם is a worst-case glyph — give it extra room.
  *(Source: Wikipedia, Niqqud.)*

**Concrete layout takeaways for our compositor:**
- Render the teaching grapheme at the largest size the safe-area allows (it's the whole point of the
  video). Size for the **nikkud mark's** legibility, not the letter's.
- **`lineHeight ≈ 1.5`** (already the brand's nikkud rule in `research/hebrew-kids/07` §10 and the
  `kidsNikkud` prop) so the below-letter point never clips against a descender line or the caption pill.
- Add **letter/word spacing** on multi-letter blends so an above-letter חולם or a shin-dot doesn't
  visually drift onto the neighboring letter.
- Isolate the target: when teaching one unit, show that unit alone (huge) rather than inside a long
  pointed line — this both maximizes point size and matches the pedagogy (isolate → blend).

---

## C. Color-highlighting the active letter/syllable (read-along standard)

The strongest evidence base for synced text highlighting is **Same-Language Subtitling (SLS)** /
**PlanetRead** — karaoke-style subtitles proven to move literacy at population scale:

- **Method = color the active unit in perfect sync.** *"The subtitles are designed to change the color
  of every word in perfect timing with the song."* "What you hear is what you read."
  *(Sources: Wikipedia, PlanetRead; billionreaders.org/evidence.)*
- **It works, especially in the exact early-reader window we target:**
  - 5-yr study: among children who couldn't read a single letter at baseline, **70% in the high-SLS
    group became functional readers vs 34%** low-SLS (Kothari & Bandyopadhyay 2014).
  - Maharashtra 2-yr: **68% of Grade-3 read at ≥Grade-1 level vs 43%** control (2015).
  - Impact "**most apparent in Grades 2–3**," i.e. early reading acquisition — our demographic.
  - Eye-tracking: "**70% of weak readers engaged in unprompted reading**" while watching SLS clips.
  *(Source: billionreaders.org/evidence.)*

**Color-as-meaning in phonics instruction** (established practice, Orton-Gillingham / structured
literacy): color is used to flag the *thing to attend to* — e.g. **"Red Words"** highlight the
irregular spelling "in red" as a visual memory cue. *(Source: orton-gillingham.com/what-are-red-words.)*
The wider OG/vowel-team convention of coloring **vowels one color, consonants another** is common
classroom practice **[unverified inference — I could not pull a primary source in this environment]**,
but the *principle* (color the unit you want the eye on) is well attested.

**Takeaways for our highlight:**
- **Highlight the active grapheme by changing ITS color, synced exactly to the per-clip audio** (the
  per-unit energy-trim from `01-subword-timing.md` gives the exact window). This is the SLS method
  applied one level finer (grapheme instead of word).
- **Never encode meaning by color alone.** Pair the color change with the existing **scale pop** so the
  cue survives color-vision deficiency and inattention (redundant coding). Size pop also reads at a
  glance better than a pure hue swap.
- **Use ONE consistent "active" accent** (brand accent) for the sounding unit, and — separately — a
  **stable color convention for the target nikkud itself** (e.g. the point sign always in the target
  color across the whole video) so the child learns to *find the sign*, independent of the highlight.

---

## D. The nikkud set: sounds, visual traps, and per-sign notes

Canonical Israeli-school values (source: Wikipedia, Niqqud + Kamatz katan):

| Sign | Name | Sound | Watch out for |
|---|---|---|---|
| בְ | **שְׁוָא** shva | [e] or ∅ (no vowel) | Two jobs (mobile/quiescent); ∅ is the tricky one |
| בִ | **חִירִיק** chirik | [i] | with/without yod (חיריק מלא/חסר) |
| בֵ | **צֵירֵי** tzere | [e] | merges with segol in speech — keep the *sign* distinct |
| בֶ | **סֶגּוֹל** segol | [e] | three-dot triangle; merges with tzere in speech |
| בַ | **פַּתָּח** patach | [a] | merges with kamatz in speech; furtive patach is sounded *before* the letter |
| בָ | **קָמָץ גָּדוֹל** kamatz gadol | [a] | identical glyph to katan (below) |
| בׇ | **קָמָץ קָטָן** kamatz katan | [o] | **normally printed identically to gadol** — disambiguate! |
| בֹ | **חוֹלָם** cholam | [o] | dot over top-left; **collides with shin/sin dot**; חולם מלא over vav |
| בֻ | **קֻבּוּץ** kubutz | [u] | three diagonal dots below |
| בוּ | **שׁוּרוּק** shuruk | [u] | **glyph-identical to וּ (vav+dagesh)** — a real trap |
| בּ | **דָּגֵשׁ** dagesh | (not a vowel) | dot *inside* the letter; kal vs chazak |

**Glyph-identity traps the font cannot fix (curriculum must handle):**
- **שורוק vs vav+dagesh:** *"its dot … is identical to a dagesh,"* so וּ as [u] vs as consonantal v+dagesh
  are visually the same. Teach שורוק explicitly as "the dot-in-vav that says oo." *(Source: Wikipedia, Niqqud.)*
- **חולם over ש:** merges with the shin/sin dot in weak fonts — verify at render. *(Source: Wikipedia, Niqqud.)*
- **Kamatz katan:** *"Ordinarily the two are written identically"*; *"there is no reliable way to
  distinguish"*; didactic texts print it longer / bolder / **encircled**. *(Source: Wikipedia, Kamatz katan.)*
  → **For our decoder: pick ONE visual disambiguation (e.g. color קמץ קטן's mark differently or ring it)
  and be consistent.** Consider deferring קמץ קטן to a later video (it's the single most-confusing sign).

---

## E. Mnemonics / sound-associations per nikkud — **SOURCE-THIN, flagged**

**I could NOT ground this section in this environment.** Hebrew teacher-blog/search access is blocked
(Seznam returns zero on Hebrew, Yahoo 500s, Brave 429s, Google/DDG dead), and the English "teach
Hebrew vowels" queries surfaced only generic results. I refuse to invent citations.

What I *can* say without a source: the nikkud **names themselves are descriptive Hebrew words** and
can anchor an association (e.g. חִירִיק relates to a whistle/squeak; צֵירֵי to a ribbon/band; סֶגּוֹל
to a violet/cluster; קֻבּוּץ to "gathered"; שׁוּרוּק to a whistle). But the *child-friendly image ↔
sound* mappings used in actual Israeli קריאה programs (the specific pictures teachers attach to each
sign) are exactly what's unverifiable here.

→ **Action:** treat mnemonics as a **to-be-sourced content task**, not a research output. Either
(a) run this section in an environment with working Hebrew search / access to Israeli early-reader
curricula (e.g. צוות גפן, מטח, or the published לימוד קריאה programs), or (b) derive our own
associations from the sign names + sounds and validate with an Israeli early-grades teacher.
**Do not ship mnemonics scraped from thin air.**

---

## F. Concrete checklist for OUR feature (folds into 01-subword-timing)

1. **Font:** keep vendored **Rubik 700/900** for the big teaching grapheme and **Heebo** for supporting
   text — both pointed-safe. QA-render one glyph of each nikkud at target size and READ it for mark
   clipping / holam-shin collisions before any full render (standard repo QA gate).
2. **Size/space:** target grapheme as large as the safe-area allows; `lineHeight ≈ 1.5`; add tracking
   on blends; render the taught unit **isolated** before blending.
3. **Highlight:** color the **active grapheme** in exact sync with the per-clip trimmed window
   (`vo[].subwords[]` from `01`), **plus** the existing scale pop (redundant cue). One consistent accent
   for "sounding now"; a separate stable color for the target nikkud sign itself.
4. **Curriculum traps:** handle שורוק=vav+dagesh, holam/shin, and (later) קמץ קטן with an explicit,
   consistent visual disambiguation — the font won't do it.
5. **Mnemonics:** open a sourcing task (§E) — do not fabricate.

---

## Sources (actually read)
- https://en.wikipedia.org/wiki/Niqqud — sign table + IPA, mark size/placement, holam/shin merge, shuruk=dagesh, where pointed text is used
- https://en.wikipedia.org/wiki/Kamatz_katan — kamatz gadol vs katan identical glyph, didactic longer/bolder/encircled forms
- https://en.wikipedia.org/wiki/Frank-R%C3%BChl — standard Hebrew book/news face; educational-clarity letter adjustments
- https://en.wikipedia.org/wiki/Template_talk:Script/Hebrew — serif pointed faces prioritized "because it properly displays nikud, which the sans-serif script does not"; SBL Hebrew/Taamey/Ezra SIL/Frank Ruehl CLM/Keter YG named
- https://culmus.sourceforge.io/ — Frank Ruehl CLM free; diacritics (meteg/rafe) support
- https://github.com/googlefonts/rubik — Hebrew + explicit nikkud OpenType positioning (Meir Sadan), cantillations excluded
- https://github.com/googlefonts/rubik/issues?q=nikkud — zero nikkud bug reports
- https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/METADATA.pb + DESCRIPTION.en_us.html — Heebo Hebrew-primary, Oded Ezer, mastered by Meir Sadan
- https://en.wikipedia.org/wiki/PlanetRead — SLS: "change the color of every word in perfect timing with the song"
- https://billionreaders.org/evidence/ — SLS literacy gains (70%/34%; 68%/43%; strongest Grades 2–3; weak-reader eye-tracking)
- https://www.orton-gillingham.com/what-are-red-words/ — color-as-meaning in phonics ("red words" highlight the irregular part)

## Blocked / unverifiable in this environment (do not retry)
- Hebrew-language searches (Seznam/Yahoo/Brave) for Israeli schoolbook fonts and per-nikkud mnemonics — all returned nothing or 429/500.
- Brave rate-limited (HTTP 429) throughout; WebSearch/DuckDuckGo/Google/Startpage dead per env notes.
- Therefore §E (mnemonics) is inference-flagged, and the "sans-vs-serif" caveat in §A is contextualized, not exhaustive.
