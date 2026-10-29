// Playing XI: team list on the left, captain cut-out on the right.
import { esc, DISPLAY, BODY, canvas, layer, content, shade, anchored, topBar, matchDate, displayName, rgba, pad, crest } from './shared.js';

export function playingXiCard(ev, club, size, a) {
  const c = club.colours, W = size.width, H = size.height, tall = H > 1500, p = pad(size);
  const xi = [...(ev.players || [])].sort((x, y) => (x.battingOrder ?? 99) - (y.battingOrder ?? 99));
  const bg = '';
  const slab = `<div style="display:flex;position:absolute;left:${Math.round(W * 0.66)}px;top:-100px;width:${Math.round(W * 0.55)}px;height:${H + 200}px;background:${c.panel};transform:rotate(12deg);"></div>`;
  const figure = anchored(a.cutout, { left: Math.round(W * 0.44), bottom: 0, width: Math.round(W * 0.7), height: Math.round(H * (tall ? 0.66 : 0.78)), align: 'left' });
  const fade = layer(size, '', `background-image:linear-gradient(90deg, ${rgba(c.ground, 0.9)} 0%, ${rgba(c.ground, 0.75)} 45%, ${rgba(c.ground, 0)} 60%)`);

  const row = (pl) => {
    const marks = [pl.captain && '(c)', pl.wicketKeeper && '(wk)'].filter(Boolean).join(' ');
    return `<div style="display:flex;align-items:baseline;gap:12px;${BODY};font-size:${tall ? 46 : 40}px;font-weight:700;line-height:${tall ? 1.38 : 1.22};text-transform:uppercase;">
      <div style="display:flex;">${esc(displayName(pl))}</div>
      <div style="display:flex;font-size:${tall ? 32 : 28}px;color:${c.gold};">${esc(marks)}</div></div>`;
  };

  return canvas(size, c, `${bg}${slab}${figure}${fade}${content(size, `
    ${topBar(club, ev, size)}
    <div style="display:flex;flex-direction:column;width:${Math.round(W * 0.56)}px;">
      <div style="display:flex;${DISPLAY};font-size:${tall ? 150 : 128}px;line-height:0.95;text-transform:uppercase;">Playing XI</div>
      <div style="display:flex;align-items:center;gap:16px;margin:12px 0 ${tall ? 30 : 20}px;">
        ${crest(a.oppLogo, ev.opponent?.name, tall ? 64 : 56, c)}
        <div style="display:flex;${BODY};font-size:${tall ? 40 : 34}px;font-weight:600;color:${c.gold};">v ${esc(ev.opponent?.name || 'TBC')}</div>
      </div>
      ${xi.map(row).join('')}
    </div>
    <div style="display:flex;${BODY};font-size:${tall ? 36 : 32}px;font-weight:600;color:${c.muted};">${esc(matchDate(ev.date, club.timezone))}, ${esc(ev.startTime || '')}, ${esc(ev.venue?.name || '')}</div>`)}`);
}
