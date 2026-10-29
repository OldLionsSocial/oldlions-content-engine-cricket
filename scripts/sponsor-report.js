#!/usr/bin/env node
// Counts how often each sponsor appeared, by month and post type. Writes sponsor-report.csv.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(ROOT, 'docs/packs');
const counts = {};
for (const id of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  const f = path.join(dir, id, 'schedule.json');
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!p.sponsor) continue;
  const key = [p.sponsor, (p.createdAt || '').slice(0, 7), p.kind, p.brand || 'club'].join(',');
  counts[key] = (counts[key] || 0) + (p.posts?.length || 1);
}
const rows = ['sponsor,month,post type,brand,posts', ...Object.entries(counts).sort().map(([k, v]) => `${k},${v}`)];
fs.writeFileSync(path.join(ROOT, 'sponsor-report.csv'), rows.join('\n'));
console.log(rows.join('\n'));
