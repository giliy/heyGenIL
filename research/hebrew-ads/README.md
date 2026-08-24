# Hebrew Ads Research — index

Research program run 2026-08-22 (3 workflows, 17 agents, ~1.1M subagent tokens, 871 tool calls) on
how to harness this repo so Israeli small businesses can generate their own Hebrew advertising short videos.

- **[hebrew-ads-deep-dive.md](./hebrew-ads-deep-dive.md)** — the full research report:
  Israeli market & platforms, SMB budgets & pricing, competitor gap analysis, Hebrew ad language &
  slang, consumer psychology, sector lexicons, on-screen Hebrew/RTL, regulation, calendar, and the repo tech audit.
- **[harness-plan.md](./harness-plan.md)** — the concrete implementation plan for the harness:
  a `/make-ad` skill, an ad-mode `beats.json` contract, new ad components, per-vertical lexicon
  tables, and a WhatsApp-native GTM.

The companion HTML report (same content, shareable) is published as an artifact titled
**"פרסום בעברית" / Hebrew Ads Research**.

## TL;DR

The market is real, the language layer is mapped, and **the repo is ~80% ready** — a working Hebrew
RTL commercial already exists (`shorts/short-16-formy`). The missing 20% is: a `/make-ad` skill, three
ad components (CTA end-card, ₪ price badge, logo), a bidi-safe number fix, and a louder ad style
variant. No competitor ships natural-Hebrew-voice + correct-RTL-captions + Israeli-culture templates
at SMB prices — that is the open lane.
