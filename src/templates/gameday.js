// Match-day poster: ground photo, giant "Game day" type, captain cut-out in front of it.
import { esc, DISPLAY, BODY, canvas, layer, content, cover, shade, anchored, topBar, matchDate, fitSize, rgba, pad, crest, badge } from './shared.js';

export function gamedayCard(ev, club, size, a) {
  const c = club.colours, W = size.width, H = size.height, tall = H > 1500, p = pad(size);
  const opp = ev.opponent?.name || 'TBC';
  const bigPx = tall ? 330 : 290;
  const textTop = p.top + (tall ? 110 : 90);
  const infoH = tall ? 430 : 390;

  const bg = a.ground
    ? cover(a.ground, size) + shade(size, `linear-gradient(180deg, ${rgba(c.deep, 0.78)} 0%, ${rgba(c.deep, 0.5)} 30%, ${rgba(c.deep, 0.55)} 55%, ${c.ground} 80%)`)
    : shade(size, `linear-gradient(165deg, ${c.panel} 0%, ${c.ground} 75%)`);

  const words = layer(size, `
    <div style="display:flex;flex-direction:column;align-items:center;width:${W}px;margin-top:${textTop}px;${DISPLAY};font-size:${bigPx}px;line-height:0.86;text-transform:uppercase;color:${c.chalk};">
      <div style="display:flex;">Game</div><div style="display:flex;color:${c.gold};">day</div>
    </div>`);

  const figure = anchored(a.cutout, { left: Math.round(W * 0.1), bottom: p.bottom + infoH - 40, width: Math.round(W * 0.8), height: Math.round(H * (tall ? 0.4 : 0.5)) });
  const fade = layer(size, '', `background-image:linear-gradient(180deg, ${rgba(c.ground, 0)} 0%, ${rgba(c.ground, 0)} ${Math.round(100 * (1 - (p.bottom + infoH + 60) / H))}%, ${c.ground} ${Math.round(100 * (1 - (p.bottom + infoH - 30) / H))}%)`);

  const stat = (v) => `<div style="display:flex;${BODY};font-size:${tall ? 44 : 40}px;font-weight:700;">${esc(v)}</div>`;
  const sep = `<div style="display:flex;width:4px;height:${tall ? 40 : 36}px;background:${c.gold};"></div>`;
  return canvas(size, c, `${bg}${words}${figure}${fade}${content(size, `
    ${topBar(club, ev, size)}
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="display:flex;align-items:center;gap:26px;margin-bottom:10px;">
        ${badge(club, tall ? 104 : 92)}
        <div style="display:flex;${DISPLAY};font-size:44px;color:${c.gold};">v</div>
        ${crest(a.oppLogo, opp, tall ? 104 : 92, c)}
      </div>
      <div style="display:flex;${BODY};font-size:${tall ? 40 : 36}px;font-weight:600;color:${c.gold};">${esc(club.shortName)} ${esc(ev.team?.name || '')} v</div>
      <div style="display:flex;${DISPLAY};font-size:${fitSize(opp, tall ? 110 : 100, W - 2 * p.side, 0.46)}px;line-height:1.05;text-transform:uppercase;">${esc(opp)}</div>
      <div style="display:flex;align-items:center;gap:22px;margin-top:18px;">
        ${stat(matchDate(ev.date, club.timezone))}${sep}${stat(ev.startTime || 'TBC')}${sep}${stat(ev.venue?.name || 'TBC')}
      </div>
    </div>`)}`);
}
