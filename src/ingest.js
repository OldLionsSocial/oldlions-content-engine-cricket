#!/usr/bin/env node
// Scans the Drive Photo Library, processes new or changed photos and updates Processed/photo-index.json.
//  - Studio/<season>/PLAYERID_pose.jpg       -> studio photo (+ background-removed cut-out)
//  - Match Photos/<season>/<YYYY-MM-DD Team v Opponent>/*.jpg -> match photo, players tagged by
//    IDs in the file name or the Drive description (e.g. "P103 P107 bat")
//  - Brand Assets/Ground & Club/*            -> ground photos (backgrounds, no people)
//  - Brand Assets/Logos/*.png                -> club logo
// Every processed copy is re-encoded, which strips EXIF (including GPS location).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { listChildren, upsertFile, readJson, writeJson, download, exportFile, FOLDER, driveConfigured } from './drive.js';
import { INDEX_NAME } from './photos.js';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const club = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/club.json'), 'utf8'));
const lib = club.photoLibrary;
// (club is also used for the Claude model name)
const ID_PAT = lib.playerIdPattern || 'P\\d+';
// Player IDs anywhere in a name or description; underscores, spaces and dashes all count as separators.
const ID = new RegExp(`(?:^|[^A-Za-z0-9])(${ID_PAT})(?![A-Za-z0-9])`, 'g');
const tagsIn = (text) => [...new Set([...text.matchAll(ID)].map((m) => m[1]))];
const POSES = ['headshot', 'halfbody', 'bat', 'bowl', 'keep', 'celebrate', 'field'];
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

// Cut-outs need Python with rembg + OpenCV (installed in the GitHub Action).
const hasRembg = (() => { try { execFileSync('python3', ['-c', 'import rembg, cv2'], { stdio: 'ignore' }); return true; } catch { return false; } })();

function poseFrom(text) {
  const t = text.toLowerCase();
  return POSES.find((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(t)) || 'action';
}

// ---- roster: photographer file names -> ops player IDs --------------------------
const normName = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
// "Allister de Blocq 4.jpg", "Brandon Childs (11).jpg" -> "allister de blocq"
const nameFromFile = (f) => normName(f.replace(/\.[^.]+$/, '').replace(/\(\d+\)|[_-]?\d+\s*$/g, ''));

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function loadRoster() {
  if (!lib.rosterSheetId) return new Map();
  const csv = (await exportFile(lib.rosterSheetId, 'text/csv')).toString('utf8');
  const [head, ...rows] = parseCsv(csv);
  const col = (re) => head.findIndex((h) => re.test(h));
  const iName = col(/name in photo/i), iAlt = col(/other spellings/i), iId = col(/ops player id/i);
  const map = new Map();
  for (const r of rows) {
    const id = (r[iId] || '').trim();
    for (const n of [r[iName], ...String(r[iAlt] || '').split(/[,;]/)]) if (normName(n)) map.set(normName(n), id || null);
  }
  return map;
}

// ---- pose sorting with Claude ---------------------------------------------------
// Claude describes the photo (pose, sharpness, eyes); it is never asked who the person is.
const POSE_PROMPT = `This is a studio photo of a cricket player for club social media graphics. Reply with JSON only:
{"pose": one of "headshot" (head and shoulders only), "halfbody" (arms crossed or relaxed standing pose), "celebrate" (pointing, fist pump, arms raised), "bat" (holding or swinging a bat), "bowl" (bowling action or ball in hand), "keep" (wicketkeeping),
 "usable": true or false (false if eyes closed, blurred, cut off at the head, or someone else in frame),
 "reason": short reason if not usable}`;
let claude;
async function classify(buf) {
  if (!process.env.ANTHROPIC_API_KEY) return { pose: 'halfbody', usable: true, reason: 'not checked (no API key)' };
  claude ??= new Anthropic();
  const thumb = await sharp(buf).rotate().resize(768, 768, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
  const msg = await claude.messages.create({
    model: club.claudeModel, max_tokens: 200,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: thumb.toString('base64') } },
      { type: 'text', text: POSE_PROMPT },
    ] }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return { pose: 'halfbody', usable: true, reason: 'could not read classification' }; }
}

async function processFull(buf, maxEdge = 1600) {
  return sharp(buf).rotate().resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

// Green-screen aware cut-out: AI subject mask + chroma-key edges + spill removal +
// face-framed crops. Returns { cutout, waist, head } PNG buffers (waist/head may be missing).
async function processCutout(buf) {
  if (!hasRembg) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cut-'));
  const src = path.join(dir, 'photo.jpg');
  fs.writeFileSync(src, await sharp(buf).rotate().jpeg({ quality: 95 }).toBuffer());
  execFileSync('python3', [path.join(ROOT, 'scripts/greenscreen.py'), src, '--out', dir, '--model', lib.cutoutModel || 'birefnet-portrait'], { stdio: 'inherit' });
  const read = (k) => (fs.existsSync(path.join(dir, `photo_${k}.png`)) ? fs.readFileSync(path.join(dir, `photo_${k}.png`)) : null);
  const out = { cutout: read('cutout'), waist: read('halfbody'), head: read('head') };
  fs.rmSync(dir, { recursive: true, force: true });
  return out.cutout ? out : null;
}

// Head-and-shoulders square from the top of a trimmed cut-out, for round team-list photos.
async function headCrop(png) {
  const { width, height } = await sharp(png).metadata();
  const side = Math.min(width, height);
  const left = Math.round((width - side) / 2);
  return sharp(png).extract({ left, top: 0, width: side, height: side }).resize(400, 400).png().toBuffer();
}

async function scan() {
  const found = []; // { file, type, season, matchFolder, matchDate }
  const report = [];
  const seasons = (id) => listChildren(id, { foldersOnly: true });

  for (const s of await seasons(lib.studioId)) {
    for (const f of await listChildren(s.id)) {
      if (f.mimeType === FOLDER || !IMAGE.test(f.name)) continue;
      const m = f.name.match(new RegExp(`^([A-Za-z0-9-]+)_(${POSES.join('|')})\\d*\\.`, 'i'));
      if (!m || !new RegExp(`^${ID_PAT}$`).test(m[1])) { report.push(`Studio/${s.name}/${f.name}: name not recognised (expected PLAYERID_pose.jpg)`); continue; }
      found.push({ file: f, type: 'studio', season: s.name, playerIds: [m[1]], pose: m[2].toLowerCase() });
    }
  }
  // Raw studio shoots: files named after the player (e.g. "Allister de Blocq 4.jpg").
  const walkRaw = async (id, label) => {
    for (const f of await listChildren(id)) {
      if (f.mimeType === FOLDER) { await walkRaw(f.id, `${label}/${f.name}`); continue; }
      if (IMAGE.test(f.name)) found.push({ file: f, type: 'studio', season: lib.rawSeason || club.season, raw: true, rawName: nameFromFile(f.name), playerIds: [], pose: null, where: label });
    }
  };
  for (const id of lib.studioRawFolders || []) await walkRaw(id, 'Raw');

  for (const s of await seasons(lib.matchId)) {
    for (const match of await listChildren(s.id, { foldersOnly: true })) {
      const date = (match.name.match(/^\d{4}-\d{2}-\d{2}/) || [null])[0];
      for (const f of await listChildren(match.id)) {
        if (f.mimeType === FOLDER || !IMAGE.test(f.name)) continue;
        const text = `${f.name} ${f.description || ''}`;
        const playerIds = tagsIn(text);
        if (!playerIds.length) report.push(`${match.name}/${f.name}: no players tagged yet (won't be used until tagged)`);
        found.push({ file: f, type: 'match', season: s.name, matchFolder: match.name, matchDate: date, playerIds, pose: poseFrom(text) });
      }
    }
  }
  for (const f of await listChildren(lib.groundId)) if (IMAGE.test(f.name)) found.push({ file: f, type: 'ground', playerIds: [], pose: 'ground' });
  // Every PNG under Brand Assets / Logos (all sub-folders): the club badge, Super Sixers and
  // franchise logos. Each brand picks its own by name (see config/brands.json).
  const walkLogos = async (id, where) => {
    for (const f of await listChildren(id)) {
      if (f.mimeType === FOLDER) await walkLogos(f.id, `${where}/${f.name}`);
      else if (/\.png$/i.test(f.name) && !/^copy of/i.test(f.name)) found.push({ file: f, type: 'logo', name: `${where}/${f.name}`, playerIds: [], pose: 'logo' });
    }
  };
  await walkLogos(lib.logosId, 'Logos');
  if (lib.sponsorsId) {
    for (const f of await listChildren(lib.sponsorsId)) {
      if (IMAGE.test(f.name)) found.push({ file: f, type: 'sponsor', name: f.name.replace(/\.[^.]+$/, '').trim(), playerIds: [], pose: 'logo' });
    }
  }
  if (lib.oppositionId) {
    for (const f of await listChildren(lib.oppositionId)) {
      if (!IMAGE.test(f.name)) continue;
      if (/^\d+_\d+/.test(f.name)) { report.push(`Opposition Clubs/${f.name}: rename to the club's name`); continue; }
      found.push({ file: f, type: 'opposition', name: f.name.replace(/\.[^.]+$/, '').trim(), playerIds: [], pose: 'logo' });
    }
  }
  return { found, report };
}

async function main() {
  if (!driveConfigured()) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.');
  console.log(`Background removal: ${hasRembg ? 'on' : 'OFF (rembg not installed; no cut-outs will be made)'}`);
  const index = (await readJson(lib.processedId, INDEX_NAME)) || { version: 1, photos: [] };
  const roster = await loadRoster();
  const skippedBefore = new Map((index.skipped || []).map((x) => [x.sourceId, x]));
  const skipped = [];
  const known = new Map(index.photos.map((p) => [p.sourceId, p]));
  const { found, report } = await scan();
  const next = [];
  let added = 0;

  for (const item of found) {
    const prev = known.get(item.file.id);
    if (item.raw) {
      const id = roster.get(item.rawName);
      if (!id) {
        report.push(`${item.where}/${item.file.name}: "${item.rawName}" has no ops player ID in the roster sheet yet`);
        continue;
      }
      item.playerIds = [id];
      const old = skippedBefore.get(item.file.id);
      if (old && old.modifiedTime === item.file.modifiedTime) { skipped.push(old); continue; }
      if (prev && prev.modifiedTime === item.file.modifiedTime) item.pose = prev.pose;
    }
    const meta = { type: item.type, name: item.name || null, season: item.season || null, playerIds: item.playerIds, pose: item.pose, matchFolder: item.matchFolder || null, matchDate: item.matchDate || null };
    // Unchanged file: keep processed copies, but refresh tags (people get tagged after upload).
    if (prev && prev.modifiedTime === item.file.modifiedTime && (prev.files?.cutout || item.type !== 'studio' || !hasRembg)) {
      next.push({ ...prev, ...meta });
      continue;
    }
    try {
      const src = await download(item.file.id);
      if (item.raw) {
        const c = await classify(src);
        if (!c.usable) {
          skipped.push({ sourceId: item.file.id, modifiedTime: item.file.modifiedTime, name: item.file.name, reason: c.reason || 'not usable' });
          report.push(`${item.where}/${item.file.name}: skipped (${c.reason || 'not usable'})`);
          continue;
        }
        item.pose = c.pose || 'halfbody';
        meta.pose = item.pose;
        meta.playerIds = item.playerIds;
      }
      const files = {};
      if (['logo', 'opposition', 'sponsor'].includes(item.type)) {
        const png = await sharp(src).trim().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        files.full = await upsertFile(lib.processedId, `${item.file.id}_logo.png`, png, 'image/png');
      } else {
        files.full = await upsertFile(lib.processedId, `${item.file.id}_full.jpg`, await processFull(src), 'image/jpeg');
        if (item.type === 'studio') {
          const cut = await processCutout(src);
          if (cut) {
            files.cutout = await upsertFile(lib.processedId, `${item.file.id}_cutout.png`, cut.cutout, 'image/png');
            files.head = await upsertFile(lib.processedId, `${item.file.id}_head.png`, cut.head || (await headCrop(cut.cutout)), 'image/png');
            if (cut.waist) files.waist = await upsertFile(lib.processedId, `${item.file.id}_waist.png`, cut.waist, 'image/png');
          }
        }
      }
      next.push({ sourceId: item.file.id, name: item.file.name, modifiedTime: item.file.modifiedTime, ...meta, files, addedAt: prev?.addedAt || new Date().toISOString() });
      added++;
      console.log(`  ✓ ${item.type} ${item.file.name}${files.cutout ? ' (+cut-out)' : ''}`);
    } catch (e) {
      report.push(`${item.file.name}: processing failed (${e.message})`);
      if (prev) next.push(prev);
    }
  }

  await writeJson(lib.processedId, INDEX_NAME, { version: 1, updatedAt: new Date().toISOString(), photos: next, skipped, report });
  console.log(`Index: ${next.length} photos (${added} new or changed, ${index.photos.length + added - next.length > 0 ? 'some removed' : 'none removed'})`);
  for (const r of report) console.log(`  ⚠ ${r}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
