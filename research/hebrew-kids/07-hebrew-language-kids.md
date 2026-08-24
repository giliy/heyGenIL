# 07 — Child-Directed Hebrew: The Language Harness for Kids' Shorts

**How the engine talks to Israeli children ages 3–5.** This is the reference the kids' scriptwriting
stage reads before writing a single line — the same role `research/hebrew-ads/` plays for `/make-ad`.
Synthesized from grounded web research (child-directed-speech linguistics, classic Israeli preschool
TV, קלינאי תקשורת guidance, שירי ילדים rhyme mechanics). Sources at the bottom.

> **Why this exists:** the repo had *advertising* Hebrew (adults) but no *child-directed* Hebrew
> (gap #7 in `04-pipeline-fit.md`). This file is the fix. **Read it before writing any kids' script,
> before engineering a character catchphrase, and before composing any song line.**

---

## 1. The register: Hebrew "motherese" (שפת ההורים) — the delivery layer

Hebrew-speaking adults reliably shift into a documented child-directed register. These are its
prosodic features — they drive **how the TTS voice line should be delivered** (and what emotion tags
to use on ElevenLabs v3):

| Feature | What to do in the script/voice |
|---|---|
| Higher pitch | Warm, lifted delivery — not flat adult narration |
| Slower tempo | ~2.2–2.5 wps with real pauses (matches short-7 kids pacing: "kids stories breathe; do not tighten") |
| Exaggerated melody, rising sentence-ends | Warm/encouraging lines **rise**; let the intonation carry the emotion |
| Lengthened vowels | Stretch key vowels on emotional/target words |
| Over-clear syllable articulation | Crisp word boundaries (good for word-exact captions) |
| Frequent repetition | Repeat the hook/phrase ≥3× per short |
| Short sentences, short words | 3–6 words per sentence (see §3) |
| Point + isolate single words | Name things one at a time: "מה זה? ... זה כדור!" |

**Tone mapping (from a UCLA study via Hayadan):** approval is delivered in a **high/rising** tone —
"נכון, הנה הדובי!" ("Right, here's the teddy!"); prohibition in a **low** tone — "לא! אל תטפס"
("No! Don't climb"). For scripts: warm lines rise, gentle "stop" lines drop.

**This register is correct, not pandering.** Infants prefer infant-directed speech in every language
studied; per Dr. Idit Sulkin: "אין יותר רציונלי מלדבר כך עם ילדים צעירים" (nothing is more rational
than speaking this way to young children).

---

## 2. Lexical mechanics — how to "toddler-ize" a Hebrew word

Four documented mechanisms. Use them deliberately:

1. **Diminutive/affection suffix -י (-i):** כלבִּי (doggie), חתולי (kitty), דובי (teddy — the canonical
   case: "הנה הדובי"), name + -י (מיכלי). Signals smallness + affection.
2. **Reduplication/doubling:** בוקבוק (bottle), טופטוף, בי-בי, קוקו (peek-a-boo). **Doubling is the
   default mechanism for turning an adult word into a toddler word.**
3. **Onomatopoeia as legitimate first words:** האו־האו (woof), מיאו (meow), מוּ (moo), מֶה (baa),
   קוקו ריקו (rooster), קוואק קוואק (quack). "מו" is easier than "פרה" — use the sound, then the word.
4. **Syllable-truncation is how toddlers hear words** — "דור" for כדור, "בה" for בובה. Don't *script*
   truncated words (clinicians say model the correct form — §5), but design call-and-response so the
   child's imperfect attempt is *accepted and recast*: child says "דור" → character says "כן! כדור!"

---

## 3. Sentence structure rules (ages 3–5)

- **3–6 words per sentence.** Present tense. One idea per sentence.
- **Direct second-person address**, warm and immediate (see §4 for the greeting formula).
- **Repetition is a device, not a bug:** "בַּסּוֹף, בַּסּוֹף" / "נוֹרָא נוֹרָא רוֹצֶה" — immediate
  word-repetition is idiomatic toddler speech.
- **Questions drive interaction:** מה זה? (what's this?), מי זה? (who's this?), איפה...? (where's...?),
  רוצים לשיר איתי? (want to sing with me?), אתם מוכנים? (are you ready?)
- **Poetry for tots is "more sonic than verbal"** (צלילית יותר ומילולית פחות) — sound and rhythm
  carry it; keep the semantics simple.

---

## 4. Address & greeting conventions (the established formula)

The audience-recognized opening, documented from the leading Israeli preschool hosts:

- **Greet with both genders, masculine first:** **"שלום לכם ילדים וילדות"** — Yuval HaMebulbal's
  signature ("...אני יובל המבולבל") and Michal HaKtana's ("...איזה כיף שבאתם לבקר אותי!").
- **Collective sign-off:** "לילה טוב לכולם!" (Hop!) — "לכולם" (to everyone) is the warm neutral.
- **Whole-family address:** "ילדים וילדות וכל המשפחה."
- **Second-person plural** (masculine-plural verbs function as the collective): "אתם מוכנים?",
  "רוצים לשיר איתי?", "אני מצפה לפגוש אתכם."
- **Participation invitations (Michal HaKtana's documented pattern):** "רוצים לשיר איתי?",
  "אתם מוכנים להרפתקה הבאה?", "הזמן לשיר בקולי קולות!" Her motto: **"לשיר, לרקוד, לשמוח ולאהוב"**
  (to sing, to dance, to rejoice, and to love).

---

## 5. Clinician interaction rules (קלינאי תקשורת — the "Ms. Rachel" techniques in Hebrew)

From Maccabi communication-clinicians' guidance — these are **script structure rules**:

1. **Narrate like a sportscaster:** "דברו עם הילד, ספרו לו מה אתם עושים" — the character narrates
   what it's doing as it does it.
2. **Point and ask:** "מה זה?" / "מי זה?" — point at the real thing, name it.
3. **Pause and wait (turn-taking):** "עצרו אחרי כל מילה ותנו לילד זמן" — **ask, then hold a genuine
   2–4s expectant pause** for the child's answer. Communication = initiation + response. This is the
   core of the call-and-response format — the pause is engineered into the beat timing, not trimmed.
4. **Expand the child's utterance (הארכת מבעים):** child: "כדור" → character: "כן! כדור אדום גדול!"
   (model one level up).
5. **Recast correctly, don't mimic errors:** cute mispronunciations get repeated back *correctly and
   clearly* — never mock, never copy the error.
6. **Repeat first words:** "מילים ראשונות זקוקות לחזרה" — repeat the target word several times.
7. **Imitate & join the child's sounds:** "חקו קולות בעלי חיים יחד" — make animal sounds and
   movements *together*.
8. **Show delight when the child "speaks":** warm praise after the pause, regardless of answer.
9. **Screen-time framing:** the Ministry of Health recommends minimizing screens before age 3 — so
   our scripts model *interactive, pausing* style that invites co-viewing participation, and the
   brand position stays "the calm, trustworthy Hebrew short" (see `02` gap #4).

---

## 6. First-vocabulary word banks by theme (אוצר מילים)

Script against what Israeli toddlers actually know. Comprehension far outpaces production (16-month:
~70 words said vs ~200 understood) — so scripts can *use* more than a toddler could *say*.

| Theme | Hebrew words |
|---|---|
| **משפחה** | אמא (most common first word), אבא (easiest — identical vowels), סבא, סבתא, אח, אחות |
| **חיות בית** | כלב, חתול, דג, ציפור, ארנב |
| **חיות חווה** | פרה, סוס, חזיר, כבש, תרנגול |
| **חיות בר** | אריה, פיל, קוף, דוב, זברה, ג'ירפה |
| **קולות חיות** | האו־האו, מיאו, מוּ, מֶה, קוקו ריקו, קוואק קוואק |
| **חלקי גוף** | ראש, עיניים, אף, פה, יד, רגל, בטן, אוזן |
| **אוכל** | בננה, תפוח, תפוז, מים, חלב, לחם, עוגה, עוגיה |
| **בית** | כיסא, שולחן, מיטה, חולצה, מכנסיים, נעליים, תיק, ספר, כדור, בובה, אור |
| **צבעים/מספרים/רגשות** | אדום, כחול, צהוב, ירוק · אחד–חמש · שמח, עצוב |
| **חברתי/פעלים** | בי-בי, עוד, תודה, רוצה, ישן, אוכל, שותה |
| **כלי רכב** (gap in sources — standard category) | אוטו, אוטובוס, מכונית, משאית, רכבת |

**Milestones to pace against:** 12–18mo one-word stage · ~2yr two-word combos ("רוצה מים") · 18–24mo
lexical explosion. For ages 3–5 we're past first-words — so these banks are the *content vocabulary*
(letters, colors, animals, feelings), and the harness's job is to keep sentence *structure* simple.

---

## 7. Rhyme & rhythm rules (חריזה — for singable lines)

From Dr. Oren Hasson (toddler rhyme rules), CET, and the canon:

- **Rhyme packs memory:** "מסרים נקלטים ביתר קלות כשהם ארוזים בחרוזים" — rhyme the *key* line.
- **Keep rhymes simple** — toddlers' small vocabulary means "a high dose of simple rhymes." Start with
  single-syllable rhymes (אוֹר–שָׁחֹר).
- **Favor sibilant endings** (ש/ס) over מ/נ: טִפֵּשׁ–טִפֵּס is easier to distinguish than תֹּם–תָּם.
- **Don't force it:** natural melody first; forced syntax to land a rhyme is the failure mode.
- **Schemes:** AABB couplets (the toddler default), ABAB, ABBA.
- **Short trochaic lines** (the Bergstein model — §8).
- **Pair rhyme with a beat** — "recognizing the beat helps kids follow the rhyme" (clap/rattle/drum
  in the music bed).
- **Nonsense-in-rhyme is legitimate** — Datia Ben-Dor's "שְׁטוּזִים" (rhymed nonsense) won the Bialik
  Prize; catalog/list songs and call-and-response dialogue are proven toddler structures.

---

## 8. Analyzed models from the canon (templates to copy)

**A. Fania Bergstein — "בוא אלי פרפר נחמד" (1945)** — the foundational toddler rhyme (later the
פרפר נחמד TV chorus). Structure: a single short quatrain of brief trochaic lines, AABB couplets,
gentle imperative + reassurance ("בוא... אל תירא" — come... don't be afraid). Works *without* music.
**→ The harness story-opener template.**

**B. Bialik — "קן ציפור"** — nest→egg→chick nesting structure; end-rhyme on -ים; and a **whispered
aside "הס, פן תעיר"** ("hush, lest you wake") that drops the energy and pulls the child in.
**→ The "quiet moment" beat — a scripted whisper for contrast.**

**C. Datia Ben-Dor** — humor + linguistic virtuosity + captivating rhythm; catalog & dialogue patterns.
**→ The list-song and call-and-response templates.**

**D. Tongue-twisters / counting chants** — "גנן גידל בגן דגן" (alliteration), "שרה שרה שיר שמח"
(palindrome), "דנה קמה דנה נמה" (counting-out). **→ Rhythm-play templates.**

---

## 9. The harness in use: ready phrase banks + templates

### Story sentence templates (ages 3–5 mini-story arc)
- **Opening:** "פעם אחת היה/הייתה..." (once there was...) — or the Bergstein invitation form.
- **Meet the character:** "זה [שם]. [שם] אוהב/ת..." (This is X. X loves...)
- **The problem (gentle):** "אוי! [דבר קטן השתבש]..." — small, safe, forgivable (the Stitch chaos rule).
- **Repetition beat:** the attempt/gag ×3 with variation.
- **Whisper aside (Bialik):** "הס... בואו נראה בשקט..." (hush... let's look quietly...)
- **Warm resolution (belonging):** the chaos is forgiven; end on "ביחד" (together) / the catchphrase.
- **Sign-off:** collective "בי-בי!" / "להתראות!" — warm, to camera.

### Call-and-response template (educational shorts)
1. Character points: "מה זה?" *(pause 2–4s, expectant)*
2. Warm acceptance: "נכון! זה [מילה]!" *(rising tone)*
3. Expand: "[מילה] + one descriptor" — "כדור אדום!"
4. Repeat ×3 with different items; end with delight.

### Catchphrase construction rules (for the character's signature line)
- **2–6 words max**, present tense, singable.
- **Doubling or -י diminutive** somewhere if natural.
- **Sibilant-friendly simple rhyme or rhythm** so it's chantable.
- **Ends on warmth/belonging** (אוהב, ביחד, חברים).
- **Imitable by a 3-year-old** — no consonant clusters that defeat little mouths.
- Test: can it be shouted joyfully AND whispered? Both are used.

### Song line rules
- Lyric = one repeated 2–6-word phrase; action synced to musical beats; tempo speech-paced (singable
  by a 4-year-old). Nonsense-syllable hooks ("דוּ דוּ דוּ"-style) are legitimate and travel well.

---

## 10. How this plugs into the pipeline

- **Scriptwriting stage** reads this file before drafting `script.md` → feeds `beats.json`.
- **Character catchphrase** (Phase 0) gets engineered against §9's catchphrase rules — applies to
  whichever of שפופון/בּוּ/טיפה is chosen.
- **Voice delivery:** the §1 prosodic register maps to ElevenLabs v3 emotion tags (or edge-tts
  delivery choices) — warm/rising for encouragement, low for gentle "stop," whisper for the aside.
- **Nikkud:** kids' content uses nikkud (brand.md exception) — bump caption lineHeight to ~1.5 so the
  points don't clip. Hebrew examples in this file are written as the captions should render.
- **Beats pacing:** ~2.2–2.5 wps, engineered 2–4s pauses for call-and-response, whisper beat optional.

## Sources
- hayadan.org.il/babies-language-0909071 (ID-speech features + UCLA tone study)
- iditsulkin.co.il/baby-language-and-musical-speech/ (musical speech)
- he.wikipedia.org/wiki/רכישת_שפה (motherese features, milestones)
- klinai.co.il/blog/the-development-of-speech-in-infants/ · clalit.co.il (milestones, truncation)
- he.wikipedia.org/wiki/פרפר_נחמד · /wiki/רחוב_סומסום_(ישראל) · /wiki/ערוץ_הופ! · /wiki/יובל_המבולבל · /wiki/מיכל_הקטנה
- michalhaktana.co.il (greeting + participation pattern)
- zemereshet.co.il (בוא אלי פרפר נחמד analysis + Bialik קן ציפור)
- orenhasson.com/publications/rhymes.asp (toddler rhyme rules) · lib.cet.ac.il (rhyme schemes)
- infogan.co.il (kindergarten rhymes, tongue-twisters, beat)
- gameoffun.co.il (first-word lists + 30 animals) · maccabi4u.co.il (קלינאות תקשורת: narrate/expand/recast/turn-taking)
