// Isometric renderer with an overview (atlas) mode for far zoom levels.
import { BIOMES, W, H, B, world, wrapX, tileWX, tileWY, biomeAt, isWater } from './world.js';
import { SPR, TB, DECOR_DENSITY, homeArt } from './sprites.js';
import { byRiver, canCanal, canZoneAs, BIG, footprint, S, M, DEFS, ZONES, townById, canPlace, canZone, canRoad, canFound, canStart, ownerOf, groundDist2, CONTACT_RANGE, inContact } from './game.js';
import { hash2 } from './noise.js';
import { idxOf } from './world.js';
import * as L from './life.js';
import * as A from './alive.js';
import * as X from './explore.js';
import * as K from './kingdoms.js';
import * as ST from './stories.js';
import { petOf, personById, ageOf } from './folk.js';
import { styleAt } from './regions.js';
import { nbExtra, SPECS } from './game.js';
L.setExtraLookup((i) => nbExtra.has(i));
const MOOD_FACES = ['🙂', '😊', '😄'];

export const TILE_MODE_TW = 20;
const A_GENTLE = () => !!S.settings.gentle;
const A_FLAT = new Set(['pit', 'pasture', 'park', 'woodlot', 'farm', 'green', 'fountain', 'riceterrace', 'vineyard', 'orchard', 'oasis', 'cacao', 'apiary', 'quarry', 'dock']);
const SMOKY = new Set(['house', 'townhall', 'tavern', 'bakery', 'smithy', 'brewery', 'workshop']);
const LIT = new Set(['shops', 'stable', 'house', 'townhall', 'workshop', 'market', 'tower', 'dock', 'library', 'cathedral', 'greatcastle', 'lighthouse', 'lumber', 'harbour', 'fountain',
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
export const cancelFlight = () => { flight = null; if (M.follow) { M.follow = null; emitFollow(); } };
let emitFollow = () => {}; export function onFollowEnd(f) { emitFollow = f; }
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
  let target = tiles[Math.floor(Math.random() * tiles.length)];
  if (w.age >= 6 && w.age < 16 && L.daylight().n < 0.3 && Math.random() < 0.6) { // off to school
    if (t._schoolFor !== tiles) { t._schoolFor = tiles; t._school = tiles.find((i) => { const b = S.buildings.get(i); return b && b.t === 'school' && b.p >= 1; }); }
    if (t._school != null) target = t._school;
  }
  const hall = idxOf(t.x, t.y);
  const tilesPath = [];
  // follow the town's roads where they exist, else walk the straight way
  const leg = (from, to, reverse) => {
    const r = L.routeToHall(t.id, from);
    let p = r ? r.map((i) => [i % W, Math.floor(i / W)]) : L.lPath(from % W, Math.floor(from / W), to % W, Math.floor(to / W));
    if (r && !reverse) p.unshift([from % W, Math.floor(from / W)]);
    if (r && reverse) p.unshift([from % W, Math.floor(from / W)]);
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
// Forget everyone walking about (when leaving a realm).
export function clearTransient() { walkers.clear(); visitors.clear(); tileCacheStamp = -1; dirty = true; }
// Visitors: market-day wagons from neighbouring villages, and the odd traveller heading for the tavern.
export const visitors = new Map(); // townId -> array
function routeVisitor(v, fromTile, toTile, nearX) {
  const p = L.lPath(fromTile % W, Math.floor(fromTile / W), toTile % W, Math.floor(toTile / W));
  const pts = []; let lastX = nearX;
  for (const [x, y] of p) { let X = tileWX(x, y); if (X - lastX > W / 2) X -= W; else if (lastX - X > W / 2) X += W; pts.push([X, tileWY(y) + 0.05]); lastX = X; }
  if (pts.length < 2) pts.push([pts[0][0] + 0.01, pts[0][1]]);
  v.pts = pts; v.seg = []; v.len = 0; v.d = 0; v.k = 0;
  for (let k = 1; k < pts.length; k++) { const d = gdist(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]); v.seg.push(d); v.len += d; }
  v.X = pts[0][0]; v.Y = pts[0][1];
}
function edgeTileToward(t, nx, ny) {
  const X0 = tileWX(t.x, t.y), Y0 = tileWY(t.y);
  let dX = tileWX(nx, ny) - X0; if (dX > W / 2) dX -= W; else if (dX < -W / 2) dX += W;
  const dY = (tileWY(ny) - Y0) * 2, len = Math.hypot(dX, dY) || 1, r = Math.max(2, t.radius - 0.8);
  const tl = tileOfWorld(X0 + (dX / len) * r, Y0 + ((dY / len) * r) / 2);
  return tl ? tl[1] * W + tl[0] : idxOf(t.x, t.y);
}
function updateVisitors(dt, t, tiles) {
  let vs = visitors.get(t.id); if (!vs) visitors.set(t.id, (vs = []));
  const market = tiles.find((i) => { const b = S.buildings.get(i); return b && b.t === 'market'; });
  const tavern = tiles.find((i) => { const b = S.buildings.get(i); return b && b.t === 'tavern'; });
  if (market != null && t.marketUntil && S.day < t.marketUntil && !vs.some((v) => v.market)) {
    for (const nid of (t.marketFrom || []).slice(0, 3)) {
      const n = S.neighbors.find((q) => q.id === nid); if (!n) continue;
      const start = edgeTileToward(t, n.x, n.y);
      for (let k = 0; k < 2; k++) {
        const v = { market: true, kind: k ? 'traveller' : 'wagon', start, dest: market, wait: k * 3 + Math.random() * 2, sp: k ? 0.36 : 0.5, face: 1, ph: Math.random() * 6,
          c: `hsl(${n.hue},45%,48%)`, rider: !k, cart: !k, cover: !k, moving: false, leaving: false };
        routeVisitor(v, start, market, tileWX(t.x, t.y)); vs.push(v);
      }
    }
  }
  if (t.royalVisit && S.day < t.royalVisit.until && !vs.some((v) => v.royal || v.escort)) { // a royal procession comes up the road
    const n = S.neighbors.find((q) => q.id === t.royalVisit.from), hall = idxOf(t.x, t.y);
    const start = edgeTileToward(t, n ? n.x : t.x + 20, n ? n.y : t.y);
    const hue = n ? n.hue : 280;
    for (let k = 0; k < 3; k++) {
      const v = { kind: k === 1 ? 'royal' : 'escort', royal: k === 1, escort: k !== 1, start, dest: hall, wait: k * 1.6, sp: 0.42, face: 1, ph: Math.random() * 6,
        c: `hsl(${hue},50%,45%)`, banner: `hsl(${hue},60%,50%)`, rider: true, cart: k === 1, moving: false, leaving: false };
      routeVisitor(v, start, hall, tileWX(t.x, t.y)); vs.push(v);
    }
  }
  if (tavern != null && vs.length < 3 && Math.random() < dt / 45) { // a traveller wanders in for a bed and a meal
    const n = S.neighbors[Math.floor(Math.random() * S.neighbors.length)];
    const start = edgeTileToward(t, n ? n.x : t.x + 20, n ? n.y : t.y);
    const v = { kind: 'traveller', start, dest: tavern, wait: 0, sp: 0.34, face: 1, ph: Math.random() * 6, c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], moving: false, leaving: false };
    routeVisitor(v, start, tavern, tileWX(t.x, t.y)); vs.push(v);
  }
  for (let j = vs.length - 1; j >= 0; j--) {
    const v = vs[j];
    v.moving = false;
    if (v.wait > 0) { v.wait -= dt; continue; }
    v.d += dt * v.sp;
    while (v.k < v.seg.length - 1 && v.d > v.seg[v.k]) { v.d -= v.seg[v.k]; v.k++; }
    const a = v.pts[v.k], b = v.pts[v.k + 1], f = Math.min(1, v.seg[v.k] ? v.d / v.seg[v.k] : 1);
    const nx = a[0] + (b[0] - a[0]) * f, ny = a[1] + (b[1] - a[1]) * f;
    if (Math.abs(nx - v.X) > 1e-4) v.face = nx > v.X ? 1 : -1;
    v.X = nx; v.Y = ny; v.moving = true; v.ph += dt * 9;
    if (v.k >= v.seg.length - 1 && f >= 1) {
      if (v.leaving) { vs.splice(j, 1); continue; }
      v.leaving = true; v.wait = 8 + Math.random() * 8; // trade, rest, then head home
      routeVisitor(v, v.dest, v.start, v.X);
    }
  }
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
      const pid = M.follow && M.follow.town === t.id && !ws.some((q) => q.pid === M.follow.pid) ? M.follow.pid : pickFolk(t), person = pid && personById(t, pid), pet = person && petOf(t, person);
      ws.push({ town0: t.id, job: person ? person.j : null, sk: person ? person.k : 0, age: person ? ageOf(person) : 30, dog: !ride && pet && pet.k === 'dog' ? pet : null, pid, X, Y, tile, pts: null, wait: Math.random() * 3, sp: (0.32 + Math.random() * 0.18) * (ride ? 2.2 : 1), face: 1,
        rider: ride, cart: ride && Math.random() < 0.35, hc: HORSE_COLS[Math.floor(Math.random() * HORSE_COLS.length)],
        lx: (Math.random() - 0.5) * LANE, ly: (Math.random() - 0.5) * LANE * 0.4,
        c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], carry: Math.random() < 0.3, ph: Math.random() * 6, moving: false });
    }
    if (ws.length > want) { const keep = M.follow && M.follow.town === t.id ? ws.findIndex((q) => q.pid === M.follow.pid) : -1; if (keep >= want) { const tmp = ws[0]; ws[0] = ws[keep]; ws[keep] = tmp; } ws.length = want; }
    updateVisitors(dt, t, tiles);
    for (const w of ws) {
      w.moving = false;
      if (w.wait > 0) { w.wait -= dt * pace; continue; }
      if (!w.pts) { planWalk(w, tiles, t); if (w.len < 0.05) { w.pts = null; w.wait = 1; continue; } }
      const wy0 = Math.round((w.Y - 0.25) / 0.25), wx0 = ((Math.round(w.X - 0.5 - (wy0 & 1) * 0.5) % W) + W) % W, wi = wy0 * W + wx0;
      const onRoad = L.roads.has(wi);
      if (!onRoad && !S.buildings.has(wi) && w.pts) wear.set(wi, Math.min(400, (wear.get(wi) || 0) + dt * pace));
      w.d += dt * w.sp * pace * (onRoad ? 1.35 : 1);
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
// Footpaths: grass wears where villagers often walk off the roads.
export const wear = new Map();
setInterval(() => { for (const [k, v] of wear) { if (v <= 1) wear.delete(k); else wear.set(k, v * 0.995); } }, 4000);
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
    const ws = [...(walkers.get(t.id) || []), ...(visitors.get(t.id) || [])];
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
// Work clothes: each trade has its hat or apron; journeymen add a belt and masters a golden sash.
const HATS = { farm: 'straw', pasture: 'straw', orchard: 'straw', vineyard: 'straw', riceterrace: 'cone', cacao: 'straw', oasis: 'wrap', apiary: 'veil',
  smithy: 'apron', mine: 'helm', pit: 'helm', quarry: 'helm', lumber: 'cap', woodlot: 'cap', bakery: 'chef', brewery: 'apron', weaver: 'apron', potter: 'apron', glassworks: 'apron',
  market: 'fez', shops: 'fez', spicehouse: 'wrap', school: 'scholar', scriptorium: 'scholar', chapel: 'hood', dock: 'sou', shipyard: 'sou', harbour: 'sou', icehut: 'fur', tavern: 'apron', stable: 'cap', yard: 'cap', tower: 'helm', workshop: 'apron', windmill: 'cap' };
function outfit(hx, y, s, job, k) {
  const hy = y - 7.6 * s, kind = HATS[job] || 'cap';
  if (kind === 'straw') { ctx.fillStyle = '#e8c870'; ctx.beginPath(); ctx.ellipse(hx, hy - 1.2 * s, 2.8 * s, 0.8 * s, 0, 0, 6.3); ctx.fill(); ctx.fillRect(hx - 1.1 * s, hy - 2.5 * s, 2.2 * s, 1.4 * s); }
  else if (kind === 'cone') { ctx.fillStyle = '#d8c080'; ctx.beginPath(); ctx.moveTo(hx - 3 * s, hy - 1 * s); ctx.lineTo(hx, hy - 3.4 * s); ctx.lineTo(hx + 3 * s, hy - 1 * s); ctx.fill(); }
  else if (kind === 'helm') { ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.arc(hx, hy - 0.6 * s, 1.8 * s, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#ffe080'; ctx.fillRect(hx - 0.4 * s, hy - 2.6 * s, 0.8 * s, 0.8 * s); }
  else if (kind === 'chef') { ctx.fillStyle = '#fbf8f0'; ctx.fillRect(hx - 1.3 * s, hy - 3.6 * s, 2.6 * s, 2.4 * s); }
  else if (kind === 'fez') { ctx.fillStyle = '#b8402e'; ctx.fillRect(hx - 1.2 * s, hy - 2.8 * s, 2.4 * s, 1.6 * s); }
  else if (kind === 'wrap') { ctx.fillStyle = '#f0e6cc'; ctx.beginPath(); ctx.ellipse(hx, hy - 1.4 * s, 1.9 * s, 1.1 * s, 0, 0, 6.3); ctx.fill(); }
  else if (kind === 'scholar') { ctx.fillStyle = '#2e2a3a'; ctx.fillRect(hx - 2 * s, hy - 2.2 * s, 4 * s, 0.7 * s); ctx.fillRect(hx - 1 * s, hy - 2 * s, 2 * s, 0.9 * s); }
  else if (kind === 'hood') { ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.arc(hx, hy - 0.2 * s, 1.9 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); }
  else if (kind === 'sou') { ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.ellipse(hx, hy - 1.1 * s, 2.3 * s, 0.9 * s, 0, Math.PI, 0); ctx.fill(); }
  else if (kind === 'fur') { ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(hx, hy - 0.8 * s, 2 * s, Math.PI, 0); ctx.fill(); }
  else if (kind === 'veil') { ctx.fillStyle = 'rgba(250,250,240,0.85)'; ctx.fillRect(hx - 2 * s, hy - 2.2 * s, 4 * s, 3 * s); }
  else if (kind === 'apron') { ctx.fillStyle = 'rgba(245,240,228,0.9)'; ctx.fillRect(hx - 1.4 * s, y - 4.6 * s, 2.6 * s, 3 * s); }
  else { ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(hx, hy - 0.7 * s, 1.6 * s, Math.PI, 0); ctx.fill(); }
  if (k >= 40) { ctx.fillStyle = '#5a3a24'; ctx.fillRect(hx - 1.9 * s, y - 3.4 * s, 3.2 * s, 0.6 * s); } // a good leather belt
  if (k >= 80) { ctx.strokeStyle = '#e8b830'; ctx.lineWidth = Math.max(0.7, 0.6 * s); ctx.beginPath(); ctx.moveTo(hx - 1.6 * s, y - 5.8 * s); ctx.lineTo(hx + 1.4 * s, y - 2.6 * s); ctx.stroke(); } // master's sash
}
const t_school = (w) => { const t = townById(w.town0); return t ? t._school : undefined; };
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
          if (w.cover) { ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.ellipse(bx, y - 5 * s, 4.4 * s, 4.8 * s, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.6)'; ctx.lineWidth = 0.6 * s; for (const k of [-2, 0, 2]) { ctx.beginPath(); ctx.moveTo(bx + k * s, y - 5 * s); ctx.lineTo(bx + k * s * 0.8, y - 9.6 * s); ctx.stroke(); } }
          else if (w.royal) { // a gilded carriage with a crown on top
            ctx.fillStyle = '#5a2a6a'; ctx.fillRect(bx - 4 * s, y - 10 * s, 8 * s, 5.5 * s); ctx.fillStyle = '#e8b830'; ctx.fillRect(bx - 4.4 * s, y - 10.6 * s, 8.8 * s, 1 * s); ctx.fillRect(bx - 4 * s, y - 5.2 * s, 8 * s, 0.7 * s);
            ctx.fillStyle = '#f5d78a'; ctx.fillRect(bx - 1.6 * s, y - 9 * s, 3.2 * s, 2.4 * s);
            ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.moveTo(bx - 2 * s, y - 10.6 * s); ctx.lineTo(bx - 2 * s, y - 13 * s); ctx.lineTo(bx - 1 * s, y - 11.6 * s); ctx.lineTo(bx, y - 13.4 * s); ctx.lineTo(bx + 1 * s, y - 11.6 * s); ctx.lineTo(bx + 2 * s, y - 13 * s); ctx.lineTo(bx + 2 * s, y - 10.6 * s); ctx.fill();
          }
          else { ctx.fillStyle = '#c8a070'; ctx.fillRect(bx - 3 * s, y - 7.5 * s, 3 * s, 2.5 * s); ctx.fillStyle = '#7aa04a'; ctx.fillRect(bx + 0.3 * s, y - 7 * s, 2.6 * s, 2 * s); }
          ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(bx - 2 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.arc(bx + 2.4 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.fill();
          ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(0.7, 0.6 * s); ctx.beginPath(); ctx.moveTo(bx + w.face * 4 * s, y - 4 * s); ctx.lineTo(x, y - 4.4 * s); ctx.stroke();
        }
        L.drawAnimal(ctx, 'horse', x, y, s * 1.15, w.face, animTime * (w.moving ? 1.6 : 0), w.ph);
        if (!w.cart) {
          ctx.fillStyle = w.c; ctx.fillRect(x - 1.5 * s, y - 11.5 * s - bob, 3 * s, 4.2 * s);
          ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x + w.face * 0.3 * s, y - 12.9 * s - bob, 1.5 * s, 0, 6.3); ctx.fill();
          if (w.banner) { const px = x - w.face * 1.6 * s; ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(0.7, 0.6 * s); ctx.beginPath(); ctx.moveTo(px, y - 9 * s); ctx.lineTo(px, y - 21 * s); ctx.stroke(); ctx.fillStyle = w.banner; ctx.beginPath(); ctx.moveTo(px, y - 21 * s); ctx.lineTo(px - w.face * 6 * s, y - 19.5 * s); ctx.lineTo(px, y - 17 * s); ctx.fill(); }
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
      if (w.job && cam.tw >= 34) outfit(x + w.face * 0.3 * s, y - bob, s, w.job, w.sk);
      if (w.age >= 6 && w.age < 16 && w.pts && w.dest === t_school(w)) { ctx.fillStyle = '#8a5a3c'; ctx.fillRect(x - w.face * 2.2 * s - 0.9 * s, y - 5.6 * s - bob, 1.8 * s, 2.4 * s); } // a satchel
      if (w.carry) { ctx.fillStyle = '#b08a52'; ctx.fillRect(x + (w.face > 0 ? 0.6 : -3.2) * s, y - 9.5 * s - bob, 2.6 * s, 2.2 * s); }
      if (w.kind === 'traveller') { // a wide hat and a pack: clearly from out of town
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - w.face * 2.6 * s - 1.2 * s, y - 6.4 * s - bob, 2.4 * s, 3.6 * s);
        ctx.fillStyle = '#7a5a34'; ctx.beginPath(); ctx.ellipse(x + w.face * 0.3 * s, y - 8.8 * s - bob, 2.6 * s, 0.8 * s, 0, 0, 6.3); ctx.fill();
        ctx.fillRect(x + w.face * 0.3 * s - 1 * s, y - 10 * s - bob, 2 * s, 1.4 * s);
      }
      if (!w.kind) {
        const night = L.daylight().n;
        if (night > 0.45 && w.moving) { // a little lantern lights the way home
          const lx = x + w.face * 2.6 * s, ly = y - 5 * s - bob;
          ctx.fillStyle = '#ffd88a'; ctx.fillRect(lx - 1 * s, ly - 1 * s, 2 * s, 2.2 * s); lights.push([lx, ly, 0.35]);
        }
        const db = S.buildings.get(w.dest), em = !A_GENTLE() && A.emoteFor(w, animTime, night, db && db.t === 'tavern');
        if (em && cam.tw >= 40) A.bubble(ctx, x + 3 * s, y - 13 * s - bob, s * 0.9, em);
      }
      if (w.dog) { // the family dog trots along behind
        const dxp = x - w.face * 6 * s, hop = w.moving ? Math.abs(Math.sin(w.ph * 1.3)) * 0.8 * s : 0;
        L.drawAnimal(ctx, 'dog', dxp, y + 0.5 * s - hop, s, w.face, animTime * (w.moving ? 1.8 : 0.3), w.pid || 1);
      }
    }
  }
}

// --- drawing helpers ---
function drawSpriteF(spr, x, y, s, flip) {
  if (!flip) return drawSprite(spr, x, y, s);
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(spr.c, -spr.ax * s, -spr.ay * s, spr.w * s, spr.h * s); ctx.restore();
}
// Little moving parts: windmill sails, a water wheel by the river, a swinging tavern sign, smithy sparks.
const ANIM = new Set(['windmill', 'tavern', 'smithy', 'workshop', 'bakery', 'potter', 'glassworks', 'lumber']);
function animate(type, cx, cy, s, wx, y) {
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
// As a family settles in, their yard grows: a picket fence, then a vegetable patch, then a garden shed.
function drawYard(cx, cy, s, hw, hh, age, h) {
  if (age < 6) return;
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = Math.max(0.8, 0.8 * s);
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
// Grand 2×2 buildings are drawn from their bottom tile, so everything behind them is already down.
let bigCacheFor = null, bigBottom = new Map();
function bigBottoms() {
  if (bigCacheFor !== S.occupied) {
    bigCacheFor = S.occupied; bigBottom = new Map();
    for (const [i, b] of S.buildings) if (BIG.has(b.t)) { const [, , , [fx, fy]] = footprint(i % W, Math.floor(i / W)); bigBottom.set(fy * W + fx, i); }
  }
  return bigBottom;
}
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
    return t && t.capital ? SPR.build.castle[Math.min(S.tier, SPR.build.castle.length - 1)] : SPR.build.townhall[0];
  }
  if (b.t === 'house') {
    const t = townById(b.town);
    const arr = homeArt(t ? townStyle(t) : 'temperate', b.lv || 1);
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
  if (M.follow) { // the follow camera glides after one villager
    const w = (walkers.get(M.follow.town) || []).find((q) => q.pid === M.follow.pid);
    if (w) { const k = Math.min(1, dt * 3); cam.x += (w.X - cam.x) * k; cam.y += (w.Y - 0.05 - cam.y) * k; dirty = true; }
    else if (tileMode && cam.tw >= 30) { const t = townById(M.follow.town); if (t && !(walkers.get(t.id) || []).length) { M.follow = null; emitFollow(); } }
  }
  L.updateWeather(dt);
  A.updateSky(dt);
  if ((sceneT += dt) > 1.5 && world.ready && S.started) { sceneT = 0; sampleScene(); }
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
  const view = curView();
  A.drawTravellers(ctx, view);
  X.drawHighwayTraffic(ctx, view); X.drawCaravans(ctx, view); K.drawMigrations(ctx, view);
  drawExplorers();
  L.drawClouds(ctx, animTime, cam, cw, ch, sx, sy, tileMode);
  L.drawBirds(ctx, animTime, cam, cw, ch, sx, sy);
  if (tileMode) L.drawFalling(ctx, fdt, cw, ch, L.fallingSnow(Math.max(0, Math.min(H - 1, Math.round(cam.y / 0.25)))));
  A.drawLight(ctx, view);
  A.drawSky(ctx, view);
  L.drawNight(ctx, cw, ch, lights, cam.tw, waterAtScreen);
  A.drawAir(ctx, view, fdt);
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
  K.drawKingdoms(ctx, curView(), true);
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
    const spr = t.capital ? SPR.build.castle[Math.min(S.tier, SPR.build.castle.length - 1)] : SPR.build.townhall[0];
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
let sceneT = 0;
// What's on screen right now, for the soundscape (sea, river, town, forest: 0..1).
function sampleScene() {
  let sea = 0, river = 0, town = 0, forest = 0, n = 0;
  const span = Math.min(30, cw / cam.tw / 2);
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const X = cam.x + (a / 3) * span, Y = cam.y + (b / 3) * span * 0.5, y = Math.max(0, Math.min(H - 1, Math.round(Y / 0.25))), x = wrapX(Math.round(X));
    const i = y * W + x, bio = world.biome[i]; n++;
    if (bio <= 1) sea++; if (world.river[i]) river++; if (S.buildings.has(i)) town++;
    if (bio === B.FOREST || bio === B.JUNGLE || bio === B.TAIGA) forest++;
  }
  const close = cam.tw >= 20 ? 1 : 0.35;
  sceneFn && sceneFn(Math.min(1, (sea / n) * 2.5) * close, Math.min(1, river / 6) * close, Math.min(1, (town / n) * 3) * close, Math.min(1, (forest / n) * 2) * close);
}
let sceneFn = null;
export function onScene(f) { sceneFn = f; }
// Bunting and lanterns around the hall during a festival.
function festive(ctx, cx, cy, s, tw, t) {
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
function festiveExtras(ctx, cx, cy, s, tw, t) {
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
function lostAnimal(ctx, q, s, tw) {
  if (tw < 20) return;
  const x = sx(tileWX(q.x, q.y)), y = sy(tileWY(q.y)) + tw * 0.05;
  if (x < -30 || x > cw + 30 || y < -30 || y > ch + 30) return;
  const [ox, , face] = L.wander(animTime * 0.6, q.id, 0.12);
  const kind = q.animal === 'goat' ? 'goat' : q.animal === 'hen' ? 'chicken' : 'sheep';
  L.drawAnimal(ctx, kind, x + ox * tw, y, s * 1.4, face, animTime, q.id);
  A.bubble(ctx, x + ox * tw + 4 * s, y - 16 * s + Math.sin(animTime * 3) * 1.5 * s, s, '?');
}
// Explorer parties out on the map, and the landmarks already in the journal.
function drawExplorers() {
  const tw = cam.tw, s = tw / TB;
  for (const k of S.explored || []) {
    const [lx, ly] = X.lmTile(k), x = sx(tileWX(lx, ly)), y = sy(tileWY(ly));
    if (x < -60 || x > cw + 60 || y < -40 || y > ch + 40) continue;
    if (tw >= 3) label(`${X.LANDMARKS[k][3]} ${X.LANDMARKS[k][0]}`, x, y - (tw >= 20 ? tw * 0.6 : 8), 11);
  }
  for (const e of S.expeditions || []) {
    const pp = X.partyPos(e); if (!pp) continue;
    const x = sx(pp.X), y = sy(pp.Y);
    if (x < -30 || x > cw + 30 || y < -30 || y > ch + 30) continue;
    if (tw < 14) { ctx.fillStyle = '#c0503e'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else {
      const face = pp.out ? 1 : -1;
      if (e.horse) L.drawAnimal(ctx, 'horse', x, y, s * 1.15, face, animTime * 1.6, 3);
      for (let k = 0; k < 2; k++) { ctx.fillStyle = ['#5a7a4a', '#a06a3a'][k]; ctx.fillRect(x - (k + 1) * 6 * s * face - 1.4 * s, y - (e.horse ? 11 : 6) * s, 2.8 * s, 4.4 * s); ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x - (k + 1) * 6 * s * face, y - (e.horse ? 12.4 : 7.4) * s, 1.4 * s, 0, 6.3); ctx.fill(); }
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(1, 0.8 * s); ctx.beginPath(); ctx.moveTo(x - 6 * s * face, y - 6 * s); ctx.lineTo(x - 6 * s * face, y - 20 * s); ctx.stroke();
      ctx.fillStyle = '#c0503e'; ctx.fillRect(x - 6 * s * face, y - 20 * s, 6 * s * face, 4 * s);
    }
  }
}
function waterAtScreen(px, py) { const t = pickTile(px, py); return !!t && world.biome[t.y * W + t.x] <= 1; }
function curView(X0 = 0, X1 = 0, yA = 0, yB = -1) {
  return { X0, X1, yA, yB, tw: cam.tw, s: cam.tw / TB, sx, sy, cw, ch, time: animTime, camX: cam.x, camY: cam.y };
}
function drawTiles() {
  const tw = cam.tw, s = tw / TB, hw = tw / 2, hh = tw / 4;
  const X0 = cam.x - cw / 2 / tw - 1, X1 = cam.x + cw / 2 / tw + 1;
  const Y0 = cam.y - ch / 2 / tw, Y1 = cam.y + ch / 2 / tw;
  const yA = Math.max(0, Math.floor((Y0 - 0.25) / 0.25) - 2);
  const yB = Math.min(H - 1, Math.ceil((Y1 - 0.25) / 0.25) + 8);
  const mode = M.mode;
  const showOwn = S.towns.length > 0;
  const placing = mode && (mode.kind === 'build' || mode.kind === 'zone' || mode.kind === 'move');
  const mopt = mode && mode.kind === 'move' ? { moving: mode.from } : {};

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
  const isPaved = (i) => { const rt = L.roadTown.get(i); if (rt === -1) return S.tier >= 3; const t = townById(rt); return !!(t && t.imp && t.imp.paved); };
  let anyRoad = false, anyRiver = false, anyBridge = false;
  const riverPaths = [new Path2D(), new Path2D(), new Path2D()], bridgePath = new Path2D(), canalPath = new Path2D(); let anyCanal = false;
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
        const rv = world.river[rowBase + wx];
        if (rv) { const sz = (rv >> 4) - 1; L.addRoad(riverPaths[sz], rv & 15, cx, cy, hw, hh); riverPaths[sz].moveTo(cx + tw * 0.06, cy); riverPaths[sz].arc(cx, cy, tw * 0.06, 0, 6.283); anyRiver = true; }
        const rm = b > 2 ? L.roads.get(rowBase + wx) : 0;
        if (rm && rv && !(S.buildings.get(rowBase + wx) || {}).t) { L.addRoad(bridgePath, rm, cx, cy, hw * 0.92, hh * 0.92); anyBridge = true; }
        { const wv = wear.get(rowBase + wx); if (wv > 25 && tw >= 18 && !L.roads.has(rowBase + wx)) { ctx.fillStyle = `rgba(196,168,118,${Math.min(0.42, (wv - 25) / 250)})`; ctx.beginPath(); ctx.ellipse(cx, cy, hw * 0.42, hh * 0.42, 0, 0, 6.3); ctx.fill(); } }
        if (S.canals.has(rowBase + wx)) { let cm = 0; for (let d = 0; d < 4; d++) { const [nx, ny] = L.stepTile(wx, y, d), ni = ny * W + ((nx % W) + W) % W; if (S.canals.has(ni) || world.river[ni] || world.biome[ni] <= 1) cm |= 1 << d; } L.addRoad(canalPath, cm || 16, cx, cy, hw, hh); anyCanal = true; }
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
            const ok = mode.kind === 'zone' ? (mode.zone === 'erase' ? S.zones.has(rowBase + wx) || S.proads.has(rowBase + wx) || S.canals.has(rowBase + wx) : mode.zone === 'road' ? canRoad(wx, y) : mode.zone === 'canal' ? canCanal(wx, y) : canZoneAs(mode.zone, wx, y)) : canPlace(mode.type, wx, y, mopt).ok;
            if (ok) { valid.moveTo(cx + Math.max(1.8, tw * 0.042), cy); valid.arc(cx, cy, Math.max(1.8, tw * 0.042), 0, 6.283); }
          }
        }
      }
    }
  }
  if (anyCanal) { // stone-lined canals
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#8f897e'; ctx.lineWidth = tw * 0.25; ctx.stroke(canalPath);
    ctx.strokeStyle = '#4f8fb8'; ctx.lineWidth = tw * 0.18; ctx.stroke(canalPath);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = tw * 0.02; ctx.stroke(canalPath);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  if (anyRiver) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let sz = 0; sz < 3; sz++) { ctx.strokeStyle = 'rgba(70,100,80,0.45)'; ctx.lineWidth = tw * (0.17 + 0.08 * sz); ctx.stroke(riverPaths[sz]); }
    for (let sz = 0; sz < 3; sz++) { ctx.strokeStyle = '#5c9cc4'; ctx.lineWidth = tw * (0.12 + 0.08 * sz); ctx.stroke(riverPaths[sz]); }
    ctx.setLineDash([tw * 0.06, tw * 0.22]); ctx.lineDashOffset = -animTime * tw * 0.05;
    for (let sz = 0; sz < 3; sz++) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = tw * 0.025; ctx.stroke(riverPaths[sz]); }
    ctx.setLineDash([]); ctx.lineCap = 'butt';
  }
  if (anyRoad) { L.strokeRoads(ctx, roadPath, tw); L.strokeRoads(ctx, pavedPath, tw, true); }
  if (anyBridge) { // little wooden bridges where the roads cross a river
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = tw * 0.24; ctx.stroke(bridgePath);
    ctx.strokeStyle = '#b08458'; ctx.lineWidth = tw * 0.18; ctx.stroke(bridgePath);
    ctx.setLineDash([tw * 0.02, tw * 0.035]); ctx.strokeStyle = 'rgba(90,64,48,0.6)'; ctx.lineWidth = tw * 0.16; ctx.stroke(bridgePath); ctx.setLineDash([]);
  }
  K.drawKingdoms(ctx, curView(), false);
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
    if (mode.kind === 'build' || mode.kind === 'move') ok = canPlace(mode.type, hoverTile.x, hoverTile.y, mopt).ok;
    if ((mode.kind === 'build' || mode.kind === 'move') && BIG.has(mode.type)) for (const [fx, fy] of footprint(hoverTile.x, hoverTile.y).slice(1)) outline({ x: fx, y: fy }, ok ? '#b8ffb0' : '#ff9a8a', 2.5);
    else if (mode.kind === 'zone') ok = mode.zone === 'erase' || (mode.zone === 'road' ? canRoad(hoverTile.x, hoverTile.y) : mode.zone === 'canal' ? canCanal(hoverTile.x, hoverTile.y) : canZoneAs(mode.zone, hoverTile.x, hoverTile.y));
    else if (mode.kind === 'found') ok = canFound(hoverTile.x, hoverTile.y).ok;
    else if (mode.kind === 'start') ok = canStart(hoverTile.x, hoverTile.y).ok;
    outline(hoverTile, ok ? '#b8ffb0' : '#ff9a8a', 2.5);
  }
  outline(M.selected, '#ffffff', 2.5);
  // S Pen / mouse hover: outline plus a small name tag (drawn after objects below)
  const hoverInfo = hoverTile && !mode ? hoverText(hoverTile) : null;
  if (hoverInfo) outline(hoverTile, 'rgba(255,255,255,0.85)', 1.5);

  const view = curView(X0, X1, yA, yB);
  A.drawWaterLife(ctx, view);
  const festLate = [];
  // Pass 2: objects (row order for correct overlap)
  const bigB = bigBottoms();
  for (let y = yA; y <= yB; y++) {
    const off = (y & 1) * 0.5, cy = sy(tileWY(y));
    const xa = Math.floor(X0 - off - 0.5), xb = Math.ceil(X1 - off);
    const rowBase = y * W;
    const rs = L.rowSeason(y);
    for (let x = xa; x <= xb; x++) {
      const wx = ((x % W) + W) % W, i = rowBase + wx;
      const cx = sx(x + 0.5 + off);
      const bld = S.buildings.get(i);
      if (bigB.has(i)) { // the bottom tile of a grand building: draw it big, centred on its 2×2 patch
        const ai = bigB.get(i), ab = S.buildings.get(ai);
        if (ab) { if (ab.p >= 1 && tw >= 26) A.longShadow(ctx, cx, cy - hh, s * 1.8, tw * 1.8); drawSpriteF(buildingSprite(ab, ai % W, Math.floor(ai / W)), cx, cy - hh, s * 1.85, ab.f); }
        continue;
      }
      if (bld && BIG.has(bld.t)) continue;
      if (S.occupied.has(i)) continue;
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
        if (bld.p >= 1 && !A_FLAT.has(bld.t) && tw >= 26) A.longShadow(ctx, cx, cy, s, tw);
        drawSpriteF(buildingSprite(bld, wx, y), cx, cy, s, bld.f);
        if (bld.t === 'house' && bld.p >= 1 && tw >= 30) drawYard(cx, cy, s, hw, hh, S.day - (bld.d || 0), hash2(wx, y, 61));
        if (bld.t === 'shipyard' && bld.p >= 1) X.drawFleet(ctx, i, view);
        if (bld.p >= 1 && tw >= 30 && ANIM.has(bld.t)) animate(bld.t, cx, cy, s, wx, y);
        if (bld.t === 'pasture' && bld.p >= 1 && tw >= 30 && !L.tileSnowy(wx, y, bt, rs)) L.drawFarmAnimals(ctx, cx, cy, s, wx, y, animTime, true);
        if (bld.t === 'mine' || bld.t === 'quarry') X.drawSparkle(ctx, i, cx, cy, s, animTime);
        if (bld.t === 'townhall') { const ft = townById(bld.town); if (ft && ft.fest && S.day < ft.fest.until) { festive(ctx, cx, cy, s, tw, ft); festLate.push([cx, cy, ft]); } }
        if (bld.p >= 1 && tw >= 30) {
          if (SMOKY.has(bld.t) && (bld.t !== 'house' || hash2(wx, y, 54) < 0.55)) A.smoke(ctx, cx + (bld.t === 'house' ? -4 : 3) * s, cy - (bld.t === 'townhall' ? 34 : 22) * s, s, animTime, hash2(wx, y, 55) * 9, rs.snow > 0.3);
          if (bld.t === 'house' && hash2(wx, y, 53) < 0.12) A.laundry(ctx, cx + tw * 0.06, cy + tw * 0.2, s, animTime, hash2(wx, y, 56) * 9);
        }
        if (bld.idle && tw >= 26) { // resting: upkeep could not be paid
          const bx = cx, by = cy - tw * 0.55, r = Math.max(7, tw * 0.13);
          ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.strokeStyle = 'rgba(60,46,36,0.6)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#5a6a8a'; ctx.font = `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('z', bx - r * 0.2, by + r * 0.1); ctx.font = `700 ${Math.round(r * 0.75)}px system-ui, sans-serif`; ctx.fillText('z', bx + r * 0.4, by - r * 0.35);
        }
        if (bld.t === 'house' && bld.p >= 1 && tw >= 40 && hash2(wx, y, 51) < 0.2) { // a cat on the doorstep
          const kx = cx + tw * 0.13, ky = cy + tw * 0.2, col = ['#e0a050', '#3c3430', '#9a9a9a', '#f4efe6'][(hash2(wx, y, 52) * 4) | 0], k = s * 1.1;
          const wag = Math.sin(animTime * 2 + wx) * 1.4 * k;
          ctx.fillStyle = 'rgba(30,40,20,0.2)'; ctx.beginPath(); ctx.ellipse(kx, ky, 2.4 * k, 0.9 * k, 0, 0, 6.3); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 0.9 * k; ctx.beginPath(); ctx.moveTo(kx + 1.4 * k, ky - 0.6 * k); ctx.quadraticCurveTo(kx + 3.4 * k, ky - 1 * k, kx + 3 * k + wag * 0.4, ky - 3 * k); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(kx, ky - 1.6 * k, 1.6 * k, 1.9 * k, 0, 0, 6.3); ctx.fill();
          ctx.beginPath(); ctx.arc(kx - 0.3 * k, ky - 3.9 * k, 1.2 * k, 0, 6.3); ctx.fill();
          ctx.beginPath(); ctx.moveTo(kx - 1.3 * k, ky - 4.4 * k); ctx.lineTo(kx - 1 * k, ky - 5.6 * k); ctx.lineTo(kx - 0.4 * k, ky - 4.8 * k);
          ctx.moveTo(kx + 0.1 * k, ky - 4.8 * k); ctx.lineTo(kx + 0.6 * k, ky - 5.6 * k); ctx.lineTo(kx + 0.8 * k, ky - 4.4 * k); ctx.fill();
        }
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
        if (bld.p < 1 && tw >= 30) { // builders at work, hammers swinging
          const bt2 = townById(bld.town), n = bt2 && (bt2._yards || 0) > 0 ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const bx = cx + (k ? -0.22 : 0.24) * tw, by = cy + (k ? 0.1 : 0.06) * tw, face = k ? 1 : -1, ph = hash2(wx, y, 60 + k) * 6;
            const swing = Math.sin(animTime * 6 + ph), ss = s;
            ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(bx, by, 2.4 * ss, 1.1 * ss, 0, 0, 6.3); ctx.fill();
            ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = Math.max(0.8, 0.9 * ss);
            ctx.beginPath(); ctx.moveTo(bx - 0.6 * ss, by - 1.6 * ss); ctx.lineTo(bx - 0.8 * ss, by); ctx.moveTo(bx + 0.6 * ss, by - 1.6 * ss); ctx.lineTo(bx + 0.8 * ss, by); ctx.stroke();
            ctx.fillStyle = k ? '#c0703e' : '#4a78a8'; ctx.fillRect(bx - 1.6 * ss, by - 6 * ss, 3.2 * ss, 4.6 * ss);
            ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(bx, by - 7.6 * ss, 1.6 * ss, 0, 6.3); ctx.fill();
            ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.arc(bx, by - 8.2 * ss, 1.7 * ss, Math.PI, 0); ctx.fill(); // a work cap
            const ang = -0.4 + swing * 0.9, hx = bx + face * Math.cos(ang) * 4 * ss, hy = by - 5 * ss + Math.sin(ang) * 4 * ss;
            ctx.strokeStyle = '#7a5634'; ctx.lineWidth = Math.max(0.8, 0.8 * ss); ctx.beginPath(); ctx.moveTo(bx + face * 1.2 * ss, by - 5 * ss); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.fillStyle = '#5a5a62'; ctx.fillRect(hx - 1 * ss, hy - 0.8 * ss, 2 * ss, 1.6 * ss);
          }
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
        A.drawVillageLife(ctx, cx, cy, s, nb, animTime, tw);
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
      if (S.canals.has(i)) { // now and then a little boat drifts along the canal
        if (tw >= 24 && hash2(wx, y, 91) < 0.2) { const ph = hash2(wx, y, 92) * 6.28; const u = Math.sin(animTime * 0.18 + ph); L.drawBoat(ctx, cx + u * tw * 0.14, cy + u * tw * 0.07, s * 0.8, animTime, ph, false, Math.cos(animTime * 0.18 + ph) > 0 ? 1 : -1); }
        continue;
      }
      if (S.zones.has(i) || world.river[i]) continue;
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
        if (wk) {
          const n = A.herdSize(wk, wx, y), [fx, fy, fleeing] = A.herdOffset(animTime, hash2(wx, y, 26));
          for (let k = 0; k < n; k++) {
            const ph = hash2(wx + k, y, 24) * 6.28, [ox, oy, face] = L.wander(animTime * (wk === 'rabbit' ? 1.6 : 0.8), ph, 0.3);
            L.drawAnimal(ctx, wk, cx + (ox + fx + (k - (n - 1) / 2) * 0.16) * tw, cy + (oy + fy + (k % 2) * 0.05) * tw + tw * 0.06, s * (wk === 'camel' ? 1.15 : 1) * (k && wk !== 'camel' ? 0.85 : 1), fleeing ? 1 : face, animTime * (fleeing ? 3 : 1), ph);
          }
        }
      }
    }
    drawRowWalkers(y);
    A.drawRowLife(ctx, y, view);
    for (const q of S.requests || []) if (q.kind === 'lost' && q.y === y) lostAnimal(ctx, q, s, tw);
  }
  for (const [fx, fy, ft] of festLate) festiveExtras(ctx, fx, fy, s, tw, ft); // lists, rides and arches stand clear of the houses
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
    const face = (t.mood ? MOOD_FACES[t.mood.level] : '') + (t.spec ? ' ' + SPECS[t.spec].icon : '');
    if (tileMode) label(`${t.name} ${face}`, x, y - tw * 0.9, 13, `${Math.floor(t.pop)} folk`);
    if (tileMode && tw < 70 && t.districts) for (const d of t.districts) { // quarter names, softly
      const dx = sx(tileWX(d.x, d.y)), dy = sy(tileWY(d.y));
      ctx.font = `italic 600 ${Math.round(11 + tw * 0.05)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,30,20,0.55)'; ctx.strokeText(d.name, dx, dy - tw * 0.3); ctx.fillStyle = '#fff4dc'; ctx.fillText(d.name, dx, dy - tw * 0.3);
    }
    if (!tileMode) label(`${t.name} ${face}`, x, y - 20, 12);
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
