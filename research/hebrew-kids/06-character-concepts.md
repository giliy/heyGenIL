# 06 — Original Character Concepts (Phase 0 deliverable)

Three candidate mascots for the Hebrew kids' shorts series, each built on the decoded Stitch appeal
recipe (`01-character-appeal.md`). **All are original — none references Disney IP.** Target: ages 3–5.

Each concept below gives: the recipe checklist (so you can see the formula applied), the character
profile, and a draft `character.json` skeleton.

---

## 🥇 Concept A — שפופון (Shfofon), the hyrax

**Direction:** Israeli-native animal. A rock hyrax (שפן סלע) — native to Israel, naturally round and
cute, culturally ownable, and currently unclaimed as a children's character. This is the strongest
"cultural moat" concept: a character that is *from* Israel, for Hebrew-speaking kids.

| Recipe trait | How Shfofon embodies it |
|---|---|
| Baby-schema proportions | Huge round head (≈½ body), enormous low-set eyes, chubby cheeks, plump furry body, tiny stubby legs, mitten paws |
| "Cute but weird" signature | Two little front teeth that always stick out + a fluffy mohawk tuft that droops when sad |
| Mischievous-but-kind | Loves to hoard shiny things it "borrows" (buttons, spoons, kippot) — always returns them with a hug |
| Vulnerability | Gets scared of loud noises; hides under its own tail; needs the viewer to "help" it be brave |
| One saturated color | Warm sandy-orange (desert rock) with a cream belly |
| Signature sounds + catchphrase | Squeaky "ווּי!" (vuy!) gasp; catchphrase **"שפופון לא משאיר אף אחד לבד"** ("Shfofon never leaves anyone alone") — the ohana line |
| Signature gesture | Holds out a tiny paw for the viewer to "hold" |

**Personality one-liner:** A small round hyrax who borrows things he shouldn't, gets in over his
head, and is loved anyway — because nobody gets left alone.

**Why it wins the market:** Israeli parents get a character that is *theirs* — a native animal, a
Hebrew name, chagim/Shabbat content a global import can't touch. Distinct from the dub channels AND
from Yuval HaMebulbal's human-clown model.

```json
{
  "name": "shfofon",
  "display_he": "שפופון",
  "species": "rock hyrax (שפן סלע)",
  "rule": "NEVER generate from text twice; always from the locked character.png reference",
  "design": {
    "proportions": "head ~1/2 body, ~3.5 heads tall, oversized rounded head, chubby cheeks, mitten paws, stubby legs, zero sharp angles",
    "signature_feature": "two buck teeth always showing + a fluffy mohawk tuft that droops when sad",
    "palette": "saturated sandy-orange body, cream belly, dark warm eyes",
    "gesture": "holds out a tiny paw"
  },
  "voice": {
    "tts": "edge-tts he-IL-HilaNeural, pitched/warm delivery",
    "catchphrase_he": "שפופון לא משאיר אף אחד לבד",
    "signature_sounds": ["ווּי! (vuy! gasp)", "happy chirrup", "scared squeak"]
  }
}
```

---

## 🥈 Concept B — בּוּ (Bu), the gentle chaos-creature

**Direction:** gentle monster/alien — the direct Stitch/Grogu lineage. Maximum baby-schema freedom
and the strongest "mischievous chaos" engine, but needs design care so it reads as original, not a
Stitch knockoff (different silhouette, different color, no extra arms, no toothy alien grin).

| Recipe trait | How Bu embodies it |
|---|---|
| Baby-schema proportions | Enormous head (≈½ body), giant wide eyes, soft blobby body, tiny arms and legs |
| "Cute but weird" signature | A single curly antenna with a soft glowing tip that changes color with Bu's mood |
| Mischievous-but-kind | Accidentally makes messes (sneezes glitter, knocks things over bouncing) — then helps fix them |
| Vulnerability | The antenna droops/dims when Bu is sad or scared; lights back up when comforted |
| One saturated color | Soft saturated teal-green (distinct from Stitch's blue) |
| Signature sounds + catchphrase | A bouncy "בּוּ בּוּ!" (bu bu!) coo; catchphrase **"בּוּ אוהב אותך"** ("Bu loves you") |
| Signature gesture | Bounces in place when happy (three little boings) |

**Personality one-liner:** A bouncy little creature whose feelings glow on its antenna — it makes
gentle chaos, feels everything big, and always ends in a hug.

**Why it wins on appeal:** purest baby-schema execution, most merch-able, most globally legible
(prosody-over-vocabulary coos travel well if we later localize).

**Risk:** closest to the existing cute-monster lineage — must be differentiated hard in design.

```json
{
  "name": "bu",
  "display_he": "בּוּ",
  "species": "gentle creature (original)",
  "rule": "NEVER generate from text twice; always from the locked character.png reference",
  "design": {
    "proportions": "head ~1/2 body, ~3 heads tall, giant wide low-set eyes, soft blobby body, tiny limbs, no sharp angles",
    "signature_feature": "single curly antenna with a soft glowing mood-colored tip (dims when sad, bright when happy)",
    "palette": "saturated teal-green body, lighter belly, warm dark eyes",
    "gesture": "bounces in place three times when happy"
  },
  "voice": {
    "tts": "edge-tts he-IL-HilaNeural + coo/giggle overlays",
    "catchphrase_he": "בּוּ אוהב אותך",
    "signature_sounds": ["בּוּ בּוּ! (bu bu! coo)", "happy bounce-boing", "sad antenna-dim hum"]
  }
}
```

---

## 🥉 Concept C — טיפה (Tipa), the little raindrop

**Direction:** personified object/element — the TuTiTu lineage, but with a face, a Hebrew voice, and
a personality. Very toddler-legible (a raindrop is instantly readable at phone scale), gentle by
nature (fits the calm brand position perfectly), and a natural fit for the educational content
(colors, water, weather, counting).

| Recipe trait | How Tipa embodies it |
|---|---|
| Baby-schema proportions | One big round droplet body that IS the head; huge low-set eyes; tiny stubby arms; no legs (hops) |
| "Cute but weird" signature | A little swirl/curl at the top of the droplet (like a question-mark tuft) that wiggles |
| Mischievous-but-kind | Loves to splash and drip where she shouldn't (on heads, into cups, onto paper) — then helps clean up |
| Vulnerability | Afraid of evaporating in the sun; shrinks a little when sad; puffs back up with encouragement |
| One saturated color | Clear saturated sky-blue with a shine highlight |
| Signature sounds + catchphrase | A plippy "טיפּ!" (tip!) drop sound; catchphrase **"טיפה טיפה, ביחד ניפה"**-style rhythm — "drop by drop, together" |
| Signature gesture | A happy little hop that lands with a soft plip |

**Personality one-liner:** A curious little raindrop who drips into the wrong places, makes a splash,
and always finds her way back to her friends — drop by drop.

**Why it wins for the brand:** the most *calm* and gentle of the three — the strongest match for the
"Shorts you don't have to feel guilty about" parent position. Least likely to feel overstimulating.
Cleanest silhouette at tiny phone scale.

**Risk:** emotionally softer/less chaotic than A or B — the "mischief" is milder, so attachment may
build slower; also less ownable as a "creature."

```json
{
  "name": "tipa",
  "display_he": "טיפה",
  "species": "raindrop (personified element)",
  "rule": "NEVER generate from text twice; always from the locked character.png reference",
  "design": {
    "proportions": "droplet body IS the head, huge low-set eyes, tiny stubby arms, no legs (hops), soft round silhouette",
    "signature_feature": "a little question-mark swirl tuft at the top that wiggles",
    "palette": "saturated sky-blue, translucent shine highlight, warm dark eyes",
    "gesture": "happy hop landing with a soft plip"
  },
  "voice": {
    "tts": "edge-tts he-IL-HilaNeural, soft + gentle",
    "catchphrase_he": "טיפה טיפה, ביחד",
    "signature_sounds": ["טיפּ! (tip! drop plip)", "happy splash", "sad shrink-sigh"]
  }
}
```

---

## How to choose

| | **שפופון** (hyrax) | **בּוּ** (creature) | **טיפה** (raindrop) |
|---|---|---|---|
| Cultural moat / ownability | ⭐⭐⭐ strongest | ⭐⭐ | ⭐ |
| Raw baby-schema appeal | ⭐⭐ | ⭐⭐⭐ strongest | ⭐⭐ |
| Chaos/mischief engine | ⭐⭐ | ⭐⭐⭐ strongest | ⭐ |
| Calm/parent-trust fit | ⭐⭐ | ⭐ | ⭐⭐⭐ strongest |
| Merch/licensing potential | ⭐⭐ | ⭐⭐⭐ strongest | ⭐⭐ |
| Distinctness from existing IP | ⭐⭐⭐ | ⭐ (needs design care) | ⭐⭐⭐ |

**Recommendation:** **שפופון (Shfofon) the hyrax** — it uniquely combines strong baby-schema appeal
with the cultural moat (a native Israeli animal for Hebrew kids) that no import or dub can copy, and
it carries the ohana catchphrase naturally. It's the concept that owns a *position*, not just a look.

**Next step once you pick:** draft the full `character.json`, then lock a `character.png` reference
image (one paid generation, human-approved) — the iron rule that protects character consistency
across every episode. Then Phase 1 pipeline gaps, then the pilot batch.
