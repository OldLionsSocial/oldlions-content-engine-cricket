// Chooses the best photo for each graphic from the photo index, and loads it.
// The index is built by src/ingest.js and stored in Drive as Processed/photo-index.json.
// For local testing, samples/photo-index.json points at files on disk instead.
import fs from 'node:fs';
import path from 'node:path';
import { driveConfigured, readJson, download } from './drive.js';
import sharp from 'sharp';
import { silhouette } from './render.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const INDEX_NAME = 'photo-index.json';

export async function loadIndex(club) {
  if (driveConfigured() && club.photoLibrary?.processedId) {
    const idx = await readJson(club.photoLibrary.processedId, INDEX_NAME);
    if (idx) return { ...idx, source: 'drive' };
    console.log('  No photo index in Drive yet: run the ingest job first. Using placeholders.');
    return { photos: [], source: 'drive' };
  }
  // Demo placeholders only when explicitly asked for (npm run demo), never in real builds.
  const local = path.join(ROOT, process.env.LOCAL_PHOTO_INDEX || 'samples/photo-index.json');
  if (process.env.USE_DEMO_PHOTOS === '1' && fs.existsSync(local)) return { ...JSON.parse(fs.readFileSync(local, 'utf8')), source: 'local' };
  return { photos: [], source: 'none' };
}

// ---- consent ---------------------------------------------------------------
// A photo of people is only usable if every tagged person is in this event's player list
// with photoConsent === true. Untagged match photos are never used automatically.
function consentOk(photo, ctx) {
  if (['ground', 'logo', 'opposition'].includes(photo.type)) return true;
  if (!photo.playerIds?.length) return false;
  return photo.playerIds.every((id) => ctx.players?.[id]?.photoConsent === true);
}

// ---- selection ------------------------------------------------------------
// A rule is "<type>:<variant>:<pose>[:same-day]", e.g. "studio:cutout:bat" or "match:full:*:same-day".
function matches(photo, rule, playerId, ctx) {
  const [type, variant, pose, when] = rule.split(':');
  if (photo.type !== type) return false;
  if (variant !== 'full' && !photo.files?.[variant]) return false;
  if (pose !== '*' && photo.pose !== pose) return false;
  if (playerId && !photo.playerIds?.includes(playerId)) return false;
  if (when === 'same-day' && photo.matchDate !== ctx.date) return false;
  return consentOk(photo, ctx);
}

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Returns { photo, variant } for the first rule that finds anything, or null.
export function pick(index, rules, { playerId = null, ctx }) {
  for (const rule of rules) {
    const found = index.photos.filter((p) => matches(p, rule, playerId, ctx));
    if (!found.length) continue;
    // Prefer the current season, then rotate deterministically per match so photos don't repeat every week.
    const season = Math.max(...found.map((p) => parseInt(p.season, 10) || 0));
    const pool = found.filter((p) => (parseInt(p.season, 10) || 0) === season);
    const photo = pool[hash(`${ctx.matchId}:${rule}`) % pool.length];
    return { photo, variant: rule.split(':')[1] };
  }
  return null;
}

// Rule sets per graphic. Order = preference.
export const RULES = {
  heroCutout: (discipline) => [
    ...(discipline ? [`studio:cutout:${discipline}`] : []),
    'studio:cutout:celebrate', 'studio:cutout:halfbody', 'studio:cutout:*',
  ],
  captainCutout: ['studio:waist:halfbody', 'studio:cutout:halfbody', 'studio:waist:celebrate', 'studio:cutout:*'],
  headshot: ['studio:head:headshot', 'studio:head:halfbody', 'studio:full:headshot', 'studio:head:*'],
  actionSameDay: (discipline) => [
    ...(discipline ? [`match:full:${discipline}:same-day`] : []),
    'match:full:celebrate:same-day', 'match:full:*:same-day',
  ],
  ground: ['ground:full:*'],
};

// ---- loading ----------------------------------------------------------------
const cache = new Map();
async function bytes(ref, source) {
  if (cache.has(ref)) return cache.get(ref);
  const buf = source === 'drive' ? await download(ref) : fs.readFileSync(path.join(ROOT, ref));
  cache.set(ref, buf);
  return buf;
}

export async function dataUri(choice, index) {
  if (!choice) return null;
  const ref = choice.photo.files[choice.variant];
  let buf = await bytes(ref, index.source);
  // Logos often sit on a large empty canvas: trim it so the badge fills its space.
  if (['logo', 'opposition'].includes(choice.photo.type)) buf = await sharp(buf).trim().png().toBuffer();
  const png = ['cutout', 'head', 'waist'].includes(choice.variant) || ['logo', 'opposition'].includes(choice.photo.type) || String(ref).endsWith('.png');
  const type = png ? 'image/png' : 'image/jpeg';
  const { width, height } = await sharp(buf).metadata();
  return { src: `data:${type};base64,${buf.toString('base64')}`, w: width, h: height };
}

export const placeholder = (colours) => ({ src: silhouette(colours.muted, colours.panel), w: 200, h: 200 });

// Convenience: everything a template might need for one player.
export async function playerImages(index, player, ctx, { discipline = null, colours, heroRules = null }) {
  const id = player?.id;
  const hero = pick(index, heroRules || RULES.heroCutout(discipline), { playerId: id, ctx });
  const head = pick(index, RULES.headshot, { playerId: id, ctx });
  const action = pick(index, RULES.actionSameDay(discipline), { playerId: id, ctx });
  return {
    cutout: await dataUri(hero, index),
    headshot: (await dataUri(head, index)) || placeholder(colours),
    action: await dataUri(action, index),
  };
}

export async function groundImage(index, ctx) {
  return dataUri(pick(index, RULES.ground, { ctx }), index);
}

export async function logoImage(index) {
  const logo = index.photos.find((p) => p.type === 'logo');
  if (logo) return dataUri({ photo: logo, variant: 'full' }, index);
  const local = path.join(ROOT, 'assets/logo.png');
  if (!fs.existsSync(local)) return null;
  const buf = await sharp(fs.readFileSync(local)).trim().png().toBuffer();
  const { width, height } = await sharp(buf).metadata();
  return { src: `data:image/png;base64,${buf.toString('base64')}`, w: width, h: height };
}

// Opposition club logos: matched by name, ignoring case and common suffixes, plus aliases in club.json.
const norm = (s) => String(s || '').toLowerCase().replace(/\b(cricket club|sports club|cricket|cc|club)\b/g, '').replace(/[^a-z0-9]/g, '');
export async function opponentLogo(index, name, club) {
  if (!name) return null;
  const target = norm(club.opponentAliases?.[name] || name);
  const hit = index.photos.find((p) => p.type === 'opposition' && norm(p.name) === target);
  return hit ? dataUri({ photo: hit, variant: 'full' }, index) : null;
}
