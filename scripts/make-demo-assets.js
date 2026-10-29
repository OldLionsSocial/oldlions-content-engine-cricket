#!/usr/bin/env node
// Makes placeholder "photos" (flat illustrations) plus samples/photo-index.json, so every
// template can be previewed locally without real player photos. Not for real use.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'samples/photos');
fs.mkdirSync(OUT, { recursive: true });
const svgPng = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

const SKIN = '#b9a593', HAIR = '#3b2f28', KIT = '#22324c', KIT2 = '#2d4163', TRIM = '#d9a23a';

// Figure poses on an 800x1100 transparent canvas.
const body = `
  <path d="M120 1100 C130 760 220 560 400 540 C580 560 670 760 680 1100Z" fill="${KIT}"/>
  <path d="M345 545 L400 640 L455 545" fill="none" stroke="${TRIM}" stroke-width="14"/>
  <rect x="360" y="440" width="80" height="120" rx="30" fill="${SKIN}"/>
  <ellipse cx="400" cy="330" rx="112" ry="135" fill="${SKIN}"/>
  <path d="M290 320 C285 200 360 175 410 178 C480 180 525 225 512 315 C490 250 430 240 400 238 C350 236 305 260 290 320Z" fill="${HAIR}"/>`;
const POSES = {
  halfbody: `${body}
    <path d="M190 820 C260 740 540 760 610 820 C560 900 250 900 190 820Z" fill="${KIT2}"/>
    <ellipse cx="225" cy="805" rx="48" ry="40" fill="${SKIN}"/><ellipse cx="575" cy="805" rx="48" ry="40" fill="${SKIN}"/>`,
  bat: `${body}
    <path d="M560 640 C620 560 650 470 660 420" stroke="${KIT2}" stroke-width="90" stroke-linecap="round" fill="none"/>
    <g transform="rotate(-28 660 380)"><rect x="632" y="40" width="58" height="380" rx="14" fill="#e9dcc0"/><rect x="646" y="380" width="30" height="120" rx="10" fill="#3a3a3a"/></g>
    <ellipse cx="662" cy="410" rx="46" ry="40" fill="#f2f2f2"/>`,
  bowl: `${body}
    <path d="M580 650 C660 560 690 420 690 300" stroke="${KIT2}" stroke-width="88" stroke-linecap="round" fill="none"/>
    <ellipse cx="690" cy="270" rx="46" ry="42" fill="${SKIN}"/><circle cx="700" cy="235" r="30" fill="#b3261e"/>`,
  celebrate: `${body}
    <path d="M220 660 C160 560 140 430 150 330" stroke="${KIT2}" stroke-width="88" stroke-linecap="round" fill="none"/>
    <path d="M580 660 C640 560 660 430 650 330" stroke="${KIT2}" stroke-width="88" stroke-linecap="round" fill="none"/>
    <ellipse cx="150" cy="300" rx="46" ry="44" fill="${SKIN}"/><ellipse cx="650" cy="300" rx="46" ry="44" fill="${SKIN}"/>`,
};
const figure = (pose) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100">${POSES[pose]}
  <text x="400" y="1060" font-family="sans-serif" font-size="34" fill="#ffffff" fill-opacity="0.35" text-anchor="middle">DEMO PLACEHOLDER</text></svg>`;

// A generic cricket ground: sky, stand, floodlights, striped outfield, pitch.
const stripes = Array.from({ length: 12 }, (_, i) => `<rect x="${i * 140}" y="700" width="70" height="400" fill="#4f8a3a" opacity="0.55"/>`).join('');
const ground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f74b5"/><stop offset="1" stop-color="#bcd6ee"/></linearGradient></defs>
  <rect width="1600" height="1100" fill="url(#sky)"/>
  <ellipse cx="300" cy="230" rx="260" ry="70" fill="#ffffff" opacity="0.6"/><ellipse cx="1150" cy="170" rx="320" ry="80" fill="#ffffff" opacity="0.5"/>
  <path d="M0 560 C200 520 380 540 560 520 C760 500 980 530 1200 515 C1380 505 1500 520 1600 530 L1600 640 L0 640Z" fill="#6b8f5a"/>
  <rect x="980" y="470" width="520" height="190" fill="#e8e4dc"/><rect x="960" y="450" width="560" height="30" fill="#8a2f2f"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${1000 + i * 62}" y="510" width="44" height="120" fill="#c9c2b6"/>`).join('')}
  <rect x="140" y="250" width="16" height="400" fill="#9a9a9a"/><rect x="100" y="230" width="96" height="44" fill="#d9d9d9"/>
  <rect x="1450" y="220" width="16" height="430" fill="#9a9a9a"/><rect x="1410" y="200" width="96" height="44" fill="#d9d9d9"/>
  <rect x="0" y="640" width="1600" height="460" fill="#5e9a45"/>${stripes}
  <rect x="0" y="640" width="1600" height="16" fill="#ffffff" opacity="0.7"/>
  <path d="M720 760 L880 760 L940 1100 L660 1100Z" fill="#d8c79a"/>
  <text x="800" y="1070" font-family="sans-serif" font-size="30" fill="#ffffff" fill-opacity="0.45" text-anchor="middle">DEMO GROUND PLACEHOLDER</text></svg>`;

async function main() {
  const groundJpg = await sharp(svgPng(ground, 1600)).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(path.join(OUT, 'ground_full.jpg'), groundJpg);

  const entries = [{ sourceId: 'demo-ground', type: 'ground', playerIds: [], pose: 'ground', season: null, files: { full: 'samples/photos/ground_full.jpg' } }];
  const studio = [['P103', 'halfbody'], ['P103', 'bat'], ['P103', 'celebrate'], ['P108', 'bowl'], ['P108', 'halfbody'], ['P101', 'bat'], ['P101', 'halfbody']];
  for (const [id, pose] of studio) {
    const cut = await sharp(svgPng(figure(pose), 1000)).trim().png().toBuffer();
    const meta = await sharp(cut).metadata();
    const side = Math.min(meta.width, meta.height);
    const head = await sharp(cut).extract({ left: Math.round((meta.width - side) / 2), top: 0, width: side, height: side }).resize(400, 400).png().toBuffer();
    const base = `${id}_${pose}`;
    fs.writeFileSync(path.join(OUT, `${base}_cutout.png`), cut);
    fs.writeFileSync(path.join(OUT, `${base}_head.png`), head);
    entries.push({ sourceId: `demo-${base}`, type: 'studio', season: '2026-27', playerIds: [id], pose,
      files: { cutout: `samples/photos/${base}_cutout.png`, head: `samples/photos/${base}_head.png` } });
  }
  // A "match photo": the batting figure on the ground, flattened like a real photo.
  const bat = await sharp(svgPng(figure('bat'), 700)).png().toBuffer();
  const action = await sharp(groundJpg).composite([{ input: bat, left: 450, top: 138 }]).jpeg({ quality: 85 }).toBuffer();
  fs.writeFileSync(path.join(OUT, 'match_P103_bat_full.jpg'), action);
  entries.push({ sourceId: 'demo-match-1', type: 'match', season: '2026-27', matchDate: '2026-10-31', matchFolder: '2026-10-31 1st XI v Kensington Ridge CC',
    playerIds: ['P103'], pose: 'bat', files: { full: 'samples/photos/match_P103_bat_full.jpg' } });

  fs.writeFileSync(path.join(ROOT, 'samples/photo-index.json'), JSON.stringify({ version: 1, note: 'Demo index pointing at placeholder images on disk.', photos: entries }, null, 2));
  console.log(`Wrote ${entries.length} demo photos to samples/photos`);
}
main();
