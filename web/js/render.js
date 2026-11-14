// Isometric renderer with an overview (atlas) mode for far zoom levels.
import { BIOMES, W, H, B, world, wrapX, tileWX, tileWY, biomeAt, isWater } from './world.js';
import { SPR, TB, DECOR_DENSITY } from './sprites.js';
import { S, M, DEFS, ZONES, townById, canPlace, canZone, canFound, canStart, ownerOf, groundDist2, CONTACT_RANGE, inContact } from './game.js';
import { hash2 } from './noise.js';

export const TILE_MODE_TW = 20;
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
  const halfH = ch / 2 / cam.tw;
  cam.y = halfH * 2 >= 1000 ? 500 : Math.max(halfH, Math.min(1000 - halfH, cam.y));
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
const walkers = new Map(); // townId -> array
const CLOTHES = ['#c0503e', '#4a78a8', '#5a9a5a', '#d9a440', '#8a5aa8', '#e8e0d0', '#7a5634'];
function townTiles(t) {
  const arr = [];
  for (const [i, b] of S.buildings) if (b.town === t.id && b.p >= 1) arr.push(i);
  return arr;
}
const tileCache = new Map(); let tileCacheStamp = -1;
export function invalidateTowns() { tileCacheStamp = -1; }
function updateWalkers(dt, visibleTowns) {
  if (tileCacheStamp !== S.buildings.size) { tileCache.clear(); tileCacheStamp = S.buildings.size; }
  for (const t of visibleTowns) {
    if (!tileCache.has(t.id)) tileCache.set(t.id, townTiles(t));
    const tiles = tileCache.get(t.id);
    if (tiles.length < 1) continue;
    let ws = walkers.get(t.id);
    if (!ws) walkers.set(t.id, (ws = []));
    const want = Math.min(28, Math.ceil(t.pop / 2));
    while (ws.length < want) {
      const a = tiles[Math.floor(Math.random() * tiles.length)];
      ws.push({ a, b: a, t: 1, sp: 0.25 + Math.random() * 0.2, c: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], carry: Math.random() < 0.3, ph: Math.random() * 6 });
    }
    ws.length = want;
    for (const w of ws) {
      w.t += dt * w.sp * Math.max(1, S.speed) / Math.max(0.5, w.len || 1);
      if (w.t >= 1) {
        w.a = w.b; w.b = tiles[Math.floor(Math.random() * tiles.length)]; w.t = 0;
        const ax = w.a % W, ay = Math.floor(w.a / W), bx = w.b % W, by = Math.floor(w.b / W);
        w.len = Math.sqrt(groundDist2(ax, ay, bx, by)) + 0.3;
        w.ox = (Math.random() - 0.5) * 0.4; w.oy = (Math.random() - 0.5) * 0.15;
      }
      w.ph += dt * 8;
    }
  }
}
function drawWalkers(visibleTowns) {
  const s = cam.tw / TB;
  for (const t of visibleTowns) {
    const ws = walkers.get(t.id); if (!ws) continue;
    for (const w of ws) {
      const ax = w.a % W, ay = Math.floor(w.a / W), bx = w.b % W, by = Math.floor(w.b / W);
      let X0 = tileWX(ax, ay), X1 = tileWX(bx, by);
      if (X1 - X0 > W / 2) X1 -= W; else if (X0 - X1 > W / 2) X1 += W;
      const k = Math.min(1, w.t);
      const X = X0 + (X1 - X0) * k + (w.ox || 0) + 0.18, Y = tileWY(ay) + (tileWY(by) - tileWY(ay)) * k + (w.oy || 0) + 0.06;
      const x = sx(X), y = sy(Y);
      if (x < -20 || x > cw + 20 || y < -20 || y > ch + 20) continue;
      const bob = Math.abs(Math.sin(w.ph)) * 0.8 * s;
      ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 2.4 * s, 1.1 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = w.c; ctx.fillRect(x - 1.6 * s, y - 6 * s - bob, 3.2 * s, 5 * s);
      ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x, y - 7.6 * s - bob, 1.6 * s, 0, 6.3); ctx.fill();
      if (w.carry) { ctx.fillStyle = '#b08a52'; ctx.fillRect(x + 0.6 * s, y - 9.5 * s - bob, 2.6 * s, 2.2 * s); }
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
  const arr = SPR.build[b.t];
  return arr[Math.floor(hash2(x, y, 3) * arr.length)];
}
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
let lastT = performance.now(), animTime = 0;
export function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; animTime += dt;
  stepFlight(dt);
  const tileMode = cam.tw >= TILE_MODE_TW;
  const visTowns = tileMode && cam.tw >= 30 ? S.towns.filter((t) => Math.abs(sx(tileWX(t.x, t.y)) - cw / 2) < cw / 2 + t.radius * cam.tw && Math.abs(sy(tileWY(t.y)) - ch / 2) < ch / 2 + t.radius * cam.tw) : [];
  if (visTowns.length) { updateWalkers(dt, visTowns); dirty = true; }
  if (!dirty || !world.ready) return;
  dirty = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = OCEAN; ctx.fillRect(0, 0, cw, ch);
  if (tileMode) drawTiles(); else drawOverview();
  if (visTowns.length) drawWalkers(visTowns);
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
  // polar fade
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
  const tint = new Path2D(), border = new Path2D(), valid = new Path2D(), invalid = new Path2D();
  let anyOwn = false;
  for (let y = yA; y <= yB; y++) {
    const off = (y & 1) * 0.5, cy = sy(tileWY(y));
    const xa = Math.floor(X0 - off - 0.5), xb = Math.ceil(X1 - off);
    const rowBase = y * W;
    for (let x = xa; x <= xb; x++) {
      const wx = ((x % W) + W) % W;
      const b = world.biome[rowBase + wx];
      const cx = sx(x + 0.5 + off);
      if (b !== B.OCEAN) {
        const arr = SPR.ground[b];
        drawSprite(arr[(hash2(wx, y, 1) * 4) | 0], cx, cy, s);
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
            if (ok) diamondPath(valid, cx, cy, hw * 0.8, hh * 0.8);
          }
        }
      }
    }
  }
  if (anyOwn) {
    ctx.fillStyle = 'rgba(255,226,150,0.10)'; ctx.fill(tint);
    if (placing) { ctx.fillStyle = 'rgba(140,255,140,0.22)'; ctx.fill(valid); }
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
    ctx.beginPath(); diamondPath(ctx, cx, cy, hw, hh); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
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
    for (let x = xa; x <= xb; x++) {
      const wx = ((x % W) + W) % W, i = rowBase + wx;
      const cx = sx(x + 0.5 + off);
      const bld = S.buildings.get(i);
      if (bld) {
        drawSprite(buildingSprite(bld, wx, y), cx, cy, s);
        if (bld.p < 1) {
          const bw = tw * 0.5, bh = Math.max(3, tw / 16);
          ctx.fillStyle = 'rgba(40,30,20,0.6)'; ctx.fillRect(cx - bw / 2, cy - tw * 0.42, bw, bh);
          ctx.fillStyle = '#ffd36a'; ctx.fillRect(cx - bw / 2, cy - tw * 0.42, bw * bld.p, bh);
        }
        continue;
      }
      const nb = S.nbIndex.get(i);
      if (nb) {
        drawSprite(SPR.build.village[nb.id % 3], cx, cy, s);
        // banner in their colour
        const fx = cx + 12 * s, fy = cy - 4 * s;
        ctx.strokeStyle = '#5a4030'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22 * s); ctx.stroke();
        ctx.fillStyle = `hsl(${nb.hue},55%,55%)`; ctx.fillRect(fx, fy - 22 * s, 9 * s, 6 * s);
        continue;
      }
      const b = world.biome[i];
      const dens = DECOR_DENSITY[b];
      if (dens && hash2(wx, y, 7) < dens) {
        if (S.zones.has(i)) continue;
        let arr = SPR.decor[b];
        if (b === B.MOUNTAIN && hash2(wx, y, 8) < 0.3) arr = SPR.misc.snowpeak;
        drawSprite(arr[(hash2(wx, y, 2) * arr.length) | 0], cx, cy, s);
      }
    }
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
    if (tileMode) label(t.name, x, y - tw * 0.9, 13, `${Math.floor(t.pop)} folk`);
    else label(t.name, x, y - 20, 12);
  }
  if ((tileMode && tw >= 24) || (!tileMode && tw >= 6)) {
    for (const n of S.neighbors) {
      if (n.joined) continue;
      const x = sx(tileWX(n.x, n.y)), y = sy(tileWY(n.y));
      if (x < -80 || x > cw + 80 || y < -40 || y > ch + 60) continue;
      label(n.name, x, y - (tileMode ? tw * 0.7 : 9), 11);
    }
  }
}
