// Isometric renderer with an overview (atlas) mode for far zoom levels.
import { BIOMES, W, H, B, world, wrapX, tileWX, tileWY, biomeAt, isWater } from './world.js';
import { SPR, TB, DECOR_DENSITY } from './sprites.js';
import { S, M, DEFS, ZONES, townById, canPlace, canZone, canFound, canStart, ownerOf, groundDist2, CONTACT_RANGE, inContact } from './game.js';
import { hash2 } from './noise.js';
import { idxOf } from './world.js';
import * as L from './life.js';
import { styleAt } from './regions.js';
import { nbExtra } from './game.js';
const MOOD_FACES = ['🙂', '😊', '😄'];

export const TILE_MODE_TW = 20;
const LIT = new Set(['stable', 'house', 'townhall', 'workshop', 'market', 'tower', 'dock', 'library', 'cathedral', 'greatcastle', 'lighthouse', 'lumber', 'harbour', 'fountain',
  'chapel', 'tavern', 'school', 'bakery', 'brewery', 'weaver', 'smithy', 'windmill', 'monastery', 'bridge', 'observatory', 'dome', 'icehut', 'well']);
export const MAX_TW = 160;
const OCEAN = '#2e628c';

let canvas, ctx, cw = 0, ch = 0, dpr = 1;
export const cam = S.cam;
export let dirty = true;
export const markDirty = () => { dirty = true; };

export function initRender(c) {
  canvas = c; ctx = c.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);
}
export function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3); // sharp on high-density phones like the S26 Ultra
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  clampCam(); dirty = true;
}
export const minTW = () => Math.max(ch / 1000, cw / 2000) * 0.98;
export function clampCam() {
  cam.tw = Math.max(minTW(), Math.min(MAX_TW, cam.tw));
  cam.x = ((cam.x % W) + W) % W;
  // Let the map scroll a little past its top and bottom so the far north and south
  // never hide under the top bar, goods row or bottom toolbar.
  const halfH = ch / 2 / cam.tw;
  const hudShown = typeof document !== 'undefined' && !document.querySelector('#hud').classList.contains('hidden');
  const hudB = hudShown ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-bottom')) || 110) + 10 : 10;
  const sb = document.querySelector('#startbar');
  const padBottom = hudShown ? 96 : sb && !sb.classList.contains('hidden') ? sb.getBoundingClientRect().height + 20 : 10;
  const minY = halfH - hudB / cam.tw, maxY = 1000 - halfH + padBottom / cam.tw;
  cam.y = minY > maxY ? (minY + maxY) / 2 : Math.max(minY, Math.min(maxY, cam.y));
}
export const screenSize = () => ({ cw, ch });

// --- coordinate transforms (world units = tile widths) ---
export function sx(X) { let d = X - cam.x; if (d > W / 2) d -= W; else if (d < -W / 2) d += W; return d * cam.tw + cw / 2; }
export const sy = (Y) => (Y - cam.y) * cam.tw + ch / 2;
export const toWorld = (px, py) => ({ X: (px - cw / 2) / cam.tw + cam.x, Y: (py - ch / 2) / cam.tw + cam.y });
export function pickTile(px, py) {
  const { X, Y } = toWorld(px, py);
  const r0 = Math.round((Y - 0.25) / 0.25);
  let best = null, bm = Infinity;
  for (let y = r0 - 2; y <= r0 + 2; y++) {
    if (y < 0 || y >= H) continue;
    const off = (y & 1) * 0.5, x = Math.round(X - 0.5 - off);
    const dx = Math.abs(X - (x + 0.5 + off)) / 0.5, dy = Math.abs(Y - tileWY(y)) / 0.25, m = dx + dy;
    if (m < bm) { bm = m; best = { x: wrapX(x), y }; }
  }
  return best;
}
export function centerOn(x, y, tw) { cam.x = tileWX(x, y); cam.y = tileWY(y); if (tw) cam.tw = tw; clampCam(); dirty = true; }

// --- smooth camera flights ---
let flight = null;
export function flyTo(x, y, tw, dur = 1.2) {
  let tx = x == null ? cam.x : tileWX(x, y); const ty = y == null ? cam.y : tileWY(y);
  let d = tx - cam.x; if (d > W / 2) tx -= W; else if (d < -W / 2) tx += W;
  flight = { t: 0, dur, x0: cam.x, y0: cam.y, z0: Math.log(cam.tw), x1: tx, y1: ty, z1: Math.log(tw ?? cam.tw) };
}
export function panBy(dxPx, dyPx, dur = 0.4) {
  flight = { t: 0, dur, x0: cam.x, y0: cam.y, z0: Math.log(cam.tw), x1: cam.x + dxPx / cam.tw, y1: cam.y + dyPx / cam.tw, z1: Math.log(cam.tw) };
}
export const cancelFlight = () => { flight = null; };
function stepFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.dur);
  const e = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
  cam.x = flight.x0 + (flight.x1 - flight.x0) * e; cam.y = flight.y0 + (flight.y1 - flight.y0) * e;
  cam.tw = Math.exp(flight.z0 + (flight.z1 - flight.z0) * e);
  clampCam(); dirty = true;
  if (flight.t >= 1) flight = null;
}

// --- villagers walking about (visual only) ---
export const walkers = new Map(); // townId -> array (exported for tests)
// Each walker is one of the town's named villagers (who is out and about depends on the hour).
function pickFolk(t) {
  const f = t.folk; if (!f || !f.length) return 0;
  return f[Math.floor(Math.random() * f.length)].i;
}
// The walker under a screen point, if any (for tapping someone to meet them).
export function walkerAt(px, py) {
  const s = cam.tw / TB; let best = null, bd = (14 * Math.max(1, s)) ** 2;
  for (const [tid, ws] of walkers) for (const w of ws) {
    const dx = sx(w.X) - px, dy = sy(w.Y) - 5 * s - py, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = { town: tid, pid: w.pid, w }; }
  }
  return best;
}
const CLOTHES = ['#c0503e', '#4a78a8', '#5a9a5a', '#d9a440', '#8a5aa8', '#e8e0d0', '#7a5634'];
function townTiles(t) {
  const arr = [];
  for (const [i, b] of S.buildings) if (b.town === t.id && b.p >= 1) arr.push(i);
  return arr;
}
const tileCache = new Map(); let tileCacheStamp = -1;
const stableTowns = new Set();
const HORSE_COLS = ['#8a5a3a', '#5a3e2c', '#c8a070', '#3c3430', '#e8e0d0'];
export function invalidateTowns() { tileCacheStamp = -1; }
// Ground distance between two world points (undo the 2:1 iso squash).
const gdist = (ax, ay, bx, by) => Math.hypot(bx - ax, (by - ay) * 2);
// Open ground people may walk across; every other building is solid (people go inside instead).
const OPEN = new Set(['farm', 'green', 'fountain', 'apiary', 'vineyard', 'riceterrace', 'oasis', 'cacao', 'orchard', 'quarry', 'smithy', 'dock', 'market']);
function tileSpot(i, nearX) {
  const x = i % W, y = Math.floor(i / W);
  const b = S.buildings.get(i), solid = b && !OPEN.has(b.t);
  // at a solid building, stand by the front door; on open ground, anywhere
  let X = tileWX(x, y) + (Math.random() - 0.5) * (solid ? 0.18 : 0.35);
  let Y = tileWY(y) + (solid ? 0.15 + Math.random() * 0.04 : 0.04 + (Math.random() - 0.5) * 0.1);
  if (X - nearX > W / 2) X -= W; else if (nearX - X > W / 2) X += W; // stay on the same side of the date line
  return [X, Y];
}
// Plan a walk along the iso grid (like following streets): one leg on each axis.
// Villagers walk the roads: from where they are to the town hall, then out to their next stop.
const LANE = 0.07;
function planWalk(w, tiles, t) {
  const target = tiles[Math.floor(Math.random() * tiles.length)];
  const hall = idxOf(t.x, t.y);
  const tilesPath = [];
  const leg = (from, to, reverse) => {
    let p = L.lPath(from % W, Math.floor(from / W), to % W, Math.floor(to / W));
    if (reverse) p = p.slice().reverse();
    for (const [x, y] of p) tilesPath.push([x, y]);
  };
  const here = w.tile ?? hall;
  if (here !== hall) leg(here, hall, false);
  if (target !== hall) leg(target, hall, true);
  if (!tilesPath.length) tilesPath.push([t.x, t.y]);
  const pts = [[w.X, w.Y]];
  let lastX = w.X;
  for (const [x, y] of tilesPath) {
    let X = tileWX(x, y) + w.lx;
    if (X - lastX > W / 2) X -= W; else if (lastX - X > W / 2) X += W;
    pts.push([X, tileWY(y) + 0.03 + w.ly]); lastX = X;
  }
  // a little wander at the destination so people don't stack on one spot
  const end = pts[pts.length - 1];
  pts.push([end[0] + (Math.random() - 0.5) * 0.3, end[1] + (Math.random() - 0.5) * 0.08]);
  w.pts = pts; w.seg = []; w.len = 0;
  for (let k = 1; k < pts.length; k++) { const d = gdist(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]); w.seg.push(d); w.len += d; }
  w.d = 0; w.k = 0; w.dest = target;
}
function updateWalkers(dt, visibleTowns) {
  if (tileCacheStamp !== S.buildings.size) {
    tileCache.clear(); tileCacheStamp = S.buildings.size; stableTowns.clear();
    for (const b of S.buildings.values()) if (b.t === 'stable' && b.p >= 1) stableTowns.add(b.town);
  }
  const pace = 1;
  for (const t of visibleTowns) {
    if (!tileCache.has(t.id)) tileCache.set(t.id, townTiles(t));
    const tiles = tileCache.get(t.id);
    if (tiles.length < 1) continue;
    let ws = walkers.get(t.id);
    if (!ws) walkers.set(t.id, (ws = []));
    const night = L.daylight().n;
    const want = Math.round(Math.min(28, Math.ceil(t.pop / 2)) * (1 - night * 0.75)); // most folk are home at night
    while (ws.length < want) {
      const tile = tiles[Math.floor(Math.random() * tiles.length)];
      const [X, Y] = tileSpot(tile, tileWX(t.x, t.y));
      const ride = stableTowns.has(t.id) && Math.random() < 0.28; // with stables, some folk ride or drive a cart
      ws.push({ pid: pickFolk(t), X, Y, tile, pts: null, wait: Math.random() * 3, sp: (0.32 + Math.random() * 0.18) * (ride ? 2.2 : 1), face: 1,
        rider: ride, cart: ride && Math.random() < 0.35, hc: HORSE_COLS[Math.floor(Math.random() * HORSE_COLS.length)],
        lx: (Math.random() - 0.5) * LANE, ly: (Math.random() - 0.5) * LANE * 0.4,
        c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], carry: Math.random() < 0.3, ph: Math.random() * 6, moving: false });
    }
    if (ws.length > want) ws.length = want;
    for (const w of ws) {
      w.moving = false;
      if (w.wait > 0) { w.wait -= dt * pace; continue; }
      if (!w.pts) { planWalk(w, tiles, t); if (w.len < 0.05) { w.pts = null; w.wait = 1; continue; } }
      w.d += dt * w.sp * pace;
      while (w.k < w.seg.length - 1 && w.d > w.seg[w.k]) { w.d -= w.seg[w.k]; w.k++; }
      const a = w.pts[w.k], b = w.pts[w.k + 1], f = Math.min(1, w.seg[w.k] ? w.d / w.seg[w.k] : 1);
      const nx = a[0] + (b[0] - a[0]) * f, ny = a[1] + (b[1] - a[1]) * f;
      if (w.k >= w.seg.length - 1 && f >= 1) { w.pts = null; w.tile = w.dest; w.wait = 0.8 + Math.random() * 3; } // arrived: linger a moment
      if (Math.abs(nx - w.X) > 1e-4) w.face = nx > w.X ? 1 : -1;
      w.X = nx; w.Y = ny; w.moving = !!w.pts;
      if (w.moving) w.ph += dt * 9 * pace;
    }
  }
}
// The tile containing a world point, and how deep inside it the point is (0 = centre, 1 = edge).
function tileOfWorld(X, Y) {
  const r0 = Math.round((Y - 0.25) / 0.25);
  let best = null, bm = Infinity;
  for (let y = r0 - 1; y <= r0 + 1; y++) {
    if (y < 0 || y >= H) continue;
    const off = (y & 1) * 0.5, x = Math.round(X - 0.5 - off);
    const m = Math.abs(X - (x + 0.5 + off)) / 0.5 + Math.abs(Y - tileWY(y)) / 0.25;
    if (m < bm) { bm = m; best = [wrapX(x), y, m]; }
  }
  return best;
}
// Sort walkers into the map rows they stand in, so buildings in front hide them correctly.
// Anyone deep inside a solid building's tile is indoors, and not drawn at all.
let walkerRows = new Map();
function bucketWalkers(visibleTowns) {
  walkerRows = new Map();
  for (const t of visibleTowns) {
    const ws = walkers.get(t.id); if (!ws) continue;
    for (const w of ws) {
      const tl = tileOfWorld(w.X, w.Y); if (!tl) continue;
      const b = S.buildings.get(tl[1] * W + tl[0]);
      if (b && !OPEN.has(b.t) && tl[2] < 0.62) continue; // indoors
      if (!walkerRows.has(tl[1])) walkerRows.set(tl[1], []);
      walkerRows.get(tl[1]).push(w);
    }
  }
}
function drawRowWalkers(y) {
  const ws = walkerRows.get(y); if (!ws) return;
  ws.sort((a, b) => a.Y - b.Y);
  drawWalkerList(ws);
}
function drawWalkers(visibleTowns) {
  for (const t of visibleTowns) { const ws = walkers.get(t.id); if (ws) drawWalkerList(ws); }
}
function drawWalkerList(ws) {
  const s = cam.tw / TB;
  {
    for (const w of ws) {
      const x = sx(w.X), y = sy(w.Y);
      if (x < -20 || x > cw + 20 || y < -20 || y > ch + 20) continue;
      const step = w.moving ? Math.sin(w.ph) : 0, bob = Math.abs(step) * 0.7 * s;
      if (w.rider) { // on horseback, or driving a little cart
        if (w.cart) {
          const bx = x - w.face * 8 * s;
          ctx.fillStyle = 'rgba(30,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(bx, y, 4.5 * s, 1.6 * s, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#9a7048'; ctx.fillRect(bx - 4 * s, y - 5 * s, 8 * s, 3 * s);
          ctx.fillStyle = '#c8a070'; ctx.fillRect(bx - 3 * s, y - 7.5 * s, 3 * s, 2.5 * s); ctx.fillStyle = '#7aa04a'; ctx.fillRect(bx + 0.3 * s, y - 7 * s, 2.6 * s, 2 * s);
          ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(bx - 2 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.arc(bx + 2.4 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.fill();
          ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(0.7, 0.6 * s); ctx.beginPath(); ctx.moveTo(bx + w.face * 4 * s, y - 4 * s); ctx.lineTo(x, y - 4.4 * s); ctx.stroke();
        }
        L.drawAnimal(ctx, 'horse', x, y, s * 1.15, w.face, animTime * (w.moving ? 1.6 : 0), w.ph);
        if (!w.cart) {
          ctx.fillStyle = w.c; ctx.fillRect(x - 1.5 * s, y - 11.5 * s - bob, 3 * s, 4.2 * s);
          ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x + w.face * 0.3 * s, y - 12.9 * s - bob, 1.5 * s, 0, 6.3); ctx.fill();
        } else {
          const bx = x - w.face * 8 * s;
          ctx.fillStyle = w.c; ctx.fillRect(bx + w.face * 2 * s - 1.4 * s, y - 10.5 * s, 2.8 * s, 3.6 * s);
          ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(bx + w.face * 2 * s, y - 11.8 * s, 1.4 * s, 0, 6.3); ctx.fill();
        }
        continue;
      }
      ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 2.4 * s, 1.1 * s, 0, 0, 6.3); ctx.fill();
      // legs
      ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = Math.max(0.8, 0.9 * s);
      ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y - 1.6 * s - bob); ctx.lineTo(x - 0.6 * s + step * 1.1 * s, y);
      ctx.moveTo(x + 0.6 * s, y - 1.6 * s - bob); ctx.lineTo(x + 0.6 * s - step * 1.1 * s, y); ctx.stroke();
      ctx.fillStyle = w.c; ctx.fillRect(x - 1.6 * s, y - 6 * s - bob, 3.2 * s, 4.6 * s);
      ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x + w.face * 0.3 * s, y - 7.6 * s - bob, 1.6 * s, 0, 6.3); ctx.fill();
      if (w.carry) { ctx.fillStyle = '#b08a52'; ctx.fillRect(x + (w.face > 0 ? 0.6 : -3.2) * s, y - 9.5 * s - bob, 2.6 * s, 2.2 * s); }
    }
  }
}

// --- drawing helpers ---
function drawSprite(spr, x, y, s, alpha) {
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(spr.c, x - spr.ax * s, y - spr.ay * s, spr.w * s, spr.h * s);
  if (alpha !== undefined) ctx.globalAlpha = 1;
}
function diamondPath(p, x, y, hw, hh) { p.moveTo(x, y - hh); p.lineTo(x + hw, y); p.lineTo(x, y + hh); p.lineTo(x - hw, y); p.closePath(); }
function buildingSprite(b, x, y) {
  if (b.p < 1) return SPR.build.scaffold[0];
  if (b.t === 'townhall') {
    const t = townById(b.town);
    return t && t.capital ? SPR.build.castle[S.tier] : SPR.build.townhall[0];
  }
  if (b.t === 'house') {
    const t = townById(b.town);
    const arr = SPR.homes[t ? townStyle(t) : 'temperate'][(b.lv || 1) - 1];
    return arr[Math.floor(hash2(x, y, 3) * arr.length)];
  }
  const arr = SPR.build[b.t];
  return arr[Math.floor(hash2(x, y, 3) * arr.length)];
}
// A town keeps the style of the place it was founded.
export function townStyle(t) { return t.style || (t.style = styleAt(t.x, t.y)); }
function label(text, x, y, size = 12, sub) {
  ctx.font = `600 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(40,34,28,0.62)';
  roundRect(x - w / 2, y - size - 4, w, size + 8, (size + 8) / 2); ctx.fill();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - size / 2);
  if (sub) { ctx.font = `500 ${size - 2}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,246,228,0.95)'; ctx.fillText(sub, x, y + size / 2 + 2); }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

export let hoverTile = null;
export const setHover = (t) => { hoverTile = t; dirty = true; };

// --- main draw ---
let lastT = performance.now(), animTime = 0, ambientT = 0, lastDraw = 0;
const lights = []; // window glows collected while drawing, lit up at night
export const getAnimTime = () => animTime;
export function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; animTime += dt;
  stepFlight(dt);
  const tileMode = cam.tw >= TILE_MODE_TW;
  const visTowns = tileMode && cam.tw >= 30 ? S.towns.filter((t) => Math.abs(sx(tileWX(t.x, t.y)) - cw / 2) < cw / 2 + t.radius * cam.tw && Math.abs(sy(tileWY(t.y)) - ch / 2) < ch / 2 + t.radius * cam.tw) : [];
  if (visTowns.length) { updateWalkers(dt, visTowns); dirty = true; }
  L.updateWeather(dt);
  L.updateRoads();
  // Clouds, animals and water move gently all the time; redraw for them at up to 30 fps.
  ambientT += dt;
  if (ambientT >= 1 / 30) { ambientT = 0; dirty = true; }
  if (!dirty || !world.ready) return;
  const fdt = now - lastDraw > 200 ? 0 : (now - lastDraw) / 1000; lastDraw = now;
  dirty = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = OCEAN; ctx.fillRect(0, 0, cw, ch);
  lights.length = 0;
  if (tileMode) { bucketWalkers(visTowns); drawTiles(); } else drawOverview();
  if (visTowns.length && !tileMode) drawWalkers(visTowns);
  if (S.routes && S.routes.length) L.drawRoutes(ctx, animTime, S.routes, townById, sx, sy, cam.tw);
  L.drawClouds(ctx, animTime, cam, cw, ch, sx, sy, tileMode);
  L.drawBirds(ctx, animTime, cam, cw, ch, sx, sy);
  if (tileMode) L.drawFalling(ctx, fdt, cw, ch, L.fallingSnow(Math.max(0, Math.min(H - 1, Math.round(cam.y / 0.25)))));
  L.drawNight(ctx, cw, ch, lights, cam.tw);
  drawLabels(tileMode);
}

function drawOverview() {
  const tw = cam.tw;
  ctx.imageSmoothingEnabled = tw < 4;
  const left = sx(0) - (sx(0) > cw ? W * tw : 0);
  const top = sy(0);
  for (let k = -1; k <= 1; k++) {
    const dx = left + k * W * tw;
    if (dx > cw || dx + W * tw < 0) continue;
    ctx.drawImage(world.overview, dx, top, W * tw, 1000 * tw);
  }
  ctx.imageSmoothingEnabled = true;
  L.drawOverviewSeasons(ctx, left, top, tw, cw);
  // territories
  for (const t of S.towns) {
    const x = sx(tileWX(t.x, t.y)), y = sy(tileWY(t.y));
    ctx.fillStyle = 'rgba(255,214,120,0.22)'; ctx.strokeStyle = 'rgba(255,226,150,0.95)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(3, t.radius * tw), Math.max(1.5, t.radius * tw / 2), 0, 0, 6.3); ctx.fill(); ctx.stroke();
  }
  // contact range while founding or when zoomed in a bit
  if (M.mode && M.mode.kind === 'found') {
    for (const t of S.towns) {
      const x = sx(tileWX(t.x, t.y)), y = sy(tileWY(t.y));
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, (t.radius + 3) * tw, (t.radius + 3) * tw / 2, 0, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // buildings as dots when close enough
  if (tw >= 5) {
    for (const [i, b] of S.buildings) {
      const x0 = i % W, y0 = Math.floor(i / W);
      const x = sx(tileWX(x0, y0)), y = sy(tileWY(y0));
      if (x < -5 || x > cw + 5 || y < -5 || y > ch + 5) continue;
      ctx.fillStyle = b.t === 'house' ? '#c0603e' : b.t === 'farm' ? '#e0c050' : b.t === 'townhall' ? '#fff' : '#8a6a4a';
      const r = Math.max(1.2, tw * 0.35); ctx.fillRect(x - r, y - r / 2, r * 2, r);
    }
  }
  // neighbour villages
  if (tw >= 1.6) {
    for (const n of S.neighbors) {
      if (n.joined) continue;
      const x = sx(tileWX(n.x, n.y)), y = sy(tileWY(n.y));
      if (x < -10 || x > cw + 10 || y < -10 || y > ch + 10) continue;
      const r = Math.min(5, 1.5 + tw * 0.25);
      ctx.fillStyle = `hsl(${n.hue},45%,${n.friend >= 100 ? 70 : 55}%)`; ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); ctx.stroke();
    }
  }
  // town markers
  for (const t of S.towns) {
    const x = sx(tileWX(t.x, t.y)), y = sy(tileWY(t.y));
    const spr = t.capital ? SPR.build.castle[S.tier] : SPR.build.townhall[0];
    lights.push([x, y - 4, Math.min(1.6, 0.5 + t.pop / 200)]);
    const s = Math.max(0.35, Math.min(0.7, tw / 20));
    drawSprite(spr, x, y, s);
  }
  if (M.selected) {
    const { x: tx, y: ty } = M.selected;
    const x = sx(tileWX(tx, ty)), y = sy(tileWY(ty));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.3); ctx.stroke();
  }
}

// Ownership cache for visible region
function drawTiles() {
  const tw = cam.tw, s = tw / TB, hw = tw / 2, hh = tw / 4;
  const X0 = cam.x - cw / 2 / tw - 1, X1 = cam.x + cw / 2 / tw + 1;
  const Y0 = cam.y - ch / 2 / tw, Y1 = cam.y + ch / 2 / tw;
  const yA = Math.max(0, Math.floor((Y0 - 0.25) / 0.25) - 2);
  const yB = Math.min(H - 1, Math.ceil((Y1 - 0.25) / 0.25) + 8);
  const mode = M.mode;
  const showOwn = S.towns.length > 0;
  const placing = mode && (mode.kind === 'build' || mode.kind === 'zone');

  // Pre-compute owners for visible tiles (towns are few).
  const nearTowns = S.towns.filter((t) => {
    const X = tileWX(t.x, t.y), Y = tileWY(t.y);
    let dx = Math.abs(X - cam.x); if (dx > W / 2) dx = W - dx;
    return dx < cw / 2 / tw + t.radius + 2 && Math.abs(Y - cam.y) < ch / 2 / tw + t.radius + 2;
  });
  const own = (x, y) => {
    for (const t of nearTowns) if (groundDist2(x, y, t.x, t.y) <= t.radius * t.radius) return t.id;
    return 0;
  };

  // Pass 1: ground
  const tint = new Path2D(), border = new Path2D(), valid = new Path2D(), invalid = new Path2D(), roadPath = new Path2D(), pavedPath = new Path2D();
  const isPaved = (i) => { const t = townById(L.roadTown.get(i)); return !!(t && t.imp && t.imp.paved); };
  let anyRoad = false;
  let anyOwn = false;
  for (let y = yA; y <= yB; y++) {
    const off = (y & 1) * 0.5, cy = sy(tileWY(y));
    const xa = Math.floor(X0 - off - 0.5), xb = Math.ceil(X1 - off);
    const rowBase = y * W;
    const rs = L.rowSeason(y);
    for (let x = xa; x <= xb; x++) {
      const wx = ((x % W) + W) % W;
      const b = world.biome[rowBase + wx];
      const cx = sx(x + 0.5 + off);
      if (b !== B.OCEAN) {
        const arr = L.tileSnowy(wx, y, b, rs) && SPR.groundSnow[b] ? SPR.groundSnow[b] : SPR.ground[b];
        drawSprite(arr[(hash2(wx, y, 1) * 4) | 0], cx, cy, s);
        const rm = b > 2 ? L.roads.get(rowBase + wx) : 0;
        if (rm) { L.addRoad(isPaved(rowBase + wx) ? pavedPath : roadPath, rm, cx, cy, hw, hh); anyRoad = true; }
      }
      if (showOwn && nearTowns.length && b > 2) {
        const o = own(wx, y);
        if (o) {
          anyOwn = true;
          diamondPath(tint, cx, cy, hw, hh);
          const o1 = y & 1;
          // edges: up-left, up-right, down-right, down-left
          if (own(wx - 1 + o1, y - 1) !== o) { border.moveTo(cx - hw, cy); border.lineTo(cx, cy - hh); }
          if (own(wx + o1, y - 1) !== o) { border.moveTo(cx, cy - hh); border.lineTo(cx + hw, cy); }
          if (own(wx + o1, y + 1) !== o) { border.moveTo(cx + hw, cy); border.lineTo(cx, cy + hh); }
          if (own(wx - 1 + o1, y + 1) !== o) { border.moveTo(cx, cy + hh); border.lineTo(cx - hw, cy); }
          if (placing && y <= yB - 6) {
            const ok = mode.kind === 'zone' ? (mode.zone === 'erase' ? S.zones.has(rowBase + wx) : canZone(wx, y)) : canPlace(mode.type, wx, y).ok;
            if (ok) { valid.moveTo(cx + Math.max(1.8, tw * 0.042), cy); valid.arc(cx, cy, Math.max(1.8, tw * 0.042), 0, 6.283); }
          }
        }
      }
    }
  }
  if (anyRoad) { L.strokeRoads(ctx, roadPath, tw); L.strokeRoads(ctx, pavedPath, tw, true); }
  if (anyOwn) {
    ctx.fillStyle = 'rgba(255,226,150,0.10)'; ctx.fill(tint);
    if (placing) { // a bright dot with a dark rim marks every tile you can use, on any ground
      ctx.lineWidth = Math.max(1.6, tw * 0.03); ctx.strokeStyle = 'rgba(30,24,18,0.7)'; ctx.stroke(valid);
      ctx.fillStyle = 'rgba(255,255,240,0.88)'; ctx.fill(valid);
    }
    ctx.lineWidth = Math.max(1.5, tw / 22); ctx.strokeStyle = 'rgba(255,236,170,0.95)'; ctx.setLineDash([tw / 6, tw / 10]);
    ctx.stroke(border); ctx.setLineDash([]);
  }
  // Zones
  if (S.zones.size) {
    for (let y = yA; y <= yB; y++) {
      const off = (y & 1) * 0.5, cy = sy(tileWY(y));
      const xa = Math.floor(X0 - off - 0.5), xb = Math.ceil(X1 - off);
      for (let x = xa; x <= xb; x++) {
        const z = S.zones.get(y * W + (((x % W) + W) % W));
        if (z) drawSprite(SPR.misc.zone[z], sx(x + 0.5 + off), cy, s);
      }
    }
  }
  // Hover / selection outline
  const outline = (t, col, w = 2) => {
    if (!t) return;
    const cx = sx(tileWX(t.x, t.y)), cy = sy(tileWY(t.y));
    ctx.beginPath(); diamondPath(ctx, cx, cy, hw, hh);
    ctx.strokeStyle = 'rgba(25,20,15,0.6)'; ctx.lineWidth = w + 2.2; ctx.stroke(); // dark backing so it shows on snow and sand
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  };
  if (hoverTile && mode) {
    let ok = true;
    if (mode.kind === 'build') ok = canPlace(mode.type, hoverTile.x, hoverTile.y).ok;
    else if (mode.kind === 'zone') ok = mode.zone === 'erase' || canZone(hoverTile.x, hoverTile.y);
    else if (mode.kind === 'found') ok = canFound(hoverTile.x, hoverTile.y).ok;
    else if (mode.kind === 'start') ok = canStart(hoverTile.x, hoverTile.y).ok;
    outline(hoverTile, ok ? '#b8ffb0' : '#ff9a8a', 2.5);
  }
  outline(M.selected, '#ffffff', 2.5);
  // S Pen / mouse hover: outline plus a small name tag (drawn after objects below)
  const hoverInfo = hoverTile && !mode ? hoverText(hoverTile) : null;
  if (hoverInfo) outline(hoverTile, 'rgba(255,255,255,0.85)', 1.5);

  // Pass 2: objects (row order for correct overlap)
  for (let y = yA; y <= yB; y++) {
    const off = (y & 1) * 0.5, cy = sy(tileWY(y));
    const xa = Math.floor(X0 - off - 0.5), xb = Math.ceil(X1 - off);
    const rowBase = y * W;
    const rs = L.rowSeason(y);
    for (let x = xa; x <= xb; x++) {
      const wx = ((x % W) + W) % W, i = rowBase + wx;
      const cx = sx(x + 0.5 + off);
      const bld = S.buildings.get(i);
      if (bld) {
        const bt = world.biome[i];
        if (bld.t === 'farm' && bld.p >= 1) {
          const snowy = L.tileSnowy(wx, y, bt, rs);
          drawSprite(snowy ? SPR.build.farmSnow[(hash2(wx, y, 3) * 2) | 0] : buildingSprite(bld, wx, y), cx, cy, s);
          const rm = L.roads.get(i);
          if (rm) { const p = new Path2D(); L.addRoad(p, rm, cx, cy, hw, hh); L.strokeRoads(ctx, p, tw, isPaved(i)); }
          if (!snowy && tw >= 30) { L.drawFarmAnimals(ctx, cx, cy, s, wx, y, animTime); if (stableTowns.has(bld.town) && hash2(wx, y, 27) < 0.5) L.drawPlough(ctx, cx, cy, s, animTime, hash2(wx, y, 28) * 6.28); }
          continue;
        }
        drawSprite(buildingSprite(bld, wx, y), cx, cy, s);
        if (bld.t === 'house' && bld.p >= 1 && tw >= 30) {
          const ht = townById(bld.town);
          if (ht && ht.imp && ht.imp.flowers) for (let k = 0; k < 4; k++) {
            ctx.fillStyle = ['#f2b6c6', '#f4e9a8', '#e8705a', '#c8a0f0'][(k + wx) % 4];
            ctx.fillRect(cx + (-10 + k * 6.5) * s, cy + (2 + (k % 2) * 3) * s, 2.2 * s, 2.2 * s);
          }
        }
        if (bld.t === 'windmill' && bld.p >= 1) { // turning sails
          const hx = cx, hy = cy - 24 * s, a0 = animTime * 0.9 + wx;
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.fillStyle = 'rgba(245,238,220,0.92)';
          for (let k = 0; k < 4; k++) {
            const a = a0 + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a), L = 15 * s;
            ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + ca * L, hy + sa * L * 0.9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(hx + ca * L * 0.25, hy + sa * L * 0.22); ctx.lineTo(hx + ca * L, hy + sa * L * 0.9);
            ctx.lineTo(hx + ca * L - sa * 3.2 * s, hy + sa * L * 0.9 + ca * 3 * s); ctx.lineTo(hx + ca * L * 0.25 - sa * 3.2 * s, hy + sa * L * 0.22 + ca * 3 * s); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(hx, hy, 1.6 * s, 0, 6.3); ctx.fill();
        }
        if (bld.p >= 1 && LIT.has(bld.t)) lights.push([cx, cy - tw * 0.18, bld.t === 'lighthouse' ? 2.4 : bld.t === 'house' ? 0.8 : 1.1]);
        if (bld.t === 'dock' && bld.p >= 1 && tw >= 24) {
          const spot = L.dockBoatSpot(i);
          if (spot) { const ph = hash2(wx, y, 33) * 6.28, [ox, oy, face] = L.wander(animTime * 1.5, ph, 0.3);
            L.drawBoat(ctx, sx(tileWX(spot[0], spot[1]) + ox), sy(tileWY(spot[1]) + oy), s, animTime, ph, false, face); }
        }
        if (bld.p < 1) {
          const bw = tw * 0.5, bh = Math.max(3, tw / 16);
          ctx.fillStyle = 'rgba(40,30,20,0.6)'; ctx.fillRect(cx - bw / 2, cy - tw * 0.42, bw, bh);
          ctx.fillStyle = '#ffd36a'; ctx.fillRect(cx - bw / 2, cy - tw * 0.42, bw * bld.p, bh);
        }
        continue;
      }
      const extra = nbExtra.get(i);
      if (extra) {
        drawSprite(SPR.build.hut[(hash2(wx, y, 41) * 3) | 0], cx, cy, s);
        lights.push([cx, cy - tw * 0.12, 0.6]);
        continue;
      }
      const nb = S.nbIndex.get(i);
      if (nb) {
        drawSprite(nb.pop < 22 ? SPR.build.hut[nb.id % 3] : SPR.build.village[nb.id % 3], cx, cy, s);
        if (nb.req) { // a letter waiting: little envelope bobbing above the village
          const ey = cy - tw * 0.62 + Math.sin(animTime * 2.4 + nb.id) * tw * 0.03, ew = Math.max(9, tw * 0.2), eh = ew * 0.66;
          ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#a0603c'; ctx.lineWidth = 1.2;
          ctx.fillRect(cx - ew / 2, ey - eh / 2, ew, eh); ctx.strokeRect(cx - ew / 2, ey - eh / 2, ew, eh);
          ctx.beginPath(); ctx.moveTo(cx - ew / 2, ey - eh / 2); ctx.lineTo(cx, ey + eh * 0.1); ctx.lineTo(cx + ew / 2, ey - eh / 2); ctx.stroke();
          ctx.fillStyle = '#c0503e'; ctx.beginPath(); ctx.arc(cx, ey + eh * 0.1, ew * 0.09, 0, 6.3); ctx.fill();
        }
        lights.push([cx, cy - tw * 0.15, 0.9]);
        // banner in their colour
        const fx = cx + 12 * s, fy = cy - 4 * s;
        ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22 * s); ctx.stroke();
        ctx.fillStyle = `hsl(${nb.hue},55%,55%)`; ctx.fillRect(fx, fy - 22 * s, 9 * s, 6 * s);
        continue;
      }
      const b = world.biome[i];
      if (b <= 1) { // open water: the odd sailing ship
        if (tw >= 24 && L.shipAt(b, wx, y)) { const ph = hash2(wx, y, 32) * 6.28, [ox, oy, face] = L.wander(animTime * 0.6, ph, 0.7);
          L.drawBoat(ctx, sx(x + 0.5 + off + ox), cy + oy * tw, s, animTime, ph, true, face); }
        continue;
      }
      if (S.zones.has(i)) continue;
      if (tw >= 28 && L.roads.has(i) && hash2(wx, y, 43) < 0.4) {
        const lt = townById(L.roadTown.get(i));
        if (lt && lt.imp && lt.imp.lanterns) {
          const lit = L.daylight().n > 0.3;
          L.drawLantern(ctx, cx + tw * 0.16, cy + tw * 0.02, s, lit);
          lights.push([cx + tw * 0.16, cy - tw * 0.2, 0.55]);
          continue;
        }
      }
      const dens = DECOR_DENSITY[b];
      if (dens && hash2(wx, y, 7) < dens) {
        let arr = SPR.decor[b];
        if (b === B.MOUNTAIN && hash2(wx, y, 8) < 0.3) arr = SPR.misc.snowpeak;
        else { const sd = L.seasonalDecor(b, wx, y, rs, L.tileSnowy(wx, y, b, rs)); if (sd) arr = sd; }
        drawSprite(arr[(hash2(wx, y, 2) * arr.length) | 0], cx, cy, s);
      }
      if (tw >= 30) {
        const wk = L.wildAt(b, wx, y);
        if (wk) { const ph = hash2(wx, y, 24) * 6.28, [ox, oy, face] = L.wander(animTime * (wk === 'rabbit' ? 1.6 : 0.8), ph, 0.3);
          L.drawAnimal(ctx, wk, cx + ox * tw, cy + oy * tw + tw * 0.06, s * (wk === 'camel' ? 1.15 : 1), face, animTime, ph); }
      }
    }
    drawRowWalkers(y);
  }
  if (hoverInfo) label(hoverInfo, sx(tileWX(hoverTile.x, hoverTile.y)), sy(tileWY(hoverTile.y)) - tw * 0.45, 11);
}

function hoverText(t) {
  const i = t.y * W + t.x, nb = S.nbIndex.get(i), b = S.buildings.get(i), z = S.zones.get(i);
  if (nb) return nb.name;
  if (b) { const tn = b.t === 'townhall' ? townById(b.town) : null; return tn ? tn.name : DEFS[b.t].name + (b.p < 1 ? ` · ${Math.round(b.p * 100)}%` : ''); }
  if (z) return `${ZONES[z].name} zone`;
  return BIOMES[world.biome[i]].name;
}

function drawLabels(tileMode) {
  const tw = cam.tw;
  for (const t of S.towns) {
    const x = sx(tileWX(t.x, t.y)), y = sy(tileWY(t.y));
    if (x < -100 || x > cw + 100 || y < -60 || y > ch + 100) continue;
    const face = t.mood ? MOOD_FACES[t.mood.level] : '';
    if (tileMode) label(`${t.name} ${face}`, x, y - tw * 0.9, 13, `${Math.floor(t.pop)} folk`);
    else label(`${t.name} ${face}`, x, y - 20, 12);
  }
  if ((tileMode && tw >= 24) || (!tileMode && tw >= 6)) {
    for (const n of S.neighbors) {
      if (n.joined) continue;
      const x = sx(tileWX(n.x, n.y)), y = sy(tileWY(n.y));
      if (x < -80 || x > cw + 80 || y < -40 || y > ch + 60) continue;
      label(n.req ? `${n.name} ✉` : n.name, x, y - (tileMode ? tw * 0.7 : 9), 11);
    }
  }
}
