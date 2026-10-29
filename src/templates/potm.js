// Player of the match: big cut-out on the left, stacked stats on the right.
import { esc, DISPLAY, BODY, canvas, layer, content, shade, anchored, topBar, rgba, pad } from './shared.js';

export function potmStats(top) {
  const { bat, bowl } = top;
  const s = [];
  const batFirst = bat && (bat.runs >= 20 || !bowl);
  if (batFirst) s.push([`${bat.runs}${bat.notOut ? '*' : ''}`, 'Runs'], [`${bat.balls}`, 'Balls']);
  if (bowl && (bowl.wickets >= 1 || !bat)) s.push([`${bowl.wickets}`, 'Wickets'], [`${bowl.runs}`, 'Runs conceded']);
  if (batFirst && !(bowl && bowl.wickets >= 1)) s.push(bat.sixes ? [`${bat.sixes}`, bat.sixes === 1 ? 'Six' : 'Sixes'] : [`${bat.fours}`, 'Fours']);
  return s.slice(0, 3);
}

export function potmCard(ev, club, size, a, top) {
  const c = club.colours, W = size.width, H = size.height, tall = H > 1500, p = pad(size);
  const [first, ...rest] = (top.name || '').split(' ');
  const last = rest.join(' ') || first;
  const colW = Math.round(W * 0.42);

  const bg = `<div style="display:flex;position:absolute;left:${Math.round(W * 0.3)}px;top:-200px;width:120px;height:${H + 400}px;background:${c.panel};transform:rotate(14deg);"></div>`;
  const band = `<div style="display:flex;position:absolute;left:${Math.round(W * 0.2)}px;top:-200px;width:220px;height:${H + 400}px;background:${c.gold};opacity:0.9;transform:rotate(14deg);"></div>`;
  const figure = anchored(a.cutout || a.headshot, { left: -30, bottom: 0, width: Math.round(W * 0.66), height: Math.round(H * (tall ? 0.8 : 0.88)), align: 'left' });
  const fade = layer(size, '', `background-image:linear-gradient(90deg, ${rgba(c.ground, 0)} 45%, ${rgba(c.ground, 0.85)} 62%)`);

  const stat = ([v, label]) => `
    <div style="display:flex;flex-direction:column;align-items:flex-end;margin-top:${tall ? 26 : 16}px;">
      <div style="display:flex;${DISPLAY};font-size:${tall ? 190 : 150}px;line-height:0.95;">${esc(v)}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 34 : 30}px;font-weight:700;background:${c.chalk};color:${c.ground};padding:2px 16px;">${esc(label)}</div>
    </div>`;

  return canvas(size, c, `${bg}${band}${figure}${fade}${content(size, `
    ${topBar(club, ev, size)}
    <div style="display:flex;justify-content:flex-end;">
      <div style="display:flex;flex-direction:column;align-items:flex-end;width:${colW}px;">
        <div style="display:flex;${BODY};font-size:${tall ? 48 : 42}px;font-weight:600;color:${c.gold};">${esc(first)}</div>
        <div style="display:flex;${DISPLAY};font-size:${tall ? 104 : 88}px;line-height:1;text-transform:uppercase;text-align:right;">${esc(last)}</div>
        <div style="display:flex;width:${colW - 40}px;height:4px;background:${c.gold};margin:18px 0 6px;"></div>
        ${potmStats(top).map(stat).join('')}
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;">
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        <div style="display:flex;${DISPLAY};font-size:${tall ? 84 : 70}px;line-height:0.95;text-transform:uppercase;color:${c.gold};">Player of</div>
        <div style="display:flex;${DISPLAY};font-size:${tall ? 84 : 70}px;line-height:0.95;text-transform:uppercase;color:${c.gold};">the match</div>
        <div style="display:flex;${BODY};font-size:30px;font-weight:600;color:${c.muted};margin-top:10px;">v ${esc(ev.opponent?.name || '')}</div>
      </div>
    </div>`)}`);
}
