// Everything numeric comes from here, never from the language model.
import { matchDate, displayName } from './templates/shared.js';

const byId = (ev) => Object.fromEntries((ev.players || []).map((p) => [p.id, p]));

export function battingLine(b) {
  const extras = [b.fours && `${b.fours} four${b.fours > 1 ? 's' : ''}`, b.sixes && `${b.sixes} six${b.sixes > 1 ? 'es' : ''}`].filter(Boolean);
  return `${b.runs}${b.notOut ? '*' : ''} off ${b.balls} balls${extras.length ? ` (${extras.join(', ')})` : ''}`;
}
export const bowlingLine = (w) => `${w.wickets} for ${w.runs} off ${w.overs} overs`;

// Player of the match: the ops system can set topPerformerId; otherwise we score it.
export function topPerformer(ev) {
  const people = {};
  const add = (id, name) => (people[id] ??= { id, name, pts: 0, bat: null, bowl: null });
  for (const b of ev.batting || []) {
    const p = add(b.playerId, b.name);
    p.bat = b;
    p.pts += b.runs + (b.runs >= 50 ? 10 : 0) + (b.runs >= 100 ? 20 : 0);
  }
  for (const w of ev.bowling || []) {
    const p = add(w.playerId, w.name);
    p.bowl = w;
    const overs = parseFloat(w.overs) || 0;
    p.pts += w.wickets * 22 + (w.wickets >= 5 ? 20 : 0) - Math.max(0, w.runs - overs * 6) * 0.2;
  }
  const list = Object.values(people);
  if (!list.length) return null;
  const chosen = (ev.topPerformerId && people[ev.topPerformerId]) || list.sort((a, b) => b.pts - a.pts)[0];
  const player = byId(ev)[chosen.id] || { id: chosen.id, name: chosen.name };
  const lines = [], graphicLines = [];
  if (chosen.bat && (chosen.bat.runs >= 20 || !chosen.bowl)) {
    lines.push(battingLine(chosen.bat));
    graphicLines.push(`${chosen.bat.runs}${chosen.bat.notOut ? '*' : ''} off ${chosen.bat.balls}`);
  }
  if (chosen.bowl && (chosen.bowl.wickets >= 1 || !chosen.bat)) {
    lines.push(bowlingLine(chosen.bowl));
    graphicLines.push(`${chosen.bowl.wickets} for ${chosen.bowl.runs}`);
  }
  return { player, name: displayName(player) || chosen.name, lines, graphicLines, bat: chosen.bat, bowl: chosen.bowl, discipline: chosen.bowl && (!chosen.bat || chosen.bat.runs < 20) ? 'bowl' : 'bat' };
}

const scoreText = (inn) =>
  inn.wickets === 10 ? `${inn.runs} all out (${inn.overs} overs)` : `${inn.runs}/${inn.wickets} (${inn.overs} overs)`;

// A plain list of true statements the caption writer may use, and nothing else.
export function factSheet(ev, club, kind) {
  const f = [
    `Team: ${club.shortName} ${ev.team?.name || ''}`.trim(),
    `Opponent: ${ev.opponent?.name || 'TBC'}`,
    `Competition: ${[ev.competition, ev.round].filter(Boolean).join(', ')}`,
    `Date: ${matchDate(ev.date, club.timezone)}`,
    `Start time: ${ev.startTime || 'TBC'}`,
    `Venue: ${ev.venue?.name || 'TBC'} (${ev.homeAway === 'away' ? 'away' : 'home'} fixture)`,
    `Format: ${ev.format || ''}`,
  ];
  const people = byId(ev);
  if (kind === 'team-list') {
    const xi = [...(ev.players || [])].sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99));
    f.push(`Selected team: ${xi.map((p) => displayName(p) + (p.captain ? ' (captain)' : '') + (p.wicketKeeper ? ' (wicketkeeper)' : '')).join(', ')}`);
  }
  if (kind === 'result') {
    const r = ev.result || {};
    f.push(`Result: ${club.shortName} ${r.outcome}${r.margin ? ` by ${r.margin}` : ''}`);
    if (r.tossNote) f.push(`Toss: ${r.tossNote}`);
    for (const inn of ev.innings || []) f.push(`Innings: ${inn.team} ${scoreText(inn)}`);
    for (const b of ev.batting || []) f.push(`Batting: ${displayName(people[b.playerId]) || b.name} ${battingLine(b)}`);
    for (const w of ev.bowling || []) f.push(`Bowling: ${displayName(people[w.playerId]) || w.name} ${bowlingLine(w)}`);
    const top = topPerformer(ev);
    if (top) f.push(`Player of the match: ${top.name} (${top.lines.join('; ')})`);
  }
  if (kind === 'gameday' || kind === 'playing-xi') {
    const cap = (ev.players || []).find((p) => p.captain);
    if (cap) f.push(`Captain: ${displayName(cap)}`);
  }
  if (club.sponsor?.name) f.push(`Sponsor to thank: ${club.sponsor.name}`);
  return f;
}

export function milestoneFacts(ev, club, m, name) {
  const base = factSheet(ev, club, 'fixture').filter((x) => !x.startsWith('Start time'));
  const what = m.bat ? `${name} scored a ${m.word.toLowerCase()}: ${battingLine(m.bat)}` : `${name} took a ${m.word.toLowerCase()}: ${bowlingLine(m.bowl)}`;
  return [...base, `Milestone: ${what}`, ...(club.sponsor?.name ? [`Sponsor to thank: ${club.sponsor.name}`] : [])];
}

export function weeklyFacts(ev, club, kind) {
  const f = [`Club: ${club.name}`, `Period: ${ev.title || 'this weekend'}`];
  if (kind === 'weekend-fixtures') for (const x of ev.fixtures || []) f.push(`Fixture: ${x.team} v ${x.opponent}, ${matchDate(x.date, club.timezone)}, ${x.startTime || 'TBC'}, ${x.venue || 'TBC'} (${x.homeAway === 'away' ? 'away' : 'home'})`);
  else for (const x of ev.results || []) f.push(`Result: ${x.team} ${x.outcome}${x.margin ? ` by ${x.margin}` : ''} v ${x.opponent}. ${club.shortName} ${x.ourScore || ''}, ${x.opponent} ${x.theirScore || ''}`);
  if (club.sponsor?.name) f.push(`Sponsor to thank: ${club.sponsor.name}`);
  return f;
}

// Every number that appears in the facts. Captions may only contain these.
export const allowedNumbers = (facts) => new Set(facts.join(' ').match(/\d+(?:\.\d+)?/g) || []);

// ---- scheduling ----------------------------------------------------------

function localNow(timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
}

function addMinutes(local, mins) {
  const d = new Date(`${local}Z`);
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return d.toISOString().slice(0, 19);
}

// Returns a local date-time string (YYYY-MM-DDTHH:mm:ss) in the club's timezone.
export function suggestedTime(ev, club, kind) {
  const rule = club.schedule?.[kind] || {};
  const d = new Date(`${ev.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (rule.daysBefore || 0) + (rule.daysAfter || 0));
  let when = `${d.toISOString().slice(0, 10)}T${rule.time || '18:00'}:00`;
  const soonest = addMinutes(localNow(club.timezone), 20);
  if (when < soonest) when = soonest; // posting late? go out in 20 minutes instead
  return when;
}
