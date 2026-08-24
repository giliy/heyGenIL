# short-16 · Commercial — Formy (פורמי) — "טופס דיגיטלי בעברית"

A 36s **product commercial** for [Formy](https://formy.co.il) — "פלטפורמת הטפסים
הדיגיטליים של ישראל" (Israel's digital forms platform). Hebrew-native, RTL on-screen,
Edge-TTS Hebrew voice (`he-IL-AvriNeural`), $0.

**Why TSX wins here:** the commercial's content IS a UI — a form card that builds,
signs, branches, and integrates. Remotion animates that natively (no real product
footage needed), and the pixels are fully brand-controlled.

## Fact base (verified from formy.co.il before scripting)

- **Product:** build digital forms in full Hebrew — drag-and-drop + AI builder.
- **Signature:** digital signature with audit log, one-time-code identity verification,
  and a tamper-proof evidence chain; claims compliance with Israel's Electronic
  Signature Law, 2001.
- **Features:** conditional logic, live analytics, granular permissions, templates
  (leads/hiring/events/contracts/RSVP), government forms hub, free tools.
- **Integrations:** Webhooks, Slack, Email, Google Sheets, Notion, Zapier, Morning
  (green invoice).
- **Pricing:** Free (₪0), Lite (₪29/mo), Basic (₪74), Pro (₪149, recommended),
  Unlimited (custom). "No credit card required to start."
- **Positioning:** local alternative to Google Forms / Typeform; made by CodePal.

## Beat sheet (time | on screen | VO)

| t | on screen | VO (Hebrew) |
|---|---|---|
| 0.5 | Hook headline: pain question | צריך להחתים הרבה לקוחות? |
| 3.3 | paper form crumples, mail envelope, red X | טפסים על הנייר. חתימות שצריך לשלוח בדואר. |
| 7.9 | Formy wordmark + 'פלטפורמת הטפסים הדיגיטליים של ישראל'; form card assembles | הכירו את פורמי — פלטפורמת הטפסים הדיגיטליים של ישראל. |
| 12.95 | form card BUILDS: field + checkbox + dropdown (RTL) | בונים טופס מרהיב בכמה לחיצות. |
| 16.0 | signature ink-stroke draws; green 'verified' seal; legal-chain chip | חתימה דיגיטלית. חוקית. עם שרשרת ראיות. |
| 21.5 | branch diagram (logic); live responses counter | לוגיקה מותנית, ואנליטיקה חיה בזמן אמת. |
| 25.35 | integration chips: Slack/Sheets/Webhooks/Zapier/Notion | מתחבר לשלאק ולגוגל שיטס. |
| 28.15 | 'response received' toast; small bar chart grows | עסקים בישראל כבר בונים איתנו. |
| 30.87 | Formy wordmark; CTA 'מתחילים בחינם' + no-credit-card badge | מתחילים בחינם. בלי כרטיס אשראי. |
| 35.6 | loop restore to frame 0 | (none) |

## Voice

`tools/gen_voice_edge.py` with `--voice he-IL-AvriNeural` — Microsoft Edge Hebrew neural
TTS, word-exact boundaries (the same pipeline as vox-3-dor-sever). Captions are RTL
pill/karaoke via the `rtl` prop on the shared captions; Hebrew renders through the
pre-wired **Heebo** font (`FONT_HEBREW`).

## Brand / taste

Calm-premium house style (§7): dark brand-mesh stage, indigo→violet→teal signature
gradient, felt-not-heard SFX, no CTA outros (the end card IS the ad's CTA, that's the
product — allowed). Seamless loop.
