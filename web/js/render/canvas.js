// Moved out of render.js to keep modules small. See ARCHITECTURE.md.
import { ctx } from '../render.js';

// --- drawing helpers ---
export function drawSpriteF(spr, x, y, s, flip) {
  if (!flip) return drawSprite(spr, x, y, s);
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(spr.c, -spr.ax * s, -spr.ay * s, spr.w * s, spr.h * s); ctx.restore();
}

export function drawSprite(spr, x, y, s, alpha) {
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(spr.c, x - spr.ax * s, y - spr.ay * s, spr.w * s, spr.h * s);
  if (alpha !== undefined) ctx.globalAlpha = 1;
}

export function diamondPath(p, x, y, hw, hh) { p.moveTo(x, y - hh); p.lineTo(x + hw, y); p.lineTo(x, y + hh); p.lineTo(x - hw, y); p.closePath(); }

export function label(text, x, y, size = 12, sub) {
  ctx.font = `600 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(40,34,28,0.62)';
  roundRect(x - w / 2, y - size - 4, w, size + 8, (size + 8) / 2); ctx.fill();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - size / 2);
  if (sub) { ctx.font = `500 ${size - 2}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,246,228,0.95)'; ctx.fillText(sub, x, y + size / 2 + 2); }
}

export function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
