// City building: roads first, demand, taxes and the budget, land value, building needs and abandonment,
// town walls, and fires after a raid breaks through.
import { S, on, emit, DEFS, ZONES, totalPop, totalCap, setCityHooks, ownerOf, UPKEEP, groundDist2 } from './game.js';
import { idxOf, wrapX, W, H, B, world } from './world.js';
import * as L from './life.js';

const near = (i, d) => { const x = i % W, y = Math.floor(i / W); return [0, 1, 2, 3].map((k) => { const [nx, ny] = L.stepTile(x, y, k); return ny * W + wrapX(nx); }).slice(0, d); };
const neighbours4 = (i) => near(i, 4);
export const hasRoadNear = (x, y) => neighbours4(idxOf(wrapX(x), y)).some((j) => L.roads.has(j) || S.proads.has(j));

// ---------------- demand ----------------
// Like a city game's RCI bars: what the realm wants built next. Zoned tiles only grow while there is demand.
export function demand() {
  const pop = totalPop(), cap = totalCap();
  let jobs = 0; for (const t of S.towns) jobs += t.jobs || 0;
  const tax = (S.taxRate ?? 0.09) * 100;
  const free = Math.max(0, cap - pop);
  const housing = 45 + (jobs - pop * 0.6) * 1.2 - free * 2.5 - (tax - 9) * 5 + (S.fed ? 0 : -40);
  const workshop = 35 + (pop * 0.6 - jobs) * 1.5 - (tax - 9) * 3;
  const farmland = 30 - (S.rates.food || 0) * 12 + (S.fed ? 0 : 60) - (S.res.food > 2000 ? 40 : 0);
  const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));
  return { housing: clamp(housing), farmland: clamp(farmland), workshop: clamp(workshop) };
}
let demandCache = null, demandDay = -1;
const demandNow = () => { if (demandDay !== Math.floor(S.day * 2)) { demandDay = Math.floor(S.day * 2); demandCache = demand(); } return demandCache; };

// ---------------- land value ----------------
// 0..100 for each plot: paved streets, wells, chapels, parks, schools, markets and water raise it; workshops,
// pits and mines next door lower it.
const LV_SOURCES = { well: [5, 10], fountain: [6, 15], chapel: [7, 15], park: [5, 12], school: [7, 10], market: [7, 12], tavern: [4, 5], green: [5, 10], cathedral: [12, 20], library: [10, 15], gardens: [10, 15] };
const LV_NUISANCE = { workshop: [3, -10], pit: [4, -14], mine: [4, -14], quarry: [4, -10], smithy: [3, -8], glassworks: [3, -8], barracks: [3, -5] };
let lvMap = new Map(), lvStamp = -1;
export function landValue(i) {
  const stamp = S.buildings.size * 7 + Math.floor(S.day / 2) + L.roads.size * 13;
  if (stamp !== lvStamp) { lvStamp = stamp; lvMap = new Map(); }
  if (lvMap.has(i)) return lvMap.get(i);
  const x = i % W, y = Math.floor(i / W);
  let v = 20;
  if (neighbours4(i).some((j) => L.roads.has(j))) v += 10;
  if (neighbours4(i).some((j) => world.river[j] || world.biome[j] <= 1)) v += 6;
  for (const [j, b] of S.buildings) {
    if (b.p < 1 || b.ab) continue;
    const src = LV_SOURCES[b.t] || LV_NUISANCE[b.t]; if (!src) continue;
    const d2 = groundDist2(x, y, j % W, Math.floor(j / W));
    if (d2 <= src[0] * src[0]) v += src[1] * (1 - Math.sqrt(d2) / (src[0] + 1));
  }
  const t = ownerOf(x, y);
  if (t) { if (t.capital) v += 5; v += Object.keys(t.imp || {}).length * 3; }
  v = Math.max(0, Math.min(100, Math.round(v)));
  lvMap.set(i, v);
  return v;
}
export const LV_FOR_LEVEL = [0, 0, 35, 60]; // a town house needs 35, a manor 60

// ---------------- needs and abandonment ----------------
// Every building needs a road beside it; from Village tier homes also need fresh water (a well, fountain or
// river nearby). Unmet needs show as icons; after ten days the building empties. Fix the need and folk return.
const WATER = new Set(['well', 'fountain']);
function needOf(i, b) {
  const d = DEFS[b.t]; if (!d || b.t === 'townhall' || d.civic || d.wonder) return null;
  if (!neighbours4(i).some((j) => L.roads.has(j) || S.proads.has(j)) && !L.roads.has(i)) return 'road';
  if (b.t === 'house' && S.tier >= 1) {
    const x = i % W, y = Math.floor(i / W);
    let water = neighbours4(i).some((j) => world.river[j] || S.canals.has(j));
    if (!water) for (const [j, w] of S.buildings) if (WATER.has(w.t) && w.p >= 1 && groundDist2(x, y, j % W, Math.floor(j / W)) <= 49) { water = true; break; }
    if (!water) return 'water';
  }
  return null;
}
function stepNeeds(dd) {
  let changed = false;
  for (const [i, b] of S.buildings) {
    if (b.p < 1 || b.ab === 'ruin' || b.fire) continue;
    const need = needOf(i, b);
    if (need) {
      b.need = need; b.needT = (b.needT || 0) + dd;
      if (!b.ab && b.needT >= 10) { b.ab = need; changed = true; emit('abandoned', { b, i }); }
    } else if (b.need || b.ab) {
      b.need = null; b.needT = 0;
      if (b.ab && b.ab !== 'ruin') { b.ab = 0; changed = true; emit('reoccupied', { b, i }); }
    }
  }
  if (changed) emit('change');
}

// ---------------- fires and ruins ----------------
export function burn(i) { const b = S.buildings.get(i); if (!b || b.t === 'townhall') return false; b.fire = S.day + 3; emit('change'); return true; }
function stepFires() {
  for (const b of S.buildings.values()) if (b.fire && S.day >= b.fire) { b.fire = 0; b.ab = 'ruin'; emit('change'); }
}
export const repairCost = (b) => Object.fromEntries(Object.entries(DEFS[b.t].cost || { wood: 10 }).map(([k, v]) => [k, Math.ceil(v / 2)]));
export function repair(i) {
  const b = S.buildings.get(i); if (!b || b.ab !== 'ruin') return false;
  const c = repairCost(b); if (!Object.entries(c).every(([k, v]) => S.res[k] >= v)) return false;
  for (const [k, v] of Object.entries(c)) S.res[k] -= v;
  b.ab = 0; b.p = 0.4; b.need = null; b.needT = 0; emit('change'); return true; // builders finish the rest
}
// Which buildings a raid can reach: anything not covered by a tower, a fort or the town walls.
export function protectedTile(i) {
  const x = i % W, y = Math.floor(i / W);
  for (const [j, b] of S.buildings) {
    if (b.p < 1) continue;
    const r = b.t === 'fort' ? 7 : b.t === 'tower' ? 5 : 0; if (!r) continue;
    if (groundDist2(x, y, j % W, Math.floor(j / W)) <= r * r) return true;
  }
  for (const j of S.walls || []) if (groundDist2(x, y, j % W, Math.floor(j / W)) <= 4) return true;
  return false;
}
// Called by war.js when raiders break through.
export function raidFires(t, severity) {
  const cand = [];
  for (const [i, b] of S.buildings) if (b.town === t.id && b.p >= 1 && b.t !== 'townhall' && !b.fire && b.ab !== 'ruin' && !protectedTile(i)) cand.push(i);
  cand.sort(() => Math.random() - 0.5);
  const n = Math.min(cand.length, Math.max(1, Math.round(severity)));
  for (const i of cand.slice(0, n)) burn(i);
  return n && cand.length ? n : 0;
}

// ---------------- walls ----------------
// Walls are painted like roads. Where a wall crosses a street it becomes a gate. They cost a little stone.
export const WALL_COST = { stone: 3 };
export function canWall(x, y) {
  x = wrapX(x); if (y < 1 || y >= H - 1) return false;
  const i = idxOf(x, y);
  if ((S.walls || new Set()).has(i) || S.buildings.has(i) || S.occupied.has(i) || S.canals.has(i) || world.biome[i] <= 1 || world.biome[i] === B.MOUNTAIN) return false;
  return !!ownerOf(x, y) && S.res.stone >= WALL_COST.stone;
}
export function placeWall(x, y) {
  if (!canWall(x, y)) return false;
  const i = idxOf(wrapX(x), y); (S.walls ||= new Set()).add(i); S.zones.delete(i); S.res.stone -= WALL_COST.stone; emit('change'); return true;
}
export const wallDefence = (t) => { let n = 0; for (const j of S.walls || []) if (groundDist2(j % W, Math.floor(j / W), t.x, t.y) <= (t.radius + 2) ** 2) n++; return Math.min(30, n * 0.5); };

// ---------------- budget ----------------
export function budget() {
  const pop = totalPop(), rate = S.taxRate ?? 0.09;
  const taxes = pop * 0.02 * (rate / 0.09);
  let upkeep = 0; for (const b of S.buildings.values()) if (b.p >= 1 && UPKEEP[b.t]) upkeep += UPKEEP[b.t].gold || 0;
  let soldiers = 0; for (const t of S.towns) soldiers += t.garrison || 0; if (S.army) soldiers += S.army.n;
  return { taxes, upkeep, soldiers: soldiers * 0.03, trade: Math.max(0, (S.rates.gold || 0) - taxes + upkeep + soldiers * 0.03) };
}
export function setTax(v) { S.taxRate = Math.max(0, Math.min(0.2, v)); emit('change'); }

// ---------------- buildings face their street ----------------
on('built', ({ b, i }) => {
  if (!DEFS[b.t] || DEFS[b.t].wonder) return;
  const n = neighbours4(i); // directions: 0 down-right, 1 up-left, 2 down-left, 3 up-right
  if (L.roads.has(n[0]) && !L.roads.has(n[2])) b.f = 1; else if (L.roads.has(n[2])) b.f = 0;
});

setCityHooks({
  wallCan: (x, y) => canWall(x, y), wallPlace: (x, y) => placeWall(x, y),
  roadNear: (x, y) => hasRoadNear(x, y),
  demandOk: (zone) => (demandNow()[zone] ?? 1) > 0,
  landOk: (i, lv) => landValue(i) >= LV_FOR_LEVEL[lv],
});
let needT = 0;
on('stepped', (dd) => { if (!S.started) return; stepFires(); if ((needT += dd) >= 1) { stepNeeds(needT); needT = 0; } });
export { ZONES };
