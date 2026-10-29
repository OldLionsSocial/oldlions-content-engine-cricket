#!/usr/bin/env node
// Deletes content packs older than KEEP_DAYS (default 120) so the site stays small.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(ROOT, 'docs/packs');
const keep = Number(process.env.KEEP_DAYS || 120) * 864e5;
let removed = 0;
for (const id of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  const f = path.join(dir, id, 'schedule.json');
  if (!fs.existsSync(f)) continue;
  const { createdAt } = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (createdAt && Date.now() - new Date(createdAt) > keep) { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); removed++; }
}
console.log(`Removed ${removed} old pack(s).`);
