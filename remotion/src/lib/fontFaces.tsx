// VENDORED HEBREW/LATIN FONTS — offline, deterministic.
// Generated from tools/fonts/manifest.json by tools/fonts/gen-fontfaces.mjs.
// The woff2 files live in media/library/fonts/ (Remotion's public root is media/), referenced
// via staticFile('library/fonts/...'). <FontFaces/> injects the @font-face rules into the
// document head at the composition root, so every shot can use the local families without any
// network fetch at render time (replaces @remotion/google-fonts runtime loading for these).
//
// Local family names: 'Heebo-Local' (500/600/700, hebrew+latin), 'Rubik-Local' (700/900, hebrew+latin).
import React from 'react';
import { staticFile } from 'remotion';

// The @font-face CSS. staticFile() is interpolated per src so Remotion resolves the public-dir URL.
export const FONT_FACES_CSS = `
  /* Rubik 700 hebrew */
  @font-face {
    font-family: 'Rubik-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Rubik-700-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Rubik 700 latin */
  @font-face {
    font-family: 'Rubik-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Rubik-700-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Rubik 900 hebrew */
  @font-face {
    font-family: 'Rubik-Local';
    font-style: normal;
    font-weight: 900;
    font-display: block;
    src: url(${staticFile('library/fonts/Rubik-900-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Rubik 900 latin */
  @font-face {
    font-family: 'Rubik-Local';
    font-style: normal;
    font-weight: 900;
    font-display: block;
    src: url(${staticFile('library/fonts/Rubik-900-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Heebo 500 hebrew */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-500-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Heebo 500 latin */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-500-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Heebo 600 hebrew */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 600;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-600-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Heebo 600 latin */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 600;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-600-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Heebo 700 hebrew */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-700-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Heebo 700 latin */
  @font-face {
    font-family: 'Heebo-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Heebo-700-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Frank Ruhl Libre 500 hebrew */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-500-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Frank Ruhl Libre 500 latin */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-500-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Frank Ruhl Libre 700 hebrew */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-700-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Frank Ruhl Libre 700 latin */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-700-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Frank Ruhl Libre 900 hebrew */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 900;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-900-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Frank Ruhl Libre 900 latin */
  @font-face {
    font-family: 'Frank Ruhl Libre-Local';
    font-style: normal;
    font-weight: 900;
    font-display: block;
    src: url(${staticFile('library/fonts/Frank Ruhl Libre-900-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Varela Round 400 hebrew */
  @font-face {
    font-family: 'Varela Round-Local';
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile('library/fonts/Varela Round-400-hebrew.woff2')}) format('woff2');
    unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
  }
  /* Varela Round 400 latin */
  @font-face {
    font-family: 'Varela Round-Local';
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile('library/fonts/Varela Round-400-latin.woff2')}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
`;

// Render this ONCE at the composition root (see Root.tsx). It injects the @font-face rules
// into the document so the local families resolve during render.
//
// Fonts are vendored woff2 with font-display:block, so text is HIDDEN until the face for
// the run of glyphs finishes downloading. If we capture (QA stills or a frame) before the
// webfonts resolve, every caption/overlay comes back blank — the classic blank-text QA bug.
// delayRender/continueRender holds the frame until document.fonts.ready settles, so the
// captured pixels always carry real glyphs. (Harmless when no webfont is in use: the promise
// resolves immediately.)
import { delayRender, continueRender } from 'remotion';

export const FontFaces: React.FC = () => {
  const [handle] = React.useState(() => delayRender('awaiting webfonts (document.fonts.ready)'));
  React.useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) continueRender(handle);
    };
    if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(done, done).catch(done);
      // Safety: never hold the frame forever if fonts hang — release after 5s regardless.
      setTimeout(done, 5000);
    } else {
      done();
    }
    return () => {
      cancelled = true;
    };
  }, [handle]);
  return <style dangerouslySetInnerHTML={{ __html: FONT_FACES_CSS }} />;
};

export default FontFaces;
