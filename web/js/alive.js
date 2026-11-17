// The living world: little scenes, emotes, smoke and laundry, water life, wildlife,
// light through the day, richer weather, night magic and lived-in neighbour villages.
import { W, H, B, world, tileWX, tileWY, tileLat, idxOf, wrapX } from './world.js';
import { S, on } from './game.js';
import { hash2 } from './noise.js';
import * as L from './life.js';
import * as SE from './seasons.js';

const gentle = () => !!S.settings.gentle;

// ---------------- scene spots per town (recomputed when the realm changes) ----------------
let scenes = new Map(); // row y -> [scene]
let scenesDirty = true;
on('change', () => { scenesDirty = true; }); on('built', () => { scenesDirty = true; });
function seasonAt(y) { return SE.seasonIndex(S.day, tileLat(y)); }
function computeScenes() {
  scenesDirty = false; scenes = new Map();
  const add = (y, sc) => { if (!scenes.has(y)) scenes.set(y, []); scenes.get(y).push(sc); };
  for (const t of S.towns) {
    const r = Math.ceil(t.radius) + 2;
    let kids = 0, fishers = 0, ducks = 0, benches = 0, snow = 0, swim = 0, chat = 0;
    for (let dy = -2 * r; dy <= 2 * r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = wrapX(t.x + dx), y = t.y + dy; if (y < 1 || y >= H - 1) continue;
      const i = y * W + x, h = hash2(x, y, 90), b = S.buildings.get(i), bio = world.biome[i];
      const river = world.river && world.river[i];
      if (b && b.p >= 1) {
        if (b.t === 'house' && h < 0.12 && benches < 6) { add(y, { k: 'bench', x, y, ph: h * 50, t: t.id }); benches++; }
        if (b.t === 'market' && chat < 2) { add(y, { k: 'chat', x, y, ph: h * 50 }); chat++; }
        if ((b.t === 'green' || b.t === 'fountain') && kids < 2) { add(y, { k: 'kids', x, y, ph: h * 50 }); kids++; }
        continue;
      }
      if (river && fishers < 3 && h < 0.25) { add(y, { k: 'fisher', x, y, ph: h * 50 }); fishers++; continue; }
      if ((river || bio === B.SHALLOW) && ducks < 4 && h > 0.85) { add(y, { k: 'ducks', x, y, ph: h * 50, swan: h > 0.95 }); ducks++; continue; }
      if ((river || bio === B.SHALLOW) && swim < 2 && h > 0.6 && h < 0.7) { add(y, { k: 'swim', x, y, ph: h * 50 }); swim++; continue; }
      if (!river && bio > 2 && L.roads.has(i) === false && h > 0.4 && h < 0.43 && kids < 3 && Math.abs(dx) < 4 && Math.abs(dy) < 8) { add(y, { k: 'kids', x, y, ph: h * 50 }); kids++; continue; }
      if (!river && bio > 2 && h > 0.5 && h < 0.53 && snow < 3) { add(y, { k: 'snowman', x, y, ph: h * 50 }); snow++; }
    }
  }
}

// ---------------- little people ----------------
function person(ctx, x, y, s, col, face = 1, bob = 0, hat = null) {
  ctx.fillStyle = 'rgba(30,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, 2.2 * s, 1 * s, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(x - 1.5 * s, y - 5.8 * s - bob, 3 * s, 4.6 * s);
  ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = Math.max(0.7, 0.8 * s); ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y - 1.4 * s - bob); ctx.lineTo(x - 0.7 * s, y); ctx.moveTo(x + 0.6 * s, y - 1.4 * s - bob); ctx.lineTo(x + 0.7 * s, y); ctx.stroke();
  ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x + face * 0.3 * s, y - 7.3 * s - bob, 1.5 * s, 0, 6.3); ctx.fill();
  if (hat) { ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(x + face * 0.3 * s, y - 7.9 * s - bob, 1.6 * s, Math.PI, 0); ctx.fill(); }
}
export function bubble(ctx, x, y, s, text) {
  const r = Math.max(6, 5.2 * s);
  ctx.fillStyle = 'rgba(255,252,244,0.95)'; ctx.strokeStyle = 'rgba(60,46,36,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.25, y + r * 0.85); ctx.lineTo(x - r * 0.05, y + r * 1.5); ctx.lineTo(x + r * 0.3, y + r * 0.8); ctx.fill();
  ctx.font = `${Math.round(r * 1.15)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3d3229'; ctx.fillText(text, x, y + r * 0.08);
}
const COLS = ['#c0503e', '#4a78a8', '#5a9a5a', '#d9a440', '#8a5aa8', '#e8e0d0'];

// Scenes standing in map row y (drawn with the row, so buildings in front hide them).
export function drawRowLife(ctx, y, v) {
  if (gentle() || v.tw < 30) return;
  if (scenesDirty) computeScenes();
  const list = scenes.get(y); if (!list) return;
  const t = v.time, s = v.s, night = L.daylight().n, si = seasonAt(y);
  for (const sc of list) {
    const cx = v.sx(tileWX(sc.x, sc.y)), cy = v.sy(tileWY(sc.y));
    if (cx < -40 || cx > v.cw + 40 || cy < -40 || cy > v.ch + 60) continue;
    if (sc.k === 'bench') { // an elder resting on a bench by the door
      const bx = cx - v.tw * 0.24, by = cy + v.tw * 0.16;
      ctx.fillStyle = '#8a5a3c'; ctx.fillRect(bx - 4 * s, by - 2.4 * s, 8 * s, 1.4 * s); ctx.fillRect(bx - 4 * s, by - 5 * s, 8 * s, 1 * s);
      ctx.fillRect(bx - 3.6 * s, by - 2.4 * s, 0.8 * s, 2.4 * s); ctx.fillRect(bx + 2.8 * s, by - 2.4 * s, 0.8 * s, 2.4 * s);
      ctx.fillStyle = '#7a6a8a'; ctx.fillRect(bx - 1.4 * s, by - 6.6 * s, 2.8 * s, 4.2 * s);
      ctx.fillStyle = '#e8d0b8'; ctx.beginPath(); ctx.arc(bx, by - 8 * s, 1.4 * s, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(bx, by - 8.6 * s, 1.4 * s, Math.PI, 0); ctx.fill();
      if (night > 0.5 && (t + sc.ph) % 14 < 5) bubble(ctx, bx + 3 * s, by - 13 * s, s, '💤');
      else if (night < 0.5 && (t + sc.ph) % 22 < 4) bubble(ctx, bx + 3 * s, by - 13 * s, s, '☕');
      continue;
    }
    if (sc.k === 'chat') { // two neighbours chatting at the market
      if (night > 0.5) continue;
      const bx = cx + v.tw * 0.26, by = cy + v.tw * 0.08;
      person(ctx, bx - 3 * s, by, s, COLS[(sc.ph | 0) % 6], 1); person(ctx, bx + 3 * s, by, s, COLS[((sc.ph | 0) + 2) % 6], -1);
      if ((t + sc.ph) % 9 < 4) bubble(ctx, bx, by - 13 * s, s, (t + sc.ph) % 18 < 9 ? '…' : '😄');
      continue;
    }
    if (sc.k === 'kids') { // children playing tag (or sledding and building snowmen in winter)
      if (night > 0.4) continue;
      // they play for a while, then wander off home for a bit
      const cyc = (t + sc.ph * 13) % 70; if (cyc > 45) continue;
      const kidPos = (k, tt) => { // a wandering, irregular run with little stops
        const p1 = sc.ph * 3 + k * 1.7, sp = 0.5 + k * 0.13;
        const u = tt * sp + Math.sin(tt * 0.37 + p1) * 1.4; // speeds up and slows down
        return [Math.sin(u + p1) * 0.6 + Math.sin(u * 1.9 + p1 * 2) * 0.35, Math.cos(u * 0.8 + p1) * 0.6 + Math.sin(u * 1.3 + p1) * 0.3];
      };
      for (let k = 0; k < 3; k++) {
        // the child who is "it" chases the one ahead, a moment behind
        const [ux, uy] = k === 0 ? kidPos(1, t - 0.6) : kidPos(k, t), [px, py] = k === 0 ? kidPos(1, t - 0.7) : kidPos(k, t - 0.1);
        const kx = cx + ux * v.tw * 0.24, ky = cy + uy * v.tw * 0.09 + v.tw * 0.05;
        const moving = Math.hypot(ux - px, uy - py) > 0.01;
        const hop = moving ? Math.abs(Math.sin(t * 9 + k)) * 1.2 * s : 0;
        person(ctx, kx, ky, s * 0.72, COLS[(k + (sc.ph | 0)) % 6], ux >= px ? 1 : -1, hop, si === 3 ? '#c0503e' : null);
      }
      if ((t + sc.ph) % 16 < 3) bubble(ctx, cx, cy - v.tw * 0.32, s, '😆');
      continue;
    }
    if (sc.k === 'fisher') { // someone fishing from the riverbank, line in the water
      if (night > 0.6 || si === 3) continue;
      const bx = cx - v.tw * 0.18, by = cy - v.tw * 0.02;
      person(ctx, bx, by, s, '#5a7a4a', 1, 0, '#a08050');
      const tipx = bx + 9 * s, tipy = by - 12 * s, fx = cx + v.tw * 0.12, fy = cy + v.tw * 0.03;
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(0.7, 0.8 * s); ctx.beginPath(); ctx.moveTo(bx + 1 * s, by - 5 * s); ctx.lineTo(tipx, tipy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.quadraticCurveTo(tipx + 2 * s, fy - 4 * s, fx, fy); ctx.stroke();
      const rr = ((t * 0.7 + sc.ph) % 1.6) * 4 * s; // ripples
      ctx.strokeStyle = `rgba(255,255,255,${0.55 - rr / (14 * s)})`; ctx.beginPath(); ctx.ellipse(fx, fy, rr, rr * 0.45, 0, 0, 6.3); ctx.stroke();
      if ((t + sc.ph) % 25 < 2) bubble(ctx, bx + 2 * s, by - 16 * s, s, '🐟');
      continue;
    }
    if (sc.k === 'ducks') { // a little family of ducks (or a pair of swans)
      for (let k = 0; k < (sc.swan ? 2 : 4); k++) {
        const a = t * 0.25 + sc.ph + k * 0.5, dx = cx + Math.cos(a) * v.tw * 0.18 - k * 3 * s, dy = cy + Math.sin(a) * v.tw * 0.05;
        const big = sc.swan ? 1.6 : k ? 0.7 : 1, col = sc.swan ? '#fbfbf6' : k ? '#c8a878' : '#6a7a4a';
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(dx, dy + 0.6 * s, 3 * s * big, 0.8 * s, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(dx, dy - 1 * s * big, 2.2 * s * big, 1.2 * s * big, 0, 0, 6.3); ctx.fill();
        if (sc.swan) { ctx.strokeStyle = col; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(dx + 1.6 * s, dy - 1.6 * s); ctx.quadraticCurveTo(dx + 3 * s, dy - 4 * s, dx + 2.2 * s, dy - 5.6 * s); ctx.stroke(); }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(dx + 1.8 * s * big, dy - (sc.swan ? 5.6 : 2.2) * s * big / (sc.swan ? big : 1), 0.9 * s * big, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#e8a040'; ctx.fillRect(dx + 2.5 * s * big, dy - (sc.swan ? 5.8 : 2.4) * s * big / (sc.swan ? big : 1), 0.9 * s, 0.5 * s);
      }
      continue;
    }
    if (sc.k === 'swim') { // summer swimmers splashing
      if (si !== 1 || night > 0.4 || Math.abs(tileLat(sc.y)) > 60) continue;
      for (let k = 0; k < 2; k++) {
        const sx2 = cx + (k - 0.5) * v.tw * 0.18 + Math.sin(t + k) * 2 * s, sy2 = cy + Math.cos(t * 0.8 + k) * s;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(sx2, sy2, 3.4 * s, 1.3 * s, 0, 0, 6.3); ctx.stroke();
        ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(sx2, sy2 - 1.2 * s, 1.4 * s, 0, 6.3); ctx.fill();
        if (Math.sin(t * 3 + k) > 0.7) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx2 + 2 * s, sy2 - 3 * s, 1, 1); ctx.fillRect(sx2 - 2.5 * s, sy2 - 2.5 * s, 1, 1); }
      }
      continue;
    }
    if (sc.k === 'snowman') { // winter snowmen where the snow lies
      if (si !== 3 || !L.tileSnowy(sc.x, sc.y, world.biome[sc.y * W + sc.x], L.rowSeason(sc.y))) continue;
      const bx = cx + v.tw * 0.1, by = cy + v.tw * 0.06;
      ctx.fillStyle = '#f8fbff'; ctx.beginPath(); ctx.arc(bx, by - 2.6 * s, 2.8 * s, 0, 6.3); ctx.arc(bx, by - 6.8 * s, 2 * s, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8803c'; ctx.fillRect(bx + 1 * s, by - 7 * s, 1.8 * s, 0.6 * s);
      ctx.fillStyle = '#3c3a40'; ctx.fillRect(bx - 1.6 * s, by - 10 * s, 3.2 * s, 1.4 * s); ctx.fillRect(bx - 1 * s, by - 11.6 * s, 2 * s, 1.8 * s);
      ctx.fillStyle = '#c0503e'; ctx.fillRect(bx - 2 * s, by - 5.2 * s, 4 * s, 0.9 * s);
    }
  }
}

// ---------------- emotes over walkers ----------------
export function emoteFor(w, t, night, isTavern) {
  // phase from the person's id (not their walking step, which changes every frame), shown for a few calm seconds
  const ph = (t + ((w.pid || 0) * 7.3) % 30) % 30;
  if (ph > 4.5) return null;
  if (night > 0.5) return w.moving ? null : '💤';
  if (isTavern) return '♪';
  if (w.pid % 5 === 0) return '♥';
  if (w.pid % 7 === 0) return '😊';
  return null;
}

// ---------------- chimney smoke and laundry ----------------
export function smoke(ctx, x, y, s, t, seed, winter) {
  if (gentle()) return;
  const n = winter ? 5 : 3;
  for (let k = 0; k < n; k++) {
    const life = ((t * 0.35 + seed + k / n) % 1);
    const px = x + life * 9 * s + Math.sin(life * 6 + seed) * 1.5 * s, py = y - life * 16 * s;
    ctx.fillStyle = `rgba(235,235,235,${0.45 * (1 - life)})`;
    ctx.beginPath(); ctx.arc(px, py, (1.6 + life * 3.4) * s, 0, 6.3); ctx.fill();
  }
}
export function laundry(ctx, x, y, s, t, seed) {
  if (gentle()) return;
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(0.7, 0.6 * s);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 8 * s); ctx.moveTo(x + 14 * s, y + 3 * s); ctx.lineTo(x + 14 * s, y - 5 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,70,60,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, y - 7.5 * s); ctx.lineTo(x + 14 * s, y - 4.5 * s); ctx.stroke();
  const cols = ['#f4f0e6', '#c0503e', '#4a78a8', '#e8c040'];
  for (let k = 0; k < 3; k++) {
    const lx = x + (2 + k * 4) * s, ly = y - (7 - k * 0.9) * s, sway = Math.sin(t * 3 + k + seed) * 1.2 * s;
    ctx.fillStyle = cols[(k + (seed | 0)) % 4];
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 2.6 * s, ly + 0.4 * s); ctx.lineTo(lx + 2.6 * s + sway, ly + 3.4 * s); ctx.lineTo(lx + sway, ly + 3 * s); ctx.closePath(); ctx.fill();
  }
}

// ---------------- water life: waves, fish, whales, night sparkle ----------------
export function drawWaterLife(ctx, v) {
  if (v.tw < 24) return;
  const t = v.time, s = v.s, night = L.daylight().n;
  for (let y = v.yA; y <= v.yB; y++) {
    const off = (y & 1) * 0.5, cy = v.sy(tileWY(y));
    const xa = Math.floor(v.X0 - off - 0.5), xb = Math.ceil(v.X1 - off);
    for (let x = xa; x <= xb; x++) {
      const wx = wrapX(x), i = y * W + wx, b = world.biome[i];
      if (b > 1) continue;
      const cx = v.sx(x + 0.5 + off), h = hash2(wx, y, 95);
      if (b === B.SHALLOW && !gentle()) { // waves lapping towards the shore
        const land = world.biome[idxOf(wx, y - 2)] > 2 || world.biome[idxOf(wx, y + 2)] > 2 || world.biome[idxOf(wx - 1, y)] > 2 || world.biome[idxOf(wx + 1, y)] > 2;
        if (land) {
          const k = (t * 0.4 + h * 7) % 1;
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * Math.sin(k * Math.PI)})`; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.ellipse(cx, cy, v.tw * (0.18 + k * 0.14), v.tw * (0.05 + k * 0.04), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        }
      }
      if (h < 0.012 && !gentle()) { // a fish jumps now and then
        const k = (t * 0.5 + h * 300) % 6;
        if (k < 0.8) {
          const u = k / 0.8, fx = cx - 5 * s + u * 10 * s, fy = cy - Math.sin(u * Math.PI) * 8 * s;
          ctx.fillStyle = '#9ab0c0'; ctx.beginPath(); ctx.ellipse(fx, fy, 2 * s, 0.9 * s, u * 2 - 1, 0, 6.3); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(cx - 5 * s, cy, 3 * s * u, 1.2 * s * u, 0, 0, 6.3); ctx.stroke();
        }
      }
      if (b === B.OCEAN && h > 0.9985) { // whales far out at sea: a back, a spout, a tail
        const k = (t * 0.12 + h * 1000) % 3;
        if (k < 1.6) {
          const wx2 = cx + (k - 0.8) * v.tw * 0.5, rise = Math.sin(Math.min(1, k / 1.6) * Math.PI);
          ctx.fillStyle = 'rgba(60,72,90,0.9)'; ctx.beginPath(); ctx.ellipse(wx2, cy, 9 * s * rise + 1, 2.6 * s * rise + 0.5, 0, Math.PI, 0); ctx.fill();
          if (k > 0.5 && k < 1) { ctx.fillStyle = 'rgba(230,240,250,0.8)'; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(wx2 + (j - 1.5) * 1.5 * s, cy - (6 + j % 2 * 2) * s, 1.4 * s, 0, 6.3); ctx.fill(); } }
          if (k > 1.25) { ctx.fillStyle = 'rgba(60,72,90,0.9)'; ctx.beginPath(); ctx.moveTo(wx2 - 9 * s, cy); ctx.lineTo(wx2 - 13 * s, cy - 5 * s); ctx.lineTo(wx2 - 10 * s, cy - 2 * s); ctx.lineTo(wx2 - 7 * s, cy - 5 * s); ctx.closePath(); ctx.fill(); }
        }
      }
      if (night > 0.5 && h > 0.97) { // moonlight glinting on the water
        const tw2 = (Math.sin(t * 2 + h * 90) + 1) / 2;
        ctx.fillStyle = `rgba(230,240,255,${0.6 * tw2 * night})`; ctx.fillRect(cx + (h - 0.98) * 400, cy, 2, 1);
      }
    }
  }
}

// ---------------- wildlife herds and startled birds ----------------
export function herdSize(kind, x, y) { return kind === 'deer' || kind === 'reindeer' || kind === 'gazelle' ? 2 + Math.floor(hash2(x, y, 25) * 3) : 1; }
// Every so often a herd takes fright and bounds away, then wanders back.
export function herdOffset(t, ph) {
  const k = (t * 0.05 + ph) % 1;
  if (k < 0.08) { const u = k / 0.08; return [Math.sin(u * Math.PI) * 0.6, -Math.sin(u * Math.PI) * 0.15, true]; }
  return [0, 0, false];
}
const flocks = [];
export function scatterBirds(px, py) {
  if (gentle()) return;
  const n = 7 + Math.floor(Math.random() * 6);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    flocks.push({ x: px + (Math.random() - 0.5) * 24, y: py + (Math.random() - 0.5) * 14, vx: Math.cos(a) * (60 + Math.random() * 80), vy: Math.sin(a) * (70 + Math.random() * 60), life: 0, ph: Math.random() * 6 });
  }
}
// Fireflies on summer nights, petals in spring, leaves in autumn, and the startled birds.
const motes = [];
export function drawAir(ctx, v, dt) {
  const t = v.time, night = L.daylight().n, si = SE.seasonIndex(S.day, tileLat(Math.max(0, Math.min(H - 1, Math.round(v.camY / 0.25)))));
  for (let k = flocks.length - 1; k >= 0; k--) {
    const f = flocks[k]; f.life += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 10 * dt;
    if (f.life > 3) { flocks.splice(k, 1); continue; }
    const flap = Math.sin(t * 18 + f.ph) * 3;
    ctx.strokeStyle = `rgba(40,40,50,${1 - f.life / 3})`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(f.x - 4, f.y - flap); ctx.quadraticCurveTo(f.x - 1.5, f.y - 2, f.x, f.y); ctx.quadraticCurveTo(f.x + 1.5, f.y - 2, f.x + 4, f.y - flap); ctx.stroke();
  }
  if (gentle() || v.tw < 20) return;
  const want = night > 0.5 && si === 1 ? 40 : si === 0 && night < 0.5 ? 26 : si === 2 && night < 0.5 ? 30 : 0;
  const kind = night > 0.5 && si === 1 ? 'fly' : si === 0 ? 'petal' : 'leaf';
  while (motes.length < want) motes.push({ x: Math.random() * v.cw, y: Math.random() * v.ch, ph: Math.random() * 6, vx: 10 + Math.random() * 20, k: kind });
  if (motes.length > want) motes.length = want;
  for (const m of motes) {
    if (m.k !== kind) m.k = kind;
    if (kind === 'fly') {
      m.x += Math.sin(t * 0.7 + m.ph) * 12 * dt; m.y += Math.cos(t * 0.9 + m.ph * 2) * 10 * dt;
      const glow = (Math.sin(t * 2.6 + m.ph * 3) + 1) / 2;
      ctx.fillStyle = `rgba(230,255,140,${0.25 + glow * 0.7})`; ctx.beginPath(); ctx.arc(m.x, m.y, 1.4 + glow, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgba(230,255,140,${0.12 * glow})`; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 6.3); ctx.fill();
    } else {
      m.x += (m.vx + Math.sin(t + m.ph) * 8) * dt; m.y += (14 + Math.sin(t * 1.4 + m.ph) * 6) * dt;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(t * 1.5 + m.ph);
      ctx.fillStyle = kind === 'petal' ? 'rgba(248,200,214,0.9)' : ['rgba(214,128,52,0.9)', 'rgba(196,84,48,0.9)', 'rgba(226,172,62,0.9)'][(m.ph * 10 | 0) % 3];
      ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.3, 0, 0, 6.3); ctx.fill(); ctx.restore();
    }
    if (m.x > v.cw + 10) m.x = -10; if (m.x < -10) m.x = v.cw + 10; if (m.y > v.ch + 10) m.y = -10; if (m.y < -10) m.y = v.ch + 10;
  }
}

// ---------------- light through the day ----------------
// Sun direction and how long shadows are: long at dawn and dusk, short at midday.
export function sun() {
  const f = SE.dayFrac(S.day); // 0..1 through the day; night ~0.78-0.9
  const dayF = f < 0.78 ? f / 0.78 : 0; // 0 sunrise .. 1 sunset
  const len = dayF ? 0.4 + Math.abs(dayF - 0.5) * 2.2 : 0;
  return { dx: dayF ? (0.5 - dayF) * 2 : 0, len, f };
}
export function longShadow(ctx, x, y, s, tw) {
  if (gentle()) return;
  const sn = sun(); if (!sn.len) return;
  const L2 = sn.len * tw * 0.45;
  ctx.fillStyle = `rgba(30,40,30,${0.12 + Math.min(0.1, sn.len * 0.05)})`;
  ctx.beginPath(); ctx.ellipse(x + sn.dx * L2 * 0.7, y + tw * 0.04, tw * 0.22 + L2 * 0.45, tw * 0.07 + L2 * 0.08, 0, 0, 6.3); ctx.fill();
}
// Golden hour glow and the blue hour after sunset.
export function drawLight(ctx, v) {
  const sn = sun(), f = sn.f;
  let gold = 0, blue = 0;
  if (f > 0.6 && f < 0.72) gold = Math.sin(((f - 0.6) / 0.12) * Math.PI);
  else if (f > 0.9 || f < 0.06) gold = Math.sin((((f + 0.1) % 1) / 0.16) * Math.PI) * 0.7;
  if (f > 0.7 && f < 0.8) blue = Math.sin(((f - 0.7) / 0.1) * Math.PI);
  if (gold > 0.02) {
    const g = ctx.createLinearGradient(0, 0, v.cw * 0.3, v.ch);
    g.addColorStop(0, `rgba(255,190,90,${0.22 * gold})`); g.addColorStop(1, `rgba(255,140,80,${0.08 * gold})`);
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, v.cw, v.ch); ctx.globalCompositeOperation = 'source-over';
  }
  if (blue > 0.02) { ctx.fillStyle = `rgba(70,90,160,${0.12 * blue})`; ctx.fillRect(0, 0, v.cw, v.ch); }
}

// ---------------- weather: fog, storms with lightning and rainbows, heat shimmer ----------------
const wx = { fog: 0, storm: 0, flash: 0, rainbow: 0, lastRain: 0 };
export function updateSky(dt) {
  const w = L.weather, f = sun().f;
  const morning = f > 0.0 && f < 0.18;
  if (w.kind === 'rain' && !w.stormRolled) { w.stormRolled = true; w.storm = Math.random() < 0.35; }
  if (w.kind !== 'rain') w.stormRolled = false;
  const fogTarget = morning && !S.settings.noweather && w.kind !== 'rain' && (Math.floor(S.day / SE.CYCLE) % 3 === 0) ? 1 : 0;
  wx.fog += (fogTarget - wx.fog) * Math.min(1, dt * 0.4);
  wx.storm += ((w.kind === 'rain' && w.storm ? 1 : 0) - wx.storm) * Math.min(1, dt * 0.5);
  if (wx.storm > 0.5 && Math.random() < dt * 0.12) { wx.flash = 1; emitThunder(); }
  wx.flash = Math.max(0, wx.flash - dt * 3);
  if (wx.lastRain > 0.5 && w.rain < 0.2) wx.rainbow = 1; // the sun comes out after rain
  wx.lastRain = w.rain;
  wx.rainbow = Math.max(0, wx.rainbow - dt / 40);
}
let thunderFn = null;
export function onThunder(f) { thunderFn = f; }
function emitThunder() { if (thunderFn) setTimeout(thunderFn, 300 + Math.random() * 900); }
export function drawSky(ctx, v) {
  if (wx.storm > 0.05) { ctx.fillStyle = `rgba(30,35,50,${0.18 * wx.storm})`; ctx.fillRect(0, 0, v.cw, v.ch); }
  if (wx.flash > 0) { ctx.fillStyle = `rgba(240,245,255,${0.5 * wx.flash})`; ctx.fillRect(0, 0, v.cw, v.ch); }
  if (gentle()) return;
  if (wx.fog > 0.02) {
    for (let k = 0; k < 5; k++) {
      const y = ((k * 0.23 + v.time * 0.004) % 1.2 - 0.1) * v.ch, x = ((v.time * 6 + k * 170) % (v.cw + 400)) - 200;
      const g = ctx.createRadialGradient(x, y, 10, x, y, v.cw * 0.6);
      g.addColorStop(0, `rgba(238,240,242,${0.35 * wx.fog})`); g.addColorStop(1, 'rgba(238,240,242,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, v.cw, v.ch);
    }
  }
  if (wx.rainbow > 0.02 && L.daylight().n < 0.3) {
    const cx = v.cw * 0.65, cy = v.ch * 0.95, R = Math.max(v.cw, v.ch) * 0.75;
    const cols = ['255,80,80', '255,160,60', '255,230,90', '110,210,110', '90,150,240', '150,100,220'];
    ctx.lineWidth = R * 0.018;
    cols.forEach((c, k) => { ctx.strokeStyle = `rgba(${c},${0.22 * wx.rainbow})`; ctx.beginPath(); ctx.arc(cx, cy, R - k * ctx.lineWidth, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
  }
  // heat shimmer over desert at midday in summer
  const row = Math.max(0, Math.min(H - 1, Math.round(v.camY / 0.25)));
  const camB = world.biome[row * W + wrapX(Math.round(v.camX))];
  const f = sun().f;
  if (camB === B.DESERT && f > 0.25 && f < 0.55 && SE.seasonIndex(S.day, tileLat(row)) === 1 && v.tw >= 20) {
    ctx.strokeStyle = 'rgba(255,250,235,0.08)'; ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const y = (k / 14) * v.ch + Math.sin(v.time * 1.3 + k) * 4;
      ctx.beginPath(); for (let x = 0; x <= v.cw; x += 24) { const yy = y + Math.sin(x * 0.04 + v.time * 3 + k) * 2.5; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke();
    }
  }
}

// ---------------- lived-in neighbour villages ----------------
export function drawVillageLife(ctx, cx, cy, s, nb, t, tw) {
  if (gentle() || tw < 30) return;
  smoke(ctx, cx - 4 * s, cy - 18 * s, s, t, nb.id * 0.37, SE.seasonIndex(S.day, tileLat(nb.y)) === 3);
  const night = L.daylight().n; if (night > 0.6) return;
  for (let k = 0; k < 3; k++) {
    const [ox, oy, face] = L.wander(t * 0.7, nb.id * 3 + k * 2.1, 0.35);
    person(ctx, cx + (ox + (k - 1) * 0.15) * tw, cy + (oy + 0.12) * tw, s, `hsl(${(nb.hue + k * 40) % 360},45%,50%)`, face, Math.abs(Math.sin(t * 8 + k)) * 0.6 * s);
  }
  for (let k = 0; k < 3; k++) { // a few sheep by the village
    const [ox, oy, face] = L.wander(t * 0.4, nb.id * 5 + k, 0.2);
    L.drawAnimal(ctx, 'sheep', cx + (0.28 + ox) * tw, cy + (0.16 + oy + k * 0.04) * tw, s, face, t, nb.id + k);
  }
}

// ---------------- travellers between villages on the wide map ----------------
let lanes = null, lanesFor = -1;
function buildLanes() {
  lanes = [];
  const nbs = S.neighbors.filter((n) => !n.joined);
  for (const a of nbs) {
    let best = null, bd = 50 * 50;
    for (const b of nbs) {
      if (a === b) continue;
      let dx = tileWX(a.x, a.y) - tileWX(b.x, b.y); if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
      const dy = (tileWY(a.y) - tileWY(b.y)) * 2, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = b; }
    }
    if (best && a.id < best.id) {
      // only overland lanes: sample the line for sea
      let sea = 0;
      for (let k = 1; k < 10; k++) { const x = Math.round(a.x + (best.x - a.x) * k / 10), y = Math.round(a.y + (best.y - a.y) * k / 10); if (world.biome[idxOf(x, y)] <= 1) sea++; }
      if (!sea) lanes.push({ a, b: best, kind: hash2(a.id, best.id, 3) < 0.7 ? 'caravan' : 'pilgrims', len: Math.sqrt(bd) });
    }
  }
  lanesFor = S.neighbors.length;
}
export function drawTravellers(ctx, v) {
  if (gentle()) return;
  if (!lanes || lanesFor !== S.neighbors.length) buildLanes();
  const t = v.time;
  for (const ln of lanes) {
    const u0 = ((t * 0.6 / ln.len + hash2(ln.a.id, 9, 9)) % 2), u = u0 > 1 ? 2 - u0 : u0;
    let ax = tileWX(ln.a.x, ln.a.y), bx = tileWX(ln.b.x, ln.b.y); if (bx - ax > W / 2) bx -= W; else if (ax - bx > W / 2) bx += W;
    const X = ax + (bx - ax) * u, Y = tileWY(ln.a.y) + (tileWY(ln.b.y) - tileWY(ln.a.y)) * u;
    const x = v.sx(X), y = v.sy(Y);
    if (x < -30 || x > v.cw + 30 || y < -30 || y > v.ch + 30) continue;
    const face = (bx - ax) * (u0 > 1 ? -1 : 1) >= 0 ? 1 : -1;
    if (v.tw < 14) { if (v.tw >= 2.5) { ctx.fillStyle = ln.kind === 'caravan' ? '#8a5a3c' : '#f4ead8'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } continue; }
    const s = v.s;
    if (ln.kind === 'caravan') {
      L.drawAnimal(ctx, 'horse', x + face * 7 * s, y, s * 1.1, face, t * 1.4, ln.a.id);
      ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.ellipse(x, y - 5 * s, 4.4 * s, 4.6 * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#9a7048'; ctx.fillRect(x - 4 * s, y - 5 * s, 8 * s, 3 * s);
      ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(x - 2.2 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.arc(x + 2.4 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.fill();
    } else {
      for (let k = 0; k < 3; k++) person(ctx, x - face * k * 4 * s, y + k * 0.6 * s, s, ['#e8e0d0', '#a08060', '#c0b090'][k], face, Math.abs(Math.sin(t * 8 + k)) * 0.6 * s, '#7a5a34');
    }
  }
}
