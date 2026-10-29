// Club-wide weekend fixtures and results, one row per team. Long weeks become a carousel.
import { esc, DISPLAY, BODY, canvas, content, cover, shade, logoMark, rgba, pad, crest } from './shared.js';

export const ROWS_PER_PAGE = { feed: 7, story: 9 };
const day = (iso, tz) => new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(`${iso}T12:00:00`));

function frame(club, size, a, title, subtitle, rows, pageLabel) {
  const c = club.colours, tall = size.height > 1500;
  const bg = a.ground ? `${cover(a.ground, size, 0.5)}${shade(size, `linear-gradient(180deg, ${c.ground} 0%, ${c.ground} 60%, ${rgba(c.deep, 0.8)} 100%)`)}` : '';
  return canvas(size, c, `${bg}${content(size, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;${DISPLAY};font-size:${tall ? 150 : 128}px;line-height:0.95;text-transform:uppercase;">${esc(title)}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 40 : 36}px;font-weight:600;color:${c.gold};margin-top:6px;">${esc(subtitle)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        ${logoMark(club, 90) || `<div style="display:flex;${BODY};font-size:34px;font-weight:700;color:${c.gold};">${esc(club.shortName)}</div>`}
        <div style="display:flex;${BODY};font-size:28px;font-weight:500;color:${c.muted};">${esc(pageLabel)}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:${tall ? 18 : 14}px;">${rows}</div>
    <div style="display:flex;${BODY};font-size:30px;font-weight:500;color:${c.muted};">${esc(club.handles?.instagram || '')}</div>`)}`);
}

export function weekendFixturesCard(ev, club, size, a, page, pageLabel) {
  const c = club.colours, tall = size.height > 1500, h = tall ? 124 : 108;
  const rows = page.map((f) => `
    <div style="display:flex;height:${h}px;">
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:${tall ? 220 : 200}px;background:${rgba(c.gold, 0.16)};border-left:8px solid ${c.gold};">
        <div style="display:flex;${DISPLAY};font-size:${tall ? 38 : 34}px;text-transform:uppercase;color:${c.gold};">${esc(day(f.date, club.timezone))}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 38 : 34}px;font-weight:700;">${esc(f.startTime || 'TBC')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:18px;flex-grow:1;padding:0 20px;background:${c.panel};">
        ${crest(a.logos?.[f.opponent], f.opponent, tall ? 76 : 66, c)}
        <div style="display:flex;flex-direction:column;justify-content:center;">
        <div style="display:flex;${BODY};font-size:${tall ? 40 : 36}px;font-weight:700;">${esc(f.team)} v ${esc(f.opponent)}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 30 : 27}px;font-weight:500;color:${c.muted};">${esc(f.venue || '')}${f.competition ? `, ${esc(f.competition)}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;width:${tall ? 130 : 116}px;${BODY};font-size:${tall ? 30 : 28}px;font-weight:700;${f.homeAway === 'away' ? `color:${c.chalk};background:${rgba(c.chalk, 0.08)};` : `color:${c.ground};background:${c.gold};`}">${f.homeAway === 'away' ? 'Away' : 'Home'}</div>
    </div>`).join('');
  return frame(club, size, a, 'Fixtures', ev.title || 'This weekend', rows, pageLabel);
}

export function weekendResultsCard(ev, club, size, a, page, pageLabel) {
  const c = club.colours, tall = size.height > 1500, h = tall ? 124 : 108;
  const chip = { won: ['W', c.gold, c.ground], lost: ['L', c.loss, c.chalk], draw: ['D', c.muted, c.ground], tie: ['T', c.muted, c.ground] };
  const rows = page.map((r) => {
    const [ch, bgc, fg] = chip[r.outcome] || ['–', c.panel, c.muted];
    return `
    <div style="display:flex;height:${h}px;background:${c.panel};">
      <div style="display:flex;justify-content:center;align-items:center;width:${h}px;background:${bgc};color:${fg};${DISPLAY};font-size:${tall ? 64 : 56}px;">${ch}</div>
      <div style="display:flex;align-items:center;gap:16px;flex-grow:1;padding:0 18px;">
        ${crest(a.logos?.[r.opponent], r.opponent, tall ? 70 : 60, c)}
        <div style="display:flex;flex-direction:column;justify-content:center;">
        <div style="display:flex;${BODY};font-size:${tall ? 42 : 38}px;font-weight:700;">${esc(r.team)}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 30 : 27}px;font-weight:500;color:${c.muted};">v ${esc(r.opponent)}${r.margin ? `, ${r.outcome === 'won' ? 'won' : r.outcome === 'lost' ? 'lost' : ''} by ${esc(r.margin)}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding-right:24px;${BODY};font-size:${tall ? 34 : 30}px;font-weight:700;">
        <div style="display:flex;color:${c.chalk};">${esc(r.ourScore || '')}</div>
        <div style="display:flex;color:${c.muted};">${esc(r.theirScore || '')}</div>
      </div>
    </div>`;
  }).join('');
  return frame(club, size, a, 'Results', ev.title || 'This weekend', rows, pageLabel);
}
