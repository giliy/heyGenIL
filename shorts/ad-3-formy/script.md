# ad-3 · Commercial — Formy (פורמי) — "חתימה דיגיטלית בחינם" (the free plan)

A ~19s Hebrew RTL **ad** for [Formy](https://formy.co.il), selling the **free plan** (₪0).
Voice = edge-tts `he-IL-AvriNeural` (male, neutral-plural register, **$0**). mode:"ad" —
the conversion CTA (WhatsApp end card) IS the payoff; no seamless loop, the card HOLDS.

## Fact base (verified from formy.co.il 2026-08-23)

- **Free plan (₪0/חודש, ללא כרטיס אשראי):** unlimited active forms, up to 5 signed
  documents/mo, 10 AI form-creations/mo, file uploads to 5MB, digital signature with audit
  log + signer identity verification + evidence chain, Hebrew RTL editor, contacts/groups.
- **Signature is legal:** digital signature with audit log, one-time-code identity
  verification, tamper-proof evidence chain (short-16 cites Israel's Electronic Signature
  Law, 2001).
- **Positioning:** "פלטפורמת הטפסים הדיגיטליים של ישראל" — the Hebrew-native forms
  platform, a local alternative to Google Forms / Typeform.
- **CTA on the site:** "התחילו עכשיו בחינם" + "דברו איתנו" → WhatsApp +972-50-679-3057.
- **Reassurance:** "ללא כרטיס אשראי · התחלה ב-30 שניות".

## Beat sheet (time | on screen | VO)

Register = neutral-plural (אתם / דברו). The speech-driven windows are set AFTER voice gen;
these are the draft targets (~2.7 w/s).

| t (s) | on screen | VO (Hebrew) |
|---|---|---|
| 0.0 | **HOOK**, fully composed at frame 0: big white line "חתימה דיגיטלית" + teal "בחינם." over a faint form card | **חתימה דיגיטלית בחינם.** *(hook, 3 words)* |
| 2.6 | **INTRO** — gradient "פורמי" wordmark + tagline; form card assembles | **פורמי. פלטפורמת הטפסים של ישראל.** |
| 6.2 | **BUILD** — the form card builds: name field + email field + checkbox fill (RTL) | **בונים טופס בעברית בכמה לחיצות.** |
| 9.7 | **SIGN** — ink signature draws; green ✓ מאומת seal stamps; evidence-chain chip | **חתימה דיגיטלית חוקית. עם שרשרת ראיות.** |
| 13.8 | **CTA** — the WhatsApp end card pops and HOLDS (₪0 + בלי כרטיס אשראי + formy.co.il + 050-679-3057) | **התחילו עכשיו. בלי כרטיס אשראי.** |
| ~19 | end — the card holds, tappable | (none) |

## Word budget

3 + 7 + 7 + 7 + 7 = **31 words** (well under the 45–70 ad cap — a tight, punchy ad).
The hook is a `vo[]` line tagged `beat:"hook"` so the hook-craft gate runs on it.

## Voice

`tools/gen_voice_edge.py --beats …/beats.json --voice he-IL-AvriNeural --emit-ts
remotion/src/shots/ad-3/vo.gen.ts`. Word-exact boundaries → RTL pill captions
(`Captions lines={VO} rtl`), Hebrew through the vendored Heebo font.

## Register / taste

- saas lexicon: neutral-plural, Hebrish fine, magic phrase **ללא כרטיס אשראי**.
- CTA from the lexicon family — the end card's spoken line is "התחילו עכשיו. בלי כרטיס
  אשראי." (free-trial CTA); the card's button is "דברו איתנו בוואטסאפ" (the site's own CTA).
- `cta_never` (תפוס מקום) avoided; no taboo terms; no hidden-subscription implication
  (the saas taboo) — the ad stresses **בלי כרטיס אשראי**.
- No urgency / no discount → no §15 scope/total-price disclosure required (it's ₪0, always).

## What we WILL build (stated before any pixels)

- **Beats:** hook → intro → build → sign → cta (5 scenes, ~19s total).
- **Voice:** edge-tts AvriNeural, **$0** (no paid step).
- **Composition:** `remotion/src/shots/ad-3/Ad3Formy.tsx` — persistent form-card hero,
  PriceBadge (₪0) + AdEndCard (WhatsApp), RTL captions, indigo/violet/teal brand grade.
- **Cost to make:** **$0** (edge-tts only; no ElevenLabs, no fal/Gemini pixels).
