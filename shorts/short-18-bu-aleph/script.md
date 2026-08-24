# בּוּ — בּוּ וְהָאוֹת א (Bu and the letter Aleph)

**Sub-type:** faceless AI-image story (storybook track — `make-short` + `lib/story.tsx`).
**Series:** `bu-koala` (locked character `ai-shorts/bu-koala/character.jpg`).
**Audience:** ages 3–5, Hebrew-native. YouTube Made-for-Kids short.
**Voice:** edge-tts `he-IL-HilaNeural` motherese (`--rate -8% --pitch +4Hz`), FREE.
**Mode:** `mode:"kids"` — nikkud captions on, lineHeight ~1.5, gentle bouncy motion, no CTA outro.
**Format:** ~35s @30fps, 1080×1920. Hook <2s. Repetition ≥3×. Call-and-response with `[— 2.5s]`
engineered pauses. One idea, resolved warmly. Seamless loop (frame-0 ≈ last-frame).

**Budget:** ~10 images × `fast` tier (~$0.03 ea) ≈ **$0.30** (locked). Voice/music = $0.
**Music bed:** `kids-play-ukulele` (already in library).

---

## The one idea
The letter **א (aleph)** begins Bu's favorite word of all — **"אוֹתְךָ"** (you). We meet the letter,
find it again and again, and close on Bu's catchphrase. Warm, belonging, calm.

## Beat sheet (VO in nikkud'd child-directed Hebrew)

| # | Beat | On screen (AI image) | VO (clean Hebrew) | Notes |
|---|------|----------------------|-------------------|-------|
| 1 | hook | Bu's big face fills frame, one fluffy ear waves | **בּוּ בּוּ! שָׁלוֹם, יְלָדִים וִילָדוֹת!** | Greeting formula; hook <2s; name-coo |
| 2 | intro-letter | Big soft **א** floats beside Bu | **זוֹהִי הָאוֹת א.** | Introduce the letter; slow |
| 3 | mystery | Bu tilts head, points at **א** | **מָה מַתְחִיל בְּאוֹת א?** `[— 2.5s]` | Call-and-response, expectant pause |
| 4 | first-answer | Bu beside a giant, glowing apple (תַּפּוּחַ) | **תַּפּוּחַ! אָדוֹם וּמָתוֹק!** | Answer the call; apple = first-child-safe word |
| 5 | second-answer | Bu's happy face + a tiny chick (אֶפְרוֹחַ) | **וְגַם אֶפְרוֹחַ! קְטַן־קְטַן!** | Diminutive reduplication (harness §2) |
| 6 | repetition-build | Bu with **א** growing big and warm | **אוֹת א, אוֹת א — אֶפְשָׁר לְהַמְשִׁיךְ!** | Repetition ≥3×; singable |
| 7 | the-big-one | Bu heart-glows, arms wide to viewer | **אֲבָל הַיּוֹם הָאוֹת א עוֹשָׂה אוֹתְךָ!** | The belonging payload: "אותך" |
| 8 | catchphrase-payoff | Bu hugs, antenna/heart warm glow | **בּוּ בּוּ — אוֹהֵב אוֹתְךָ!** | Engineered catchphrase; warm close |

**Seamless loop:** end on the catchphrase frame, visually settling so frame-0 (Bu's wave) reads as
"again" — same warm framing, gentle entry. No CTA.

---

## Production notes (for the build)

- **Character consistency:** every image is `gen_image.py --ref ai-shorts/bu-koala/character.jpg`
  with the SAME design line ("this exact cute yellow koala creature, big fluffy round ears with
  cream inner fluff, soft plush body, huge dark eyes, gentle smile") + per-beat scene.
- **Images:** 8 beats → `media/projects/short-18-bu-aleph/b1-hook.png` … `b8-payoff.png`,
  model `fast`, aspect 9:16, 2K.
- **Captions:** `Captions ... rtl kidsNikkud` (nikkud kept), lineHeight ~1.5, Heebo/Rubik, amber accent.
- **Voice:** `gen_voice_edge.py --voice he-IL-HilaNeural --rate -8% --pitch +4Hz`.
- **Music:** `kids-play-ukulele` bed under the voice, ducked.
- **QA:** render phone-scale frames, READ them (bidi-check, nikkud lineHeight), then full render.
