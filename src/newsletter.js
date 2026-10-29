// Monday newsletter: email-safe HTML (tables + inline styles, 600 px wide) built from the
// "newsletter.weekly" event. Claude writes a short intro from the facts; everything else is data.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { allowedNumbers } from './facts.js';
import { checkCaption } from './captions.js';
import { matchDate } from './templates/shared.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const e = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function newsletterFacts(ev, club) {
  const f = [`Club: ${club.name}`, `Edition: ${ev.title || ev.date}`];
  for (const r of ev.results || []) f.push(`Result: ${r.team} ${r.outcome}${r.margin ? ` by ${r.margin}` : ''} v ${r.opponent}. ${club.shortName} ${r.ourScore || ''}, ${r.opponent} ${r.theirScore || ''}`);
  for (const m of ev.milestones || []) f.push(`Milestone: ${m.name} (${m.team || ''}): ${m.text}`);
  for (const x of ev.fixtures || []) f.push(`Coming up: ${x.team} v ${x.opponent}, ${matchDate(x.date, club.timezone)}, ${x.startTime || ''}, ${x.venue || ''}`);
  for (const n of ev.news || []) f.push(`News: ${n.title}`);
  for (const x of ev.events || []) f.push(`Event: ${x.title}, ${x.date ? matchDate(x.date, club.timezone) : ''}`);
  if ((ev.classifieds || []).length) f.push(`Classifieds this week: ${ev.classifieds.length}`);
  if (club.sponsor?.name) f.push(`Sponsor to thank: ${club.sponsor.name}`);
  return f;
}

async function intro(facts, club) {
  const fallback = `Here's your weekly round-up from ${club.name}: results, milestones, what's coming up and this week's classifieds.`;
  if (!process.env.ANTHROPIC_API_KEY) return { text: fallback, source: 'template' };
  const style = fs.readFileSync(path.join(ROOT, 'config/style-guide.md'), 'utf8');
  try {
    const msg = await new Anthropic().messages.create({
      model: club.claudeModel, max_tokens: 400,
      system: `You write the opening paragraph of ${club.name}'s Monday email newsletter.\n\n${style}\n\nWrite 3 to 4 warm sentences, plain text, no greeting line, no sign-off, no hashtags or emojis. Only use the facts given.`,
      messages: [{ role: 'user', content: `Facts:\n- ${facts.join('\n- ')}` }],
    });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (checkCaption(text, allowedNumbers(facts))) return { text: fallback, source: 'template (Claude used a number not in the data)' };
    return { text, source: 'claude' };
  } catch (err) {
    return { text: fallback, source: `template (${err.message})` };
  }
}

const RED = '#ED1B24', NAVY = '#043673', YELLOW = '#FFCB05';
const h2 = (t) => `<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:${RED};text-transform:uppercase;letter-spacing:0.5px;">${e(t)}</td></tr>`;
const para = (t, style = '') => `<tr><td style="padding:4px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#222222;${style}">${t}</td></tr>`;

function resultsTable(results) {
  const chip = { won: ['W', YELLOW, NAVY], lost: ['L', NAVY, '#FFFFFF'], draw: ['D', '#DDDDDD', '#222222'], tie: ['T', '#DDDDDD', '#222222'] };
  const rows = results.map((r) => {
    const [t, bg, fg] = chip[r.outcome] || ['-', '#EEEEEE', '#555555'];
    return `<tr>
      <td width="36" style="padding:8px 0;"><div style="width:30px;height:30px;line-height:30px;text-align:center;background:${bg};color:${fg};font-family:Arial,sans-serif;font-weight:bold;">${t}</div></td>
      <td style="padding:8px 8px;font-family:Arial,sans-serif;font-size:15px;color:#222;"><strong>${e(r.team)}</strong> v ${e(r.opponent)}<br><span style="color:#666;font-size:13px;">${r.margin ? `${r.outcome === 'won' ? 'Won' : r.outcome === 'lost' ? 'Lost' : ''} by ${e(r.margin)}` : e(r.outcome || '')}</span></td>
      <td align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#222;white-space:nowrap;">${e(r.ourScore || '')}<br><span style="color:#666;">${e(r.theirScore || '')}</span></td></tr>`;
  }).join('');
  return `<tr><td style="padding:0 28px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table></td></tr>`;
}

export async function buildNewsletter(ev, club, outDir, base) {
  const facts = newsletterFacts(ev, club);
  const { text, source } = await intro(facts, club);
  const badge = `${club.publicBaseUrl}/assets/badge.png`;
  const groups = {};
  for (const c of ev.classifieds || []) (groups[c.category || 'Other'] ??= []).push(c);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(club.name)}: ${e(ev.title || '')}</title></head>
<body style="margin:0;padding:0;background:#F2F0EE;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EE;"><tr><td align="center" style="padding:20px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;">
  <tr><td style="background:${RED};padding:22px 28px;" align="left">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="110"><img src="${badge}" width="100" alt="${e(club.name)} badge" style="display:block;border:0;"></td>
      <td style="font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;"><div style="font-size:26px;font-weight:bold;text-transform:uppercase;">The Lions' Den</div><div style="font-size:15px;color:${YELLOW};">${e(ev.title || '')}</div></td>
    </tr></table></td></tr>
  ${para(e(text), 'padding-top:24px;font-size:16px;line-height:24px;')}
  ${(ev.results || []).length ? h2('Weekend results') + resultsTable(ev.results) : ''}
  ${(ev.milestones || []).length ? h2('Milestones') + (ev.milestones).map((m) => para(`<strong>${e(m.name)}</strong>${m.team ? ` (${e(m.team)})` : ''}: ${e(m.text)}`)).join('') : ''}
  ${(ev.fixtures || []).length ? h2('Coming up') + (ev.fixtures).map((x) => para(`<strong>${e(x.team)} v ${e(x.opponent)}</strong><br><span style="color:#666;">${e(matchDate(x.date, club.timezone))}, ${e(x.startTime || '')}, ${e(x.venue || '')}</span>`)).join('') : ''}
  ${(ev.news || []).length ? h2('Club news') + (ev.news).map((n) => para(`<strong>${e(n.title)}</strong><br>${e(n.text || '')}`)).join('') : ''}
  ${(ev.events || []).length ? h2('Diary') + (ev.events).map((x) => para(`<strong>${e(x.title)}</strong>${x.date ? `, ${e(matchDate(x.date, club.timezone))}` : ''}<br>${e(x.details || '')}`)).join('') : ''}
  ${Object.keys(groups).length ? h2('Classifieds') + Object.entries(groups).map(([cat, items]) => para(`<span style="color:${NAVY};font-weight:bold;text-transform:uppercase;font-size:13px;">${e(cat)}</span>`) + items.map((c) => para(`<strong>${e(c.title)}</strong>${c.price ? ` <span style="color:${RED};font-weight:bold;">${e(c.price)}</span>` : ''}<br>${e(c.text || '')}${c.contact ? `<br><span style="color:#666;">Contact: ${e(c.contact)}</span>` : ''}`)).join('')).join('') : ''}
  <tr><td style="padding:28px;"></td></tr>
  ${club.sponsor?.name ? `<tr><td style="background:${NAVY};padding:18px 28px;font-family:Arial,sans-serif;font-size:14px;color:#FFFFFF;" align="center">Proudly supported by <strong>${e(club.sponsor.name)}</strong></td></tr>` : ''}
  <tr><td style="background:${RED};padding:16px 28px;font-family:Arial,sans-serif;font-size:12px;color:#FFFFFF;" align="center">${e(club.name)}${club.handles?.instagram ? ` &middot; ${e(club.handles.instagram)}` : ''}</td></tr>
</table></td></tr></table></body></html>`;

  fs.writeFileSync(path.join(outDir, 'newsletter.html'), html);
  const txt = [club.name, ev.title, '', text, '', ...facts.filter((f) => /^(Result|Milestone|Coming up|Event|News):/.test(f))].join('\n');
  fs.writeFileSync(path.join(outDir, 'newsletter.txt'), txt);
  return { source, facts };
}
