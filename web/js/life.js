// The living world: seasons on the map, day and night, weather, animals, boats and roads.
import { W, H, B, world, tileLat, tileWX, tileWY, idxOf } from './world.js';
import { S, on, setStreetCheck, taken, crossing } from './game.js';
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
// The moon: one phase step each night, waxing and waning over eight nights.
export const moonPhase = () => (Math.floor(S.day / SE.CYCLE) % 8) / 8; // 0 new, 0.5 full
export const MOON_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
export const moonIcon = () => MOON_ICONS[Math.floor(S.day / SE.CYCLE) % 8];
const STARS = Array.from({ length: 140 }, (_, k) => [((k * 7919) % 1000) / 1000, ((k * 104729) % 997) / 997, 0.4 + ((k * 31) % 10) / 16, (k * 13) % 7]);
export function drawNight(ctx, cw, ch, lights, tw, waterAt) {
  const raw = daylight(), full = 1 - Math.abs(moonPhase() - 0.5) * 2, n = raw.n * (1 - 0.22 * full), w = raw.w;
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
    const tt = performance.now() / 1000;
    for (const [x, y, k0] of lights) { // candle-light flicker
      const k = k0 * (0.88 + 0.12 * Math.sin(tt * (5 + (x % 7)) + y));
      ctx.drawImage(SPR.glow, x - r * k, y - r * k * 0.8, 2 * r * k, 1.6 * r * k);
    }
    ctx.globalAlpha = 1;
    if (waterAt && n > 0.4) { // the night sky mirrored in still water: stars, and the moon in its phase
      const a = (n - 0.4) / 0.6;
      for (const [fx, fy, b, ph] of STARS) {
        const x = fx * cw, y = fy * ch; if (!waterAt(x, y)) continue;
        const tw2 = 0.55 + 0.45 * Math.sin(tt * (1.3 + ph * 0.3) + ph * 2);
        ctx.fillStyle = `rgba(235,240,255,${a * b * tw2})`; ctx.fillRect(x, y, 1.6, 1.6);
      }
      const mx = cw * 0.72, my = ch * 0.38, mr = Math.max(9, Math.min(22, tw * 0.5)), ph = moonPhase();
      if (ph > 0.06 && ph < 0.94 && waterAt(mx, my)) {
        ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.8;
        ctx.beginPath(); ctx.ellipse(mx, my, mr, mr * 0.55, 0, 0, 6.3); ctx.clip();
        ctx.fillStyle = 'rgb(236,240,252)'; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        // the shadowed part slides across as the moon waxes and wanes
        const off = ph < 0.5 ? -(ph / 0.5) * 2 * mr : (1 - (ph - 0.5) / 0.5) * 2 * mr;
        ctx.fillStyle = 'rgb(46,60,92)'; ctx.beginPath(); ctx.ellipse(mx + off, my, mr, mr * 0.55, 0, 0, 6.3); ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(220,230,255,${0.12 * a * full})`;
        for (let k = 1; k < 6; k++) { const yy = my + mr * 0.6 + k * 4; ctx.fillRect(mx - mr * (1 - k / 7), yy + Math.sin(tt * 2 + k) * 1.2, mr * 2 * (1 - k / 7), 1.2); }
      }
    }
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
  if (S.settings.noweather) { weather.kind = 'clear'; weather.coverTarget = 0.22; weather.rainTarget = 0; weather.rain = 0; weather.until = 0; }
  else if (S.day >= weather.until || weather.until - S.day > 10) rollWeather();
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
  } else if (kind === 'goat') {
    legs(ctx, x, y - 1.8 * s, s, 1.5, 1.8, '#4a3a30', step);
    body(ctx, x, y - 2.8 * s, 2.6 * s, 1.4 * s, '#e8e2d6'); body(ctx, x + 2.6 * s, y - 4 * s, 1.1 * s, 0.9 * s, '#e8e2d6');
    ctx.strokeStyle = '#8a7a68'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(x + 2.4 * s, y - 4.8 * s); ctx.quadraticCurveTo(x + 1.6 * s, y - 6.4 * s, x + 1 * s, y - 6 * s); ctx.stroke();
    ctx.fillStyle = '#c8bca8'; ctx.fillRect(x + 3 * s, y - 3.4 * s, 0.6 * s, 1.2 * s);
  } else if (kind === 'dog') {
    const col = ph % 3 < 1 ? '#a0703c' : ph % 3 < 2 ? '#3c3430' : '#d8c8a8';
    legs(ctx, x, y - 1.6 * s, s, 1.3, 1.6, '#3a2a20', step);
    body(ctx, x, y - 2.2 * s, 2.3 * s, 1.1 * s, col);
    body(ctx, x + 2.4 * s, y - 3.2 * s, 1.1 * s, 0.9 * s, col);
    ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.ellipse(x + 2.1 * s, y - 3.9 * s, 0.5 * s, 0.8 * s, 0.4, 0, 6.3); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 0.7 * s; ctx.beginPath(); ctx.moveTo(x - 2.2 * s, y - 2.5 * s); ctx.lineTo(x - 3.2 * s, y - 3.6 * s + Math.sin(t * 9 + ph) * 0.6 * s); ctx.stroke();
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
export function drawFarmAnimals(ctx, x, y, s, wx, wy, t, pasture = false) {
  const h = hash2(wx, wy, 21);
  if (h > 0.6 && !pasture) return;
  const kind = pasture ? (h < 0.65 ? 'sheep' : 'cow') : h < 0.22 ? 'sheep' : h < 0.36 ? 'cow' : h < 0.46 ? 'horse' : 'chicken';
  const n = kind === 'chicken' ? 4 : kind === 'sheep' ? (pasture ? 4 : 3) : 2;
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
on('built', markRoads); on('change', markRoads); on('improved', markRoads);
// Plan streets as part of the simulation (not only when the screen redraws).
on('stepped', () => updateRoads()); on('joined', markRoads); on('founded', markRoads);
// Each town grows a branching road network outward from its hall over open ground only,
// so roads never run under buildings. Every building connects at the free tile by its door.
let prevRoadKeys = [];
export const isStreet = (i) => roads.has(i) && !taken(i);
const net = new Map(); // townId -> { parent: Map(idx -> parentIdx), conn: Map(buildingIdx -> connectorIdx), hall }
export function updateRoads() {
  if (!roadsDirty) return;
  roadsDirty = false; prevRoadKeys = [...roads.keys()]; roads.clear(); roadTown.clear(); net.clear();
  const byTown = new Map();
  for (const [i, b] of S.buildings) if (b.p >= 1 && b.t !== 'townhall') { if (!byTown.has(b.town)) byTown.set(b.town, []); byTown.get(b.town).push(i); }
  const mark = (a, d, tid) => { roads.set(a, (roads.get(a) || 0) | (1 << d)); if (!roadTown.has(a)) roadTown.set(a, tid); };
  const prevRoads = new Set(prevRoadKeys);
  for (const t of S.towns) {
    const hall = idxOf(t.x, t.y), R = Math.max(4, t.radius - 0.5) ** 2; // streets stay inside the town's border
    // Cheapest paths outward from the hall: existing streets are cheapest, then open ground,
    // then zoned-but-unbuilt tiles (streets may claim those). Buildings are never crossed.
    const passable = (i, x, y) => i === hall || ((!taken(i) || crossing(i)) && (!S.walls || !S.walls.has(i) || prevRoads.has(i) || S.proads.has(i)) && world.biome[i] > 2 && !nbExtraHas(i) && groundD2(x, y, t.x, t.y) <= R);
    // Main streets: a short straight street out of each side of the hall, kept free from the start,
    // so a town always has a tidy square and its hall is never walled in.
    // they start as a little square round the hall and lengthen as the town fills in
    const spine = new Set(), mainLen = Math.max(1, Math.min(4, Math.floor((t.n || 0) / 5)));
    for (let d = 0; d < 4; d++) {
      let x = t.x, y = t.y, prev = hall;
      for (let k = 0; k < mainLen; k++) {
        const [nx, ny] = stepTile(x, y, d); if (ny < 1 || ny >= H - 1) break;
        const ni = idxOf(nx, ny);
        if (!passable(ni, nx, ny) || world.river[ni]) break;
        spine.add(ni); if (S.zones.has(ni)) S.zones.delete(ni);
        mark(prev, d, t.id); mark(ni, OPP[d], t.id);
        x = nx; y = ny; prev = ni;
      }
    }
    const cost = (i) => (spine.has(i) || prevRoads.has(i) || S.proads.has(i) ? 1 : S.zones.has(i) ? 5 : 2);
    const dist = new Map([[hall, 0]]), parent = new Map([[hall, -1]]), pdir = new Map();
    const buckets = [[hall]];
    for (let c = 0; c < buckets.length; c++) {
      const bucket = buckets[c]; if (!bucket) continue;
      for (const i of bucket) {
        if (dist.get(i) !== c) continue;
        const x = i % W, y = Math.floor(i / W);
        for (let d = 0; d < 4; d++) {
          const [nx, ny] = stepTile(x, y, d); if (ny < 1 || ny >= H - 1) continue;
          const ni = idxOf(nx, ny);
          if (!passable(ni, nx, ny)) continue;
          const nd = c + cost(ni) + (pdir.has(i) && pdir.get(i) !== d ? 1 : 0); // turns cost a little, so streets run straight
          if (dist.has(ni) && dist.get(ni) <= nd) continue;
          dist.set(ni, nd); parent.set(ni, i); pdir.set(ni, d);
          (buckets[nd] ||= []).push(ni);
        }
      }
    }
    const conn = new Map();
    const blds = (byTown.get(t.id) || []).sort((a, b) => groundD2(a % W, Math.floor(a / W), t.x, t.y) - groundD2(b % W, Math.floor(b / W), t.x, t.y));
    for (const bi of blds) {
      const bx = bi % W, by = Math.floor(bi / W);
      let best = -1, bd = Infinity, bdir = 0;
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = stepTile(bx, by, d), ni = idxOf(nx, ny);
        if (dist.has(ni) && dist.get(ni) < bd) { bd = dist.get(ni); best = ni; bdir = OPP[d]; }
      }
      if (best < 0) continue;
      conn.set(bi, best);
      mark(best, bdir, t.id); // a short drive up to the door
      for (let i = best; i !== hall; i = parent.get(i)) {
        const d = pdir.get(i), pi = parent.get(i);
        if (S.zones.has(i)) S.zones.delete(i); // the street claims this zoned tile
        mark(i, OPP[d], t.id); mark(pi, d, t.id);
      }
    }
    net.set(t.id, { parent, conn, hall });
  }
  extraRoads((i, d) => { roads.set(i, (roads.get(i) || 0) | (1 << d)); if (!roadTown.has(i)) roadTown.set(i, -1); });
  // Roads painted by the player: join each to any road beside it (a lone tile still shows as a little square).
  for (const i of S.proads) {
    if (taken(i) && !crossing(i)) { S.proads.delete(i); continue; }
    const x = i % W, y = Math.floor(i / W);
    let m = roads.get(i) || 0;
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = stepTile(x, y, d), ni = idxOf(nx, ny);
      if (S.proads.has(ni) || (roads.has(ni) && (!taken(ni) || crossing(ni)))) { m |= 1 << d; roads.set(ni, (roads.get(ni) || 0) | (1 << OPP[d])); if (!roadTown.has(ni)) roadTown.set(ni, -1); }
    }
    roads.set(i, m || 16); if (!roadTown.has(i)) roadTown.set(i, -1);
  }
}
let extraRoads = () => {};
export function setExtraRoads(f) { extraRoads = f; roadsDirty = true; }
// Tiles along the road from a building's doorstep to its town hall (or null if it has no road).
export function routeToHall(tid, bi) {
  const n = net.get(tid); if (!n) return null;
  if (bi === n.hall) return [n.hall];
  const c = n.conn.get(bi); if (c == null) return null;
  const out = [];
  for (let i = c, g = 0; i !== -1 && g < 4000; i = n.parent.get(i), g++) out.push(i);
  return out;
}
const groundD2 = (ax, ay, bx, by) => { let dx = tileWX(ax, ay) - tileWX(bx, by); if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W; const dy = (tileWY(ay) - tileWY(by)) * 2; return dx * dx + dy * dy; };
let nbExtraHas = () => false;
export function setExtraLookup(f) { nbExtraHas = f; }

// Edge midpoints for each direction, as fractions of (half width, half height).
const EDGE = [[0.5, 0.5], [-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5]];
// One tile of road: straight runs and crossings go through the centre, bends curve smoothly from edge to edge.
export function addRoad(path, mask, cx, cy, hw, hh) {
  if (mask === 16) { path.moveTo(cx - hw * 0.12, cy); path.lineTo(cx + hw * 0.12, cy); return; } // a lone painted road tile
  const m = mask & 15;
  // exactly two directions that are not opposite (0/1 and 2/3 are opposites): a bend
  if (m === 5 || m === 6 || m === 9 || m === 10) {
    const a = m & 3 ? (m & 1 ? 0 : 1) : 0, b = m & 4 ? 2 : 3;
    path.moveTo(cx + EDGE[a][0] * hw, cy + EDGE[a][1] * hh);
    path.quadraticCurveTo(cx, cy, cx + EDGE[b][0] * hw, cy + EDGE[b][1] * hh);
    return;
  }
  for (let d = 0; d < 4; d++) if (m & (1 << d)) { path.moveTo(cx, cy); path.lineTo(cx + EDGE[d][0] * hw, cy + EDGE[d][1] * hh); }
}
// Layered strokes: a soft grassy verge, a worn edge, the road bed and a little texture on top.
export function strokeRoads(ctx, path, tw, paved = false) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const fine = tw >= 22;
  if (fine) { ctx.strokeStyle = 'rgba(60,80,36,0.16)'; ctx.lineWidth = tw * 0.25; ctx.stroke(path); }
  if (paved) {
    ctx.strokeStyle = 'rgba(112,106,96,0.85)'; ctx.lineWidth = tw * 0.19; ctx.stroke(path);
    ctx.strokeStyle = '#d3ccbe'; ctx.lineWidth = tw * 0.155; ctx.stroke(path);
    if (fine) {
      ctx.setLineDash([tw * 0.028, tw * 0.022]); ctx.strokeStyle = 'rgba(150,142,128,0.6)'; ctx.lineWidth = tw * 0.12; ctx.stroke(path);
      ctx.setLineDash([tw * 0.018, tw * 0.032]); ctx.strokeStyle = 'rgba(236,232,222,0.7)'; ctx.lineWidth = tw * 0.06; ctx.stroke(path); ctx.setLineDash([]);
    }
  } else {
    ctx.strokeStyle = 'rgba(124,94,60,0.62)'; ctx.lineWidth = tw * 0.165; ctx.stroke(path);
    ctx.strokeStyle = '#d4b688'; ctx.lineWidth = tw * 0.13; ctx.stroke(path);
    if (fine) {
      ctx.strokeStyle = 'rgba(238,220,180,0.75)'; ctx.lineWidth = tw * 0.04; ctx.stroke(path); // worn middle
      ctx.setLineDash([tw * 0.012, tw * 0.06]); ctx.strokeStyle = 'rgba(140,108,72,0.55)'; ctx.lineWidth = tw * 0.1; ctx.stroke(path); ctx.setLineDash([]); // pebbles
    }
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
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

setStreetCheck((i) => isStreet(i));
