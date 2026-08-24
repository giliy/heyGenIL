# פרסום בעברית — Deep-dive research: harnessing the factory for Hebrew advertising shorts

**Run:** 2026-08-22 · 3 workflows · 17 agents · ~1.1M subagent tokens · 871 tool calls
**Goal:** figure out how to let Israeli small businesses generate their own Hebrew advertising short videos with this repo.

---

## 0. Executive summary

Israel is a **video-first, mobile-first, WhatsApp-centric, extremely price-sensitive market** with a
young population (median age 29.2) and near-universal adult social-media use (93.8% of adults). Short
vertical video is the dominant ad surface, and Israeli SMBs are a huge, fragmented, cash-strapped,
underserved base (~600–730K businesses, most one-person).

The single most important finding: **no tool today — global or local — natively produces a polished
30-second Hebrew ad with a natural voice, correct RTL burned-in captions, and Israeli cultural
context at SMB prices.** Global AI video tools treat Hebrew as a checkbox; Israeli production is
expensive (₪1,200–5,500 for a single promo). That gap is the open lane.

And the repo is **~80% ready**: a working Hebrew RTL commercial (`shorts/short-16-formy`) already
proves the voice → word-exact caption → RTL-render chain. The missing 20% is a `/make-ad` skill,
three ad components, a bidi-safe number fix, and a louder ad style.

---

## 1. The market & platforms

| Platform | Israel reach | Skew | Role for SMB |
|---|---|---|---|
| **YouTube / Shorts** | 7.01M (73.4% of pop.) — largest | balanced | broadest canvas, mass reach |
| **Facebook** | 5.05M (52.9%), ~77.7% of social referral traffic | slightly male, older | **default SMB paid lead-gen** |
| **Instagram / Reels** | 5.00M (52.4%), fastest-growing (+13.6% YoY) | 54% female, <45 | premium canvas for beauty/fashion/food |
| **TikTok** | 4.49M adults (69% of 18+) | 57% male, young | growth/"innovation" channel (62% of Israeli marketers raising budgets) |
| **WhatsApp** | 99% of population, 98% daily | universal | **the de-facto commerce/closing layer** — not an ad platform, the conversion channel |

**Structural facts:** 91.3% internet penetration · 109% mobile connections · median age 29.2 ·
sound-on is the norm in Hebrew (audio carries tone/humor/colloquialism that captions can't) — the
**opposite of US silent-first design**.

**Posting rhythm (Jewish calendar-shaped):** weekday evenings 18:00–23:00 are the core window ·
Friday afternoon is a steep lull (Shabbat prep) · **Saturday night after Shabbat (~20:00+) is the
single peak scrolling window of the week.** Never post on Shabbat, Yom Kippur, or Memorial Day.

---

## 2. SMB budgets & pricing reality

- ~**700–730K active businesses**; 68% are self-employed one-person operations. SMBs = ~55% of
  output but only ~24% of business credit (6–8% interest vs 3–4% for large firms). 2024: 50K closed
  vs 46K opened (net decline, 2nd straight year; bankruptcies +15%).
- **Marketing budgets:** FB/IG ads floor ₪1,500–3,000/mo · one serious channel ₪3,500–6,000/mo ·
  growth ₪7,000–15,000/mo.
- **Social-media management:** ₪1,200–3,000/mo (low end) · ₪3,000–5,000/mo (typical SMB) ·
  ₪8,000–15,000+/mo (startups/brands). AI-content tools: ₪109–1,399/mo.
- **Produced promo video (סרטון תדמית):** ₪1,200–2,800 (simple 30–60s) · ₪3,000–5,500 (mid) ·
  ₪12,000–25,000+ (complex).
- **Pain points:** time + money ("יקר, מסורבלת, ולוקחת זמן"); 48% feel **enslaved to the business**.
- **AI adoption is high** (28% of businesses, 2× the EU average; 57% of self-employed want
  AI+marketing skills) **but consumer trust is fragile**: fully-AI ads get +19% clicks, yet a
  "Created with AI" label cuts clicks ~31.5%. → Market "your products, AI-assisted" / authentic
  UGC-style, not obvious synthetic avatars.

**SaaS price psychology (Israeli SMB):** ActiveTrail anchors the market at **₪50–60/mo**.
Under ~₪100/mo = impulse-buy, card-on-file, treated like Netflix. ₪100–300 = "real tool" needing
ROI. ₪400+ = agency tier. **But:** the $25–50/mo band has the *highest* churn in B2B SaaS (8.6%/mo);
AI-native tools <$50 retain only 23% of revenue. → stickiness (habit loops, saved brand assets,
visible views/leads) is survival.

---

## 3. Competitor gap analysis — the open lane

| Tool | Hebrew voice | RTL captions | Verdict |
|---|---|---|---|
| **HeyGen** | only on Creator plan ($29/mo) | not documented | Hebrew possible but gated, no slang tuning |
| **Synthesia** | in 140+ dubbing langs, claims RTL | claimed | corporate presenters, not casual Israeli SMB ads |
| **D-ID** (Israeli) | via Azure — only 2 flat Hebrew voices | — | minute-based, no styles, robotic Hebrew |
| **CapCut** | no Hebrew TTS | no RTL | dominant free editor, but Hebrew absent |
| **Canva** | no Hebrew AI voice | RTL = long-standing complaint | SMB favorite, not a Hebrew VO tool |
| **ElevenLabs** (inside Pictory/Powtoon/invideo) | Hebrew only on v3 (not v2/flash) | — | hidden quality trap — depends which model the tool routes to |
| **Wix + Hour One** (Israeli) | — | — | **the direct future threat**: Wix owns the Israeli SMB website relationship |

**Net gap:** nobody ships natural-Hebrew-voice + correct-RTL-burned-captions + Israeli-culture
templates + ₪ SMB pricing. **Move before Wix productizes Hour One.**

---

## 4. The Hebrew language of Israeli ads

**Register:** semiformal spoken Hebrew (תקנית-לייט) is the sweet spot — never formal (אנו, הינך,
לפיכך read as stiff/alienating), rarely pure street. Rule: **"ISRAELI > ACADEMY" — write how 9
million people speak.**

**CTAs:** plural imperative (הזמינו עכשיו, גלו, חסכו, נסו) is the default. Future-tense softens
(תכתוב לי) for personal/service brands.

**Hebrish is expected:** סייל, דיל, ברנד, אונליין, להזמין are fully naturalized. Prefer Hebrew where
a good word exists (יתרון not אדוונטג׳). Tech audiences take heavy Hebrish; broad audiences need light.

**Urgency/discount cluster:** מבצע, הנחה, חינם + עכשיו, היום, נגמר, רק, עד גמר המלאי.
**Magic phrases:** **בלי מנוי** (no subscription) and **חד פעמי** (one-time) — Israelis hate
recurring payments. Prices always in ₪, never $.

**Slogan formula:** 3–6 words, rhyming/punning, a Hebrew root verb or a naturalized English noun
(זה טוב, זה אסם · מה הקשר? בירה נשר! · ככה זה כשאוהבים).

**Gender:** masculine-plural (אתם) is the broad default — but **it is actively wrong for women's
beauty** (use feminine-singular את). Register is vertical-dependent, not universal.

**Never in digital Hebrew:** ניקוד (vowel marks) — write ktiv maleh, unambiguous short words. Use
Hebrew quotes (״ ״), gershayim abbreviations (סה"כ, בע"מ).

---

## 5. Social-media spoken Hebrew: hooks & slang

**3-second hook formulas:** רגע, אתם חייבים לראות את זה · סיפור מטורף · אף אחד לא מדבר על זה ·
רגע, תקשיבו לי · יאללה, בואו נראה מה קורה פה.

**Core interjections (Arabic-derived, instantly native):** יאללה, וואלה, סבבה, אחלה, תכלס, חבל"ז
(ironic = "amazing"), סחתן.

**Directness is a feature:** dugri (דוגרי) bluntness and tachles (bottom-line) are trust signals.
Fast, high-energy, direct-to-camera, first-person — "סבבה, בואו נדבר על…"

**Audience splits:** secular Tel Aviv = maximally slangy + English; national-religious = blessings
(ב"ה, יהיה בסדר); Haredi = Yiddish/Aramaic (בלי נדר), no internet slang; Arab-Israeli = Arabic
interjections (סחתן, חביבי).

**Meme texture:** ironic inversion (חבל על הזמן = amazing), elongation (staaaaam), reduplication
(בלה-בלה), teen leetspeak (ס22ה), laughter = חחחחח.

---

## 6. Consumer psychology — the cultural code

1. **Never make the viewer a פרייר (freier/sucker).** The "11th commandment: לא תצא פראייר." Frame
   every deal as proof the buyer is **smart** ("you beat the system"), not merely cheap. Show the math.
2. **שווה ("worth it") beats "cheap."** Israelis are value-maximizers, not bargain-hunters. The 2011
   cottage-cheese boycott (100K FB members, −30% demand, price reversed in days) made consumers
   durably price-militant. Israel is the OECD's 4th-most-expensive country; food ~51% above EU.
3. **Speak דוגרי from a named, visible owner.** Polish reads as "someone's trying to fool me." The
   **חנות של משפחה** (family shop) and מפה לאוזן (word-of-mouth) out-trust any faceless brand.
4. **Warmth + משפחתיות + nostalgia** is the emotional payload (the Bamba playbook — 25% of the snack
   market via a baby mascot).
5. **Make the brand the customer's ALLY** against profiteering (the Shufersal-vs-Tnuva playbook).
6. **חוצפה + דווקא humor** — punch UP at institutions/situations, self-deprecate first, never punch
   down at the customer.
7. **Hard taboos:** no Holocaust, no terror victims, no fallen soldiers, no army-as-sales-device
   (Cellcom 2009 lesson), no casual politics/religion. In wartime: sober, service-oriented, or
   "strategic silence."

---

## 7. Sector lexicons (per-vertical)

The #1 product rule: **each vertical loads its own vocabulary, offer structure, register, CTA, and
proof type** — generic ad-Hebrew reads as "not written for my business."

- **Restaurants/food:** fixed-price multi-person packages with price-anchoring (ארוחה לזוג ב-165 ש"ח
  במקום 336), course vocabulary (מנות פתיחה/עיקרית/קינוח), transliterated dish names (אנטריקוט,
  צ'יפס), kosher/premium signals. **CTA = "הזמנת שולחן"/"הזמנת מקום" — NOT "תפוס מקום."**
- **Beauty/salon (women):** ALL persuasive copy in **feminine singular** (אני מזמינה אותך, עצרי,
  בחרי); slash-forms (את/ה) only in functional/consent text. Clinical vocabulary (אבחון, פרוטוקול,
  רטינול). Structure: concern→empathy→clinical-solution→invitation. Before/after as narrative.
- **Salon/barbershop:** appointment economy (קביעת תור, תזכרות אוטומטיות); first-visit perk,
  word-of-mouth discount (הנחה למעבירי מילת הפה), off-peak special. Barbershop = masculine address.
- **Real estate:** discount typology (הנחה אמיתית, הנחה פיננסית), payment splits (10%-90%, פטור
  מהצמדה), room-count sizing (דירות 4 חדרים), the ממ"ד (safe room) selling point, anchor against
  מחיר מחירון. Buyer-empowerment CTAs (בדיקת עסקאות דומות).
- **Fitness:** the offer is a **trial** (שיעור ניסיון חינם / שבוע התנסות) with real fine print as
  trust (מוגבל לשימוש 1 בחצי שנה, תקף ל-6 חודשים). Proof = לפני ואחרי transformation.
- **Trades:** emergency/speed (צנרת שהתפוצצה לא מחכה, מי שעונה ראשון לוקח את העבודה) + trust
  credentials (מאומתים, אחריות שנה-שנתיים) + tiered pricing (בסיסי/סטנדרטי/פרימיום). CTA =
  "השוו הצעות" via one free WhatsApp inquiry.

---

## 8. On-screen Hebrew / RTL

- **Fonts Israeli designers use:** Assistant, Heebo, Rubik, Alef, Varela Round (sans, screen) · Frank
  Ruhl (serif, premium) · Secular One / Amatic SC (display). All free with full Hebrew coverage.
- **Burned captions are the Israeli norm** (subtitles were always "part of the image"; dubbing never
  won). Max **2 lines** per card, ~60 chars full-width Hebrew, ktiv maleh, no nikud.
- **The #1 technical risk is bidi, not fonts:** trailing punctuation/percent/phone can jump to the
  wrong side. Fix = RTL base direction on the caption block + isolate numbers/Latin tokens. Test
  `50% הנחה`, phone numbers, and line-end `!` before render.
- **Text animation:** reveal whole line blocks, wipe right-to-left, slide in from the right — **avoid
  per-character typewriter** (it scrambles Hebrew word order).
- **Caption style:** bold weight, white/bright with a dark strip/heavy outline, bottom-third,
  emoji only at line start/end (1–3 max, e.g. "🔥 מבצע חם").

---

## 9. Israeli ad regulation (bake into the generator)

- **Consumer Protection Law Sec. 2** — no misleading on any material matter.
- **Sec. 7a + 1991 regs** — special protection against deceptive marketing to minors.
- **Sec. 15** — any special sale must disclose scope, terms, and discount rate; **total price** online.
- **Influencer/native ads** must be visibly labeled **"פרסום בשיתוף פעולה" / "שת״פ ממומן"** up front.
- Also handle **Privacy Protection Law Amendment 13** (in force Aug 2025) for customer data, and
  **ACUM music licensing** for commercial video.
- *(Exact fine amounts unverifiable from gov.il in this environment — confirm current figures before relying.)*

---

## 10. The Israeli marketing calendar

Demand concentrates into holiday spikes — a calendar-aware generator templates the angle per vertical
and pre-loads 1–2 weeks ahead:

- **Tishrei (Sep–Oct)** — Rosh Hashana/Yom Kippur/Sukkot = the biggest family/gift/food season + back-to-school (Sep 1). Angles: family dinner, new beginnings, gifts.
- **Hanukkah (Dec) + Black Friday (late Nov, now near-month-long in Israel)** — the biggest gift+discount window.
- **Purim (Mar)** — costumes/party/beauty spike.
- **Passover (Apr)** — the largest single food-spend holiday (Seder, kosher-for-Passover pantry replacement, cleaning, family).
- **Independence Day (May)** — the BBQ/mangal + blue-white peak (meat, venues, beverages).
- **Tu B'Av (Aug)** — the "Jewish Valentine's Day" romance/gift mini-peak.
- **Summer (Jul–Aug)** — end-of-season fashion clearance (up to 70% off) + pre-summer body season for gyms/beauty.
- **Ramadan/Eid (Feb–Mar 2026)** — for the Arab-Israeli audience/verticals.

---

## 11. Tech audit — what this repo already has vs. what's missing

### Already built (proven by `shorts/short-16-formy`, a real 36s Hebrew RTL commercial)
- **Voice:** `tools/gen_voice_edge.py` — edge-tts `he-IL-AvriNeural`/`he-IL-HilaNeural`, free,
  unlimited, native WordBoundary word timestamps.
- **Alignment:** whisperX `he` → `imvladikon/wav2vec2-xls-r-300m-hebrew`, wired `--lang he` end-to-end.
- **Captions:** `shorts.tsx` RTL contract — `direction:'rtl'`, `unicodeBidi:'isolate'`,
  `anchorRtl()` RLM, `stripNikkud()`, `rtl` prop on `CaptionsPop`/`CaptionsPill`.
- **Fonts:** Heebo + Rubik vendored offline, `hebrew+latin` ranges incl. ₪.

### Missing (the work)
| Gap | Severity | Fix |
|---|---|---|
| ElevenLabs default model is v2 — **no Hebrew** | blocker | use `--model eleven_multilingual_v3 --lang he` for ElevenLabs; default to edge-tts |
| kokoro offered as an engine but **has no Hebrew** | major | exclude kokoro for Hebrew; the $0 Hebrew path is edge-tts |
| No `/make-ad` skill or ad template | major | author it, reuse short-16-formy as reference |
| **No CTA end-card / ₪ price-badge / logo component** | blocker→major | add `remotion/src/lib/ads.tsx` (AdEndCard, PriceBadge, Logo) |
| brand.md forbids CTA outros + loud energy | major | explicit ad-mode override (drop seamless loop, allow CTA card) |
| Mixed Hebrew+digit caption tokens can bidi-reorder | major | `formatILPrice()` + isolated-digit formatter for phones |
| Ad contract fields not validated | major | `validate_ad_beats()` in `tools/contracts.py` |

---

## 12. Sources

Full per-finding source URLs are embedded in each workflow's raw output. Primary sources: DataReportal
Digital Israel (2024/2025/2026), ISOC social-media survey 2025, Bezeq State of the Internet 2025,
Globes, TheMarker, Calcalist, ICE, Ynet, Times of Israel, Jerusalem Post, Hebrew Wikipedia
(סלנג עברי, סיסמה (פרסום), פראייר, כתוביות, חוק הגנת הצרכן), ActiveTrail/vcita/Canva/Monday pricing,
HeyGen/Synthesia/D-ID/ElevenLabs docs, rest.co.il, and Israeli SMB marketing guides.

---

*For the build order, see `harness-plan.md`.*
