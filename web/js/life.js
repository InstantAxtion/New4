// The living world: seasons on the map, day and night, weather, animals, boats and roads.
import { W, H, B, world, tileLat, tileWX, tileWY, idxOf } from './world.js';
import { S, on } from './game.js';
import { hash2 } from './noise.js';
import { SPR } from './sprites.js';
import * as SE from './seasons.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------- seasons on the map ----------------
export const SNOWABLE = new Set([B.GRASS, B.STEPPE, B.FOREST, B.TAIGA, B.HILLS, B.TUNDRA, B.DESERT, B.SAVANNA, B.JUNGLE]);
// Per-row seasonal amounts (fractions of tiles affected), cached per frame.
const rowCache = new Map(); let rowDay = -1;
export function rowSeason(y) {
  const day = Math.floor(S.day * 8) / 8; // update 8 times per game day
  if (day !== rowDay) { rowCache.clear(); rowDay = day; }
  const key = y >> 3; // rows close together share a latitude band
  let r = rowCache.get(key);
  if (!r) {
    const lat = tileLat(y), alat = Math.abs(lat), t = SE.yearT(day, lat);
    r = {
      snow: SE.snowLevel(t) * SE.coldness(lat) * 1.05,
      autumn: SE.autumnLevel(t) * clamp01((alat - 25) / 15),
      bare: SE.bareLevel(t) * clamp01((alat - 30) / 12),
      blossom: SE.blossomLevel(t) * clamp01((alat - 25) / 15) * 0.45,
    };
    rowCache.set(key, r);
  }
  return r;
}
// Snow covers individual tiles gradually (each tile has its own threshold), so it spreads and melts naturally.
export const tileSnowy = (x, y, b, rs) => rs.snow > 0 && SNOWABLE.has(b) && hash2(x, y, 11) < rs.snow;
export function seasonalDecor(b, x, y, rs, snowy) {
  const h = hash2(x, y, 13);
  if (b === B.FOREST || b === B.GRASS) {
    const set = b === B.FOREST ? SPR.season.forest : SPR.season.grass;
    if (snowy) return set.snow;
    if (h < rs.bare) return set.bare;
    if (h < rs.autumn) return set.autumn;
    if (h < rs.blossom) return set.blossom;
    return null;
  }
  if (!snowy) return null;
  if (b === B.TAIGA) return SPR.season.taigaSnow;
  if (b === B.HILLS) return SPR.season.hillsSnow;
  if (b === B.STEPPE || b === B.TUNDRA) return SPR.season.rocksSnow;
  return null;
}

// Overview: a soft white wash over cold lands in winter, one mask per hemisphere.
let snowMasks = null;
export function buildSnowMasks() {
  const MW = 1000, MH = 500;
  const make = (north) => {
    const c = document.createElement('canvas'); c.width = MW; c.height = MH;
    const g = c.getContext('2d'), img = g.createImageData(MW, MH), d = img.data;
    for (let y = 0; y < MH; y++) {
      const ty = Math.min(H - 1, Math.floor((y + 0.5) * (H / MH))), lat = tileLat(ty);
      if ((lat > 0) !== north) continue;
      const cold = SE.coldness(lat);
      if (!cold) continue;
      for (let x = 0; x < MW; x++) {
        const b = world.biome[ty * W + Math.floor(x * (W / MW))];
        if (!SNOWABLE.has(b)) continue;
        const o = (y * MW + x) * 4;
        d[o] = 244; d[o + 1] = 247; d[o + 2] = 251; d[o + 3] = Math.round(225 * cold);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  };
  snowMasks = { north: make(true), south: make(false) };
}
export function drawOverviewSeasons(ctx, left, top, tw, cw) {
  if (!snowMasks) return;
  for (const [mask, lat] of [[snowMasks.north, 45], [snowMasks.south, -45]]) {
    const a = SE.snowLevel(SE.yearT(S.day, lat));
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    for (let k = -1; k <= 1; k++) {
      const dx = left + k * W * tw;
      if (dx > cw || dx + W * tw < 0) continue;
      ctx.drawImage(mask, dx, top, W * tw, 1000 * tw);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- day and night ----------------
export const daylight = () => SE.nightAt(S.day);
export function drawNight(ctx, cw, ch, lights, tw) {
  const { n, w } = daylight();
  if (w > 0.02) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(255,${Math.round(250 - 16 * w)},${Math.round(242 - 38 * w)})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  if (n > 0.01) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${Math.round(255 - 150 * n)},${Math.round(255 - 135 * n)},${Math.round(255 - 70 * n)})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, n * 0.42);
    const r = Math.max(8, tw * 0.42);
    for (const [x, y, k] of lights) ctx.drawImage(SPR.glow, x - r * k, y - r * k * 0.8, 2 * r * k, 1.6 * r * k);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------- weather ----------------
export const weather = { kind: 'clear', until: 0, cover: 0.3, coverTarget: 0.3, rain: 0, rainTarget: 0 };
function rollWeather() {
  const r = Math.random();
  weather.kind = r < 0.55 ? 'clear' : r < 0.82 ? 'cloudy' : 'rain';
  weather.until = S.day + (weather.kind === 'rain' ? 1 + Math.random() * 2 : 2 + Math.random() * 4);
  weather.coverTarget = weather.kind === 'clear' ? 0.22 : weather.kind === 'cloudy' ? 0.45 : 0.62;
  weather.rainTarget = weather.kind === 'rain' ? 1 : 0;
}
export function updateWeather(dt) {
  if (S.day >= weather.until || weather.until - S.day > 10) rollWeather();
  const k = Math.min(1, dt * 0.25);
  weather.cover += (weather.coverTarget - weather.cover) * k;
  weather.rain += (weather.rainTarget - weather.rain) * k;
}
// Is the falling weather snow where the camera is looking?
export const fallingSnow = (camRow) => rowSeason(camRow).snow > 0.35;

// Clouds: a fixed field of clouds slid along by the wind, so they drift without ever popping.
export function drawClouds(ctx, t, cam, cw, ch, sx, sy, tileMode) {
  const tw = cam.tw;
  const windX = t * 0.05, windY = t * 0.012;
  let cell = 18;
  const visW = cw / tw, visH = ch / tw;
  while ((visW / cell) * (visH / (cell * 0.5)) > 260) cell *= 2;
  const cellH = cell * 0.5;
  const x0 = Math.floor((cam.x - visW / 2 - windX) / cell) - 1, x1 = Math.ceil((cam.x + visW / 2 - windX) / cell) + 1;
  const y0 = Math.floor((cam.y - visH / 2 - windY) / cellH) - 1, y1 = Math.ceil((cam.y + visH / 2 - windY) / cellH) + 1;
  const alpha = tileMode ? Math.max(0.14, 0.34 - (tw - 20) / 120) : 0.7;
  const draws = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const wcx = ((cx % 4096) + 4096) % 4096;
    if (hash2(wcx, cy, 71) > weather.cover) continue;
    const X = cx * cell + hash2(wcx, cy, 72) * cell + windX, Y = cy * cellH + hash2(wcx, cy, 73) * cellH + windY;
    const size = cell * (0.35 + hash2(wcx, cy, 74) * 0.35);
    const k = (hash2(wcx, cy, 75) * 4) | 0;
    draws.push([sx(X), sy(Y), size * tw, SPR.clouds[k], k]);
  }
  // shadows first (offset towards the low sun), then the clouds themselves
  const shadows = cloudShadows();
  ctx.globalAlpha = 0.13 + weather.rain * 0.07;
  for (const [x, y, w, , k] of draws) ctx.drawImage(shadows[k], x - w / 2 + w * 0.18, y - w / 4 + w * 0.32, w, w / 2);
  ctx.globalAlpha = alpha * (1 - weather.rain * 0.25);
  for (const [x, y, w, img] of draws) ctx.drawImage(img, x - w / 2, y - w / 4, w, w / 2);
  ctx.globalAlpha = 1;
  return draws.length;
}
// Cloud shadows: dark copies of the cloud sprites, built once.
let shadowSprites = null;
function cloudShadows() {
  if (!shadowSprites) {
    shadowSprites = SPR.clouds.map((c) => {
      const sh = document.createElement('canvas'); sh.width = c.width; sh.height = c.height;
      const g = sh.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in';
      g.fillStyle = 'rgb(20,30,50)'; g.fillRect(0, 0, sh.width, sh.height); return sh;
    });
  }
  return shadowSprites;
}

// Rain and snow fall in screen space.
const drops = [];
export function drawFalling(ctx, dt, cw, ch, snow) {
  const amt = weather.rain;
  if (amt < 0.03) return false;
  const want = Math.round((snow ? 110 : 160) * amt);
  while (drops.length < want) drops.push({ x: Math.random() * cw, y: Math.random() * ch, v: 0.6 + Math.random() * 0.6, p: Math.random() * 6 });
  drops.length = want;
  ctx.fillStyle = `rgba(40,50,70,${0.1 * amt})`; ctx.fillRect(0, 0, cw, ch);
  if (snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const d of drops) {
      d.y += dt * 40 * d.v; d.p += dt; d.x += Math.sin(d.p * 1.3) * dt * 12;
      if (d.y > ch) { d.y = -4; d.x = Math.random() * cw; }
      ctx.beginPath(); ctx.arc(d.x, d.y, 1.2 + d.v, 0, 6.3); ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(205,220,240,0.45)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (const d of drops) {
      d.y += dt * 520 * d.v; d.x -= dt * 90 * d.v;
      if (d.y > ch) { d.y = -12; d.x = Math.random() * (cw + 100); }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 4, d.y - 14);
    }
    ctx.stroke();
  }
  return true;
}

// Birds: small flocks gliding across in a slowly turning direction.
export function drawBirds(ctx, t, cam, cw, ch, sx, sy) {
  if (daylight().n > 0.5 || cam.tw < 4) return; // flocks only when zoomed in enough to see them as birds
  const tw = cam.tw, cell = 60, cellH = 30;
  const ang = 0.4 + Math.sin(t * 0.01) * 0.6;
  const ox = Math.cos(ang) * t * 0.35, oy = Math.sin(ang) * t * 0.12;
  const visW = cw / tw, visH = ch / tw;
  if ((visW / cell) * (visH / cellH) > 200) return;
  const x0 = Math.floor((cam.x - visW / 2 - ox) / cell) - 1, x1 = Math.ceil((cam.x + visW / 2 - ox) / cell) + 1;
  const y0 = Math.floor((cam.y - visH / 2 - oy) / cellH) - 1, y1 = Math.ceil((cam.y + visH / 2 - oy) / cellH) + 1;
  ctx.strokeStyle = 'rgba(40,40,50,0.7)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const wcx = ((cx % 4096) + 4096) % 4096;
    if (hash2(wcx, cy, 81) > 0.3) continue;
    const bx = sx(cx * cell + hash2(wcx, cy, 82) * cell + ox), by = sy(cy * cellH + hash2(wcx, cy, 83) * cellH + oy);
    const n = 3 + ((hash2(wcx, cy, 84) * 5) | 0), sp = 9;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
      const x = bx - Math.cos(ang) * rank * sp + side * Math.sin(ang) * rank * sp, y = by - Math.sin(ang) * rank * sp * 0.5 - side * Math.cos(ang) * rank * sp * 0.5;
      const flap = Math.sin(t * 7 + i + cx) * 2;
      ctx.moveTo(x - 4, y - 1 - flap); ctx.quadraticCurveTo(x - 1.5, y - 2, x, y); ctx.quadraticCurveTo(x + 1.5, y - 2, x + 4, y - 1 - flap);
    }
  }
  ctx.stroke();
}

// ---------------- animals ----------------
const WILD = { [B.FOREST]: ['deer', 0.02], [B.TAIGA]: ['reindeer', 0.016], [B.GRASS]: ['rabbit', 0.014], [B.STEPPE]: ['rabbit', 0.012],
  [B.SAVANNA]: ['gazelle', 0.016], [B.DESERT]: ['camel', 0.006], [B.TUNDRA]: ['reindeer', 0.012] };
export function wildAt(b, x, y) { const w = WILD[b]; return w && hash2(x, y, 23) < w[1] ? w[0] : null; }

function body(ctx, x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); }
function legs(ctx, x, y, s, w, h, col, step = 0) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.7, 0.7 * s); ctx.beginPath();
  for (const dx of [-w, w]) { ctx.moveTo(x + dx * s, y); ctx.lineTo(x + dx * s + step * s, y + h * s); ctx.moveTo(x + dx * s * 0.6, y); ctx.lineTo(x + dx * s * 0.6 - step * s, y + h * s); }
  ctx.stroke();
}
export function drawAnimal(ctx, kind, x, y, s, face, t, ph) {
  const step = Math.sin(t * 5 + ph) * 0.6;
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1); ctx.translate(-x, -y);
  ctx.fillStyle = 'rgba(30,40,20,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 0.5 * s, 3.4 * s, 1.2 * s, 0, 0, 6.3); ctx.fill();
  if (kind === 'sheep') {
    legs(ctx, x, y - 1.6 * s, s, 1.6, 1.6, '#3c3530');
    body(ctx, x, y - 2.8 * s, 3 * s, 2 * s, '#f4f0e6'); body(ctx, x - 1 * s, y - 3.4 * s, 1.6 * s, 1.3 * s, '#ffffff');
    body(ctx, x + 2.9 * s, y - 3.2 * s, 1.1 * s, 0.9 * s, '#3c3530');
  } else if (kind === 'cow') {
    legs(ctx, x, y - 2 * s, s, 2, 2, '#4a3a30');
    body(ctx, x, y - 3.2 * s, 3.6 * s, 2 * s, '#f2ece2'); body(ctx, x - 1.2 * s, y - 3.6 * s, 1.2 * s, 0.9 * s, '#5a4232'); body(ctx, x + 1 * s, y - 2.8 * s, 0.9 * s, 0.7 * s, '#5a4232');
    body(ctx, x + 3.7 * s, y - 3.8 * s, 1.3 * s, 1 * s, '#f2ece2'); body(ctx, x + 4.4 * s, y - 3.5 * s, 0.6 * s, 0.5 * s, '#e8b0a0');
  } else if (kind === 'chicken') {
    const peck = Math.max(0, Math.sin(t * 3 + ph)) * 0.8 * s;
    body(ctx, x, y - 1.4 * s, 1.3 * s, 1 * s, ph % 2 > 1 ? '#c08850' : '#fbf6ea');
    body(ctx, x + 1.1 * s, y - 2.2 * s + peck, 0.7 * s, 0.6 * s, ph % 2 > 1 ? '#c08850' : '#fbf6ea');
    ctx.fillStyle = '#d0402c'; ctx.fillRect(x + 0.9 * s, y - 3 * s + peck, 0.6 * s, 0.5 * s);
  } else if (kind === 'deer' || kind === 'reindeer' || kind === 'gazelle') {
    const col = kind === 'deer' ? '#a2683e' : kind === 'gazelle' ? '#c89a5a' : '#8a7a68';
    legs(ctx, x, y - 2.4 * s, s, 1.8, 2.4, '#5a4030', step);
    body(ctx, x, y - 3.4 * s, 3 * s, 1.5 * s, col);
    ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(x + 2.2 * s, y - 3.8 * s); ctx.lineTo(x + 3.3 * s, y - 6 * s); ctx.stroke();
    body(ctx, x + 3.8 * s, y - 6.2 * s, 1.1 * s, 0.7 * s, col);
    if (kind !== 'gazelle' && ph % 3 > 1) { ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(x + 3.4 * s, y - 6.7 * s); ctx.lineTo(x + 2.6 * s, y - 8.6 * s); ctx.lineTo(x + 1.8 * s, y - 9 * s); ctx.moveTo(x + 2.9 * s, y - 7.9 * s); ctx.lineTo(x + 3.6 * s, y - 8.8 * s); ctx.stroke(); }
    if (kind === 'deer') body(ctx, x - 2.8 * s, y - 3.8 * s, 0.6 * s, 0.5 * s, '#f4ead8');
  } else if (kind === 'rabbit') {
    const hop = Math.max(0, Math.sin(t * 4 + ph)) * 1.4 * s;
    body(ctx, x, y - 1.3 * s - hop, 1.5 * s, 1.1 * s, '#9a8470'); body(ctx, x + 1.3 * s, y - 2 * s - hop, 0.8 * s, 0.7 * s, '#9a8470');
    ctx.strokeStyle = '#9a8470'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(x + 1.3 * s, y - 2.6 * s - hop); ctx.lineTo(x + 1 * s, y - 4.2 * s - hop); ctx.stroke();
    body(ctx, x - 1.5 * s, y - 1.5 * s - hop, 0.5 * s, 0.5 * s, '#fff');
  } else if (kind === 'horse') {
    const col = ph % 5 < 1 ? '#5a3e2c' : ph % 5 < 2 ? '#c8a070' : ph % 5 < 3 ? '#3c3430' : '#8a5a3a';
    legs(ctx, x, y - 3.2 * s, s, 2.2, 3.2, '#3a2a20', step);
    body(ctx, x, y - 4.4 * s, 3.8 * s, 1.8 * s, col);
    ctx.strokeStyle = col; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x + 2.8 * s, y - 5 * s); ctx.lineTo(x + 4.2 * s, y - 7.8 * s); ctx.stroke();
    body(ctx, x + 4.9 * s, y - 8 * s, 1.5 * s, 0.85 * s, col);
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(x + 2.6 * s, y - 6 * s); ctx.lineTo(x + 3.9 * s, y - 8.6 * s);
    ctx.moveTo(x - 3.6 * s, y - 4.8 * s); ctx.quadraticCurveTo(x - 5.2 * s, y - 4 * s, x - 4.8 * s, y - 2 * s); ctx.stroke();
  } else if (kind === 'camel') {
    legs(ctx, x, y - 3.2 * s, s, 1.9, 3.2, '#8a6a44', step);
    body(ctx, x, y - 4 * s, 3.4 * s, 1.5 * s, '#c8a066'); body(ctx, x - 0.4 * s, y - 5.4 * s, 1.6 * s, 1.2 * s, '#c8a066');
    ctx.strokeStyle = '#c8a066'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(x + 2.6 * s, y - 4.2 * s); ctx.quadraticCurveTo(x + 4.4 * s, y - 4.6 * s, x + 4.4 * s, y - 7 * s); ctx.stroke();
    body(ctx, x + 4.8 * s, y - 7.2 * s, 1.1 * s, 0.6 * s, '#c8a066');
  }
  ctx.restore();
}
// Gentle wandering within a tile.
export function wander(t, ph, range = 0.22) {
  const ox = Math.sin(t * 0.11 + ph) * range, oy = Math.cos(t * 0.083 + ph * 1.7) * range * 0.35;
  return [ox, oy, Math.cos(t * 0.11 + ph) >= 0 ? 1 : -1];
}
export function drawFarmAnimals(ctx, x, y, s, wx, wy, t) {
  const h = hash2(wx, wy, 21);
  if (h > 0.6) return;
  const kind = h < 0.22 ? 'sheep' : h < 0.36 ? 'cow' : h < 0.46 ? 'horse' : 'chicken';
  const n = kind === 'chicken' ? 4 : kind === 'sheep' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const ph = hash2(wx + i, wy, 22) * 6.28;
    const [ox, oy, face] = wander(t * (kind === 'chicken' ? 2 : 1), ph, 0.16);
    const bx = x + ((i % 2 ? 0.14 : -0.12) + ox) * s * 64, by = y + (((i >> 1) ? 0.06 : -0.05) + oy) * s * 64;
    drawAnimal(ctx, kind, bx, by, s * 1.2, face, t, ph);
  }
}

// A horse pulling a plough up and down the furrows, with the farmer walking behind.
export function drawPlough(ctx, x, y, s, t, ph) {
  const k = (Math.sin(t * 0.18 + ph) + 1) / 2, face = Math.cos(t * 0.18 + ph) >= 0 ? 1 : -1;
  const hx = x + (k - 0.5) * 34 * s, hy = y + (k - 0.5) * 17 * s + 2 * s;
  drawAnimal(ctx, 'horse', hx, hy, s * 1.15, face, t, ph);
  const px = hx - face * 7 * s, py = hy - face * 3.5 * s;
  ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(0.7, 0.7 * s);
  ctx.beginPath(); ctx.moveTo(hx - face * 3 * s, hy - 4 * s); ctx.lineTo(px, py - 1 * s); ctx.lineTo(px - face * 1.5 * s, py + 1 * s); ctx.stroke();
  const fx = px - face * 3 * s, fy = py - 1.5 * s;
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(fx - 1.3 * s, fy - 5 * s, 2.6 * s, 4 * s);
  ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(fx, fy - 6.3 * s, 1.3 * s, 0, 6.3); ctx.fill();
}

// ---------------- boats ----------------
export function drawBoat(ctx, x, y, s, t, ph, ship, face = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1); ctx.translate(-x, -y);
  const bob = Math.sin(t * 1.6 + ph) * 0.8 * s;
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1.5 * s, (ship ? 9 : 5) * s, 1.3 * s, 0, 0, 6.3); ctx.fill();
  const L = ship ? 9 : 5;
  ctx.fillStyle = ship ? '#6e4a30' : '#8a5a3c';
  ctx.beginPath(); ctx.moveTo(x - L * s, y - 2 * s + bob); ctx.lineTo(x + L * s, y - 2 * s + bob); ctx.lineTo(x + (L - 2) * s, y + 1 * s + bob); ctx.lineTo(x - (L - 2) * s, y + 1 * s + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = Math.max(0.8, 0.7 * s);
  const masts = ship ? [-3, 3] : [0];
  for (const m of masts) {
    ctx.beginPath(); ctx.moveTo(x + m * s, y - 2 * s + bob); ctx.lineTo(x + m * s, y - (ship ? 16 : 10) * s + bob); ctx.stroke();
    ctx.fillStyle = '#f6f0e2';
    ctx.beginPath(); ctx.moveTo(x + (m + 0.6) * s, y - (ship ? 15 : 9) * s + bob); ctx.quadraticCurveTo(x + (m + (ship ? 6 : 5)) * s, y - (ship ? 9 : 6) * s + bob, x + (m + 0.6) * s, y - 3 * s + bob); ctx.fill();
  }
  if (ship) { ctx.fillStyle = '#c0503e'; ctx.fillRect(x + 3 * s, y - 18 * s + bob, 3 * s, 1.6 * s); }
  ctx.restore();
}
const dockWater = new Map();
export function dockBoatSpot(i) {
  if (dockWater.has(i)) return dockWater.get(i);
  const x = i % W, y = Math.floor(i / W);
  let spot = null;
  for (let r = 1; r <= 3 && !spot; r++) for (let dy = -2 * r; dy <= 2 * r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
    const b = world.biome[idxOf(x + dx, y + dy)];
    if (b === B.SHALLOW || b === B.OCEAN) spot = [x + dx, y + dy];
  }
  dockWater.set(i, spot);
  return spot;
}
export const shipAt = (b, x, y) => (b === B.OCEAN || b === B.SHALLOW) && hash2(x, y, 31) < (b === B.OCEAN ? 0.0012 : 0.003);

// ---------------- roads ----------------
// Paths form by themselves from every finished building to its town hall, running along the grid.
// Directions: 0 down-right (+e1), 1 up-left (-e1), 2 down-left (+e2), 3 up-right (-e2).
const STEP = [[0, 1, 1], [-1, 0, -1], [-1, 0, 1], [0, 1, -1]];
const OPP = [1, 0, 3, 2];
export const stepTile = (x, y, d) => [x + ((y & 1) ? STEP[d][1] : STEP[d][0]), y + STEP[d][2]];
export function lPath(ax, ay, bx, by) {
  let dX = tileWX(bx, by) - tileWX(ax, ay); if (dX > W / 2) dX -= W; else if (dX < -W / 2) dX += W;
  const dY = tileWY(by) - tileWY(ay);
  const k1 = Math.round(dX + 2 * dY), k2 = Math.round(2 * dY - dX);
  const out = [[ax, ay]]; let x = ax, y = ay;
  for (let i = 0; i < Math.abs(k1); i++) { [x, y] = stepTile(x, y, k1 > 0 ? 0 : 1); out.push([x, y, k1 > 0 ? 0 : 1]); }
  for (let i = 0; i < Math.abs(k2); i++) { [x, y] = stepTile(x, y, k2 > 0 ? 2 : 3); out.push([x, y, k2 > 0 ? 2 : 3]); }
  return out;
}
export const roads = new Map(); // tile idx -> bitmask of directions
export const roadTown = new Map(); // tile idx -> town id that built the road
let roadsDirty = true;
const markRoads = () => { roadsDirty = true; };
on('built', markRoads); on('change', markRoads); on('improved', markRoads); on('joined', markRoads); on('founded', markRoads);
export function updateRoads() {
  if (!roadsDirty) return;
  roadsDirty = false; roads.clear(); roadTown.clear();
  const halls = new Map(S.towns.map((t) => [t.id, t]));
  for (const [i, b] of S.buildings) {
    if (b.p < 1 || b.t === 'townhall') continue;
    const t = halls.get(b.town); if (!t) continue;
    const p = lPath(i % W, Math.floor(i / W), t.x, t.y);
    for (let k = 1; k < p.length; k++) {
      const [x, y, d] = p[k], [px, py] = p[k - 1];
      const a = idxOf(px, py), c = idxOf(x, y);
      roads.set(a, (roads.get(a) || 0) | (1 << d));
      roads.set(c, (roads.get(c) || 0) | (1 << OPP[d]));
      if (!roadTown.has(a)) roadTown.set(a, t.id);
      if (!roadTown.has(c)) roadTown.set(c, t.id);
    }
  }
}
// Edge midpoints for each direction, as fractions of (half width, half height).
const EDGE = [[0.5, 0.5], [-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5]];
export function addRoad(path, mask, cx, cy, hw, hh) {
  for (let d = 0; d < 4; d++) if (mask & (1 << d)) { path.moveTo(cx, cy); path.lineTo(cx + EDGE[d][0] * hw, cy + EDGE[d][1] * hh); }
}
export function strokeRoads(ctx, path, tw, paved = false) {
  ctx.lineCap = 'round';
  if (paved) {
    ctx.strokeStyle = 'rgba(90,86,80,0.6)'; ctx.lineWidth = tw * 0.19; ctx.stroke(path);
    ctx.strokeStyle = 'rgba(196,190,178,0.98)'; ctx.lineWidth = tw * 0.14; ctx.stroke(path);
    ctx.setLineDash([tw * 0.03, tw * 0.045]); ctx.strokeStyle = 'rgba(140,134,124,0.55)'; ctx.lineWidth = tw * 0.1; ctx.stroke(path); ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = 'rgba(120,92,60,0.55)'; ctx.lineWidth = tw * 0.17; ctx.stroke(path);
    ctx.strokeStyle = 'rgba(206,176,128,0.95)'; ctx.lineWidth = tw * 0.12; ctx.stroke(path);
  }
  ctx.lineCap = 'butt';
}
// A little iron lantern post (drawn at some road tiles in towns with street lanterns).
export function drawLantern(ctx, x, y, s, lit) {
  ctx.strokeStyle = '#3c3a40'; ctx.lineWidth = Math.max(1, 1.1 * s);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 13 * s); ctx.stroke();
  ctx.fillStyle = lit ? '#ffd88a' : '#e8e0c8'; ctx.fillRect(x - 1.6 * s, y - 16 * s, 3.2 * s, 3.2 * s);
  ctx.fillStyle = '#3c3a40'; ctx.fillRect(x - 2 * s, y - 16.8 * s, 4 * s, 1 * s);
}
// Sea routes: a dotted curve across the water with ships sailing along it.
export function drawRoutes(ctx, t, routes, townById, sx, sy, tw) {
  for (const r of routes) {
    const a = townById(r.a), b = townById(r.b); if (!a || !b) continue;
    const ha = harbourOf(a), hb = harbourOf(b); if (!ha || !hb) continue;
    let X1 = tileWX(ha[0], ha[1]), X2 = tileWX(hb[0], hb[1]);
    const Y1 = tileWY(ha[1]), Y2 = tileWY(hb[1]);
    if (X2 - X1 > W / 2) X2 -= W; else if (X1 - X2 > W / 2) X2 += W;
    // bow the route out towards the open sea
    const mx = (X1 + X2) / 2, my = (Y1 + Y2) / 2, len = Math.hypot(X2 - X1, (Y2 - Y1) * 2);
    const cxw = mx - ((Y2 - Y1) * 2 / len) * len * 0.18, cyw = my + ((X2 - X1) / len) * len * 0.09;
    const ax = sx(X1), ay = sy(Y1), bx = ax + (X2 - X1) * tw, by = sy(Y2), cx = ax + (cxw - X1) * tw, cy = sy(cyw);
    const done = r.p >= 1;
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 12;
    ctx.strokeStyle = done ? 'rgba(255,246,220,0.85)' : 'rgba(255,246,220,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    if (done) ctx.quadraticCurveTo(cx, cy, bx, by);
    else { // only the charted part so far
      const n = 24, k = r.p;
      for (let i = 1; i <= n; i++) { const u = (i / n) * k, x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx, y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by; ctx.lineTo(x, y); }
    }
    ctx.stroke(); ctx.restore();
    const ships = done ? [((t * 0.012) % 1), ((t * 0.012 + 0.5) % 1)] : [r.p];
    for (const [k, u0] of ships.entries()) {
      const u = done && k === 1 ? 1 - u0 : u0;
      const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx, y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by;
      const dx = 2 * (1 - u) * (cx - ax) + 2 * u * (bx - cx);
      drawBoat(ctx, x, y, Math.max(0.5, Math.min(1.1, tw / 40)), t, k * 3, true, (dx >= 0) !== (done && k === 1) ? 1 : -1);
    }
  }
}
const harbourCache = new Map();
function harbourOf(t) {
  const c = harbourCache.get(t.id);
  if (c && S.buildings.get(c[2]) && S.buildings.get(c[2]).t === 'harbour') return c;
  for (const [i, b] of S.buildings) if (b.t === 'harbour' && b.town === t.id && b.p >= 1) { const v = [i % W, Math.floor(i / W), i]; harbourCache.set(t.id, v); return v; }
  return null;
}
