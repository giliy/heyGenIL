# Third-Party Notices

This project bundles the following open-source packages. Each retains its own
license; the license text ships in each package's `node_modules/<pkg>/LICENSE*`.

| Package | License | Notes |
|---|---|---|
| `@remotion/rough-notation` | MIT | Declared in `package.json` (author Jonny Burger / Remotion). The npm tarball does **not** bundle a LICENSE file — a packaging omission. MIT SPDX verified at source (`packages/rough-notation/package.json` in remotion-dev/remotion). |
| `roughjs` | MIT | LICENSE bundled in package. Hand-drawn sketch strokes (`lib/sketch.tsx`). |
| `perfect-freehand` | MIT | LICENSE bundled in package. Pressure-varying strokes (`lib/freehand.tsx`). |
| `remotion-captions-kit` | MIT | LICENSE bundled in package. Per-word caption timing (`lib/captions-kit.tsx`). |
| `@tabler/icons-react` | MIT | LICENSE bundled in package. Curated brand/platform icons (`lib/icons.tsx`). |
| `flubber` | MIT | Path-morphing interpolator (`lib/morph.tsx`). P1-1. |
| `@paper-design/shaders` | Apache-2.0 | WebGL shader backgrounds (GrainGradient, …). P1-3. **Must drive with `speed={0}` + frame-derived `frame` prop** for determinism. |
| `@paper-design/shaders-react` | Apache-2.0 | React bindings for the above. P1-3. |

## License discipline (repo rule)

Only permissive, commercial-use licenses are adopted: MIT, Apache-2.0, BSD, ISC,
OFL (fonts), CC0 (assets). Rejected on license grounds during the P0 research:
`remotion-bits` (no LICENSE file anywhere), `phonikud-tts` (CC-BY-NC),
`DiffRhythm` (required VAE inherits a $1M revenue cap), `DeepFilterNet` (weights
unlicensed), `ACE-Step-1.5` (weights license only a self-declared tag),
`ostris ai-toolkit` w/ FLUX (FLUX.1-dev Non-Commercial). Re-check the license of
any new model/library before shipping it.
