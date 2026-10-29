// Interactive posts: designed to get comments, votes and shares.
import { esc, DISPLAY, BODY, canvas, content, anchored, logoMark, crest, badge, matchDate, rgba, pad, fitSize } from './shared.js';

function clubBar(club, size, right = '') {
  const c = club.colours, tall = size.height > 1500;
  return `<div style="display:flex;justify-content:space-between;align-items:center;${BODY};font-size:${tall ? 36 : 32}px;font-weight:600;">
    <div style="display:flex;align-items:center;gap:16px;color:${c.gold};">${logoMark(club) || ''}<div style="display:flex;">${esc(club.shortName)}</div></div>
    <div style="display:flex;opacity:0.85;">${esc(right)}</div></div>`;
}
const title = (c, text, px, color) => `<div style="display:flex;${DISPLAY};font-size:${px}px;line-height:0.92;text-transform:uppercase;color:${color || c.chalk};">${esc(text)}</div>`;
const pill = (c, text, tall) => `<div style="display:flex;align-self:flex-start;${BODY};font-size:${tall ? 38 : 34}px;font-weight:700;background:${c.gold};color:${c.ground};padding:6px 22px;">${esc(text)}</div>`;

// Predict the score: Friday before a match.
export function predictCard(ev, club, size, a) {
  const c = club.colours, tall = size.height > 1500;
  const opp = ev.opponent?.name || 'TBC';
  return canvas(size, c, content(size, `
    ${clubBar(club, size, [ev.competition, ev.round].filter(Boolean).join(', '))}
    <div style="display:flex;flex-direction:column;gap:${tall ? 30 : 22}px;">
      ${title(c, 'Predict', tall ? 190 : 170)}${title(c, 'the score', tall ? 150 : 130, c.gold)}
      <div style="display:flex;align-items:center;gap:28px;margin-top:10px;">
        ${badge(club, tall ? 150 : 130)}<div style="display:flex;${DISPLAY};font-size:56px;color:${c.gold};">v</div>${crest(a.oppLogo, opp, tall ? 150 : 130, c)}
      </div>
      <div style="display:flex;${BODY};font-size:${tall ? 48 : 42}px;font-weight:700;">${esc(club.shortName)} ${esc(ev.team?.name || '')} v ${esc(opp)}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 36 : 32}px;font-weight:500;color:${c.muted};">${esc(matchDate(ev.date, club.timezone))}, ${esc(ev.startTime || '')}, ${esc(ev.venue?.name || '')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${pill(c, ev.question || `How many will the ${ev.team?.name || 'team'} score?`, tall)}
      <div style="display:flex;${BODY};font-size:${tall ? 34 : 30}px;font-weight:600;">Comment your prediction. ${esc(ev.prize ? `Closest wins ${ev.prize}.` : 'Closest gets bragging rights.')}</div>
    </div>`));
}

// Player of the week: up to four candidates from across the club.
export function potwCard(ev, club, size, a) {
  const c = club.colours, tall = size.height > 1500, W = size.width, p = pad(size);
  const list = (ev.candidates || []).slice(0, 4);
  const cellW = Math.floor((W - 2 * p.side - 24) / 2), cellH = tall ? 520 : 400;
  const cell = (cd, i) => {
    const img = a.photos?.[cd.playerId];
    return `<div style="display:flex;position:relative;flex-direction:column;justify-content:flex-end;width:${cellW}px;height:${cellH}px;background:${c.panel};overflow:hidden;">
      ${img ? anchored(img, { left: 0, bottom: 0, width: cellW, height: cellH - 10 }) : ''}
      <div style="display:flex;position:absolute;top:12px;left:16px;${DISPLAY};font-size:${tall ? 84 : 72}px;color:${c.gold};">${i + 1}</div>
      <div style="display:flex;position:absolute;left:0;bottom:0;width:${cellW}px;box-sizing:border-box;flex-direction:column;padding:10px 16px;background:${rgba('#000000', 0.55)};">
        <div style="display:flex;${BODY};font-size:${tall ? 36 : 32}px;font-weight:700;color:#FFFFFF;">${esc(cd.name)}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 28 : 25}px;font-weight:600;color:${c.gold};">${esc(cd.line || '')}${cd.team ? `, ${esc(cd.team)}` : ''}</div>
      </div></div>`;
  };
  return canvas(size, c, content(size, `
    ${clubBar(club, size, ev.title || 'This week')}
    <div style="display:flex;flex-direction:column;">${title(c, 'Player', tall ? 150 : 128)}${title(c, 'of the week', tall ? 110 : 96, c.gold)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:24px;">${list.map(cell).join('')}</div>
    <div style="display:flex;${BODY};font-size:${tall ? 36 : 32}px;font-weight:700;">Vote in our story poll, or comment the number of your pick.</div>`));
}

// Guess the Lion: silhouette today, reveal tomorrow.
export function guessCard(ev, club, size, a, reveal = false) {
  const c = club.colours, tall = size.height > 1500, W = size.width, H = size.height, p = pad(size);
  const img = reveal ? a.cutout : a.silhouette;
  const figure = anchored(img, { left: Math.round(W * 0.12), bottom: p.bottom + (tall ? 260 : 200), width: Math.round(W * 0.76), height: Math.round(H * (tall ? 0.5 : 0.52)) });
  return canvas(size, c, `${figure}${content(size, `
    ${clubBar(club, size, reveal ? 'The answer' : 'Can you name him?')}
    <div style="display:flex;flex-direction:column;">${title(c, 'Guess', tall ? 170 : 150)}${title(c, 'the Lion', tall ? 130 : 112, c.gold)}</div>
    <div style="display:flex;flex-grow:1;"></div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${reveal
        ? `<div style="display:flex;${DISPLAY};font-size:${fitSize(ev.name || '', tall ? 110 : 96, W - 2 * p.side, 0.46)}px;text-transform:uppercase;">${esc(ev.name || '')}</div>`
        : `${pill(c, 'Clue', tall)}<div style="display:flex;${BODY};font-size:${tall ? 44 : 40}px;font-weight:700;">${esc(ev.clue || 'Comment your guess. Answer tomorrow.')}</div>`}
    </div>`, 'flex-direction:column;')}`);
}

// Leaderboard: season stat races.
export function leaderboardCard(ev, club, size, a) {
  const c = club.colours, tall = size.height > 1500;
  const rows = (ev.rows || []).slice(0, tall ? 10 : 8);
  const rowH = tall ? 100 : 82;
  const row = (r, i) => `
    <div style="display:flex;align-items:center;height:${rowH}px;background:${i === 0 ? c.gold : c.panel};color:${i === 0 ? c.ground : c.chalk};${i === 0 ? '' : ''}">
      <div style="display:flex;justify-content:center;width:${rowH}px;${DISPLAY};font-size:${tall ? 54 : 46}px;">${i + 1}</div>
      <div style="display:flex;flex-direction:column;flex-grow:1;">
        <div style="display:flex;${BODY};font-size:${tall ? 40 : 36}px;font-weight:700;">${esc(r.name)}</div>
        ${r.team ? `<div style="display:flex;${BODY};font-size:${tall ? 26 : 24}px;font-weight:500;opacity:0.85;">${esc(r.team)}</div>` : ''}
      </div>
      <div style="display:flex;padding-right:24px;${DISPLAY};font-size:${tall ? 60 : 50}px;">${esc(String(r.value))}</div>
    </div>`;
  return canvas(size, c, content(size, `
    ${clubBar(club, size, ev.season ? `Season ${ev.season}` : '')}
    <div style="display:flex;flex-direction:column;">${title(c, ev.metric || 'Leaders', tall ? 150 : 128)}${title(c, ev.subtitle || 'Leaderboard', tall ? 72 : 62, c.gold)}</div>
    <div style="display:flex;flex-direction:column;gap:10px;">${rows.map(row).join('')}</div>
    <div style="display:flex;${BODY};font-size:${tall ? 32 : 28}px;font-weight:600;">${esc(ev.footnote || 'All Old Lions teams. Updated weekly.')}</div>`));
}

// Umpire's Call: a Laws of Cricket question, answer the next day.
export function quizCard(ev, club, size, a, reveal = false) {
  const c = club.colours, tall = size.height > 1500;
  const letters = ['A', 'B', 'C', 'D'];
  const opt = (o, i) => {
    const right = reveal && letters[i] === ev.answer;
    const dim = reveal && !right;
    return `<div style="display:flex;align-items:center;gap:20px;padding:${tall ? 18 : 14}px 22px;background:${right ? c.panel : rgba(c.panel, dim ? 0.25 : 0.9)};color:${right ? '#FFFFFF' : dim ? c.chalk : '#FFFFFF'};">
      <div style="display:flex;${DISPLAY};font-size:${tall ? 50 : 44}px;color:${right ? c.gold : '#FFFFFF'};">${letters[i]}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 38 : 34}px;font-weight:700;">${esc(o)}</div></div>`;
  };
  return canvas(size, c, content(size, `
    ${clubBar(club, size, reveal ? 'The answer' : 'Test your knowledge')}
    <div style="display:flex;flex-direction:column;">${title(c, "Umpire's", tall ? 150 : 128)}${title(c, 'call', tall ? 150 : 128, c.gold)}</div>
    <div style="display:flex;${BODY};font-size:${tall ? 46 : 40}px;font-weight:700;line-height:1.2;">${esc(ev.question)}</div>
    <div style="display:flex;flex-direction:column;gap:12px;">${(ev.options || []).map(opt).join('')}</div>
    <div style="display:flex;${BODY};font-size:${tall ? 32 : 28}px;font-weight:600;line-height:1.25;">${esc(reveal ? `${ev.explanation || ''}${ev.law ? ` (${ev.law})` : ''}` : 'Comment A, B, C or D. Answer tomorrow.')}</div>`));
}
