// Milestone (fifty, hundred, five-for): the word repeated behind the player, fading down the page.
import { esc, DISPLAY, BODY, canvas, layer, content, shade, anchored, topBar, rgba, pad, fitSize } from './shared.js';

const NUM = ['', '', '', '', '', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export function milestonesFor(ev) {
  const out = [];
  for (const b of ev.batting || []) {
    if (b.runs >= 200) out.push({ playerId: b.playerId, word: 'Double hundred', bat: b });
    else if (b.runs >= 100) out.push({ playerId: b.playerId, word: 'Hundred', bat: b });
    else if (b.runs >= 50) out.push({ playerId: b.playerId, word: 'Fifty', bat: b });
  }
  for (const w of ev.bowling || []) if (w.wickets >= 5) out.push({ playerId: w.playerId, word: `${NUM[w.wickets]}-for`, bowl: w });
  return out;
}

export function milestoneCard(ev, club, size, a, m, name) {
  const c = club.colours, W = size.width, H = size.height, tall = H > 1500, p = pad(size);
  const word = m.word.toUpperCase();
  const px = fitSize(word, tall ? 300 : 260, W - 2 * p.side, 0.47);
  const rows = [1, 0.32, 0.16, 0.08].map((o, i) => `<div style="display:flex;opacity:${o};color:${i ? c.chalk : c.gold};">${esc(word)}</div>`).join('');
  const big = m.bat ? `${m.bat.runs}${m.bat.notOut ? '*' : ''}` : `${m.bowl.wickets}-${m.bowl.runs}`;
  const small = m.bat ? `(${m.bat.balls})` : `(${m.bowl.overs})`;
  const infoH = tall ? 360 : 330;

  const bg = '';
  const words = layer(size, `<div style="display:flex;flex-direction:column;align-items:center;width:${W}px;margin-top:${p.top + (tall ? 90 : 80)}px;${DISPLAY};font-size:${px}px;line-height:0.9;">${rows}</div>`);
  const figure = anchored(a.cutout, { left: Math.round(W * 0.08), bottom: p.bottom + infoH - 60, width: Math.round(W * 0.84), height: Math.round(H * (tall ? 0.52 : 0.56)) });
  const fade = layer(size, '', `background-image:linear-gradient(180deg, ${rgba(c.ground, 0)} ${Math.round(100 * (1 - (p.bottom + infoH + 40) / H))}%, ${c.ground} ${Math.round(100 * (1 - (p.bottom + infoH - 40) / H))}%)`);

  return canvas(size, c, `${bg}${words}${figure}${fade}${content(size, `
    ${topBar(club, ev, size)}
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="display:flex;${BODY};font-size:${tall ? 46 : 42}px;font-weight:700;letter-spacing:10px;text-transform:uppercase;">${esc(name)}</div>
      <div style="display:flex;align-items:baseline;gap:14px;">
        <div style="display:flex;${DISPLAY};font-size:${tall ? 190 : 170}px;line-height:1;color:${c.gold};">${esc(big)}</div>
        <div style="display:flex;${BODY};font-size:${tall ? 64 : 56}px;font-weight:700;">${esc(small)}</div>
      </div>
      <div style="display:flex;${BODY};font-size:30px;font-weight:600;color:${c.muted};">v ${esc(ev.opponent?.name || '')}, ${esc(ev.competition || '')}</div>
    </div>`)}`);
}
