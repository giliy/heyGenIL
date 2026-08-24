# brief.md — ad-5-noa-studio

> Scaffolded by tools/new_ad.py from the `salon` lexicon. Edit the offer/hook to the
> real business before building. Register is pre-set; do NOT fight it (the lexicon owns it).

## business
- **name:** סטודיו נועה
- **vertical:** salon — מספרה (נשים)
- **city:** תל אביב
- **phone:** 050-111-2222   **whatsapp:** 050-111-2222   **website:** —

## offer
- **headline:** תספורת + פן במחיר השקה
- **price:** 149.0 ₪   **oldPrice:** 220.0
- **offer structure (lexicon):** first-visit perk or off-peak special; word-of-mouth discount (הנחה למעבירי מילת הפה).
- **magic phrases (lexicon):** הבאת חברה — שניכן מרוויחות

## cta
- **type:** whatsapp   **text (lexicon):** קבעי תור
- **NEVER (lexicon):** תפוס מקום

## brand
- **accent:** #C026D3   **hookStyle:** pain-question

## register (the lexicon owns this)
- **register:** feminine-singular   **address pronoun:** את
- **gender note:** Feminine-singular (את, קבעי, הגיעי). Appointment economy.
- **edge-tts voice:** he-IL-HilaNeural
- **allowed hook styles:** pain-question · free-trial · social-proof
- **taboos:** גוף-שיימינג · הבטחת תוצאה מוחלטת

## voice command (Stage 4)
```
.venv-voice312\Scripts\python.exe tools/gen_voice_edge.py --beats shorts/ad-5-noa-studio/beats.json \
    --voice he-IL-HilaNeural --nikkud --emit-ts remotion/src/shots/ad-5/vo.gen.ts
```
