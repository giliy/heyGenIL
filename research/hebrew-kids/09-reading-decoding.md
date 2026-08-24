# 09 — Existing Hebrew-Reading Content & Curricula (decode-the-gap)

Research completed 2026-08-23. Question: what already exists to teach Hebrew **decoding/reading**
(קריאה) to Israeli kids ages 5–7 — the TV/YouTube shows, apps, and per-nikkud teaching videos — and
where the gap is for a premium, calm, well-synced, per-nikkud short-form series with SUB-WORD
(letter/grapheme) highlighting.

**Honest source note (read first):** this environment has NO WebSearch and a badly degraded
WebFetch ladder. Brave was hard rate-limited (429 on every attempt today), `bing.com/search` was
poisoned (returned German news + Gulf-bank spam for Hebrew queries), and Seznam returns zero results
for Hebrew-language queries. **The one engine that worked was `bing.com/videos`** — it exposed the
real YouTube kids'-reading landscape (channels, titles, durations, view counts). So the
*curriculum/pedagogy* layer below is solidly sourced (Kriakala's published scope, IvriTalk's vowel
inventory, Hop! Channel via Wikipedia); the *video-format* layer is sourced from Bing Videos result
metadata (titles/durations/views) **plus inference from those titles** — flagged as such. No specific
video's internal structure was directly watched (YouTube pages are JS-gated to WebFetch).

---

## 1. The landscape at a glance

Three distinct tiers exist, and they barely overlap:

| Tier | Exists today | Format | Weakness (our opening) |
|---|---|---|---|
| **Classic songs** (YouTube) | Huge | One 2–4 min song naming all letters / all vowel signs at once | Names ≠ sounds; no per-vowel depth; no decoding |
| **Per-vowel prep videos** (YouTube) | Medium | "הכנה לכיתה א" — one vowel per video, syllable drill | Variable quality, ad-heavy, inconsistent sync, busy |
| **Phonics apps** (Kriakala etc.) | Few, new | Locked scaffolded progression letters→vowels→syllables→words | Interactive app, not video; not a lean-back watch |

The biggest "Israeli kids" brands are **not** about reading at all: **Hop! Channel** (est. Feb 2000,
ages 0–7, HOT/yes) is entertainment-first — its flagship educational-adjacent property is *Rechov
Sumsum* (the Israeli Sesame Street) and the spin-off *הופ! אני יודע*, but Wikipedia lists **no
dedicated alphabet/reading/nikkud series** on the channel. **Kan Educational (כאן חינוכית /
kankids.org.il)** surfaces shows like עיר המספרים (math) and האחיין שלי בנץ, and likewise **no
aleph-bet/קריאה program on its homepage**. Reading-decoding content on screen is effectively a
**YouTube-native, creator-driven** category, not a broadcaster category.

## 2. Curriculum: the decoding progression is settled (and matches our plan)

The pedagogical sequence for Hebrew reading is not contested — and it is **exactly** the progression
this feature targets (isolated letter+nikkud → CV syllable → blend → word).

- **Kriakala** (a live Israeli Hebrew-phonics app, ages 4–7, built by an ex-Israeli elementary
  teacher) publishes an explicit **5-stage locked progression**:
  1. Letter sounds (all 22 letters)
  2. **Nikud vowels — the 8 core vowels, introduced "one at a time," always paired with a consonant**
  3. Syllables — "Consonant + Vowel = Syllable" (בּ + ַ = בַּ "ba")
  4. Word reading — "blend two syllables into a word … the core decoding skill" (בַּיִת = ba·yit)
  5. Storybooks
  Crucially it calls the nikkud stage **"the most commonly skipped step that causes reading to
  stall"** and locks it so it can't be skipped. Its examples imply **Patach (ַ "ah") first**, then
  tzeire ("be"), chirik ("bi"). (kriakala.com, /hebrew-phonics)

- **The vowel inventory to cover** (IvriTalk's nikkud guide, a clean enumeration with example words):
  kamatz (a/o), patach (a), tzeire (e), segol (e), chirik (i), cholam (o), kubutz + shuruk (u),
  shva (vocal/silent — with real rules: word-initial = vocal, word-final = silent), the reduced
  **chataf** forms (חֲטַף קָמָץ/פַּתָּח/סֶגּוֹל), and **dagesh** (not a vowel — flips ב/כ/פ to B/K/P).
  IvriTalk confirms the key market fact: **in Israel, nikkud appears only in grades 1–2 materials,
  children's books, and new-immigrant texts** — i.e. nikkud IS the grades-1–2 decoding layer.
  (ivritalk.com/hebrew-vowel-signs-explained)

- A generic (adult-aimed but structurally identical) 6-step Hebrew-reading method — **direction →
  consonants → nikkud → "one letter + its nikkud = one syllable sound," spoken aloud → short words →
  sentences** — corroborates the same ladder. (easylearnhebrew.com)

**Takeaway:** our per-video target (ONE nikkud) maps 1:1 onto the established "vowels one at a time"
stage; our on-screen progression (isolated grapheme → CV syllable → blend → whole word) is the
industry-standard ladder, not an invention.

## 3. Video formats that actually get watched (from Bing Videos result data)

Bing Videos surfaced the real, view-counted YouTube landscape. Patterns, in descending view order:

- **The single-song "name everything" format dominates raw views.** Examples found:
  - *"שיר סימני הניקוד 🎤 לימוד ניקוד לילדים / הכנה לכיתה א"* — EZToddler, 3:46, **1.2M views**
    (2020) — one song covering all vowel signs at once.
  - *"שיר האלף בית - שיר האותיות"* — ילדות ישראלית, 2:15, **29.7M views** (2011).
  - *"האותיות - שיר אלף בית"* — עפרה ועידן / ילד מוזיקה, 2:40, **6.1M views** (2010).
  - *"Hebrew ABC song for beginners"* — EZToddler, 2:53, **3.1M views** (2020).
  - *"Hebrew Alphabet for kids"* — EZToddler, 4:40, **1.3M views** (2020).
  - *"לומדים אותיות בעברית"* — טופקידס, 3:46, **2.4M views** (2019).
  → The winning songs are **2–4 minutes**, melodic, name-recitation. **Format: song, repetition,
  big letters.** These are letter-NAME / vowel-NAME songs, not decoding instruction.

- **Per-vowel "prep for grade 1" videos exist and get 100s of K views** — this is the closest
  existing thing to our concept, and it's the differentiation target:
  - *"קמץ פתח 🎓 סימני ניקוד פתח קמץ לילדים + דפי עבודה להדפסה"* — EZToddler, 5:14, **494.7K views**
  - *"Hebrew punctuation marks 👦 Learn hebrew"* — EZToddler, 8:10, **856.9K views**
  - *"פתח קמץ סימני ניקוד ללמוד לקרוא כיתה א - משחק תרגול קריאה"* — משחקי הכיף, 10:38, 17.3K views
  - *"הכנה לכיתה אלף | לומדים ניקוד | קובוץ | לומדים לקרוא"* — Hebrew KidTV, 4:08, 16.9K views
  - *"הכנה לכיתה אלף | לומדים ניקוד | חולם | לומדים לקרוא"* — Hebrew KidTV, 4:23
  - *"הכנה לכיתה אלף | לומדים ניקוד | חיריק"* — Hebrew KidTV
  - *"Hebrew alphabet | the letter aleph with niqqud | words that start with aleph"* — Hebrew KidTV, 3:47
  → **Hebrew KidTV is the model to beat**: per-nikkud, explicitly "הכנה לכיתה א," one vowel per video,
  ~4 min, "לומדים לקרוא" framing. These run **4–10 min** (long-form, not Shorts). *Inferred (from
  titles/durations, not watched):* syllable-drill format, one vowel held on screen, example words.

- **The mega-songs skew old (2010–2011); per-vowel reading videos skew 2020–2022.** The per-nikkud
  instructional niche is **newer and less saturated** than the aleph-bet-song niche.

- **Two channels own the niche:** **EZToddler** (UCO9neTOVf6iYtju2hGhT5uA — bilingual EN/HE branding,
  the 1.2M-view nikkud song, kamatz/patach, punctuation) and **Hebrew KidTV** (UCB9uZx-vVjuS6FIAc7cBZnQ
  — the systematic per-vowel "prep for grade 1" set, including kubutz AND shuruk coverage). Other
  players (משחקי הכיף, טופקידס, סופרקידוס, Studio Baby, HiliMood, סיפוריקי) mostly do
  letter-NAME songs, not nikkud decoding.

## 4. What the parents/kids respond to (from Kriakala's own framing)

Kriakala's marketing is the clearest articulation of the **pain point** we should echo:
> "My child can sing the whole Aleph Bet perfectly but can't read a single word."

That's the entire thesis for our feature. The classic songs teach *names and order*; parents
discover this doesn't transfer to *reading*. Kriakala's differentiators (which parents respond to)
are: systematic phonics, **"zero ads, no distractions,"** native-Israeli-speaker voice (not
synthesized), offline, calm. → **"calm + systematic + native voice + no clutter" is a stated,
validated parent preference.**

## 5. The gap — where OUR feature wins

- **Sub-word sync is unclaimed.** Every existing video either (a) names letters/vowels in a song with
  no decoding, or (b) drills one vowel over several minutes with ordinary whole-word or no
  highlighting. **None do letter/grapheme-level highlighting in sync with the exact phoneme as it's
  spoken.** Our whole-word→sub-word highlight upgrade (one level finer than the current whole-word
  pop) is the differentiator nobody has.
- **Shorts-native is unclaimed.** The per-vowel instructional content is all 4–10 min long-form.
  A **calm, 30–60s, one-nikkud-per-Short** with perfect sub-word sync does not exist. (Shorts for
  this are top-of-funnel toward the per-nikkud series / character IP, consistent with `05-plan.md`.)
- **Calm + premium is unclaimed.** Existing per-vowel videos are busy, ad-laden, variable audio.
  A deliberately calm, well-synced, beautifully typeset (Heebo/Rubik with proper nikkud + RTL
  anchoring — already solved in this repo) series is differentiated on craft alone.
- **Character-led decoding is unclaimed.** None of the reading videos are anchored by a locked,
  lovable recurring character. בּוּ (bu-koala) can host the per-nikkud series, giving the
  instructional content the character-appeal hook the songs lack.

## 6. Concrete takeaways for OUR build

1. **Keep the established ladder**: isolated letter+nikkud → CV syllable → blend → whole word. Match
   Kriakala/IvriTalk so parents recognize it as "real" phonics.
2. **Teach order (recommended)**: start with **patach + kamatz** (the two "ah" sounds — highest
   frequency, easiest; EZToddler pairs them, Kriakala leads with patach), then tzeire/segol ("e"),
   chirik ("i"), cholam ("o"), kubutz/shuruk ("u"), shva LAST (it has vocal/silent rules), dagesh as
   a separate B/K/P video. Chataf forms = advanced/optional later batch.
3. **One nikkud per Short.** Resist the "one song, all vowels" format — it's the thing that "doesn't
   transfer to reading." Our entire value is per-vowel depth + sync.
4. **Show the pointed syllable BIG** (the winning prep-video convention), with the **active grapheme
   popping** in accent color in sync with the phoneme — our sub-word highlight does this; keep
   nikkud (kidsNikkud prop) and lineHeight ~1.5.
5. **Voice: native, calm, single clear voice** (he-IL-HilaNeural per bu-koala's character.json).
   Explicitly avoid the synthetic/multi-voice clutter the space is known for. edge-tts WordBoundary
   gives real per-word times; for sub-word sync we extend to grapheme timing within the word.
6. **Music bed: calm.** Use the existing kids beds (kids-curious-pizzicato / kids-lullaby-musicbox)
   at low level under the voice — not a big singalong. The content is instruction, not a song.
7. **Bilingual EN/HE branding is a proven reach lever** (EZToddler/Hebrew KidTV both do it) — but our
   default stays Hebrew/RTL per `brand.md §5`; add EN subtitle line only if we want diaspora reach.
8. **Differentiate on sync + calm + character**, and say so in the parent-facing framing: "not a
   song they'll memorize — a sound they'll decode." That directly answers the documented
   "can sing it but can't read" complaint.

## 7. Unverified / to confirm before pilot

- **Exact internal pacing/structure of a Hebrew KidTV per-vowel video** (e.g. how many syllables per
  vowel, drill cadence, whether they blend on-screen) — inferred from titles/durations only; watch
  2–3 in a browser before locking the beats.json timing template.
- **The tzofim (צופים) / state first-grade textbook order** — the Ministry curriculum PDFs 404'd and
  Bing/Seznam returned nothing for ספרית צופים; the recommended teach-order above is triangulated
  from Kriakala + IvriTalk + the EZToddler kamatz/patach pairing, NOT from the official textbook.
- **Whether any Israeli broadcaster (Kan/Hop) has a current reading show** — neither homepage
  surfaced one; treated as "effectively YouTube-native category," worth one human confirmation.

## Sources

- https://kriakala.com/ (app: ages, 5-stage progression, "zero ads", native voice)
- https://kriakala.com/hebrew-phonics (C+V=syllable→word formula, vowels "one at a time", locked nikkud stage)
- https://kriakala.com/aleph-bet-song ("can sing the Aleph Bet but can't read a word"; song teaches names not sounds)
- https://www.ivritalk.com/hebrew-vowel-signs-explained/ (full vowel inventory incl. chataf + dagesh + shva rules; nikkud = grades 1–2/kids' books)
- https://www.easylearnhebrew.com/sp2/hebrew-reading-for-beginners.php (6-step direction→consonants→nikkud→syllable→words→sentences)
- https://en.wikipedia.org/wiki/Hop%21_Channel (Hop! Channel: est. 2000, ages 0–7, Rechov Sumsum; no alphabet series listed)
- https://www.kankids.org.il (Kan Educational homepage: math/entertainment shows, no kriah program surfaced)
- Bing Videos result set for "לומדים קריאה אלף בית ילדים ניקוד" — view counts/durations/titles for
  EZToddler (UCO9neTOVf6iYtju2hGhT5uA), Hebrew KidTV (UCB9uZx-vVjuS6FIAc7cBZnQ), ילדות ישראלית,
  ילד מוזיקה, טופקידס, משחקי הכיף (format/popularity evidence; internal structure inferred)
