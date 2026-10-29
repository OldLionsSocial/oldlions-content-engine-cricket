// Shared pieces for every graphic. Satori rule: any div with more than one child needs display:flex.

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const DISPLAY = "font-family:'Anton'";
export const BODY = "font-family:'Barlow Condensed'";

export function matchDate(isoDate, timezone = 'Africa/Johannesburg') {
  const d = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(d);
}

// Juniors are shown as first name + surname initial (safeguarding).
export function displayName(p) {
  if (!p) return '';
  const name = p.preferredName || p.name || '';
  if (!p.junior) return name;
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// Shrink display type as text gets longer so long club names still fit on one line.
export function fitSize(text, maxPx, widthPx, charRatio = 0.48) {
  const fit = Math.floor(widthPx / Math.max(1, text.length * charRatio));
  return Math.max(48, Math.min(maxPx, fit));
}

export function header(club, ev) {
  const c = club.colours;
  const left = `${club.shortName} ${ev.team?.name || ''}`.trim();
  const right = [ev.competition, ev.round].filter(Boolean).join(', ');
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;${BODY};font-size:34px;font-weight:600;">
    <div style="display:flex;align-items:center;gap:18px;color:${c.gold};">
      ${club._logo ? `<img src="${club._logo.src}" width="${Math.round(64 * club._logo.w / club._logo.h)}" height="64" />` : `<div style="display:flex;width:14px;height:44px;background:${c.gold};"></div>`}
      <div style="display:flex;">${esc(left)}</div>
    </div>
    <div style="display:flex;color:${c.muted};">${esc(right)}</div>
  </div>`;
}

export function footer(club) {
  const c = club.colours;
  const handle = club.handles?.instagram || '';
  const sponsor = club.sponsor?.name ? `Proudly supported by ${club.sponsor.name}` : '';
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;${BODY};font-size:30px;font-weight:500;color:${c.muted};border-top:2px solid ${c.panel};padding-top:28px;">
    <div style="display:flex;">${esc(handle)}</div>
    <div style="display:flex;">${esc(sponsor)}</div>
  </div>`;
}

export function frame(club, size, inner) {
  const c = club.colours;
  // Stories keep clear of the app's top and bottom overlays.
  const pad = size.height > 1500 ? '230px 96px' : '72px';
  return `
  <div style="display:flex;box-sizing:border-box;flex-direction:column;justify-content:space-between;width:${size.width}px;height:${size.height}px;padding:${pad};background:${c.ground};color:${c.chalk};">
    ${inner}
  </div>`;
}

// ---- layered (photo-led) layouts --------------------------------------------
// Satori draws later elements on top, so layers are listed back to front.

export const pad = (size) => (size.height > 1500 ? { top: 230, side: 84, bottom: 230 } : { top: 64, side: 64, bottom: 64 });

export function canvas(size, c, layers) {
  return `<div style="display:flex;position:relative;overflow:hidden;width:${size.width}px;height:${size.height}px;background:${c.ground};color:${c.chalk};">${layers}</div>`;
}

export function layer(size, inner, style = '') {
  return `<div style="display:flex;position:absolute;top:0;left:0;width:${size.width}px;height:${size.height}px;${style}">${inner}</div>`;
}

// Content layer with safe-zone padding (stories keep clear of the app's overlays).
export function content(size, inner, style = 'flex-direction:column;justify-content:space-between;') {
  const p = pad(size);
  return layer(size, inner, `box-sizing:border-box;padding:${p.top}px ${p.side}px ${p.bottom}px;${style}`);
}

export function cover(img, size, opacity = 1) {
  if (!img) return '';
  return `<img src="${img.src}" width="${size.width}" height="${size.height}" style="position:absolute;top:0;left:0;object-fit:cover;opacity:${opacity};" />`;
}

export function shade(size, gradient) {
  return `<div style="display:flex;position:absolute;top:0;left:0;width:${size.width}px;height:${size.height}px;background-image:${gradient};"></div>`;
}

// Place an image inside a box, keeping its proportions, anchored to the box's bottom edge.
export function anchored(img, { left, bottom, width, height, align = 'center' }) {
  if (!img) return '';
  const scale = Math.min(width / img.w, height / img.h);
  const w = Math.round(img.w * scale), h = Math.round(img.h * scale);
  const x = align === 'left' ? left : align === 'right' ? left + width - w : left + Math.round((width - w) / 2);
  return `<img src="${img.src}" width="${w}" height="${h}" style="position:absolute;left:${x}px;bottom:${bottom}px;" />`;
}

export function logoMark(club, px = 64) {
  return club._logo ? `<img src="${club._logo.src}" width="${Math.round(px * club._logo.w / club._logo.h)}" height="${px}" />` : '';
}

// Small top bar used by the photo-led templates.
export function topBar(club, ev, size) {
  const c = club.colours;
  const right = [ev.competition, ev.round].filter(Boolean).join(', ');
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;${BODY};font-size:${size.height > 1500 ? 36 : 32}px;font-weight:600;">
    <div style="display:flex;align-items:center;gap:18px;color:${c.gold};">
      ${logoMark(club) || `<div style="display:flex;width:12px;height:42px;background:${c.gold};"></div>`}
      <div style="display:flex;">${esc(`${club.shortName} ${ev.team?.name || ''}`.trim())}</div>
    </div>
    <div style="display:flex;color:${c.chalk};opacity:0.8;">${esc(right)}</div>
  </div>`;
}

export function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Opposition crest: logo on a white disc (works for logos with white backgrounds too).
// Without a logo, shows the club's initials so the layout never breaks.
export function crest(img, name, px, c) {
  const inner = Math.round(px * 0.74);
  if (img) {
    const s = Math.min(inner / img.w, inner / img.h);
    return `<div style="display:flex;justify-content:center;align-items:center;width:${px}px;height:${px}px;border-radius:${px}px;background:#FFFFFF;">
      <img src="${img.src}" width="${Math.round(img.w * s)}" height="${Math.round(img.h * s)}" /></div>`;
  }
  const initials = String(name || '?').replace(/\b(cricket|sports|club|cc)\b/gi, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return `<div style="display:flex;justify-content:center;align-items:center;width:${px}px;height:${px}px;border-radius:${px}px;background:${c.panel};border:3px solid ${c.chalk};font-family:'Anton';font-size:${Math.round(px * 0.34)}px;color:${c.chalk};">${esc(initials)}</div>`;
}

// Our badge, always the full approved file (laurels included), sized by height.
export function badge(club, px) {
  return club._logo ? `<img src="${club._logo.src}" width="${Math.round(px * club._logo.w / club._logo.h)}" height="${px}" />` : '';
}
