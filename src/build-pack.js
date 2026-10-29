#!/usr/bin/env node
// Usage: node src/build-pack.js <event.json>        (or pipe the JSON on stdin)
// Builds docs/packs/<pack-id>/ containing feed.png, story.png, captions.json,
// schedule.json (ready for Metricool) and index.html (the review page).
import fs from 'node:fs';
import path from 'node:path';
import { renderPng, SIZES } from './render.js';
import { fixtureCard } from './templates/fixture.js';
import { teamListCard } from './templates/team-list.js';
import { resultCard } from './templates/result.js';
import { gamedayCard } from './templates/gameday.js';
import { potmCard } from './templates/potm.js';
import { playingXiCard } from './templates/playing-xi.js';
import { resultPhotoCard } from './templates/result-photo.js';
import { milestoneCard, milestonesFor } from './templates/milestone.js';
import { weekendFixturesCard, weekendResultsCard, ROWS_PER_PAGE } from './templates/weekly.js';
import { predictCard, potwCard, guessCard, leaderboardCard, quizCard } from './templates/interactive.js';
import { interactiveFacts } from './facts.js';
import sharp from 'sharp';
import { factSheet, topPerformer, suggestedTime, milestoneFacts, weeklyFacts } from './facts.js';
import { writeCaptions } from './captions.js';
import { esc, displayName } from './templates/shared.js';
import { loadIndex, playerImages, groundImage, logoImage, placeholder, RULES, opponentLogo, sponsorFor } from './photos.js';
import crypto from 'node:crypto';
import { driveConfigured, ensurePath } from './drive.js';
import { buildTheme } from './theme.js';
import { buildNewsletter } from './newsletter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE_CLUB = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/club.json'), 'utf8'));
const BRANDS = fs.existsSync(path.join(ROOT, 'config/brands.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brands.json'), 'utf8')) : {};
let club = BASE_CLUB; // replaced per event by the event's brand (club, Super Sixers or a franchise)

// Which posts each ops event produces. Override in config/club.json under "outputs".
const OUTPUTS = {
  'fixture.created': ['fixture'],
  'fixture.updated': ['fixture'],
  'team.selected': ['playing-xi', 'gameday'],
  'scorecard.imported': ['result', 'potm', 'milestone'],
  'fixtures.weekly': ['weekend-fixtures'],
  'results.weekly': ['weekend-results'],
  'predict.open': ['predict'],
  'potw.vote': ['potw'],
  'guess.player': ['guess'],
  'guess.reveal': ['guess-reveal'],
  'leaderboard': ['leaderboard'],
  'quiz': ['quiz'],
  'quiz.answer': ['quiz-answer'],
  ...(club.outputs || {}),
  ...(process.env.OUTPUTS_JSON ? JSON.parse(process.env.OUTPUTS_JSON) : {}),
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const chunk = (arr, n) => Array.from({ length: Math.max(1, Math.ceil(arr.length / n)) }, (_, i) => arr.slice(i * n, i * n + n));

// Solid-colour silhouette of a cut-out, for Guess the Lion.
async function silhouetteOf(img, colour) {
  if (!img) return null;
  const buf = Buffer.from(img.src.split(',')[1], 'base64');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = parseInt(colour.slice(1), 16);
  for (let i = 0; i < data.length; i += 4) { data[i] = (n >> 16) & 255; data[i + 1] = (n >> 8) & 255; data[i + 2] = n & 255; }
  const png = await sharp(data, { raw: info }).png().toBuffer();
  return { src: `data:image/png;base64,${png.toString('base64')}`, w: info.width, h: info.height };
}

async function readEvent() {
  const file = process.argv[2];
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

// Each job: { kind, suffix, pages: { feed: [markup], story: [markup] }, facts, warnings }
async function jobsFor(ev, index) {
  const kinds = OUTPUTS[ev.event];
  if (!kinds) throw new Error(`Unknown event "${ev.event}". Expected one of: ${Object.keys(OUTPUTS).join(', ')}`);
  const ctx = { matchId: ev.matchId || ev.title || ev.date, date: ev.date, players: Object.fromEntries((ev.players || []).map((p) => [p.id, p])) };
  const ground = await groundImage(index, ctx);
  const oppLogo = await opponentLogo(index, ev.opponent?.name, club);
  const both = (fn) => ({ feed: [fn(SIZES.feed)], story: [fn(SIZES.story)] });
  const jobs = [];

  for (const kind of kinds) {
    const warnings = [];
    // Each post type gets its own colourway and decor.
    const C = { ...club, colours: await buildTheme(kind, club, ev) };
    if (kind === 'fixture') jobs.push({ kind, pages: both((s) => fixtureCard(ev, C, s, { oppLogo })), facts: factSheet(ev, club, 'fixture') });

    if (kind === 'team-list' || kind === 'playing-xi' || kind === 'gameday') {
      const cap = (ev.players || []).find((p) => p.captain) || ev.players?.[0];
      const capImg = await playerImages(index, cap, ctx, { colours: club.colours, heroRules: RULES.captainCutout });
      if (cap && !capImg.cutout && kind !== 'team-list') warnings.push(`No usable cut-out of ${displayName(cap)} (captain): ${cap.photoConsent ? 'add studio photos' : 'no photo consent'}.`);
      if (kind === 'team-list') {
        const heads = {};
        for (const p of ev.players || []) heads[p.id] = (await playerImages(index, p, ctx, { colours: club.colours })).headshot.src;
        jobs.push({ kind, pages: both((s) => teamListCard(ev, C, s, heads)), facts: factSheet(ev, club, 'team-list'), warnings });
      } else if (kind === 'playing-xi') {
        jobs.push({ kind, pages: both((s) => playingXiCard(ev, C, s, { cutout: capImg.cutout, oppLogo })), facts: factSheet(ev, club, 'playing-xi'), warnings });
      } else {
        jobs.push({ kind, pages: both((s) => gamedayCard(ev, C, s, { ground, cutout: capImg.cutout, oppLogo })), facts: factSheet(ev, club, 'gameday'), warnings });
      }
    }

    if (kind === 'result' || kind === 'potm') {
      const top = topPerformer(ev);
      const img = top ? await playerImages(index, top.player, ctx, { discipline: top.discipline, colours: club.colours }) : {};
      if (top && !top.player.photoConsent) warnings.push(`${top.name} has no photo consent: no photo used.`);
      if (kind === 'result') {
        const photoLed = img.action || img.cutout;
        const pages = photoLed
          ? both((s) => resultPhotoCard(ev, C, s, { action: img.action, cutout: img.cutout, ground, oppLogo }))
          : both((s) => resultCard(ev, C, s, top ? { ...top, photo: (img.headshot || placeholder(club.colours)).src } : null));
        jobs.push({ kind, pages, facts: factSheet(ev, club, 'result'), warnings });
      } else if (top) {
        jobs.push({ kind, pages: both((s) => potmCard(ev, C, s, img, top)), facts: factSheet(ev, club, 'result'), warnings });
      }
    }

    if (kind === 'milestone') {
      for (const m of milestonesFor(ev)) {
        const player = ctx.players[m.playerId] || { id: m.playerId, name: (m.bat || m.bowl).name };
        const name = displayName(player);
        const img = await playerImages(index, player, ctx, { discipline: m.bat ? 'bat' : 'bowl', colours: club.colours });
        const w = img.cutout ? [] : [`No usable cut-out of ${name} for the milestone graphic.`];
        jobs.push({ kind, suffix: slug(`${m.playerId}-${m.word}`), pages: both((s) => milestoneCard(ev, C, s, img, m, name)), facts: milestoneFacts(ev, club, m, name), warnings: w });
      }
    }

    if (kind === 'predict') jobs.push({ kind, pages: both((s) => predictCard(ev, C, s, { oppLogo })), facts: interactiveFacts(kind, ev, club) });
    if (kind === 'potw') {
      const photos = {};
      for (const cd of ev.candidates || []) {
        const pl = ctx.players[cd.playerId] || { id: cd.playerId, photoConsent: cd.photoConsent };
        ctx.players[cd.playerId] ??= pl;
        photos[cd.playerId] = (await playerImages(index, pl, ctx, { colours: club.colours })).headshot;
      }
      jobs.push({ kind, pages: both((s) => potwCard(ev, C, s, { photos })), facts: interactiveFacts(kind, ev, club) });
    }
    if (kind === 'guess' || kind === 'guess-reveal') {
      const pl = ctx.players[ev.playerId] || { id: ev.playerId, photoConsent: ev.photoConsent };
      ctx.players[ev.playerId] ??= pl;
      const img = await playerImages(index, pl, ctx, { colours: club.colours, heroRules: RULES.captainCutout });
      if (!img.cutout) warnings.push('No usable cut-out for this player: pick someone with studio photos and consent.');
      const reveal = kind === 'guess-reveal';
      const sil = reveal ? null : await silhouetteOf(img.cutout, C.colours.gold);
      jobs.push({ kind, pages: both((s) => guessCard(ev, C, s, { cutout: img.cutout, silhouette: sil }, reveal)), facts: interactiveFacts(kind, ev, club), warnings });
    }
    if (kind === 'leaderboard') jobs.push({ kind, suffix: ev.metric ? slug(ev.metric) : '', pages: both((s) => leaderboardCard(ev, C, s, {})), facts: interactiveFacts(kind, ev, club) });
    if (kind === 'quiz' || kind === 'quiz-answer') jobs.push({ kind, pages: both((s) => quizCard(ev, C, s, {}, kind === 'quiz-answer')), facts: interactiveFacts(kind, ev, club) });

    if (kind === 'weekend-fixtures' || kind === 'weekend-results') {
      const list = kind === 'weekend-fixtures' ? ev.fixtures || [] : ev.results || [];
      const card = kind === 'weekend-fixtures' ? weekendFixturesCard : weekendResultsCard;
      const logos = {};
      for (const x of list) logos[x.opponent] ??= await opponentLogo(index, x.opponent, club);
      const pages = {};
      for (const [name, size] of Object.entries(SIZES)) {
        const parts = chunk(list, ROWS_PER_PAGE[name]);
        pages[name] = parts.map((part, i) => card(ev, C, size, { ground, logos }, part, parts.length > 1 ? `${i + 1} of ${parts.length}` : ''));
      }
      jobs.push({ kind, pages, facts: weeklyFacts(ev, club, kind) });
    }
  }
  return jobs;
}

export async function buildEvent(ev) {
  const brandKey = ev.brand || 'club';
  if (ev.brand && !BRANDS[ev.brand]) throw new Error(`Unknown brand "${ev.brand}". Add it to config/brands.json.`);
  club = { ...BASE_CLUB, ...(BRANDS[brandKey] || {}), brand: brandKey };
  club = { ...club, schedule: BASE_CLUB.schedule, photoLibrary: BASE_CLUB.photoLibrary };
  const index = await loadIndex(club);
  club._logo = await logoImage(index, club);
  if (!club._logo) console.log(`  ⚠ No logo found for brand "${brandKey}" (logoMatch: ${club.logoMatch}).`);
  // Sponsor: the one named on the event, or a fair rotation.
  const sp = await sponsorFor(index, `${ev.event}:${ev.matchId || ev.date}`, ev.sponsor);
  if (sp) club.sponsor = { name: sp.name, logo: sp.logo };

  // New fixture: make its match photo folder in Drive so photographers have somewhere to upload.
  if (ev.event === 'fixture.created' && driveConfigured() && club.photoLibrary?.matchId) {
    const name = `${ev.date} ${ev.team?.name} v ${ev.opponent?.name}`.replace(/[/\\]/g, '-');
    await ensurePath(club.photoLibrary.matchId, `${club.season}/${name}`);
    console.log(`  Drive match folder ready: Match Photos/${club.season}/${name}`);
  }

  if (ev.event === 'newsletter.weekly') return [await writeNewsletter(ev)];
  const packs = [];
  for (const job of await jobsFor(ev, index)) packs.push(await writePack(ev, job));
  return packs;
}

async function writePack(ev, job) {
  const team = ev.team?.name ? slug(ev.team.name) : 'club';
  const baseId = [club.brand !== 'club' ? club.brand : null, ev.date, team, job.kind, job.suffix].filter(Boolean).join('-');
  // A secret-keyed suffix makes the review address impossible to guess (set PACK_SECRET in GitHub).
  const token = process.env.PACK_SECRET ? crypto.createHmac('sha256', process.env.PACK_SECRET).update(baseId).digest('hex').slice(0, 12) : null;
  if (!token) console.log('  ⚠ PACK_SECRET not set: this pack\'s address is guessable.');
  const id = [baseId, token].filter(Boolean).join('-');
  const dir = path.join(ROOT, 'docs/packs', id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Building ${id}`);

  const files = { feed: [], story: [] };
  for (const [name, size] of Object.entries(SIZES)) {
    for (const [i, markup] of job.pages[name].entries()) {
      const file = job.pages[name].length > 1 ? `${name}-${i + 1}.png` : `${name}.png`;
      fs.writeFileSync(path.join(dir, file), await renderPng(markup, size));
      files[name].push(file);
    }
  }

  const { captions, source, warnings } = await writeCaptions(job.kind, job.facts, club);
  warnings.push(...(job.warnings || []));

  const base = `${club.publicBaseUrl}/packs/${id}`;
  const when = suggestedTime(ev, club, job.kind);
  const nets = club.schedule?.[job.kind]?.networks || ['facebook', 'instagram'];
  const feed = files.feed.map((f) => `${base}/${f}`);
  const posts = [];
  const push = (network, text, media, data = {}) => posts.push({ network, text, media, publicationDate: { dateTime: when, timezone: club.timezone }, ...data });
  if (nets.includes('facebook')) push('facebook', captions.facebook, feed, { facebookData: { type: 'POST' } });
  if (nets.includes('instagram')) {
    push('instagram', captions.instagram, feed, { instagramData: { type: 'POST' } });
    for (const f of files.story) push('instagram', '', [`${base}/${f}`], { instagramData: { type: 'STORY' } });
  }
  if (nets.includes('tiktok')) push('tiktok', captions.tiktok, files.story.map((f) => `${base}/${f}`), { tiktokData: { privacyOption: 'PUBLIC_TO_EVERYONE' } });
  if (nets.includes('gmb')) push('gmb', captions.gmb, [], { gmbData: { type: 'publication' } });
  if (nets.includes('twitter')) push('twitter', captions.x, feed.slice(0, 4), { twitterData: { tags: [] } });
  if (nets.includes('linkedin')) push('linkedin', captions.linkedin, feed, { linkedinData: { type: 'post' } });

  const pack = { id, brand: club.brand, metricoolBrand: club.metricoolBrand || null, sponsor: club.sponsor?.name || null, kind: job.kind, matchId: ev.matchId || null, createdAt: new Date().toISOString(), captionSource: source, warnings, facts: job.facts, captions, files, posts };
  fs.writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(captions, null, 2));
  fs.writeFileSync(path.join(dir, 'schedule.json'), JSON.stringify(pack, null, 2));
  fs.writeFileSync(path.join(dir, 'index.html'), reviewPage(pack, base));
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- **${pack.kind}**: [review page](${base}/)${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}\n`);
  console.log(`  → ${path.relative(ROOT, dir)}  (${posts.length} posts, ${when.replace('T', ' ')})`);
  return pack;
}

function packId(baseId) {
  const token = process.env.PACK_SECRET ? crypto.createHmac('sha256', process.env.PACK_SECRET).update(baseId).digest('hex').slice(0, 12) : null;
  return [baseId, token].filter(Boolean).join('-');
}

async function writeNewsletter(ev) {
  const id = packId([club.brand !== 'club' ? club.brand : null, ev.date, 'newsletter'].filter(Boolean).join('-'));
  const dir = path.join(ROOT, 'docs/packs', id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Building ${id}`);
  const base = `${club.publicBaseUrl}/packs/${id}`;
  const { source, facts } = await buildNewsletter(ev, club, dir, base);
  const prompt = `Create a Gmail draft of the newsletter at ${base}/newsletter.html, subject "${club.name}: ${ev.title || ev.date}", addressed to me, so I can check it before sending.`;
  fs.writeFileSync(path.join(dir, 'schedule.json'), JSON.stringify({ id, kind: 'newsletter', brand: club.brand, sponsor: club.sponsor?.name || null, createdAt: new Date().toISOString(), introSource: source, facts }, null, 2));
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Review: newsletter</title>
<style>:root{--bg:#f6f7f9;--card:#fff;--text:#1a2230}@media (prefers-color-scheme:dark){:root{--bg:#0f1622;--card:#182233;--text:#e8edf4}}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--text)}main{max-width:900px;margin:0 auto;padding:24px}.card{background:var(--card);border-radius:10px;padding:16px 20px;margin:16px 0}iframe{width:100%;height:1400px;border:0;background:#fff;border-radius:10px}code{user-select:all}</style></head>
<body><main><h1>Monday newsletter: ${esc(ev.title || ev.date)}</h1><p>Intro written by: ${esc(source)}</p>
<div class="card"><h2>To send</h2><p>Check it below. Then open Claude (with Gmail connected) and paste:</p><code>${esc(prompt)}</code><p>Or open <a href="newsletter.html">newsletter.html</a>, copy everything, and paste it into your email tool. A plain-text version is in <a href="newsletter.txt">newsletter.txt</a>.</p></div>
<iframe src="newsletter.html" title="Newsletter preview"></iframe></main></body></html>`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- **newsletter**: [review page](${base}/)\n`);
  console.log(`  → ${path.relative(ROOT, dir)}`);
  return { id, kind: 'newsletter' };
}

function updateIndex(pack) {
  const file = path.join(ROOT, 'docs/packs/index.json');
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const next = [{ id: pack.id, kind: pack.kind, createdAt: pack.createdAt }, ...list.filter((p) => p.id !== pack.id)];
  fs.writeFileSync(file, JSON.stringify(next.slice(0, 200), null, 2));
}

function reviewPage(pack, base) {
  const c = club.colours;
  const prompt = `Schedule the ${pack.metricoolBrand || club.name} content pack at ${base}/schedule.json in Metricool${pack.metricoolBrand ? ` (brand: ${pack.metricoolBrand})` : ''}. Show me each post before you schedule it.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Review: ${esc(pack.kind)}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1a2230;--muted:#5b6678;--accent:${c.gold};--warn:#8a5a00;--warnbg:#fff4d6}
@media (prefers-color-scheme:dark){:root{--bg:#0f1622;--card:#182233;--text:#e8edf4;--muted:#9fb0c7;--warn:#ffd78a;--warnbg:#3a2e12}}
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--text)}
main{max-width:1100px;margin:0 auto;padding:24px}
.imgs{display:flex;gap:16px;flex-wrap:wrap}.imgs img{max-width:100%;height:auto;border-radius:8px}
.imgs a{flex:1 1 300px}
.card{background:var(--card);border-radius:10px;padding:16px 20px;margin:16px 0}
.warn{background:var(--warnbg);color:var(--warn)}
pre{white-space:pre-wrap;font:inherit;margin:0}
h2{font-size:1.05rem;margin:0 0 8px}code{user-select:all}
</style></head><body><main>
<h1>${esc(pack.id)}</h1>
<p style="color:var(--muted)">Captions: ${esc(pack.captionSource)}. Created ${esc(pack.createdAt)}.</p>
${pack.warnings.length ? `<div class="card warn"><h2>Check before posting</h2><ul>${pack.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
<div class="imgs">${[...pack.files.feed, ...pack.files.story].map((f) => `<a href="${f}"><img src="${f}" alt="${f}"></a>`).join('')}</div>
<div class="card"><h2>To schedule</h2><p>Open Claude with Metricool connected and paste:</p><code>${esc(prompt)}</code></div>
${pack.posts.map((p) => `<div class="card"><h2>${esc(p.network)}${p.instagramData?.type === 'STORY' ? ' story' : ''}, ${esc(p.publicationDate.dateTime.replace('T', ' ').slice(0, 16))}</h2><pre>${esc(p.text || '(no caption)')}</pre></div>`).join('')}
<div class="card"><h2>Facts used</h2><ul>${pack.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>
</main></body></html>`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  buildEvent(await readEvent()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
