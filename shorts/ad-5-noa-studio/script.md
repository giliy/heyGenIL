# script.md — ad-5-noa-studio

> Draft from tools/new_ad.py. The hook + offer copy are the craft — rewrite them against the
> `salon` playbook (`python tools/lexicon.py salon`) and lint with
> `python tools/lexicon.py --check salon "<line>"`. Gate the hook with
> `python tools/hook_craft.py check salon pain-question "<hook>"`.

**hook style:** pain-question   **register:** feminine-singular (את)   **voice:** he-IL-HilaNeural

| window (est) | beat  | VO (Hebrew) | on screen |
|---|---|---|---|
|  0.00– 2.00 | hook   | נמאס לשלם? | HOOK fully composed at frame 0 — the payoff visible on the first frame (no build-up). |
|  2.50– 4.50 | intro  | סטודיו נועה. | the business name + what it is, one line, brand accent. |
|  5.00– 7.45 | offer  | תספורת + פן במחיר השקה | the PriceBadge pops with the real numbers; oldPrice struck through if a sale. |
|  7.95–11.51 | proof  | המחיר כולל עיצוב מלא — בלי הפתעות בקופה. | the freier-proof: show the math / a concrete reason this is smart, not just cheap. |
| 12.01–14.01 | cta    | קבעי תור. | the AdEndCard pops and HOLDS to the last frame — WhatsApp/phone + website, tappable. |

The windows above are speech ESTIMATES; `gen_voice_edge.py --nikkud` writes the REAL word
times back into beats.json. Total duration ≈ last-speech-end + ~2.6s (the CTA hold), not a
round number.
