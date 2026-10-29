// Colourways and background decor (design v2).
// Each post type gets a colourway so the feed alternates instead of being all red, and every
// design shares the same subtle layers: a soft spotlight, print texture, the lion watermark,
// the sweeping "piping" stripes from the club shirt, and fine grain on top.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const THEMES = {
  red:    { ground: '#ED1B24', panel: '#043673', gold: '#FFCB05', chalk: '#FFFFFF', muted: '#FFD9DB', loss: '#021B3D', deep: '#B5121A', lion: ['#FFFFFF', 0.08], stripes: ['#FFCB05', '#FFFFFF'], stripeOpacity: 0.38 },
  navy:   { ground: '#043673', panel: '#ED1B24', gold: '#FFCB05', chalk: '#FFFFFF', muted: '#C9D6EA', loss: '#021B3D', deep: '#021E45', lion: ['#FFFFFF', 0.06], stripes: ['#FFCB05', '#ED1B24'], stripeOpacity: 0.38 },
  yellow: { ground: '#FFCB05', panel: '#043673', gold: '#ED1B24', chalk: '#043673', muted: '#4A4A2A', loss: '#021B3D', deep: '#E0A800', lion: ['#FFFFFF', 0.28], stripes: ['#ED1B24', '#043673'], stripeOpacity: 0.35 },
};

// Which colourway each post uses. Override in config/club.json under "themes".
const DEFAULT_THEMES = {
  fixture: 'navy', 'team-list': 'navy', 'playing-xi': 'red', gameday: 'red', result: 'red', 'result-lost': 'navy',
  potm: 'red', milestone: 'yellow', 'weekend-fixtures': 'navy', 'weekend-results': 'red',
  predict: 'navy', potw: 'red', guess: 'navy', 'guess-reveal': 'red', leaderboard: 'navy', quiz: 'yellow', 'quiz-answer': 'navy',
};

// Where the lion sits, chosen to stay clear of the player and the main text.
const LION_POS = {
  potm: 'right', 'playing-xi': 'left', gameday: 'right', milestone: 'center', fixture: 'bottom-right',
  'team-list': 'right', result: 'right', 'weekend-fixtures': 'right', 'weekend-results': 'right',
  predict: 'right', potw: 'right', guess: 'left', 'guess-reveal': 'left', leaderboard: 'right', quiz: 'right', 'quiz-answer': 'right',
};

let lionBase;
const tinted = new Map();
async function lion(colour) {
  if (tinted.has(colour)) return tinted.get(colour);
  const file = path.join(ROOT, 'assets/lion.png');
  if (!fs.existsSync(file)) return null;
  lionBase ??= await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = lionBase;
  const out = Buffer.from(data);
  const n = parseInt(colour.slice(1), 16);
  for (let i = 0; i < out.length; i += 4) { out[i] = (n >> 16) & 255; out[i + 1] = (n >> 8) & 255; out[i + 2] = n & 255; }
  const png = await sharp(out, { raw: info }).png().toBuffer();
  const img = { src: `data:image/png;base64,${png.toString('base64')}`, w: info.width, h: info.height };
  tinted.set(colour, img);
  return img;
}

const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const full = (src, W, H, extra = '') => `<img src="${src}" width="${W}" height="${H}" style="position:absolute;top:0;left:0;${extra}" />`;

function backdropSvg(W, H, t) {
  // Spotlight + gentle print mottling + vignette, all in one SVG.
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/></radialGradient>
      <filter id="mottle"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 -0.12"/></filter>
    </defs>
    <rect width="100%" height="100%" filter="url(#mottle)" opacity="0.5"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <rect width="100%" height="100%" fill="url(#vig)"/>
  </svg>`);
}

function stripesSvg(W, H, t) {
  // Three parallel sweeps, like the piping that curves down the club shirt.
  const [a, b] = t.stripes;
  const sweep = (o) => `M ${W * 0.48 + o} ${H + 60} C ${W * 0.78 + o} ${H * 0.82}, ${W * 0.92 + o} ${H * 0.62}, ${W + 80 + o} ${H * 0.46}`;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" fill="none">
    <path d="${sweep(0)}" stroke="${a}" stroke-width="16"/>
    <path d="${sweep(34)}" stroke="${b}" stroke-width="6"/>
    <path d="${sweep(60)}" stroke="${a}" stroke-width="16"/>
  </svg>`);
}

const grainSvg = (W, H) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/></filter>
  <rect width="100%" height="100%" filter="url(#n)"/></svg>`);

function lionLayer(img, W, H, pos, opacity) {
  if (!img) return '';
  const h = Math.round(H * (pos === 'center' ? 0.95 : 1.05));
  const w = Math.round(img.w * h / img.h);
  const x = pos === 'left' ? -Math.round(w * 0.32) : pos === 'center' ? Math.round((W - w) / 2) : W - Math.round(w * 0.68);
  const y = pos === 'bottom-right' ? Math.round(H * 0.28) : Math.round((H - h) / 2 + H * 0.06);
  return `<img src="${img.src}" width="${w}" height="${h}" style="position:absolute;left:${x}px;top:${y}px;opacity:${opacity};" />`;
}

export function themeNameFor(kind, club, ev) {
  const map = { ...DEFAULT_THEMES, ...(club.themes || {}) };
  if (kind === 'result' && ['lost'].includes(ev?.result?.outcome)) return map['result-lost'];
  return map[kind] || 'red';
}

// Returns a colours object for the templates, with decor attached.
export async function buildTheme(kind, club, ev) {
  const name = themeNameFor(kind, club, ev);
  const t = { ...THEMES[name] };
  const lionImg = await lion(t.lion[0]);
  const pos = LION_POS[kind] || 'right';
  t._name = name;
  t._decor = {
    under: (size) => full(backdropSvg(size.width, size.height, t), size.width, size.height)
      + lionLayer(lionImg, size.width, size.height, pos, t.lion[1])
      + full(stripesSvg(size.width, size.height, t), size.width, size.height, `opacity:${t.stripeOpacity};`),
    over: (size) => full(grainSvg(size.width, size.height), size.width, size.height, 'opacity:0.28;'),
  };
  return t;
}
