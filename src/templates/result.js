import { esc, DISPLAY, BODY, header, footer, frame } from './shared.js';

const OUTCOME = {
  won: (m) => `Won by ${m}`,
  lost: (m) => `Lost by ${m}`,
  draw: () => 'Match drawn',
  tie: () => 'Match tied',
  'no result': () => 'No result',
  abandoned: () => 'Abandoned',
};

// Each scoreboard character sits in its own tile, like a hand-turned club scoreboard.
function tiles(text, c, tall) {
  const w = tall ? 92 : 74, h = tall ? 122 : 98;
  return [...text].map((ch) => ch === '/'
    ? `<div style="display:flex;justify-content:center;width:${w * 0.5}px;font-family:'Anton';font-size:${h * 0.7}px;color:${c.muted};">/</div>`
    : `<div style="display:flex;justify-content:center;align-items:center;width:${w}px;height:${h}px;margin-left:6px;background:${c.panel};border-bottom:4px solid ${c.ground};font-family:'Anton';font-size:${h * 0.72}px;color:${c.gold};">${esc(ch)}</div>`
  ).join('');
}

export function resultCard(ev, club, size, top) {
  const c = club.colours;
  const tall = size.height > 1500;
  const res = ev.result || {};
  const headline = (OUTCOME[res.outcome] || (() => res.summary || 'Result'))(res.margin || '');
  const accent = res.outcome === 'lost' ? c.loss : c.gold;

  const inningsRow = (inn) => {
    const score = inn.wickets === 10 || inn.wickets == null ? `${inn.runs}` : `${inn.runs}/${inn.wickets}`;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:${tall ? 22 : 14}px 0;">
      <div style="display:flex;flex-direction:column;max-width:48%;">
        <div style="display:flex;${BODY};font-size:${tall ? 46 : 40}px;font-weight:700;">${esc(inn.team)}</div>
        <div style="display:flex;${BODY};font-size:30px;font-weight:500;color:${c.muted};">${esc(inn.overs)} overs${inn.wickets === 10 ? ', all out' : ''}</div>
      </div>
      <div style="display:flex;align-items:center;">${tiles(score, c, tall)}</div>
    </div>`;
  };

  const photoW = tall ? 460 : 380, photoH = tall ? 560 : 440;
  return frame(club, size, `
    ${header(club, ev)}
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;width:120px;height:10px;background:${accent};margin-bottom:22px;"></div>
      <div style="display:flex;${DISPLAY};font-size:${tall ? 132 : 124}px;line-height:1;text-transform:uppercase;">${esc(headline)}</div>
      <div style="display:flex;${BODY};font-size:36px;font-weight:600;color:${c.muted};margin-top:10px;">v ${esc(ev.opponent?.name || '')}, ${esc(ev.venue?.name || '')}</div>
    </div>
    <div style="display:flex;flex-direction:column;">${(ev.innings || []).map(inningsRow).join('')}</div>
    ${top ? `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="display:flex;flex-direction:column;max-width:52%;padding-bottom:12px;">
        <div style="display:flex;${BODY};font-size:32px;font-weight:600;color:${c.muted};">Player of the match</div>
        <div style="display:flex;${DISPLAY};font-size:${tall ? 96 : 78}px;line-height:1.02;text-transform:uppercase;">${esc(top.name)}</div>
        ${top.graphicLines.map((l) => `<div style="display:flex;${BODY};font-size:${tall ? 54 : 46}px;font-weight:700;color:${c.gold};">${esc(l)}</div>`).join('')}
      </div>
      <img src="${top.photo}" width="${photoW}" height="${photoH}" style="border-radius:20px;object-fit:cover;" />
    </div>` : ''}
    ${footer(club)}
  `);
}
