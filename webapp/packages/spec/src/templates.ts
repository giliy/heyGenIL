// Launch-template catalog — the single source of truth for the Phase-1 dashboard CTA.
// Both web (POST /api/projects seed) and worker (renderSpec compositionId) import this.
// The defaultSpec values mirror each composition's `defaultProps` (remotion/src/shots/*),
// kept here as validated Specs so a "Render this template" click can materialize a project
// and render it without importing TSX.
import { parseSpec } from './validators';
import type { Spec } from './types';

// --- form-card (Short16Formy) — full Hebrew form-card short. ---
const FORM_CARD_SPEC: Spec = parseSpec({
  id: 'short-16-formy',
  title: 'Formy — טופס דיגיטלי בעברית',
  template: 'Short16Formy',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#6366F1', font: 'hebrew' },
  voice: {
    engine: 'edge',
    voiceId: 'he-IL-AvriNeural',
    lines: [
      { text: 'צריך להחתים הרבה לקוחות?', start: 0.5, end: 3.23 },
      { text: 'טפסים על הנייר. חתימות שצריך לשלוח בדואר.', start: 3.3, end: 7.71 },
      { text: 'הכירו את פורמי — פלטפורמת הטפסים הדיגיטליים של ישראל.', start: 7.9, end: 12.83 },
      { text: 'בונים טופס מרהיב בכמה לחיצות.', start: 12.95, end: 15.93 },
      { text: 'חתימה דיגיטלית. חוקית. עם שרשרת ראיות.', start: 16.0, end: 21.27 },
      { text: 'לוגיקה מותנית, ואנליטיקה חיה בזמן אמת.', start: 21.5, end: 25.23 },
      { text: 'מתחבר לשלאק ולגוגל שיטס.', start: 25.35, end: 28.05 },
      { text: 'עסקים בישראל כבר בונים איתנו.', start: 28.15, end: 30.77 },
      { text: 'מתחילים בחינם. בלי כרטיס אשראי.', start: 30.87, end: 35.62 },
    ],
  },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    {
      id: 'hook', durationSec: 3.3, beatId: 'hook', visual: 'hook',
      overlays: [
        { id: 'hook-title-1', type: 'text', content: 'צריך להחתים', x: 40, y: 240, w: 1000, h: 100, start: 0, end: 3.3, animation: 'rise', style: { font: 'hebrew', size: 88, weight: 700, align: 'center', color: '#ffffff' } },
        { id: 'hook-title-2', type: 'text', content: 'הרבה לקוחות?', x: 40, y: 340, w: 1000, h: 110, start: 0, end: 3.3, animation: 'rise', style: { font: 'hebrew', size: 88, weight: 700, align: 'center', color: '#6366F1' } },
      ],
    },
    {
      id: 'pain', durationSec: 4.5, beatId: 'pain', visual: 'pain',
      overlays: [
        { id: 'pain-line', type: 'text', content: 'טפסים על נייר. חתימות בדואר.', x: 40, y: 1250, w: 1000, h: 100, start: 0, end: 4.5, animation: 'rise', style: { font: 'hebrew', size: 70, weight: 700, align: 'center', color: '#f5d76e' } },
      ],
    },
    {
      id: 'intro', durationSec: 5.03, beatId: 'intro', visual: 'intro',
      overlays: [
        { id: 'intro-tagline', type: 'text', content: 'פלטפורמת הטפסים הדיגיטליים של ישראל', x: 40, y: 1430, w: 1000, h: 90, start: 0, end: 5.03, animation: 'fade', style: { font: 'hebrew', size: 40, weight: 500, align: 'center', color: 'rgba(255,255,255,0.85)' } },
      ],
    },
    {
      id: 'builder', durationSec: 3.1, beatId: 'builder', visual: 'builder',
      overlays: [
        { id: 'kicker-builder', type: 'text', content: 'גרירה ויזואלית', x: 340, y: 190, w: 400, h: 60, start: 0, end: 3.1, animation: 'rise', style: { font: 'hebrew', size: 30, weight: 600, align: 'center', color: '#6366F1' } },
      ],
    },
    {
      id: 'signature', durationSec: 5.34, beatId: 'signature', visual: 'signature',
      overlays: [
        { id: 'kicker-sign', type: 'text', content: 'חתימה דיגיטלית חוקית', x: 300, y: 190, w: 480, h: 60, start: 0, end: 5.34, animation: 'rise', style: { font: 'hebrew', size: 30, weight: 600, align: 'center', color: '#4db8a8' } },
      ],
    },
    {
      id: 'logic', durationSec: 3.96, beatId: 'logic', visual: 'logic',
      overlays: [
        { id: 'kicker-logic', type: 'text', content: 'לוגיקה מותנית', x: 340, y: 190, w: 400, h: 60, start: 0, end: 3.96, animation: 'rise', style: { font: 'hebrew', size: 30, weight: 600, align: 'center', color: '#9b7cc4' } },
      ],
    },
    {
      id: 'integrations', durationSec: 2.82, beatId: 'integrations', visual: 'integrations',
      overlays: [
        { id: 'integ-slack', type: 'text', content: 'Slack', x: 190, y: 560, w: 180, h: 70, start: 0, end: 2.82, animation: 'pop', style: { font: 'body', size: 28, weight: 600, align: 'center', color: '#9b7cc4' } },
        { id: 'integ-gsheets', type: 'text', content: 'Google Sheets', x: 700, y: 580, w: 260, h: 70, start: 0.2, end: 2.82, animation: 'pop', style: { font: 'body', size: 28, weight: 600, align: 'center', color: '#4db8a8' } },
        { id: 'integ-webhooks', type: 'text', content: 'Webhooks', x: 180, y: 1240, w: 220, h: 70, start: 0.4, end: 2.82, animation: 'pop', style: { font: 'body', size: 28, weight: 600, align: 'center', color: '#6366F1' } },
        { id: 'integ-zapier', type: 'text', content: 'Zapier', x: 740, y: 1240, w: 200, h: 70, start: 0.6, end: 2.82, animation: 'pop', style: { font: 'body', size: 28, weight: 600, align: 'center', color: '#f5d76e' } },
        { id: 'integ-notion', type: 'text', content: 'Notion', x: 440, y: 600, w: 200, h: 70, start: 0.8, end: 2.82, animation: 'pop', style: { font: 'body', size: 28, weight: 600, align: 'center', color: '#c9d1d9' } },
      ],
    },
    {
      id: 'proof', durationSec: 2.77, beatId: 'proof', visual: 'proof', overlays: [],
    },
    {
      id: 'cta', durationSec: 4.8, beatId: 'cta', visual: 'cta',
      overlays: [
        { id: 'cta-button', type: 'text', content: 'מתחילים בחינם', x: 240, y: 720, w: 600, h: 130, start: 0, end: 4.8, animation: 'pop', style: { font: 'hebrew', size: 54, weight: 700, align: 'center', color: '#0d1117' } },
        { id: 'cta-badge', type: 'text', content: 'בלי כרטיס אשראי', x: 290, y: 880, w: 500, h: 70, start: 0, end: 4.8, animation: 'fade', style: { font: 'hebrew', size: 34, weight: 500, align: 'center', color: 'rgba(255,255,255,0.8)' } },
        { id: 'cta-url', type: 'text', content: 'formy.co.il', x: 390, y: 1020, w: 300, h: 60, start: 0, end: 4.8, animation: 'fade', style: { font: 'body', size: 30, weight: 500, align: 'center', color: 'rgba(255,255,255,0.5)' } },
      ],
    },
    { id: 'loop', durationSec: 0.38, beatId: 'loop', visual: 'loop', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-22' },
});

// --- chess (Short1Chess) — 4-move checkmate trap short. ---
const CHESS_SPEC: Spec = parseSpec({
  id: 'short-1-chess',
  title: 'The 4-Move Checkmate — Punished',
  template: 'Short1Chess',
  engine: 'tsx',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#f5d76e', font: 'display' },
  voice: {
    engine: 'elevenlabs',
    voiceId: 'default',
    lines: [
      { text: 'This trap wins millions of games — in just four moves.', start: 0.4, end: 4.02 },
      { text: 'Pawn to e4.', start: 4.1, end: 5.63 },
      { text: 'Bishop c4 — aiming at f7, the weakest square in Black\'s camp.', start: 5.7, end: 9.6 },
      { text: 'Queen h5.', start: 9.4, end: 10.69 },
      { text: 'If Black plays the natural move —', start: 10.6, end: 12.41 },
      { text: 'checkmate. Four moves. Game over.', start: 12.6, end: 15.36 },
      { text: 'But right here, Black has one move that stops everything.', start: 14.9, end: 17.86 },
      { text: 'Pause. Find it.', start: 17.9, end: 20.03 },
      { text: 'Pawn g6. It hits the queen — and kills the mate.', start: 20.1, end: 24.07 },
      { text: 'The queen runs to f3, eyeing f7 again —', start: 23.5, end: 26.35 },
      { text: 'but knight f6 slams the door.', start: 26.4, end: 28.64 },
      { text: 'f7 is safe. Forever.', start: 28.7, end: 30.63 },
      { text: 'Now count the moves.', start: 30.7, end: 32.26 },
      { text: 'White\'s queen danced around for nothing.', start: 32.3, end: 34.34 },
      { text: 'Black built an army — every move with tempo.', start: 34.4, end: 37.26 },
      { text: 'Strong players never fear the four-move mate…', start: 37.3, end: 39.84 },
      { text: 'they feed on it.', start: 40.2, end: 41.31 },
    ],
  },
  captions: { preset: 'pop', burnIn: true },
  scenes: [
    {
      id: 'hook', durationSec: 3.2, beatId: 'hook', visual: 'hook',
      overlays: [
        { id: 'hook-1', type: 'text', content: 'THE 4-MOVE', x: 40, y: 190, w: 1000, h: 90, start: 0, end: 3.2, animation: 'rise', style: { font: 'display', size: 92, weight: 700, align: 'center', color: '#ffffff' } },
        { id: 'hook-2', type: 'text', content: 'CHECKMATE TRAP', x: 40, y: 300, w: 1000, h: 90, start: 0, end: 3.2, animation: 'rise', style: { font: 'display', size: 92, weight: 700, align: 'center', color: '#f5d76e' } },
        { id: 'hook-sub', type: 'text', content: '…and the move that destroys it', x: 40, y: 420, w: 1000, h: 60, start: 0, end: 3.2, animation: 'rise', style: { font: 'body', size: 40, weight: 500, align: 'center', color: 'rgba(255,255,255,0.82)' } },
      ],
    },
    {
      id: 'trap', durationSec: 11.2, beatId: 'trap', visual: 'trap',
      overlays: [
        { id: 'kicker-trap', type: 'text', content: 'THE TRAP', x: 390, y: 180, w: 300, h: 60, start: 0.2, end: 7.4, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'center', color: '#f5d76e' } },
        { id: 'stamp-mate', type: 'text', content: 'CHECKMATE', x: 380, y: 900, w: 320, h: 110, start: 6.2, end: 8.9, animation: 'pop', style: { font: 'display', size: 96, weight: 700, align: 'center', color: '#e8879f' } },
      ],
    },
    {
      id: 'quiz', durationSec: 5.4, beatId: 'quiz', visual: 'quiz',
      overlays: [
        { id: 'kicker-quiz', type: 'text', content: 'FIND THE DEFENSE', x: 290, y: 180, w: 500, h: 60, start: 0.4, end: 5.4, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'center', color: '#e8879f' } },
      ],
    },
    {
      id: 'punish', durationSec: 10.2, beatId: 'punish', visual: 'punish',
      overlays: [
        { id: 'kicker-punish', type: 'text', content: 'THE PUNISH', x: 360, y: 180, w: 360, h: 60, start: 0.2, end: 10.2, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'center', color: '#4db8a8' } },
      ],
    },
    {
      id: 'damage', durationSec: 7.4, beatId: 'damage', visual: 'damage',
      overlays: [
        { id: 'kicker-damage', type: 'text', content: 'COUNT THE DAMAGE', x: 250, y: 180, w: 580, h: 60, start: 0.4, end: 4.0, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'center', color: '#f5d76e' } },
        { id: 'chip-white', type: 'text', content: 'White — 2 queen moves · 0 threats left', x: 60, y: 280, w: 460, h: 110, start: 1.4, end: 7.4, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'left', color: '#e8879f' } },
        { id: 'chip-black', type: 'text', content: 'Black — 3 pieces out · all with tempo', x: 560, y: 280, w: 470, h: 110, start: 1.8, end: 7.4, animation: 'rise', style: { font: 'body', size: 30, weight: 600, align: 'left', color: '#4db8a8' } },
      ],
    },
    {
      id: 'loop', durationSec: 4.6, beatId: 'loop', visual: 'loop',
      overlays: [
        { id: 'loop-1', type: 'text', content: 'THE 4-MOVE', x: 40, y: 190, w: 1000, h: 90, start: 0, end: 4.6, animation: 'fade', style: { font: 'display', size: 92, weight: 700, align: 'center', color: '#ffffff' } },
        { id: 'loop-2', type: 'text', content: 'CHECKMATE TRAP', x: 40, y: 300, w: 1000, h: 90, start: 0, end: 4.6, animation: 'fade', style: { font: 'display', size: 92, weight: 700, align: 'center', color: '#f5d76e' } },
        { id: 'loop-sub', type: 'text', content: 'now you punish it', x: 40, y: 420, w: 1000, h: 60, start: 0, end: 4.6, animation: 'fade', style: { font: 'body', size: 40, weight: 500, align: 'center', color: 'rgba(255,255,255,0.82)' } },
      ],
    },
  ],
  meta: { revision: 0, updatedAt: '2026-08-22' },
});

// --- ad-liat (Ad1Liat) — the /make-ad reference: a 30s Hebrew RTL commercial. ---
// Spec-driven comp (defaultProps + calculateMetadata) with the full ads.tsx kit:
// PriceBadge (offer), AdEndCard (holds to last frame), Logo watermark, RTL pill captions.
const AD_LIAT_SPEC: Spec = parseSpec({
  id: 'ad-1-liat',
  title: 'ליאת קוסמטיקה — סייל החודש',
  template: 'Ad1Liat',
  engine: 'tsx',
  mode: 'ad',
  language: 'he',
  rtl: true,
  ad: {
    business: 'ליאת קוסמטיקה',
    ctaText: 'להזמנת תור בוואטסאפ',
    price: 199,
    oldPrice: 290,
    currency: '₪',
    phone: '050-1234567',
    website: 'liat-beauty.co.il',
    endCardHoldSec: 20.6,
  },
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#A8342B', font: 'hebrew' },
  voice: { engine: 'edge', voiceId: 'he-IL-HilaNeural', lines: [] },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    { id: 'hook', durationSec: 3.0, beatId: 'hook', visual: 'hook', overlays: [] },
    { id: 'offer', durationSec: 3.2, beatId: 'offer', visual: 'offer', overlays: [] },
    { id: 'proof', durationSec: 3.2, beatId: 'proof', visual: 'proof', overlays: [] },
    { id: 'cta', durationSec: 20.6, beatId: 'cta', visual: 'cta', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
});

// --- ad-noa (Ad2Noa) — second Hebrew RTL commercial (beauty / facial, different offer). ---
const AD_NOA_SPEC: Spec = parseSpec({
  id: 'ad-2-noa',
  title: 'נועה גלילי יופי — טיפול פנים החודש',
  template: 'Ad2Noa',
  engine: 'tsx',
  mode: 'ad',
  language: 'he',
  rtl: true,
  ad: {
    business: 'נועה גלילי יופי',
    ctaText: 'להזמנת תור בוואטסאפ',
    price: 249,
    oldPrice: 350,
    currency: '₪',
    phone: '052-9876543',
    website: 'noa-beauty.co.il',
    endCardHoldSec: 20.6,
  },
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#A8342B', font: 'hebrew' },
  voice: { engine: 'edge', voiceId: 'he-IL-HilaNeural', lines: [] },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    { id: 'hook', durationSec: 3.0, beatId: 'hook', visual: 'hook', overlays: [] },
    { id: 'offer', durationSec: 3.2, beatId: 'offer', visual: 'offer', overlays: [] },
    { id: 'proof', durationSec: 3.2, beatId: 'proof', visual: 'proof', overlays: [] },
    { id: 'cta', durationSec: 20.6, beatId: 'cta', visual: 'cta', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
});

// --- ai-blue-man (AiSpec) — generative track: locked recurring character, fal clips. ---
// Spec-driven comp that renders scene.clip videos via OffthreadVideo. The default clip
// refs point at the committed blue-man clips (media/projects/blue-man/) so the template is
// renderable immediately; a real generate run replaces scene.clip with freshly-minted fal
// clips (the worker's pixel stage). Loops: clip-0's frame 0 == last frame (seamless).
const AI_BLUE_MAN_SPEC: Spec = parseSpec({
  id: 'ai-blue-man',
  title: 'The Blue Man — Generative Short',
  template: 'AiSpec',
  engine: 'ai',
  mode: 'ai',
  characterId: 'blue-man', // locked recurring character (ai-shorts/blue-man/character.json)
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#d2a854', font: 'display' },
  voice: {
    engine: 'edge',
    voiceId: 'en-US-ChristopherNeural',
    lines: [
      { text: 'Through the desert door, he walks.', start: 0.3, end: 4.7 },
      { text: 'Snow falls on the long road.', start: 5.0, end: 9.6 },
      { text: 'At the threshold, he waits.', start: 9.9, end: 14.3 },
      { text: 'The meadow calls him back.', start: 14.6, end: 19.4 },
      { text: 'Every door is open.', start: 19.7, end: 25.4 },
      { text: 'And the loop begins again.', start: 25.7, end: 31.6 },
    ],
  },
  captions: { preset: 'pill', burnIn: true },
  scenes: [
    { id: 's1', durationSec: 5.04, beatId: 's1', visual: 'the blue man walks through a desert door into a snow field', clip: { src: '/media/projects/blue-man/01-desert-door.mp4', durationSec: 5.04 }, overlays: [] },
    { id: 's2', durationSec: 6.04, beatId: 's2', visual: 'the blue man walks through falling snow', clip: { src: '/media/projects/blue-man/02-snow-walk.mp4', durationSec: 6.04 }, overlays: [] },
    { id: 's3', durationSec: 6.04, beatId: 's3', visual: 'the blue man stands at a glowing threshold', clip: { src: '/media/projects/blue-man/03-threshold.mp4', durationSec: 6.04 }, overlays: [] },
    { id: 's4', durationSec: 7.04, beatId: 's4', visual: 'the blue man returns to the meadow', clip: { src: '/media/projects/blue-man/04-meadow-again.mp4', durationSec: 7.04 }, overlays: [] },
    { id: 's5', durationSec: 8.04, beatId: 's5', visual: 'many doors surround the blue man', clip: { src: '/media/projects/blue-man/05-many-doors.mp4', durationSec: 8.04 }, overlays: [] },
    { id: 's6', durationSec: 7.04, beatId: 's6', visual: 'the blue man returns through the desert door', clip: { src: '/media/projects/blue-man/06-loop-return.mp4', durationSec: 7.04 }, overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
});

// --- vox-spec (VoxSpec) — paper-collage explainer track. Spec-driven comp that renders
// scene.vox.layers onto the collage.tsx kit (Cutout/ArchivalPhoto/LabelChip/RubberStamp on a
// shared paper board with a virtual camera). The default carries text labels only (no
// generated layers) so it renders immediately; a real generate run mints layer PNGs into
// media/projects/<proj>/ via the collage-layers job (gen_image + cutout.py) and fills
// scene.vox.layers[].src.
const VOX_SPEC_SPEC: Spec = parseSpec({
  id: 'vox-spec',
  title: 'Paper-Collage Explainer',
  template: 'VoxSpec',
  engine: 'vox',
  mode: 'vox',
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#c0392b', font: 'editorial' },
  voice: {
    engine: 'edge',
    voiceId: 'en-US-ChristopherNeural',
    lines: [
      { text: 'A paper-collage explainer.', start: 0.3, end: 3.2 },
      { text: 'Layers assemble on the board.', start: 3.4, end: 6.4 },
      { text: 'The camera narrates the story.', start: 6.6, end: 10.2 },
      { text: 'Every layer carries depth.', start: 10.4, end: 14.0 },
      { text: 'Built for the vox track.', start: 14.2, end: 17.8 },
    ],
  },
  captions: { preset: 'pill', burnIn: true },
  vox: {
    paper: {},
    grain: 0.055,
    cam: [
      { f: 0, x: 540, y: 960, z: 1 },
      { f: 540, x: 540, y: 960, z: 1 },
    ],
  },
  scenes: [
    {
      id: 's1', durationSec: 3.6, beatId: 's1', visual: 'the paper board and title',
      vox: {
        layers: [
          { id: 't1', type: 'label', text: 'PAPER-COLLAGE', x: 540, y: 420, w: 700, at: 6, enter: 'pop', accent: '#c0392b', size: 40 },
          { id: 't2', type: 'label', text: 'A story told in layers', x: 540, y: 1560, w: 900, at: 20, enter: 'rise', accent: '#33695d', size: 34 },
        ],
      },
      overlays: [],
    },
    {
      id: 's2', durationSec: 3.6, beatId: 's2', visual: 'cutout subject on the paper',
      vox: {
        layers: [
          { id: 'l1', type: 'label', text: 'Cutouts are die-cut subjects', x: 540, y: 420, w: 900, at: 6, enter: 'pop', accent: '#e8b73a', size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's3', durationSec: 3.6, beatId: 's3', visual: 'an archival photo print',
      vox: {
        layers: [
          { id: 'l2', type: 'label', text: 'Photos get an archival border', x: 540, y: 1520, w: 950, at: 10, enter: 'rise', accent: '#33695d', size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's4', durationSec: 3.6, beatId: 's4', visual: 'annotations on the board',
      vox: {
        layers: [
          { id: 'l3', type: 'label', text: 'Labels annotate the scene', x: 540, y: 420, w: 900, at: 6, enter: 'pop', accent: '#c0392b', size: 36 },
        ],
      },
      overlays: [],
    },
    {
      id: 's5', durationSec: 3.6, beatId: 's5', visual: 'the board loops back',
      vox: {
        layers: [
          { id: 'l4', type: 'label', text: 'A seamless paper loop', x: 540, y: 1560, w: 900, at: 8, enter: 'rise', accent: '#33695d', size: 36 },
        ],
      },
      overlays: [],
    },
  ],
  meta: { revision: 0, updatedAt: '2026-08-23' },
});

// --- avatar-talk (AvatarSpec) — HeyGen-IL talking-head track. Spec-driven comp that renders
// a locked avatar face + the lip-synced voice track as a Hebrew RTL scene. The default spec
// carries a sample script + a placeholder face (the avatar picker swaps in the real one);
// the worker's talk stage mints the talking-head clip and fills scene.clip.
const AVATAR_SPEC: Spec = parseSpec({
  id: 'avatar-talk',
  title: 'אווטאר מדבר — HeyGen-IL',
  template: 'AvatarSpec',
  engine: 'avatar',
  mode: 'avatar',
  language: 'he',
  rtl: true,
  format: { width: 1080, height: 1920, fps: 30 },
  theme: { accent: '#0b6ce0', font: 'hebrew' },
  voice: {
    engine: 'edge',
    voiceId: 'he-IL-HilaNeural',
    lines: [
      { text: 'שלום! אני האווטאר הדיגיטלי שלך.', start: 0.4, end: 2.6 },
      { text: 'כותבים תסריט, והאווטאר מדבר אותו בעברית.', start: 2.8, end: 6.2 },
      { text: 'מושלם לפרסום, להדרכה, ולמכירות.', start: 6.4, end: 9.6 },
    ],
  },
  captions: { preset: 'pill', burnIn: true, style: { rtl: true } },
  scenes: [
    { id: 's1', durationSec: 2.6, beatId: 's1', visual: 'avatar greets', overlays: [] },
    { id: 's2', durationSec: 3.4, beatId: 's2', visual: 'avatar explains the flow', overlays: [] },
    { id: 's3', durationSec: 3.2, beatId: 's3', visual: 'avatar calls to action', overlays: [] },
  ],
  meta: { revision: 0, updatedAt: '2026-08-24' },
});

export interface LaunchTemplate {
  id: string;
  title: string;
  compositionId: string;
  engine: 'tsx' | 'ai' | 'vox' | 'avatar'; // the render engine (avatar: HeyGen-IL talking head)
  mode?: 'tsx' | 'ad' | 'kids' | 'ai' | 'vox' | 'avatar'; // the content track (Phase 1)
  defaultSpec: Spec;
}

export const LAUNCH_TEMPLATES: LaunchTemplate[] = [
  {
    id: 'form-card',
    title: 'Form Card',
    compositionId: 'Short16Formy',
    engine: 'tsx',
    mode: 'tsx',
    defaultSpec: FORM_CARD_SPEC,
  },
  {
    id: 'chess',
    title: 'Chess Trap',
    compositionId: 'Short1Chess',
    engine: 'tsx',
    mode: 'tsx',
    defaultSpec: CHESS_SPEC,
  },
  {
    id: 'ad-liat',
    title: 'Ad — Liat Beauty',
    compositionId: 'Ad1Liat',
    engine: 'tsx',
    mode: 'ad',
    defaultSpec: AD_LIAT_SPEC,
  },
  {
    id: 'ad-noa',
    title: 'Ad — Noa Beauty',
    compositionId: 'Ad2Noa',
    engine: 'tsx',
    mode: 'ad',
    defaultSpec: AD_NOA_SPEC,
  },
  {
    id: 'ai-blue-man',
    title: 'AI Video — Blue Man',
    compositionId: 'AiSpec',
    engine: 'ai',
    mode: 'ai',
    defaultSpec: AI_BLUE_MAN_SPEC,
  },
  {
    id: 'vox-explainer',
    title: 'Vox — Paper-Collage Explainer',
    compositionId: 'VoxSpec',
    engine: 'vox',
    mode: 'vox',
    defaultSpec: VOX_SPEC_SPEC,
  },
  {
    id: 'avatar-talk',
    title: 'Talking Avatar — Hebrew',
    compositionId: 'AvatarSpec',
    engine: 'avatar',
    mode: 'avatar',
    defaultSpec: AVATAR_SPEC,
  },
];

export function getTemplate(templateId: string): LaunchTemplate | undefined {
  return LAUNCH_TEMPLATES.find((t) => t.id === templateId);
}
