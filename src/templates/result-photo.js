// Photo-led result: full-bleed match photo with a broadcast-style score band.
import { esc, DISPLAY, BODY, canvas, layer, content, cover, shade, anchored, topBar, rgba, pad, crest, badge } from './shared.js';

const OUTCOME = { won: (m, n) => `${n} win by ${m}`, lost: (m) => `Lost by ${m}`, draw: () => 'Match drawn', tie: () => 'Match tied', 'no result': () => 'No result', abandoned: () => 'Abandoned' };

export function resultPhotoCard(ev, club, size, a) {
  const c = club.colours, W = size.width, H = size.height, tall = H > 1500, p = pad(size);
  const r = ev.result || {};
  const outcome = (OUTCOME[r.outcome] || (() => r.summary || 'Result'))(r.margin || '', club.shortName);
  const won = r.outcome === 'won';

  const bg = a.action
    ? cover(a.action, size)
    : `${cover(a.ground, size)}${anchored(a.cutout, { left: Math.round(W * 0.1), bottom: Math.round(H * 0.28), width: Math.round(W * 0.8), height: Math.round(H * 0.62) })}`;
  const fade = shade(size, `linear-gradient(180deg, ${rgba(c.deep, 0.75)} 0%, ${rgba(c.deep, 0.45)} 30%, ${rgba(c.deep, 0.5)} 55%, ${c.ground} 78%)`);

  const side = (inn, ours) => {
    const score = inn.wickets === 10 || inn.wickets == null ? `${inn.runs}` : `${inn.runs}/${inn.wickets}`;
    return `<div style="display:flex;flex-direction:column;align-items:center;width:50%;padding:${tall ? 26 : 20}px 0;${ours ? `background:${rgba(c.panel, 0.55)};border-top:8px solid ${c.gold};` : `border-top:8px solid ${c.muted};`}">
      <div style="display:flex;height:${tall ? 96 : 84}px;align-items:center;margin-bottom:8px;">${ours ? badge(club, tall ? 90 : 78) : crest(a.oppLogo, inn.team, tall ? 90 : 78, c)}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 36 : 32}px;font-weight:700;">${esc(inn.team)}</div>
      <div style="display:flex;${DISPLAY};font-size:${tall ? 132 : 112}px;line-height:1;">${esc(score)}</div>
      <div style="display:flex;${BODY};font-size:${tall ? 30 : 28}px;font-weight:500;color:${c.muted};">${esc(inn.overs)} overs</div>
    </div>`;
  };
  const innings = (ev.innings || []).slice(0, 2);

  return canvas(size, c, `${bg}${fade}${content(size, `
    ${topBar(club, ev, size)}
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;background:${rgba(c.panel, 0.92)};">${innings.map((i) => side(i, i.team === club.shortName)).join('')}</div>
      <div style="display:flex;justify-content:center;padding:${tall ? 18 : 14}px 0;background:${won ? c.gold : r.outcome === 'lost' ? c.loss : c.panel};color:${won ? c.ground : c.chalk};${DISPLAY};font-size:${tall ? 64 : 56}px;text-transform:uppercase;">${esc(outcome)}</div>
      <div style="display:flex;justify-content:center;${BODY};font-size:30px;font-weight:600;color:${c.muted};margin-top:16px;">v ${esc(ev.opponent?.name || '')}, ${esc(ev.venue?.name || '')}</div>
    </div>`)}`);
}
