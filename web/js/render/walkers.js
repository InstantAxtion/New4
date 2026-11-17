// Moved out of render.js to keep modules small. See ARCHITECTURE.md.
import { ageOf, personById, petOf } from '../folk.js';
import { DEFS, M, S, groundDist2, townById } from '../game.js';
import { A_GENTLE, animTime, cam, ch, ctx, cw, lights, markDirty, sx, sy } from '../render.js';
import { TB } from '../sprites.js';
import { H, W, idxOf, tileWX, tileWY, wrapX } from '../world.js';
import * as A from '../alive.js';
import * as L from '../life.js';


// --- villagers walking about (visual only) ---
export const walkers = new Map(); // townId -> array (exported for tests)

// Each walker is one of the town's named villagers (who is out and about depends on the hour).
export function pickFolk(t) {
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

export const CLOTHES = ['#c0503e', '#4a78a8', '#5a9a5a', '#d9a440', '#8a5aa8', '#e8e0d0', '#7a5634'];

export function townTiles(t) {
  const arr = [];
  for (const [i, b] of S.buildings) if (b.town === t.id && b.p >= 1) arr.push(i);
  return arr;
}

export const tileCache = new Map(); let tileCacheStamp = -1;

export const stableTowns = new Set();

export const HORSE_COLS = ['#8a5a3a', '#5a3e2c', '#c8a070', '#3c3430', '#e8e0d0'];

export function invalidateTowns() { tileCacheStamp = -1; }

// Ground distance between two world points (undo the 2:1 iso squash).
export const gdist = (ax, ay, bx, by) => Math.hypot(bx - ax, (by - ay) * 2);

// Open ground people may walk across; every other building is solid (people go inside instead).
export const OPEN = new Set(['farm', 'green', 'fountain', 'apiary', 'vineyard', 'riceterrace', 'oasis', 'cacao', 'orchard', 'quarry', 'smithy', 'dock', 'market']);

export function tileSpot(i, nearX) {
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
export const LANE = 0.07;

export function planWalk(w, tiles, t) {
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
export function clearTransient() { walkers.clear(); visitors.clear(); tileCacheStamp = -1; markDirty(); }

// Visitors: market-day wagons from neighbouring villages, and the odd traveller heading for the tavern.
export const visitors = new Map(); // townId -> array

export function routeVisitor(v, fromTile, toTile, nearX) {
  const p = L.lPath(fromTile % W, Math.floor(fromTile / W), toTile % W, Math.floor(toTile / W));
  const pts = []; let lastX = nearX;
  for (const [x, y] of p) { let X = tileWX(x, y); if (X - lastX > W / 2) X -= W; else if (lastX - X > W / 2) X += W; pts.push([X, tileWY(y) + 0.05]); lastX = X; }
  if (pts.length < 2) pts.push([pts[0][0] + 0.01, pts[0][1]]);
  v.pts = pts; v.seg = []; v.len = 0; v.d = 0; v.k = 0;
  for (let k = 1; k < pts.length; k++) { const d = gdist(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]); v.seg.push(d); v.len += d; }
  v.X = pts[0][0]; v.Y = pts[0][1];
}

export function edgeTileToward(t, nx, ny) {
  const X0 = tileWX(t.x, t.y), Y0 = tileWY(t.y);
  let dX = tileWX(nx, ny) - X0; if (dX > W / 2) dX -= W; else if (dX < -W / 2) dX += W;
  const dY = (tileWY(ny) - Y0) * 2, len = Math.hypot(dX, dY) || 1, r = Math.max(2, t.radius - 0.8);
  const tl = tileOfWorld(X0 + (dX / len) * r, Y0 + ((dY / len) * r) / 2);
  return tl ? tl[1] * W + tl[0] : idxOf(t.x, t.y);
}

export function updateVisitors(dt, t, tiles) {
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
  { // carts haul the goods in from the workplaces to the town hall
    const haul = vs.filter((v) => v.hauler).length, want = Math.min(3, Math.floor((t.n || 0) / 12));
    if (haul < want && Math.random() < dt / 12) {
      const hall = idxOf(t.x, t.y), srcs = tiles.filter((i) => { const b = S.buildings.get(i); return b && b.p >= 1 && DEFS[b.t] && DEFS[b.t].prod && b.t !== 'townhall' && b.t !== 'house' && groundDist2(i % W, Math.floor(i / W), t.x, t.y) > 9; });
      if (srcs.length) {
        const from = srcs[Math.floor(Math.random() * srcs.length)], b = S.buildings.get(from), r = Object.keys(DEFS[b.t].prod)[0];
        const v = { hauler: true, kind: 'hauler', start: from, dest: hall, wait: 0, sp: 0.4, face: 1, ph: Math.random() * 6, c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], rider: true, cart: true,
          load: LOAD_COL[r] || ['#c8a070', '#7aa04a'], moving: false, leaving: false };
        routeVisitor(v, from, hall, tileWX(t.x, t.y)); vs.push(v);
      }
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

export function updateWalkers(dt, visibleTowns) {
  if (tileCacheStamp !== S.buildings.size) {
    tileCache.clear(); tileCacheStamp = S.buildings.size; stableTowns.clear();
    for (const b of S.buildings.values()) if (b.t === 'stable' && b.p >= 1) stableTowns.add(b.town);
  }
  const pace = S.speed === 2 ? 1.6 : 1; // villagers bustle a little quicker at double speed
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
        c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], carry: person && person.j ? Math.random() < 0.55 : Math.random() < 0.2, ph: Math.random() * 6, moving: false });
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

export const LOAD_COL = { food: ['#e2cc8a', '#d8b860'], wood: ['#8a5f3c', '#a8784c'], stone: ['#a8a29a', '#8e8880'], iron: ['#7a828c', '#5e6670'], gold: ['#e8c050', '#c8a030'], wool: ['#f4f0e6', '#e8e2d4'], flour: ['#f4ead8', '#e8dcc0'], bread: ['#d8a05a', '#c08840'] };

// Footpaths: grass wears where villagers often walk off the roads.
export const wear = new Map();

// The tile containing a world point, and how deep inside it the point is (0 = centre, 1 = edge).
export function tileOfWorld(X, Y) {
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
export let walkerRows = new Map();

export function bucketWalkers(visibleTowns) {
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

export function drawRowWalkers(y) {
  const ws = walkerRows.get(y); if (!ws) return;
  ws.sort((a, b) => a.Y - b.Y);
  drawWalkerList(ws);
}

export function drawWalkers(visibleTowns) {
  for (const t of visibleTowns) { const ws = walkers.get(t.id); if (ws) drawWalkerList(ws); }
}

// What a worker carries home: a grain sack, logs, a basket of stone, fish, or a parcel.
export const CARRY = { farm: 'sack', pasture: 'sack', orchard: 'sack', vineyard: 'sack', riceterrace: 'sack', gristmill: 'sack', bakery: 'sack', lumber: 'logs', woodlot: 'logs', quarry: 'stone', pit: 'stone', mine: 'stone', dock: 'fish', shipyard: 'fish', icehut: 'fish' };

export function carryItem(x, y, s, job) {
  const k = CARRY[job] || 'box';
  if (k === 'sack') { ctx.fillStyle = '#e2d0a2'; ctx.beginPath(); ctx.ellipse(x + 1.3 * s, y + 1.2 * s, 1.8 * s, 1.6 * s, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#c8b080'; ctx.fillRect(x + 0.6 * s, y - 0.6 * s, 1.4 * s, 0.8 * s); }
  else if (k === 'logs') { ctx.fillStyle = '#8a5f3c'; ctx.fillRect(x - 1 * s, y + 0.2 * s, 4.6 * s, 1.1 * s); ctx.fillRect(x - 0.6 * s, y - 0.9 * s, 4.6 * s, 1.1 * s); ctx.fillStyle = '#d8b07a'; ctx.fillRect(x + 3.4 * s, y + 0.2 * s, 0.5 * s, 1.1 * s); }
  else if (k === 'stone') { ctx.fillStyle = '#8a6a44'; ctx.fillRect(x, y + 0.4 * s, 2.8 * s, 1.6 * s); ctx.fillStyle = '#a8a29a'; ctx.beginPath(); ctx.arc(x + 0.8 * s, y + 0.4 * s, 0.8 * s, 0, 6.3); ctx.arc(x + 2 * s, y + 0.3 * s, 0.7 * s, 0, 6.3); ctx.fill(); }
  else if (k === 'fish') { ctx.fillStyle = '#8a6a44'; ctx.fillRect(x, y + 0.6 * s, 2.8 * s, 1.4 * s); ctx.fillStyle = '#b8c8d8'; ctx.beginPath(); ctx.ellipse(x + 1.4 * s, y + 0.4 * s, 1.6 * s, 0.6 * s, 0, 0, 6.3); ctx.fill(); }
  else { ctx.fillStyle = '#b08a52'; ctx.fillRect(x, y, 2.6 * s, 2.2 * s); }
}

// Work clothes: each trade has its hat or apron; journeymen add a belt and masters a golden sash.
export const HATS = { farm: 'straw', pasture: 'straw', orchard: 'straw', vineyard: 'straw', riceterrace: 'cone', cacao: 'straw', oasis: 'wrap', apiary: 'veil',
  smithy: 'apron', mine: 'helm', pit: 'helm', quarry: 'helm', lumber: 'cap', woodlot: 'cap', bakery: 'chef', brewery: 'apron', weaver: 'apron', potter: 'apron', glassworks: 'apron',
  market: 'fez', shops: 'fez', spicehouse: 'wrap', school: 'scholar', scriptorium: 'scholar', chapel: 'hood', dock: 'sou', shipyard: 'sou', harbour: 'sou', icehut: 'fur', tavern: 'apron', stable: 'cap', yard: 'cap', tower: 'helm', workshop: 'apron', windmill: 'cap' };

export function outfit(hx, y, s, job, k) {
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

export const t_school = (w) => { const t = townById(w.town0); return t ? t._school : undefined; };

export function drawWalkerList(ws) {
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
          else { const ld = w.load || ['#c8a070', '#7aa04a']; ctx.fillStyle = ld[0]; ctx.fillRect(bx - 3 * s, y - 7.5 * s, 3 * s, 2.5 * s); ctx.fillStyle = ld[1]; ctx.fillRect(bx + 0.3 * s, y - 7 * s, 2.6 * s, 2 * s); }
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
      if (w.carry) carryItem(x + (w.face > 0 ? 0.6 : -3.2) * s, y - 9.5 * s - bob, s, w.job);
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
