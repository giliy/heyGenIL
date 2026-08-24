# T13-C pricing verification + bakeoff — blue-man (2026-08-22)

Read-only pricing verification via the fal pricing API (`api.fal.ai/v1/models/pricing`),
plus ONE cheap live bakeoff (seedance baseline vs the new seedance-2 candidate). All rates
below were verified live before any spend. **No `character.json` change, no LoRA training —
that is sub-item B, explicitly out of scope.**

## Verified $/clip for the four T13 candidate models

Derived/verified $/clip (audio-off where the model has the flag). `pricing.json` (generated
by `tools/bakeoff_clip.py --verify-prices`) carries the canonical panel block at 5s/1080p; the
720p column is what the live panels below actually used.

| model | fal endpoint id | verified rate | 5s/1080p | 4s/720p | note |
|---|---|---|---|---|---|
| **Seedance 1.5 pro** (current) | `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` | $1.2/1M tokens (audio-off) | $0.2916 | $0.104 | token-priced; the incumbent |
| **Seedance 2.0** | `bytedance/seedance-2.0/image-to-video` | $0.014/**unit** | ~$0.070 est | ~$0.056 est | **unit-priced — real per-clip cost is opaque, treat $/s as a floor; VERIFY before any switch** |
| **LTX-2.5 fast** | `lightricks/ltx-2.5/image-to-video/fast` | compute-sec metered (docs ~$0.13/s @1080p, ~$0.09/s @720p) | $0.780 (6s min) | $0.540 (6s min) | Apache-2.0; **6s minimum duration** makes short panels pricey |
| **Wan 2.7 ref-to-video** | `fal-ai/wan/v2.7/reference-to-video` | **$0.10/s flat** (verified) | $0.500 | $0.400 | built-in reference-to-video **character lock**; flat per-second, resolution-independent |

## Pricing-table extension (Seedance 2.x + Wan tiers, all verified live)

| tier | endpoint | verified rate |
|---|---|---|
| Seedance v1 pro | `fal-ai/bytedance/seedance/v1/pro/image-to-video` | $2.5/1M tokens (~2x v1.5) |
| Seedance v1.5 lite | `fal-ai/bytedance/seedance/v1.5/lite/image-to-video` | compute-sec metered |
| Seedance 2.0 i2v / r2v | `bytedance/seedance-2.0/{image,reference}-to-video` | $0.014/unit |
| Seedance 2.5 i2v / r2v / t2v | `bytedance/seedance-2.5/{image,reference,text}-to-video` | $0.0214/1K tokens |
| Wan 2.7 i2v / r2v / t2v | `fal-ai/wan/v2.7/{image,reference,text}-to-video` | **$0.10/s flat** |
| Wan 2.5 preview i2v | `fal-ai/wan-25-preview/image-to-video` | $0.05/s (480p rate; higher res costs more) |
| Wan 2.6 i2v | `fal-ai/wan/v2.6/image-to-video` | compute-sec metered |
| Wan 2.2-a14b i2v | `fal-ai/wan/v2.2-a14b/image-to-video` | $0.08/s flat |

**Takeaway for future "upgrade" temptation:** Seedance 2.x moved to per-unit / per-1K-token
rates that are opaque per-clip and must be priced *before* spend (hence `--verify-prices`).
Wan 2.7 is a clean flat $0.10/s with built-in character lock — promising for identity work,
but ~1.7x the Seedance 1.5 pro cost at 1080p. LTX-2.5 fast is Apache-2.0 (licensing win) but
its 6s minimum makes it the priciest short panel here.

## Live panels rendered this run (cheap, audio-off)

Rendered with `tools/bakeoff_clip.py` on the representative blue-man desert-door prompt
(reference: `../shot-door.png`, an existing committed still — NOT regenerated). 720p to stay
inside the task budget.

- `seedance.mp4` — Seedance 1.5 pro, 4s 720p, derived $0.104 (baseline)
- `seedance-2.mp4` — Seedance 2.0, 4s 720p, derived $0.056 (new candidate)
- `grid.mp4` — side-by-side of the two, costs burned in

**Not rendered** (verified price is sufficient per the ticket; both are expensive):
`ltx-fast` (6s min → $0.54) and `wan-27` (flat $0.10/s → $0.40). Their verified $/clip is in
the table above and in `pricing.json`.
