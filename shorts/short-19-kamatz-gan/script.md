# short-19-kamatz-gan — קָמָץ: הַצָּלִיל אָ (a STORY, not a drill)

**Sub-type:** faceless AI-image story (storybook track — `make-short` + `lib/story.tsx`).
**Series:** `bu-koala` (locked character `ai-shorts/bu-koala/character.jpg`).
**Audience:** ages 4–6, Hebrew-native, learning nikkud. YouTube Made-for-Kids short.
**Voice:** edge-tts `he-IL-HilaNeural` motherese (`--rate -8% --pitch +4Hz`), FREE, real word boundaries.
**Mode:** `mode:"kids"` — nikkud captions on (kidsNikkud), lineHeight ~1.5, gentle ken-burns, no CTA.
**Format:** ~38s @30fps, 1080×1920. Hook <2s. One warm idea (a walk in the park) resolved.
**Music bed:** `kids-play-ukulele` (already in library), ducked under the voice.
**Cost:** 9 images × `fast` tier ≈ **$0.27**. Voice/music = $0.

> ⚠️ NOT the reading-drill ladder. This is the **story** the user asked for: the kamatz sound
> lives inside a little tale (אַבָּא in the park, a rabbit, a bookcase, a watermelon, the color
> red). The active word pops in accent as it's spoken (word-exact edge-tts boundaries); the five
> kamatz keywords are the ones the story teaches.

---

## The transcript (user's canonical kamatz story — source of truth)

> קָמָץ: הַצָּלִיל אָ
> שָׁלוֹם יְלָדִים, כֵּיף שֶׁחֲזַרְתֶּם!
> הַיּוֹם נֵלֵךְ לְטַיֵּל עִם אַבָּא בַּגָּן.
> בַּדֶּרֶךְ רָאִינוּ אַרְנָב קָטָן רָץ בֵּין הַדְּשָׁאִים.
> פָּתַח אֲרוֹן סְפָרִים קָטָן שֶׁבַּגָּן.
> אָז הוֹצִיא אַבָּא אֲבַטִּיחַ אָדֹם וּמָתוֹק לֶאֱכֹל.
> אֵיזֶה כֵּיף הָיָה לְטַיֵּל עִם אַבָּא!
> כָּל הַכָּבוֹד יְלָדִים, לָמַדְתֶּם אֶת הַקָּמָץ!
> מִלֵּי מַפְתֵּחַ: אַבָּא, אַרְנָב, אֲרוֹן, אֲבַטִּיחַ, אָדֹם.

**Nikkud corrections applied (from the episode audit):** בַּגָּן (dagesh in ג), פָּתַח (the narrator
verb), הוֹצִיא (took out), הַדְּשָׁאִים. Keyword list uses **אֲבַטִּיחַ** (the story's payoff word),
not the earlier draft's stray "אָז".

---

## Beat sheet (VO in nikkud'd child-directed Hebrew; scene = AI storybook still)

| # | beat | est. t(s) | on screen (AI image) | VO line (nikkud) |
|---|------|-----------|----------------------|-------------------|
| 0 | title-hook | 0–4 | Bu waves beside a big glowing kamatz sign בָּ in a sunny park | שָׁלוֹם יְלָדִים, כֵּיף שֶׁחֲזַרְתֶּם! |
| 1 | walk | 4–8.5 | Bu + a tall warm אַבָּא figure strolling into a green park | הַיּוֹם נֵלֵךְ לְטַיֵּל עִם אַבָּא בַּגָּן. |
| 2 | rabbit | 8.5–14 | a small brown אַרְנָב hopping between grass tufts, Bu watching delighted | בַּדֶּרֶךְ רָאִינוּ אַרְנָב קָטָן רָץ בֵּין הַדְּשָׁאִים. |
| 3 | aron | 14–20 | Bu opens a tiny wooden אֲרוֹן סְפָרִים on a park post, books glowing | פָּתַח אֲרוֹן סְפָרִים קָטָן שֶׁבַּגָּן. |
| 4 | watermelon | 20–27 | אַבָּא pulls a big red אֲבַטִּיחַ from a picnic basket; Bu claps | אָז הוֹצִיא אַבָּא אֲבַטִּיחַ אָדֹם וּמָתוֹק לֶאֱכֹל. |
| 5 | red | 27–31 | close-up: glossy red watermelon slice, juice-drop sparkle | אֵיזֶה כֵּיף הָיָה לְטַיֵּל עִם אַבָּא! |
| 6 | recap | 31–36 | Bu proud, arms up, kamatz sign בָּ floating like a star | כָּל הַכָּבוֹד יְלָדִים, לָמַדְתֶּם אֶת הַקָּמָץ! |
| 7 | keywords | 36–46 | the five keyword tiles around Bu: אַבָּא · אַרְנָב · אֲרוֹן · אֲבַטִּיחַ · אָדֹם | מִלֵּי מַפְתֵּחַ: אַבָּא, אַרְנָב, אֲרוֹן, אֲבַטִּיחַ, אָדֹם. |

**Keyword pedagogy:** each kamatz keyword (אַבָּא, אַרְנָב, אֲרוֹן, אֲבַטִּיחַ, אָדֹם) lights in the
accent color the moment it's spoken — the Captions active-word pop already does this word-exactly;
beat 7 re-shows all five as a calm recap.

**Loop:** end on the keyword tableau (Bu + sign), settling so frame-0 (Bu's wave + sign) reads as
"again." No CTA (mode:"kids").
