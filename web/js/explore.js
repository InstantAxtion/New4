// Explorers and their journal, highways between towns, the shipyard, and rare finds.
import { W, H, B, world, tileWX, tileWY, idxOf, wrapX, tileLat } from './world.js';
import { S, on, emit, townById, groundDist2, affordable, continentAt, hasStables, count, setFerryCheck } from './game.js';
import { hash2 } from './noise.js';
import * as L from './life.js';
import { YEAR } from './seasons.js';

// ---------------- landmarks: real natural wonders (lon, lat), with a line for the journal ----------------
export const LANDMARKS = [
  ['Mount Everest', 86.9, 28.0, '⛰', 'The highest peak on Earth, its summit wrapped in cloud and wind.'],
  ['Kilimanjaro', 37.4, -3.1, '⛰', 'A lone snow-capped mountain rising above the warm plains.'],
  ['The Sahara', 5, 23, '🏜', 'An ocean of golden dunes that stretches past every horizon.'],
  ['Victoria Falls', 25.9, -17.9, '💧', 'Thundering water and a mist that hangs rainbows in the air.'],
  ['Niagara Falls', -79.1, 43.1, '💧', 'Three great falls roaring into a deep green gorge.'],
  ['The Grand Canyon', -112.1, 36.1, '🏞', 'Layer upon layer of red rock, carved by a river over ages.'],
  ['The Amazon', -60, -3.5, '🌳', 'A green sea of forest, alive with calls and colour.'],
  ['Mont Blanc', 6.9, 45.8, '⛰', 'A white crown above alpine meadows and blue glaciers.'],
  ['Mount Fuji', 138.7, 35.4, '🗻', 'A near-perfect cone, mirrored in still lakes at dawn.'],
  ['Uluru', 131.0, -25.3, '🪨', 'A great red rock that glows like embers at sunset.'],
  ['Iceland’s geysers', -20.3, 64.3, '♨', 'Hot springs that leap skyward from steaming ground.'],
  ['The Northern Lights', 25, 68.5, '✨', 'Green ribbons of light dancing across the winter sky.'],
  ['The Great Barrier Reef', 146.5, -18.3, '🐠', 'A sunlit garden of coral teeming with bright fish.'],
  ['Ha Long Bay', 107.1, 20.9, '⛵', 'Thousands of limestone islands rising from emerald water.'],
  ['The Atacama', -69.5, -23.5, '🏜', 'The driest of deserts, under the clearest of starry skies.'],
  ['The Dead Sea', 35.5, 31.5, '🌊', 'Water so salty that travellers float without trying.'],
  ['Lake Baikal', 108, 53.5, '🏞', 'The deepest lake on Earth, clear as glass.'],
  ['The Galápagos', -90.5, -0.6, '🐢', 'Islands of giant tortoises and curious, fearless birds.'],
  ['Patagonian glaciers', -73.2, -50.5, '🧊', 'Rivers of blue ice that crack and thunder into lakes.'],
  ['The Matterhorn', 7.66, 45.98, '⛰', 'A sharp stone horn standing alone above the valleys.'],
  ['Table Mountain', 18.4, -33.96, '⛰', 'A flat-topped mountain wearing a tablecloth of cloud.'],
  ['Angel Falls', -62.5, 5.97, '💧', 'Water tumbling from a cliff so tall it turns to mist.'],
  ['The Serengeti', 34.8, -2.3, '🦓', 'Endless grasslands where great herds wander.'],
  ['Fjords of Norway', 6.7, 61.1, '🏞', 'Deep blue inlets between towering green cliffs.'],
  ['The Yellowstone springs', -110.6, 44.5, '♨', 'Pools of every colour steaming in the forest.'],
  ['Mount Kailash', 81.3, 31.07, '⛰', 'A remote, snow-banded peak in a high, quiet land.'],
  ['The Pantanal', -57, -17.5, '🦜', 'A vast wetland where birds gather in their thousands.'],
  ['Socotra', 53.8, 12.5, '🌳', 'An island of strange umbrella-shaped trees.'],
  ['The Okavango Delta', 22.9, -19.3, '🐘', 'A river that spreads into a green maze in the desert.'],
  ['Lake Titicaca', -69.3, -15.8, '🏞', 'A high, shining lake among cold mountains.'],
];
export const lmTile = (k) => { const [, lon, lat] = LANDMARKS[k]; const y = Math.round(((90 - lat) / 180) * H); return [wrapX(Math.round(((lon + 180) / 360) * W - 0.5 - (y & 1) * 0.5)), y]; };
const dist = (ax, ay, bx, by) => Math.sqrt(groundDist2(ax, ay, bx, by));

// ---------------- expeditions ----------------
export const EXPEDITION_COST = { food: 40, gold: 30 };
export const EXPLORE_TIER = 1;
export const MAX_EXPEDITIONS = 2;
export function expeditionPlan(k) {
  const [lx, ly] = lmTile(k);
  let best = null;
  for (const t of S.towns) { const d = dist(t.x, t.y, lx, ly); if (!best || d < best.d) best = { t, d }; }
  if (!best) return null;
  const overseas = continentAt(lx, ly) !== continentAt(best.t.x, best.t.y);
  const harbour = [...S.buildings.values()].some((b) => b.t === 'harbour' && b.p >= 1);
  const speed = hasStables() ? 7 : 4.5; // tiles a day
  const days = Math.max(6, Math.round((best.d * 2) / speed));
  return { town: best.t, d: best.d, days, overseas, ok: !overseas || harbour, need: overseas && !harbour ? 'Needs a Harbour to sail there' : null };
}
export function canExplore(k) {
  if (S.tier < EXPLORE_TIER) return { ok: false, reason: 'Expeditions begin at Village tier.' };
  if ((S.explored || []).includes(k)) return { ok: false, reason: 'Already in your journal.' };
  if ((S.expeditions || []).some((e) => e.lm === k)) return { ok: false, reason: 'A party is already on its way.' };
  if ((S.expeditions || []).length >= MAX_EXPEDITIONS) return { ok: false, reason: `Up to ${MAX_EXPEDITIONS} parties can travel at once.` };
  const pl = expeditionPlan(k); if (!pl) return { ok: false, reason: 'No town to set out from.' };
  if (!pl.ok) return { ok: false, reason: pl.need };
  if (!affordable(EXPEDITION_COST)) return { ok: false, reason: 'Needs 40 food and 30 gold for supplies.' };
  return { ok: true, plan: pl };
}
export function sendExpedition(k) {
  const c = canExplore(k); if (!c.ok) return c;
  for (const [r, v] of Object.entries(EXPEDITION_COST)) S.res[r] -= v;
  const t = c.plan.town, folk = (t.folk || []).filter((p) => S.day - p.b > 20 * YEAR && S.day - p.b < 55 * YEAR);
  const leader = folk.length ? folk[Math.floor(Math.random() * folk.length)] : null;
  (S.expeditions ||= []).push({ lm: k, town: t.id, start: S.day, days: c.plan.days, leader: leader ? `${leader.f} ${leader.l}` : 'a band of travellers', horse: hasStables(), half: false });
  emit('toast', `🧭 ${leader ? leader.f : 'Explorers'} set out from ${t.name} for ${LANDMARKS[k][0]}.`); emit('change');
  return { ok: true };
}
function stepExpeditions() {
  for (let j = (S.expeditions || []).length - 1; j >= 0; j--) {
    const e = S.expeditions[j], u = (S.day - e.start) / e.days;
    if (u >= 0.5 && !e.half) { e.half = true; emit('toast', `${LANDMARKS[e.lm][3]} ${e.leader} has reached ${LANDMARKS[e.lm][0]}!`); }
    if (u >= 1) {
      S.expeditions.splice(j, 1);
      (S.explored ||= []).push(e.lm);
      const reward = 40 + Math.round(e.days * 4);
      S.res.gold += reward;
      (S.journal ||= []).unshift({ lm: e.lm, d: Math.floor(S.day), who: e.leader, from: e.town, text: LANDMARKS[e.lm][4] });
      emit('toast', `📖 ${e.leader} returned with tales of ${LANDMARKS[e.lm][0]} (+${reward} gold).`);
      emit('discovered', e); emit('change');
    }
  }
}
// Where an expedition party is right now (world coords), for drawing on the map.
export function partyPos(e) {
  const t = townById(e.town); if (!t) return null;
  const [lx, ly] = lmTile(e.lm);
  let u = (S.day - e.start) / e.days; u = u < 0.5 ? u * 2 : (1 - u) * 2;
  let X0 = tileWX(t.x, t.y), X1 = tileWX(lx, ly); if (X1 - X0 > W / 2) X1 -= W; else if (X0 - X1 > W / 2) X1 += W;
  return { X: X0 + (X1 - X0) * u, Y: tileWY(t.y) + (tileWY(ly) - tileWY(t.y)) * u, out: (S.day - e.start) / e.days < 0.5 };
}

// ---------------- highways between your towns ----------------
export let highways = []; // [{a, b, tiles:[idx...]}]
function planHighways(mark) {
  highways = [];
  const ts = S.towns.slice();
  if (ts.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const d = dist(ts[i].x, ts[i].y, ts[j].x, ts[j].y);
    if (d <= 110 && continentAt(ts[i].x, ts[i].y) === continentAt(ts[j].x, ts[j].y)) pairs.push([d, ts[i], ts[j]]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const root = new Map(ts.map((t) => [t.id, t.id])); const find = (x) => (root.get(x) === x ? x : find(root.get(x)));
  for (const [, a, b] of pairs) {
    if (find(a.id) === find(b.id)) continue;
    const path = landRoute(a, b);
    if (!path) continue;
    root.set(find(a.id), find(b.id));
    const tiles = [];
    for (let k = 1; k < path.length; k++) {
      const [x, y, d] = path[k], [px, py] = path[k - 1], pi = idxOf(px, py), ci = idxOf(x, y);
      tiles.push(ci);
      if (S.occupied.has(pi) || S.occupied.has(ci) || S.buildings.has(pi) || S.buildings.has(ci) || world.biome[pi] <= 1 || world.biome[ci] <= 1) continue;
      mark(pi, d); mark(ci, [1, 0, 3, 2][d]);
    }
    highways.push({ a: a.id, b: b.id, path });
  }
}
// An overland route between two towns that steps around the sea and around buildings.
const routeCache = new Map();
function landRoute(a, b) {
  const key = a.id + ':' + b.id + ':' + a.x + ',' + a.y + ':' + b.x + ',' + b.y;
  const hit = routeCache.get(key);
  if (hit !== undefined && (hit === null ? routeCache.get(key + '#n') === S.buildings.size : hit.every(([x, y], k) => k === 0 || k === hit.length - 1 || !S.buildings.has(idxOf(x, y))))) return hit;
  const start = idxOf(a.x, a.y), goal = idxOf(b.x, b.y);
  const mx = (tileWX(a.x, a.y) + tileWX(b.x, b.y)) / 2, my = (tileWY(a.y) + tileWY(b.y)) / 2;
  const R = dist(a.x, a.y, b.x, b.y) / 2 + 30;
  const inBox = (x, y) => { let dx = tileWX(x, y) - mx; if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W; const dy = (tileWY(y) - my) * 2; return dx * dx + dy * dy <= R * R; };
  const parent = new Map([[start, -1]]), pdir = new Map(), q = [start];
  let found = false;
  for (let h = 0; h < q.length && !found; h++) {
    const i = q[h], x = i % W, y = Math.floor(i / W);
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = L.stepTile(x, y, d); if (ny < 1 || ny >= H - 1) continue;
      const ni = idxOf(nx, ny);
      if (parent.has(ni) || !inBox(nx, ny)) continue;
      if (ni !== goal && (world.biome[ni] <= 1 || S.buildings.has(ni) || S.occupied.has(ni))) continue;
      parent.set(ni, i); pdir.set(ni, d); q.push(ni);
      if (ni === goal) { found = true; break; }
    }
  }
  if (!found) { routeCache.set(key, null); routeCache.set(key + '#n', S.buildings.size); return null; }
  const out = [];
  for (let i = goal; i !== -1; i = parent.get(i)) out.push([i % W, Math.floor(i / W), pdir.has(i) ? pdir.get(i) : 0]);
  out.reverse();
  routeCache.set(key, out);
  return out;
}
L.setExtraRoads(planHighways);
// Carts and riders travelling the highways.
export function drawHighwayTraffic(ctx, v) {
  if (S.settings.gentle) return;
  const t = v.time;
  for (const h of highways) {
    const n = h.path.length; if (n < 4) continue;
    for (let c = 0; c < 2; c++) {
      const u0 = (t * 0.8 / n + c * 0.5 + h.a * 0.13) % 2, u = u0 > 1 ? 2 - u0 : u0, f = u * (n - 1), k = Math.floor(f), r = f - k;
      const [x0, y0] = h.path[k], [x1, y1] = h.path[Math.min(n - 1, k + 1)];
      let X0 = tileWX(x0, y0), X1 = tileWX(x1, y1); if (X1 - X0 > W / 2) X1 -= W; else if (X0 - X1 > W / 2) X1 += W;
      const X = X0 + (X1 - X0) * r, Y = tileWY(y0) + (tileWY(y1) - tileWY(y0)) * r + 0.04;
      const x = v.sx(X), y = v.sy(Y);
      if (x < -30 || x > v.cw + 30 || y < -30 || y > v.ch + 30) continue;
      const face = (X1 - X0) * (u0 > 1 ? -1 : 1) >= 0 ? 1 : -1;
      if (v.tw < 14) { if (v.tw >= 3) { ctx.fillStyle = '#7a5634'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } continue; }
      const s = v.s;
      L.drawAnimal(ctx, 'horse', x + face * 7 * s, y, s * 1.1, face, t * 1.5, h.a + c);
      ctx.fillStyle = '#9a7048'; ctx.fillRect(x - 4 * s, y - 5 * s, 8 * s, 3 * s);
      ctx.fillStyle = c ? '#d9a440' : '#7aa04a'; ctx.fillRect(x - 3 * s, y - 7.5 * s, 6 * s, 2.5 * s);
      ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(x - 2.2 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.arc(x + 2.4 * s, y - 1.6 * s, 1.6 * s, 0, 6.3); ctx.fill();
    }
  }
}

// Caravans: covered wagons with outriders on your chosen routes.
export function drawCaravans(ctx, v) {
  const t = v.time;
  for (const [ai, bi] of S.caravans || []) {
    const a = S.towns.find((q) => q.id === ai), b = S.towns.find((q) => q.id === bi); if (!a || !b) continue;
    const path = landRoute(a, b); if (!path || path.length < 3) continue;
    const n = path.length, u0 = (t * 0.55 / n + ai * 0.21) % 2, u = u0 > 1 ? 2 - u0 : u0, f = u * (n - 1), k = Math.floor(f), r = f - k;
    const [x0, y0] = path[k], [x1, y1] = path[Math.min(n - 1, k + 1)];
    let X0 = tileWX(x0, y0), X1 = tileWX(x1, y1); if (X1 - X0 > W / 2) X1 -= W; else if (X0 - X1 > W / 2) X1 += W;
    const x = v.sx(X0 + (X1 - X0) * r), y = v.sy(tileWY(y0) + (tileWY(y1) - tileWY(y0)) * r + 0.04);
    if (x < -40 || x > v.cw + 40 || y < -40 || y > v.ch + 40) continue;
    const face = (X1 - X0) * (u0 > 1 ? -1 : 1) >= 0 ? 1 : -1, s = v.s;
    if (v.tw < 14) { if (v.tw >= 3) { ctx.fillStyle = '#f4ead8'; ctx.fillRect(x - 2, y - 2, 4, 4); } continue; }
    L.drawAnimal(ctx, 'horse', x + face * 9 * s, y, s * 1.1, face, t * 1.5, ai);
    ctx.fillStyle = '#8a5a3c'; ctx.fillRect(x - 5 * s, y - 5 * s, 10 * s, 3 * s);
    ctx.fillStyle = '#f4ead8'; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 5 * s); ctx.quadraticCurveTo(x, y - 13 * s, x + 5 * s, y - 5 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,0.6)'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 5 * s); ctx.lineTo(x - 1.5 * s, y - 9.5 * s); ctx.moveTo(x + 2 * s, y - 5 * s); ctx.lineTo(x + 1.5 * s, y - 9.5 * s); ctx.stroke();
    ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.arc(x - 3 * s, y - 1.6 * s, 1.8 * s, 0, 6.3); ctx.arc(x + 3 * s, y - 1.6 * s, 1.8 * s, 0, 6.3); ctx.fill();
    L.drawAnimal(ctx, 'horse', x - face * 8 * s, y + 2 * s, s, face, t * 1.5, ai + 3); // an outrider behind
  }
}
// ---------------- shipyard: fishing fleet and ferries ----------------
export const FERRY_RANGE = 40;
export function shipyards() { const out = []; for (const [i, b] of S.buildings) if (b.t === 'shipyard' && b.p >= 1 && !b.idle) out.push(i); return out; }
// A shipyard's ferries can carry settlers across a short stretch of sea.
export function ferryReaches(x, y) {
  return shipyards().some((i) => dist(i % W, Math.floor(i / W), x, y) <= FERRY_RANGE);
}
const waterNear = new Map();
function nearWater(i) {
  if (waterNear.has(i)) return waterNear.get(i);
  const x = i % W, y = Math.floor(i / W), out = [];
  for (let dy = -6; dy <= 6; dy++) for (let dx = -3; dx <= 3; dx++) {
    const j = idxOf(x + dx, y + dy); if (world.biome[j] <= 1 || (world.river && world.river[j])) out.push([wrapX(x + dx), y + dy]);
  }
  waterNear.set(i, out); return out;
}
export function drawFleet(ctx, i, v) {
  if (S.settings.gentle || v.tw < 24) return;
  const spots = nearWater(i); if (!spots.length) return;
  const t = v.time;
  for (let k = 0; k < Math.min(3, spots.length); k++) {
    const [x, y] = spots[Math.floor(hash2(i, k, 71) * spots.length)];
    const ph = hash2(x, y, 72) * 6.28, [ox, oy, face] = L.wander(t * 0.7, ph, 0.45);
    L.drawBoat(ctx, v.sx(tileWX(x, y) + ox), v.sy(tileWY(y) + oy), v.s, t, ph, false, face);
  }
}

// ---------------- rare finds in mines and quarries ----------------
const FINDS = [
  ['silver', 'a vein of silver', 70, '🥈'], ['gold', 'a seam of gold', 130, '🪙'], ['gems', 'a pocket of gems', 220, '💎'],
  ['fossil', 'an ancient fossil', 50, '🦴'], ['geode', 'a sparkling geode', 90, '🔮'],
];
export const sparkle = new Map(); // building idx -> until day
function stepFinds(dd) {
  for (const [i, b] of S.buildings) {
    if ((b.t !== 'mine' && b.t !== 'quarry') || b.p < 1 || b.idle) continue;
    if (Math.random() > 0.0035 * dd) continue;
    const f = FINDS[Math.floor(Math.random() * FINDS.length)];
    S.res.gold += f[2];
    (S.treasures ||= {})[f[0]] = (S.treasures[f[0]] || 0) + 1;
    sparkle.set(i, S.day + 4);
    const t = townById(b.town);
    emit('toast', `${f[3]} Miners in ${t ? t.name : 'your realm'} found ${f[1]}! (+${f[2]} gold)`);
    emit('find', { i, kind: f[0], t });
  }
}
export function drawSparkle(ctx, i, cx, cy, s, t) {
  const until = sparkle.get(i); if (!until || S.day > until) return;
  for (let k = 0; k < 5; k++) {
    const a = t * 2 + k * 1.3, r = (6 + (k % 3) * 4) * s, glow = (Math.sin(t * 5 + k) + 1) / 2;
    const x = cx + Math.cos(a) * r, y = cy - 10 * s + Math.sin(a) * r * 0.5;
    ctx.fillStyle = `rgba(255,240,170,${0.4 + glow * 0.6})`;
    ctx.beginPath(); ctx.moveTo(x, y - 2.4 * s); ctx.lineTo(x + 0.7 * s, y); ctx.lineTo(x, y + 2.4 * s); ctx.lineTo(x - 0.7 * s, y); ctx.closePath(); ctx.fill();
  }
}

on('stepped', (dd) => { stepExpeditions(); stepFinds(dd); });

setFerryCheck(ferryReaches);
