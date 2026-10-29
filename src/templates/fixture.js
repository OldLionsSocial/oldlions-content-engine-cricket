import { esc, DISPLAY, BODY, header, footer, frame, matchDate, fitSize, crest, badge } from './shared.js';

export function fixtureCard(ev, club, size, a = {}) {
  const c = club.colours;
  const opp = ev.opponent?.name || 'TBC';
  const inner = size.width - 2 * 72;
  const where = ev.homeAway === 'away' ? 'away' : 'home';
  const detail = (label, value) => `
    <div style="display:flex;flex-direction:column;width:50%;padding:22px 0;border-top:2px solid ${c.panel};">
      <div style="display:flex;${BODY};font-size:30px;font-weight:500;color:${c.muted};">${esc(label)}</div>
      <div style="display:flex;${BODY};font-size:50px;font-weight:700;color:${c.chalk};">${esc(value)}</div>
    </div>`;

  return frame(club, size, `
    ${header(club, ev)}
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:36px;margin-bottom:28px;">
        ${badge(club, size.height > 1500 ? 170 : 140)}
        <div style="display:flex;${DISPLAY};font-size:64px;color:${c.gold};">v</div>
        ${crest(a.oppLogo, opp, size.height > 1500 ? 170 : 140, c)}
      </div>
      <div style="display:flex;${DISPLAY};font-size:${fitSize(club.shortName, 170, inner)}px;line-height:1;text-transform:uppercase;">${esc(club.shortName)}</div>
      <div style="display:flex;align-items:center;gap:28px;margin:18px 0;">
        <div style="display:flex;${DISPLAY};font-size:96px;line-height:1;color:${c.gold};">v</div>
        <div style="display:flex;flex-grow:1;height:4px;background:${c.gold};"></div>
      </div>
      <div style="display:flex;${DISPLAY};font-size:${fitSize(opp, 150, inner)}px;line-height:1.02;text-transform:uppercase;color:${c.chalk};">${esc(opp)}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;">
      ${detail('Date', matchDate(ev.date, club.timezone))}
      ${detail('Start', ev.startTime || 'TBC')}
      ${detail('Venue', ev.venue?.name || 'TBC')}
      ${detail('Format', [ev.format, where].filter(Boolean).join(', '))}
    </div>
    ${footer(club)}
  `);
}
