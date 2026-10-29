import { esc, DISPLAY, BODY, header, footer, frame, matchDate, displayName } from './shared.js';

// photos: map of playerId -> data URI (already consent-checked)
export function teamListCard(ev, club, size, photos) {
  const c = club.colours;
  const tall = size.height > 1500;
  const rowH = tall ? 88 : 74;
  const players = [...(ev.players || [])].sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99));

  const row = (p, i) => {
    const marks = [p.captain && '(c)', p.wicketKeeper && '(wk)'].filter(Boolean).join(' ');
    return `
    <div style="display:flex;align-items:center;height:${rowH}px;gap:26px;">
      <div style="display:flex;justify-content:flex-end;width:62px;${DISPLAY};font-size:${tall ? 54 : 42}px;color:${c.gold};">${p.battingOrder ?? i + 1}</div>
      <img src="${photos[p.id]}" width="${rowH - 12}" height="${rowH - 12}" style="border-radius:${rowH}px;" />
      <div style="display:flex;align-items:baseline;gap:14px;">
        <div style="display:flex;${BODY};font-size:${tall ? 50 : 44}px;font-weight:700;">${esc(displayName(p))}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 38 : 32}px;font-weight:500;color:${c.muted};">${esc(marks)}</div>
      </div>
    </div>`;
  };

  return frame(club, size, `
    ${header(club, ev)}
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;${DISPLAY};font-size:${tall ? 132 : 118}px;line-height:1;text-transform:uppercase;">Team ${esc(ev.team?.name || '')}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 46 : 38}px;font-weight:600;color:${c.muted};margin-top:12px;">
        v ${esc(ev.opponent?.name || 'TBC')}, ${esc(matchDate(ev.date, club.timezone))}, ${esc(ev.venue?.name || '')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;">${players.map(row).join('')}</div>
    ${footer(club)}
  `);
}
