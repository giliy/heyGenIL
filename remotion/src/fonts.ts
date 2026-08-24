// Brand 3-font system. Latin faces load via @remotion/google-fonts; the HEBREW faces
// (Heebo + Rubik) are VENDORED offline so renders are deterministic and network-free —
// see lib/fontFaces.ts. <FontFaces/> is mounted at the composition root (Root.tsx) and
// injects @font-face rules for the local families 'Heebo-Local' (500/600/700, hebrew+latin),
// 'Rubik-Local' (700/900, hebrew+latin), 'Frank Ruhl Libre-Local' (500/700/900) and
// 'Varela Round-Local' (400). woff2 files live in media/library/fonts/.
import { loadFont as loadDisplay } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadBody } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadSerif } from '@remotion/google-fonts/Spectral';
import { loadFont as loadEditorial } from '@remotion/google-fonts/SourceSerif4';

// Local vendored Hebrew family names (defined by the @font-face rules in lib/fontFaces.ts).
// Exported so shots can opt into a specific local family directly if needed.
export const FONT_HEBREW_LOCAL = 'Heebo-Local';
export const FONT_RUBIK_LOCAL = 'Rubik-Local';
// P1 #16 display faces (OFL, vendored hebrew+latin — see lib/fontFaces.ts):
//   Frank Ruhl Libre — variable editorial serif for premium AD moments (500/700/900).
//   Varela Round     — rounded geometric sans, the KIDS headline face (400 only).
export const FONT_FRL_LOCAL = 'Frank Ruhl Libre-Local';
export const FONT_VARELA_LOCAL = 'Varela Round-Local';

// Every face falls back to the vendored Heebo (hebrew+latin) so Hebrew text renders with a
// real glyph anywhere — offline — no per-component changes for glyph coverage. Latin keeps
// its primary face; Hebrew letters drop to Heebo automatically via per-glyph fallback.
export const FONT_HEBREW_FALLBACK = `"${FONT_HEBREW_LOCAL}", sans-serif`;

// Hebrew-capable display face for RTL captions/titles (Heebo covers latin + hebrew subsets).
// VENDORED local family — @font-face injected by <FontFaces/> at the root (lib/fontFaces.ts).
export const FONT_HEBREW = `"${FONT_HEBREW_LOCAL}", ${FONT_HEBREW_FALLBACK}`;

// Primary Hebrew caption face: Rubik (hebrew+latin), VENDORED offline, falling back to the
// vendored Heebo so captions never render with a missing glyph and never hit the network.
export const FONT_HEBREW_CAPTION = `"${FONT_RUBIK_LOCAL}", ${FONT_HEBREW_FALLBACK}`;

export const FONT_DISPLAY = loadDisplay('normal', { weights: ['500', '600', '700'], subsets: ['latin'] }).fontFamily;
export const FONT_BODY = loadBody('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;
export const FONT_MONO = loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;
// serif for the Claude Code wordmark clone (close match to the app's serif)
export const FONT_SERIF = loadSerif('normal', { weights: ['500', '600'], subsets: ['latin'] }).fontFamily;
// heavy editorial serif for the vox collage engine's headlines (Publico-ish; Spectral maxes
// at 600 and reads too light/bookish over collage layers)
export const FONT_EDITORIAL = loadEditorial('normal', { weights: ['600', '700', '900'], subsets: ['latin'] }).fontFamily;

export const FONT_DISPLAY_H = `${FONT_DISPLAY}, ${FONT_HEBREW_FALLBACK}`;
export const FONT_BODY_H = `${FONT_BODY}, ${FONT_HEBREW_FALLBACK}`;
export const FONT_EDITORIAL_H = `${FONT_EDITORIAL}, ${FONT_HEBREW_FALLBACK}`;

// P1 #16 — vendored Hebrew display faces. Each falls back to Heebo (then Rubik) so a
// stray glyph never renders blank; both cover hebrew+latin incl. ₪ U+20AA and nikkud.
//   FONT_AD_SERIF   — Frank Ruhl Libre: premium editorial serif for ad headlines/end cards.
//   FONT_KIDS_ROUND — Varela Round: soft rounded face for kids-video headlines.
export const FONT_AD_SERIF = `"${FONT_FRL_LOCAL}", ${FONT_HEBREW_FALLBACK}`;
export const FONT_KIDS_ROUND = `"${FONT_VARELA_LOCAL}", ${FONT_HEBREW_FALLBACK}`;
