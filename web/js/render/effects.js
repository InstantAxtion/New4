// Moved out of render.js to keep modules small. See ARCHITECTURE.md.
import { S, byRiver } from '../game.js';
import { hash2 } from '../noise.js';
import { animTime, cam, ch, ctx, cw, lights, markDirty, sx, sy } from '../render.js';
import { tileWX, tileWY } from '../world.js';
import * as A from '../alive.js';
import * as L from '../life.js';

// Little moving parts: windmill sails, a water wheel by the river, a swinging tavern sign, smithy sparks.
export const ANIM = new Set(['windmill', 'tavern', 'smithy', 'workshop', 'bakery', 'potter', 'glassworks', 'lumber']);

export function animate(type, cx, cy, s, wx, y) {
  const t = animTime;
  if (type === 'windmill') {
    const hx = cx + 1 * s, hy = cy - 21 * s, a0 = t * 0.9 + hash2(wx, y, 71) * 6;
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = Math.max(0.8, 0.8 * s);
    for (let k = 0; k < 4; k++) {
      const a = a0 + k * Math.PI / 2, ex = hx + Math.cos(a) * 15 * s, ey = hy + Math.sin(a) * 15 * s * 0.9;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
      const px = -Math.sin(a), py = Math.cos(a) * 0.9;
      ctx.fillStyle = 'rgba(244,236,216,0.92)'; ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * 4 * s, hy + Math.sin(a) * 4 * s * 0.9); ctx.lineTo(ex, ey); ctx.lineTo(ex + px * 3.4 * s, ey + py * 3.4 * s); ctx.lineTo(hx + Math.cos(a) * 4 * s + px * 3.4 * s, hy + Math.sin(a) * 4 * s * 0.9 + py * 3.4 * s); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(hx, hy, 1.6 * s, 0, 6.3); ctx.fill();
  } else if (type === 'tavern') {
    const px = cx + 11 * s, py = cy - 12 * s, sw = Math.sin(t * 1.6 + wx) * 0.25;
    ctx.strokeStyle = '#3c3a40'; ctx.lineWidth = Math.max(0.8, 0.7 * s); ctx.beginPath(); ctx.moveTo(px - 5 * s, py); ctx.lineTo(px + 2 * s, py); ctx.stroke();
    ctx.save(); ctx.translate(px, py); ctx.rotate(sw); ctx.fillStyle = '#8a5a3c'; ctx.fillRect(-2.6 * s, 0.8 * s, 5.2 * s, 4 * s); ctx.fillStyle = '#e8b830'; ctx.fillRect(-1.2 * s, 1.8 * s, 2.4 * s, 2 * s); ctx.restore();
  } else if (type === 'smithy' || type === 'glassworks' || type === 'potter') {
    for (let k = 0; k < 4; k++) {
      const ph = (t * 1.4 + k * 0.27 + hash2(wx, y, 72)) % 1; if (ph > 0.6) continue;
      ctx.fillStyle = `rgba(255,${170 + k * 15},70,${1 - ph / 0.6})`; ctx.fillRect(cx + (6 + k * 1.6 + ph * 6 * (k % 2 ? 1 : -1)) * s, cy - (4 + ph * 12) * s, 1.1 * s, 1.1 * s);
    }
  }
  if ((type === 'workshop' || type === 'bakery' || type === 'lumber' || type === 'windmill') && byRiver(wx, y)) { // a water wheel turning in the stream
    const hx = cx - 15 * s, hy = cy - 2 * s, r = 6 * s, a0 = t * 0.8;
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = Math.max(1, 1.1 * s); ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.45, r, 0, 0, 6.3); ctx.stroke();
    ctx.lineWidth = Math.max(0.7, 0.7 * s); ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = a0 + k * Math.PI / 4; ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * r * 0.45, hy + Math.sin(a) * r); } ctx.stroke();
    ctx.fillStyle = 'rgba(220,236,250,0.7)'; for (let k = 0; k < 3; k++) ctx.fillRect(hx - 1 * s + k * s, hy + r * 0.7 + ((t * 8 + k * 3) % 4) * s * 0.5, 0.8 * s, 0.8 * s);
  }
}

// ---------------- celebrations ----------------
export let fwUntil = 0; const sparks = [];

export function celebrate(sec = 9) { fwUntil = animTime + sec; markDirty(); }

export function drawFireworks(dt) {
  if (animTime < fwUntil && Math.random() < dt * 3.2) { // a new rocket bursts over the capital
    const cap = S.towns.find((t) => t.capital) || S.towns[0];
    let bx = cw / 2, by = ch * 0.35;
    if (cap) { const x = sx(tileWX(cap.x, cap.y)), y = sy(tileWY(cap.y)); if (x > 0 && x < cw && y > 0 && y < ch) { bx = x; by = Math.max(80, y - cam.tw * 2); } }
    const cx = bx + (Math.random() - 0.5) * 220, cy = by + (Math.random() - 0.5) * 120, hue = Math.floor(Math.random() * 360), n = 34;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, v = 60 + Math.random() * 70; sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, hue }); }
    if (Math.random() < 0.5) emitPop();
  }
  if (!sparks.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = sparks.length - 1; k >= 0; k--) {
    const p = sparks[k]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.985;
    if (p.life > 1.6) { sparks.splice(k, 1); continue; }
    ctx.fillStyle = `hsla(${p.hue},90%,${60 + 20 * (1 - p.life)}%,${1 - p.life / 1.6})`; ctx.fillRect(p.x - 1.4, p.y - 1.4, 2.8, 2.8);
  }
  ctx.restore(); markDirty();
}

export let emitPop = () => {}; export function onFirework(f) { emitPop = f; }

// a building pops up when it is finished or improved
export const pops = new Map();

export function popScale(i) { const t0 = pops.get(i); if (t0 === undefined) return 1; const a = (animTime - t0) / 0.7; if (a >= 1) { pops.delete(i); return 1; } return 1 + 0.22 * Math.sin(a * Math.PI) * (1 - a * 0.6); }

// Workplaces that have improved show it: a pennant at level 2, a golden one and a star at level 3
export function statue(x, y, s) { // a statue of the founder in the square
  ctx.fillStyle = '#b8ae9c'; ctx.fillRect(x - 3 * s, y - 4 * s, 6 * s, 4 * s); ctx.fillStyle = '#d6cebe'; ctx.fillRect(x - 3.6 * s, y - 4.8 * s, 7.2 * s, 1 * s);
  ctx.fillStyle = '#8a9a8a'; ctx.fillRect(x - 1.3 * s, y - 10 * s, 2.6 * s, 5.2 * s); ctx.beginPath(); ctx.arc(x, y - 11.2 * s, 1.5 * s, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#8a9a8a'; ctx.lineWidth = Math.max(0.8, 0.8 * s); ctx.beginPath(); ctx.moveTo(x + 1.2 * s, y - 9 * s); ctx.lineTo(x + 3.4 * s, y - 13 * s); ctx.stroke();
}

export function levelTrim(spr, cx, cy, s, lv) {
  const tx = cx + 2 * s, ty = cy - (spr.ay - 6) * s;
  ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(0.8, 0.7 * s); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 9 * s); ctx.stroke();
  ctx.fillStyle = lv >= 3 ? '#e8b830' : '#4a78a8'; ctx.beginPath(); ctx.moveTo(tx, ty - 9 * s); ctx.lineTo(tx + 6 * s, ty - 7.5 * s + Math.sin(animTime * 3 + cx) * s * 0.6); ctx.lineTo(tx, ty - 6 * s); ctx.fill();
  if (lv >= 3) { ctx.fillStyle = '#ffe28a'; ctx.font = `${Math.round(7 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('★', tx, ty - 10 * s); }
}

// As a family settles in, their yard grows: a picket fence, then a vegetable patch, then a garden shed.
export function drawYard(cx, cy, s, hw, hh, age, h) {
  if (age < 6) return;
  ctx.strokeStyle = S.tier >= 3 ? '#b8ae9c' : '#efe6d2'; ctx.lineWidth = Math.max(0.8, (S.tier >= 3 ? 1.4 : 0.8) * s); // picket fences become low stone walls in grand towns
  const a0 = 0.12 + h * 0.1, a1 = a0 + 0.38;
  ctx.beginPath();
  for (let k = 0; k <= 6; k++) { const f = a0 + (a1 - a0) * k / 6, x = cx - hw + hw * f, y = cy + hh * f; ctx.moveTo(x, y); ctx.lineTo(x, y - 3.2 * s); }
  ctx.moveTo(cx - hw + hw * a0, cy + hh * a0 - 2.2 * s); ctx.lineTo(cx - hw + hw * a1, cy + hh * a1 - 2.2 * s);
  ctx.stroke();
  if (age >= 18) {
    const vx = cx + hw * 0.42, vy = cy + hh * 0.42;
    ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.ellipse(vx, vy, 5.5 * s, 2.6 * s, 0, 0, 6.3); ctx.fill();
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 3 === 2 ? '#e8743a' : '#6aa040'; ctx.fillRect(vx - 4 * s + k * 1.5 * s, vy - 1.2 * s + (k & 1) * 1.2 * s, 1.1 * s, 1.1 * s); }
  }
  if (age >= 40 && h < 0.7) {
    const bx = cx + hw * 0.68, by = cy + hh * 0.05;
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(bx - 2.6 * s, by - 4.5 * s, 5.2 * s, 4.5 * s);
    ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.moveTo(bx - 3.2 * s, by - 4.3 * s); ctx.lineTo(bx, by - 6.6 * s); ctx.lineTo(bx + 3.2 * s, by - 4.3 * s); ctx.fill();
    ctx.fillStyle = '#4a3020'; ctx.fillRect(bx - 0.8 * s, by - 2.6 * s, 1.6 * s, 2.6 * s);
  }
}

// Bunting and lanterns around the hall during a festival.
export function festive(ctx, cx, cy, s, tw, t) {
  const cols = ['#c0503e', '#e8c040', '#4a78a8', '#5a9a5a', '#f2b6c6'];
  for (let ring = 0; ring < 2; ring++) {
    const R = tw * (0.7 + ring * 0.35);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + animTime * 0.05, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.5 - 14 * s;
      const a2 = ((k + 1) / 14) * Math.PI * 2 + animTime * 0.05, x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R * 0.5 - 14 * s;
      ctx.strokeStyle = 'rgba(90,64,48,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2, (y + y2) / 2 + 3 * s, x2, y2); ctx.stroke();
      if (t.fest.key === 'lights') { lights.push([x, y + 2 * s, 0.4]); ctx.fillStyle = '#ffcf70'; ctx.beginPath(); ctx.arc(x, y + 2 * s, 1.6 * s, 0, 6.3); ctx.fill(); }
      else { ctx.fillStyle = cols[(k + ring) % 5]; ctx.beginPath(); ctx.moveTo(x - 1.6 * s, y + 0.6 * s); ctx.lineTo(x + 1.6 * s, y + 0.6 * s); ctx.lineTo(x, y + 4 * s); ctx.closePath(); ctx.fill(); }
    }
  }
  if (t.fest.key === 'blossom' || t.fest.key === 'midsummer') { // a maypole
    ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(cx + tw * 0.55, cy + tw * 0.1); ctx.lineTo(cx + tw * 0.55, cy - tw * 0.5); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = cols[k]; ctx.beginPath(); ctx.moveTo(cx + tw * 0.55, cy - tw * 0.5); ctx.lineTo(cx + tw * 0.55 + Math.cos(animTime + k * 1.57) * tw * 0.18, cy + tw * 0.1 + Math.sin(animTime + k * 1.57) * tw * 0.06); ctx.stroke(); }
  }
}

export function festiveExtras(ctx, cx, cy, s, tw, t) {
  const cols = ['#c0503e', '#e8c040', '#4a78a8', '#5a9a5a', '#f2b6c6'];
  const k0 = t.fest.key;
  if (k0 === 'tournament') { // the lists: a long fence with two knights charging along it
    const lx = cx - tw * 0.9, ly = cy + tw * 0.55, len = tw * 1.4;
    ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + len, ly + len * 0.5); ctx.stroke();
    for (let k = 0; k <= 6; k++) { const px = lx + len * k / 6, py = ly + len * 0.5 * k / 6; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 4 * s); ctx.stroke(); }
    const u = (Math.sin(animTime * 0.9) + 1) / 2;
    for (const [f, side, col] of [[u, -1, '#c0503e'], [1 - u, 1, '#4a78a8']]) {
      const px = lx + len * f + side * 3 * s, py = ly + len * 0.5 * f - side * 3 * s, face = (side < 0) === (Math.cos(animTime * 0.9) > 0) ? 1 : -1;
      L.drawAnimal(ctx, 'horse', px, py, s * 1.25, face, animTime * 2.4, side);
      ctx.fillStyle = '#b8b8c0'; ctx.fillRect(px - 1.6 * s, py - 12 * s, 3.2 * s, 4.4 * s); ctx.fillStyle = col; ctx.fillRect(px - 1.6 * s, py - 9.6 * s, 3.2 * s, 2 * s);
      ctx.fillStyle = '#9a9aa4'; ctx.beginPath(); ctx.arc(px, py - 13.2 * s, 1.6 * s, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = Math.max(0.8, 0.8 * s); ctx.beginPath(); ctx.moveTo(px, py - 10 * s); ctx.lineTo(px + face * 10 * s, py - 13 * s); ctx.stroke();
    }
    for (let k = 0; k < 2; k++) { const px = cx + tw * (0.3 + k * 0.45), py = cy + tw * 0.15; ctx.fillStyle = cols[k * 2]; ctx.beginPath(); ctx.moveTo(px - 5 * s, py); ctx.lineTo(px, py - 9 * s); ctx.lineTo(px + 5 * s, py); ctx.fill(); ctx.fillStyle = '#f4ead8'; ctx.fillRect(px - 4 * s, py - 0.5 * s, 8 * s, 2 * s); }
  } else if (k0 === 'fair') { // a turning carousel and a tall swing ride
    const px = cx + tw * 0.62, py = cy + tw * 0.25, R = 7 * s;
    ctx.fillStyle = 'rgba(30,40,20,0.2)'; ctx.beginPath(); ctx.ellipse(px, py, R * 1.3, R * 0.6, 0, 0, 6.3); ctx.fill();
    for (let k = 0; k < 6; k++) { const a = animTime * 0.8 + k * 1.047, hx = px + Math.cos(a) * R, hy = py + Math.sin(a) * R * 0.45 - 2 * s - Math.abs(Math.sin(animTime * 2 + k)) * 1.2 * s; ctx.fillStyle = cols[k % 5]; ctx.fillRect(hx - 1.6 * s, hy - 2 * s, 3.2 * s, 2 * s); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 0.5 * s; ctx.beginPath(); ctx.moveTo(hx, hy - 2 * s); ctx.lineTo(hx, py - 11 * s); ctx.stroke(); }
    ctx.fillStyle = '#c0503e'; ctx.beginPath(); ctx.moveTo(px - R * 1.25, py - 10 * s); ctx.lineTo(px, py - 17 * s); ctx.lineTo(px + R * 1.25, py - 10 * s); ctx.fill();
    ctx.fillStyle = '#f4ead8'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px - R * 1.25 + k * R * 0.62, py - 10 * s); ctx.lineTo(px, py - 17 * s); ctx.lineTo(px - R * 1.25 + (k + 0.4) * R * 0.62, py - 10 * s); ctx.fill(); }
    const qx = cx - tw * 0.55, qy = cy + tw * 0.3; ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx, qy - 20 * s); ctx.stroke();
    for (let k = 0; k < 5; k++) { const a = animTime * 1.2 + k * 1.256, r = 7 * s, hx = qx + Math.cos(a) * r, hy = qy - 9 * s + Math.sin(a) * r * 0.4; ctx.strokeStyle = 'rgba(80,60,40,0.6)'; ctx.lineWidth = 0.5 * s; ctx.beginPath(); ctx.moveTo(qx, qy - 20 * s); ctx.lineTo(hx, hy); ctx.stroke(); ctx.fillStyle = cols[k]; ctx.fillRect(hx - 1 * s, hy, 2 * s, 1.4 * s); }
  } else if (k0 === 'wedding') { // a flower arch, the couple, and drifting petals
    const px = cx + tw * 0.5, py = cy + tw * 0.25;
    ctx.strokeStyle = '#7aa04a'; ctx.lineWidth = Math.max(1.2, 1.4 * s); ctx.beginPath(); ctx.ellipse(px, py, 6 * s, 9 * s, 0, Math.PI, 0); ctx.stroke();
    for (let k = 0; k < 9; k++) { const a = Math.PI + k * Math.PI / 8; ctx.fillStyle = cols[(k + 4) % 5]; ctx.beginPath(); ctx.arc(px + Math.cos(a) * 6 * s, py + Math.sin(a) * 9 * s, 1.3 * s, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = '#f8f6f0'; ctx.beginPath(); ctx.moveTo(px - 3.4 * s, py); ctx.lineTo(px - 0.8 * s, py); ctx.lineTo(px - 1.4 * s, py - 4.5 * s); ctx.lineTo(px - 2.8 * s, py - 4.5 * s); ctx.fill();
    ctx.fillStyle = '#3a3448'; ctx.fillRect(px + 0.8 * s, py - 4.6 * s, 2.4 * s, 4.6 * s);
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(px - 2.1 * s, py - 5.8 * s, 1.3 * s, 0, 6.3); ctx.arc(px + 2 * s, py - 5.9 * s, 1.3 * s, 0, 6.3); ctx.fill();
    for (let k = 0; k < 10; k++) { const ph = k * 1.7, fx = px + Math.sin(animTime * 0.7 + ph) * 14 * s, fy = py - 16 * s + ((animTime * 6 + k * 5) % 24) * s; ctx.fillStyle = cols[k % 5]; ctx.fillRect(fx, fy, 1.2 * s, 1.2 * s); }
  }
}

// A lost animal waiting to be found (tap it!), with a little ? above.
export function lostAnimal(ctx, q, s, tw) {
  if (tw < 20) return;
  const x = sx(tileWX(q.x, q.y)), y = sy(tileWY(q.y)) + tw * 0.05;
  if (x < -30 || x > cw + 30 || y < -30 || y > ch + 30) return;
  const [ox, , face] = L.wander(animTime * 0.6, q.id, 0.12);
  const kind = q.animal === 'goat' ? 'goat' : q.animal === 'hen' ? 'chicken' : 'sheep';
  L.drawAnimal(ctx, kind, x + ox * tw, y, s * 1.4, face, animTime, q.id);
  A.bubble(ctx, x + ox * tw + 4 * s, y - 16 * s + Math.sin(animTime * 3) * 1.5 * s, s, '?');
}
