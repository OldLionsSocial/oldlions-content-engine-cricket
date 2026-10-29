// Turns an HTML string (flexbox only, satori rules) into a PNG buffer.
// Runs in plain Node, so it works on GitHub Actions or any serverless host.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) =>
  fs.readFileSync(path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file));

const FONTS = [
  { name: 'Anton', data: fontFile('@fontsource/anton', 'anton-latin-400-normal.woff'), weight: 400, style: 'normal' },
  ...[500, 600, 700].map((w) => ({
    name: 'Barlow Condensed',
    data: fontFile('@fontsource/barlow-condensed', `barlow-condensed-latin-${w}-normal.woff`),
    weight: w,
    style: 'normal',
  })),
];

export const SIZES = {
  feed: { width: 1080, height: 1350 },   // Facebook / Instagram feed, TikTok photo
  story: { width: 1080, height: 1920 },  // Stories, Reels covers, TikTok
};

// Large photos are swapped in after parsing: the HTML parser is very slow on long data URIs.
function swapImages(node, images) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => swapImages(n, images));
  const props = node.props || {};
  if (typeof props.src === 'string' && props.src.startsWith('__img')) props.src = images[Number(props.src.slice(5))];
  swapImages(props.children, images);
}

export async function renderPng(markup, { width, height }) {
  const images = [];
  const light = markup.replace(/src="(data:[^"]+)"/g, (_, uri) => `src="__img${images.push(uri) - 1}"`);
  const tree = html(light);
  swapImages(tree, images);
  const svg = await satori(tree, { width, height, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

// ---- image helpers -------------------------------------------------------

const mime = (p) => (p.endsWith('.png') ? 'image/png' : p.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');

export async function toDataUri(src) {
  if (!src) return null;
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const type = res.headers.get('content-type') || 'image/jpeg';
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    }
    if (fs.existsSync(src)) return `data:${mime(src)};base64,${fs.readFileSync(src).toString('base64')}`;
  } catch {
    /* fall through to placeholder */
  }
  return null;
}

// Neutral head-and-shoulders placeholder, used when there is no photo or no consent.
export function silhouette(fill = '#9FB0C7', bg = '#1C304D') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/><circle cx="100" cy="78" r="38" fill="${fill}" opacity="0.55"/><path d="M28 200c6-46 36-70 72-70s66 24 72 70z" fill="${fill}" opacity="0.55"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Resolve a player's photo, honouring the consent flag. Never fetches a photo without consent.
export async function playerPhoto(player, colours) {
  if (player?.photoConsent && player?.photoUrl) {
    const uri = await toDataUri(player.photoUrl);
    if (uri) return uri;
  }
  return silhouette(colours.muted, colours.panel);
}
