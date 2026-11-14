// Game state, rules and simulation.
import { W, H, B, BIOMES, world, idxOf, wrapX, tileWX, tileWY, neighbors, biomeAt, isWater, tileLat } from './world.js';
import { mulberry32, hash2 } from './noise.js';
import { farmSeason, seasonIndex } from './seasons.js';

export const RES = ['food', 'wood', 'stone', 'gold', 'iron'];
export const RES_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold', iron: 'Iron' };

export const TIERS = [
  { name: 'Hamlet', pop: 0, maxTowns: 1, radiusCap: 6 },
  { name: 'Village', pop: 25, maxTowns: 2, radiusCap: 8 },
  { name: 'Town', pop: 80, maxTowns: 4, radiusCap: 10 },
  { name: 'City', pop: 200, maxTowns: 7, radiusCap: 13 },
  { name: 'Kingdom', pop: 500, maxTowns: 12, radiusCap: 16 },
];

export const DEFS = {
  townhall: { name: 'Town Hall', cap: 8, prod: { gold: 0.3 }, time: 2, hidden: true },
  house: { name: 'Cottages', zone: 'housing', cost: { wood: 8 }, cap: 6, time: 2, tier: 0 },
  farm: { name: 'Farm Fields', zone: 'farmland', cost: { wood: 6 }, prod: { food: 1.4 }, jobs: 2, time: 1.5, tier: 0 },
  workshop: { name: 'Workshop', zone: 'workshop', cost: { wood: 12, stone: 6 }, prod: { gold: 0.8 }, jobs: 3, time: 3, tier: 1 },
  lumber: { name: 'Lumber Camp', cost: { wood: 10 }, prod: { wood: 1.5 }, jobs: 2, time: 2, tier: 0, desc: 'Build on or beside woodland, taiga or jungle.' },
  dock: { name: 'Fishing Dock', cost: { wood: 12 }, prod: { food: 1.6 }, jobs: 2, time: 2, tier: 0, desc: 'Build on land touching the water.' },
  quarry: { name: 'Quarry', cost: { wood: 15 }, prod: { stone: 1 }, jobs: 3, time: 3, tier: 0, desc: 'Works anywhere; full output near hills, mountains or rocky ground, half elsewhere.' },
  mine: { name: 'Iron Mine', cost: { wood: 20, stone: 15 }, prod: { iron: 0.6 }, jobs: 3, time: 4, tier: 1, desc: 'Build on hills or beside mountains.' },
  tower: { name: 'Watchtower', cost: { wood: 20, stone: 25 }, jobs: 1, time: 4, tier: 1, radius: 3, desc: 'Pushes the town border outward.' },
  harbour: { name: 'Harbour', cost: { wood: 80, stone: 60, gold: 40 }, prod: { gold: 1 }, jobs: 4, time: 8, tier: 2, desc: 'On the coast. Settlers and traders sail from here to other continents.' },
  green: { name: 'Town Green', hidden: true, civic: true, time: 1 },
  fountain: { name: 'Fountain Square', hidden: true, civic: true, time: 1 },
  market: { name: 'Market', cost: { wood: 40, stone: 30, gold: 20 }, prod: { gold: 1.5 }, jobs: 3, time: 5, tier: 2, desc: 'Earns gold and sweetens every trade.' },
  library: { name: 'Grand Library', wonder: true, cost: { wood: 300, stone: 200, gold: 300 }, time: 30, tier: 2, desc: '+10% to all production.' },
  gardens: { name: 'Royal Gardens', wonder: true, cost: { food: 300, wood: 200, gold: 150 }, time: 25, tier: 2, desc: '+25% food from every source.' },
  lighthouse: { name: 'Great Lighthouse', wonder: true, cost: { stone: 300, wood: 200, iron: 80 }, time: 30, tier: 2, desc: 'Coastal. +50% fishing and better trades.' },
  greatcastle: { name: 'Great Castle', wonder: true, cost: { stone: 400, iron: 100, gold: 200 }, time: 40, tier: 3, desc: '+4 border for every town, +20% gold.' },
  cathedral: { name: 'Cathedral', wonder: true, cost: { stone: 500, gold: 300, iron: 50 }, time: 40, tier: 3, desc: '+30% housing everywhere.' },
};
// Homes upgrade by themselves as towns grow: cottage -> town house -> manor.
export const HOUSE_LEVELS = ['Cottages', 'Town house', 'Manor'];
export const HOUSE_CAP_MULT = [1, 1.35, 1.7];
const UPGRADE_COST = [null, { wood: 10, stone: 10 }, { stone: 25, gold: 15 }];
const upgradeOk = (t, lv) => (lv === 2 ? t.pop >= 40 : lv === 3 ? t.pop >= 150 && S.tier >= 3 : false);
// ---- continents, harbours and sea routes (late game) ----
export function continentAt(x, y) {
  const lat = tileLat(y), lon = ((x + 0.5 + (y & 1) * 0.5) / W) * 360 - 180;
  if (lat < -60) return 'Antarctica';
  if (lon >= -170 && lon <= -50 && lat >= 7) return 'North America';
  if (lon >= -92 && lon <= -30 && lat < 13) return 'South America';
  if (lon >= -30 && lon <= 50 && lat >= 35) return 'Europe';
  if (lon >= -20 && lon <= 52 && lat < 37 && !(lon > 34 && lat > 12)) return 'Africa';
  if ((lon >= 110 || lon <= -150) && lat < 0) return 'Oceania';
  if (lon > -170 && lon < -50) return 'North America';
  return 'Asia';
}
export const realmContinents = () => [...new Set(S.towns.map((t) => continentAt(t.x, t.y)))];
const hasHarbour = (t) => { for (const b of S.buildings.values()) if (b.t === 'harbour' && b.p >= 1 && (!t || b.town === t.id)) return true; return false; };
export const harbourTowns = () => S.towns.filter((t) => hasHarbour(t));
export const routesDone = () => (S.routes || []).filter((r) => r.p >= 1).length;
export const maxTowns = () => TIERS[S.tier].maxTowns + (S.tier >= 4 ? 4 + routesDone() : 0);
export const ROUTE_COST = { wood: 200, gold: 150, food: 120 };
export const ROUTE_DAYS = 40;
export function routeOptions() {
  const hs = harbourTowns(), out = [];
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const a = hs[i], b = hs[j];
    if (continentAt(a.x, a.y) === continentAt(b.x, b.y)) continue;
    if ((S.routes || []).some((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) continue;
    out.push([a, b]);
  }
  return out;
}
export function openRoute(a, b) {
  if (!affordable(ROUTE_COST)) return false;
  pay(ROUTE_COST);
  (S.routes ||= []).push({ a: a.id, b: b.id, p: 0 });
  emit('toast', `Ships set out to chart a route from ${a.name} to ${b.name}.`); emit('change');
  return true;
}
// ---- civic improvements: making a town lovelier ----
export const IMPROVEMENTS = {
  green: { name: 'Town green', cost: { wood: 60, food: 60 }, desc: 'Flower beds and shade trees beside the hall.' },
  paved: { name: 'Paved streets', cost: { stone: 150 }, desc: 'Cobbled roads all through town.' },
  fountain: { name: 'Fountain square', cost: { stone: 80, gold: 60 }, desc: 'A paved square with a fountain.' },
  lanterns: { name: 'Street lanterns', cost: { iron: 30, gold: 40 }, desc: 'Warm lights along the roads at night.' },
  flowers: { name: 'Window boxes', cost: { food: 40, gold: 30 }, desc: 'Flowers on every home.' },
};
export const IMPROVE_TIER = 2;
export const charm = (t) => Object.keys(t.imp || {}).length;
export function improve(t, key) {
  const d = IMPROVEMENTS[key];
  if (!d || (t.imp && t.imp[key]) || S.tier < IMPROVE_TIER || !affordable(d.cost)) return false;
  if (key === 'green' || key === 'fountain') {
    // claim a free tile beside the hall for the green or the square
    let spot = null;
    const reach = Math.max(3, Math.ceil(t.radius));
    for (let r = 1; r <= reach && !spot; r++) for (let dy = -2 * r; dy <= 2 * r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
      if (Math.abs(dx) < r && Math.abs(dy) < 2 * r - 1) continue; // only the new ring
      const x = wrapX(t.x + dx), y = t.y + dy, i = idxOf(x, y), b = world.biome[i];
      if (!S.buildings.has(i) && BUILDABLE.has(b) && !nearNeighbor(x, y) && ownerOf(x, y) === t) spot = i;
    }
    if (spot == null) { emit('toast', `There is no open ground left in ${t.name}. Free up a tile first.`); return false; }
    S.zones.delete(spot);
    S.buildings.set(spot, { t: key, p: 1, town: t.id, m: 1 });
  }
  pay(d.cost); (t.imp ||= {})[key] = 1;
  recomputeTowns();
  emit('improved', { t, key }); emit('change');
  return true;
}
export const MANUAL = ['lumber', 'dock', 'quarry', 'mine', 'tower', 'market', 'harbour'];
export const WONDERS = ['library', 'gardens', 'lighthouse', 'greatcastle', 'cathedral'];
export const ZONES = {
  housing: { name: 'Housing', builds: 'house', color: '#e8a25a' },
  farmland: { name: 'Farmland', builds: 'farm', color: '#d6c75a' },
  workshop: { name: 'Workshops', builds: 'workshop', color: '#8f8ad8' },
};

const BUILDABLE = new Set([B.GRASS, B.FOREST, B.JUNGLE, B.DESERT, B.SAVANNA, B.TUNDRA, B.TAIGA, B.HILLS, B.STEPPE]);
const FARM_MULT = { [B.GRASS]: 1.15, [B.STEPPE]: 0.95, [B.SAVANNA]: 0.9, [B.FOREST]: 0.9, [B.JUNGLE]: 0.8, [B.HILLS]: 0.75, [B.TAIGA]: 0.6, [B.TUNDRA]: 0.4, [B.DESERT]: 0.35 };
const WOODS = new Set([B.FOREST, B.JUNGLE, B.TAIGA]);

// ---------------- events ----------------
const listeners = {};
export const on = (e, f) => (listeners[e] ||= []).push(f);
export const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

// ---------------- state ----------------
export const S = {
  started: false, name: 'Hearthlands', day: 0, speed: 1, tier: 0,
  res: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 },
  rates: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 },
  towns: [], buildings: new Map(), zones: new Map(),
  neighbors: [], nbIndex: new Map(),
  questsDone: new Set(), stats: { trades: 0, gifts: 0, joins: 0 }, tutorial: 99,
  settings: { music: true, sfx: true, haptics: true },
  cam: { x: 1000, y: 500, tw: 1 }, nextTownId: 1, fed: true,
};
// Interaction mode (not saved): null | {kind:'build',type} | {kind:'zone',zone} | {kind:'found'} | {kind:'start'}
export const M = { mode: null, selected: null };

// ---------------- geometry helpers ----------------
export function groundDist2(x1, y1, x2, y2) {
  let dx = tileWX(x1, y1) - tileWX(x2, y2);
  if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
  const dy = (tileWY(y1) - tileWY(y2)) * 2;
  return dx * dx + dy * dy;
}
export const totalPop = () => S.towns.reduce((s, t) => s + t.pop, 0);
export const totalCap = () => S.towns.reduce((s, t) => s + t.cap, 0);
export const townById = (id) => S.towns.find((t) => t.id === id);
export const hasWonder = (w) => { for (const b of S.buildings.values()) if (b.t === w && b.p >= 1) return true; return false; };
export const wonderStarted = (w) => { for (const b of S.buildings.values()) if (b.t === w) return true; return false; };
export function count(type) { let n = 0; for (const b of S.buildings.values()) if (b.t === type && b.p >= 1) n++; return n; }

export function ownerOf(x, y) {
  let best = null, bd = Infinity;
  for (const t of S.towns) {
    const d = groundDist2(x, y, t.x, t.y);
    if (d <= t.radius * t.radius && d < bd) { bd = d; best = t; }
  }
  return best;
}
export function nearNeighbor(x, y, r = 2.6) {
  for (const n of S.neighbors) if (!n.joined && groundDist2(x, y, n.x, n.y) <= r * r) return n;
  return null;
}
const adjacent = (x, y, pred) => neighbors(x, y).some(([nx, ny]) => ny >= 0 && ny < H && pred(biomeAt(nx, ny)));
const affordable = (cost) => Object.entries(cost || {}).every(([k, v]) => S.res[k] >= v);
const pay = (cost) => Object.entries(cost || {}).forEach(([k, v]) => (S.res[k] -= v));
const gain = (r) => Object.entries(r || {}).forEach(([k, v]) => (S.res[k] += v));
export { affordable };

export function recomputeTowns() {
  const gc = hasWonder('greatcastle') ? 4 : 0;
  const cath = hasWonder('cathedral') ? 1.3 : 1;
  for (const t of S.towns) { t.n = 0; t.towers = 0; t.capRaw = 0; t.jobs = 0; }
  for (const b of S.buildings.values()) {
    const t = townById(b.town); if (!t) continue;
    const d = DEFS[b.t];
    if (b.p >= 1) {
      t.n++; if (b.t === 'tower') t.towers++;
      t.capRaw += (d.cap || 0) * (b.t === 'house' ? HOUSE_CAP_MULT[(b.lv || 1) - 1] : 1); t.jobs += d.jobs || 0;
    }
  }
  for (const t of S.towns) {
    const cap = TIERS[S.tier].radiusCap;
    t.radius = Math.min(cap, (t.capital ? 5 : 4) + t.n * 0.3) + t.towers * 3 + gc;
    t.cap = Math.round(t.capRaw * cath * (1 + 0.04 * charm(t)));
  }
}

// ---------------- placement rules ----------------
export function canPlace(type, x, y) {
  if (y < 1 || y >= H - 1) return { ok: false, reason: 'Too far north or south.' };
  x = wrapX(x);
  const i = idxOf(x, y), b = world.biome[i], d = DEFS[type];
  if (S.buildings.has(i)) return { ok: false, reason: 'Something is already built here.' };
  if (isWater(b)) return { ok: false, reason: 'You cannot build on water.' };
  if (!BUILDABLE.has(b)) return { ok: false, reason: `${BIOMES[b].name} is too rugged to build on.` };
  const own = ownerOf(x, y);
  if (!own) return { ok: false, reason: 'Outside your borders.' };
  const nb = nearNeighbor(x, y);
  if (nb) return { ok: false, reason: `Too close to ${nb.name}.` };
  if (d.tier > S.tier) return { ok: false, reason: `Unlocks at ${TIERS[d.tier].name}.` };
  if (d.wonder && wonderStarted(type)) return { ok: false, reason: 'This wonder is already built.' };
  if (type === 'lumber' && !WOODS.has(b) && !adjacent(x, y, (n) => WOODS.has(n))) return { ok: false, reason: 'Needs woodland nearby.' };
  if ((type === 'dock' || type === 'lighthouse' || type === 'harbour') && !adjacent(x, y, (n) => n === B.SHALLOW || n === B.OCEAN)) return { ok: false, reason: 'Must touch the water.' };
  if (type === 'mine' && !(b === B.HILLS || adjacent(x, y, (n) => n === B.MOUNTAIN || n === B.SNOW))) return { ok: false, reason: 'Needs hills or mountains.' };
  if (!affordable(d.cost)) return { ok: false, reason: 'Not enough resources.', own };
  return { ok: true, own };
}

const rocky = (x, y) => { const b = biomeAt(x, y); return b === B.HILLS || b === B.DESERT || b === B.TUNDRA || adjacent(x, y, (n) => n === B.HILLS || n === B.MOUNTAIN || n === B.SNOW); };
function yieldMult(type, x, y) {
  const b = biomeAt(x, y);
  if (type === 'farm') return FARM_MULT[b] ?? 1;
  if (type === 'lumber') {
    let n = WOODS.has(b) ? 2 : 0;
    for (const [nx, ny] of neighbors(x, y)) if (WOODS.has(biomeAt(nx, ny))) n++;
    return 0.6 + Math.min(n, 8) * 0.1;
  }
  if (type === 'quarry') return rocky(x, y) ? 1 : 0.5;
  return 1;
}

export function placeBuilding(type, x, y) {
  x = wrapX(x);
  const r = canPlace(type, x, y);
  if (!r.ok) return r;
  pay(DEFS[type].cost);
  const i = idxOf(x, y);
  S.zones.delete(i);
  S.buildings.set(i, { t: type, p: 0, town: r.own.id, m: yieldMult(type, x, y) });
  emit('placed', { type, x, y });
  emit('change');
  return r;
}

export function canZone(x, y) {
  x = wrapX(x);
  if (y < 1 || y >= H - 1) return false;
  const i = idxOf(x, y), b = world.biome[i];
  if (S.buildings.has(i) || !BUILDABLE.has(b)) return false;
  if (!ownerOf(x, y) || nearNeighbor(x, y)) return false;
  return true;
}
export function setZone(zone, x, y) {
  x = wrapX(x);
  const i = idxOf(x, y);
  if (zone === 'erase') { if (S.zones.delete(i)) { emit('change'); return true; } return false; }
  if (ZONES[zone] && DEFS[ZONES[zone].builds].tier > S.tier) return false;
  if (!canZone(x, y) || S.zones.get(i) === zone) return false;
  S.zones.set(i, zone); emit('change');
  return true;
}

export function demolish(x, y) {
  const i = idxOf(x, y), b = S.buildings.get(i);
  if (!b || b.t === 'townhall' || DEFS[b.t].civic) return false;
  const d = DEFS[b.t];
  if (b.p >= 1 || b.p > 0) Object.entries(d.cost || {}).forEach(([k, v]) => (S.res[k] += Math.floor(v * (b.p >= 1 ? 0.5 : 0.9))));
  S.buildings.delete(i);
  recomputeTowns(); emit('change');
  return true;
}

// ---------------- towns ----------------
const SYL_A = ['Ash', 'Bram', 'Wil', 'Thorn', 'Elder', 'Oak', 'Mill', 'Stone', 'Fern', 'Hollow', 'Briar', 'Rose', 'Wren', 'Hearth', 'Amber', 'Lark', 'Moss', 'Hazel', 'Kings', 'Fox', 'Raven', 'Wynd', 'Cold', 'Bright', 'Glen', 'Marl', 'Dun', 'Pen', 'Tal', 'Cael'];
const SYL_B = ['ford', 'wick', 'ton', 'ham', 'bury', 'mere', 'dale', 'holm', 'field', 'brook', 'stead', 'wood', 'by', 'thorpe', 'well', 'cross', 'haven', 'moor', 'gate', 'combe', 'ley', 'stow'];
export function makeName(rng) { return SYL_A[Math.floor(rng() * SYL_A.length)] + SYL_B[Math.floor(rng() * SYL_B.length)]; }
let nameRng = mulberry32(Date.now() & 0xffff);

export function canFound(x, y) {
  x = wrapX(x);
  if (S.tier < 1) return { ok: false, reason: 'Founding new settlements unlocks at Village.' };
  if (S.towns.length >= maxTowns()) return { ok: false, reason: `A ${TIERS[S.tier].name} can hold ${maxTowns()} settlements. ${S.tier >= 4 ? 'Each sea route makes room for one more.' : 'Grow to unlock more.'}` };
  const cont = continentAt(x, y);
  if (!realmContinents().includes(cont) && !hasHarbour()) return { ok: false, reason: `Settlers need a Harbour to sail to ${cont}.` };
  const b = biomeAt(x, y);
  if (isWater(b) || !BUILDABLE.has(b)) return { ok: false, reason: 'Pick open land for a new settlement.' };
  for (const t of S.towns) if (groundDist2(x, y, t.x, t.y) < (t.radius + 3) ** 2) return { ok: false, reason: `Too close to ${t.name}.` };
  const nb = nearNeighbor(x, y, 5); if (nb) return { ok: false, reason: `Too close to ${nb.name}.` };
  if (!affordable(FOUND_COST)) return { ok: false, reason: 'Needs 50 food, 50 wood and 30 gold.' };
  return { ok: true };
}
export const FOUND_COST = { food: 50, wood: 50, gold: 30 };

function addTown(x, y, opts = {}) {
  const t = { id: S.nextTownId++, name: opts.name || makeName(nameRng), x: wrapX(x), y, capital: !!opts.capital, pop: opts.pop ?? 3, cap: 0, radius: 4, n: 0, founded: S.day };
  S.towns.push(t);
  S.buildings.set(idxOf(x, y), { t: 'townhall', p: opts.built ? 1 : 0, town: t.id, m: 1 });
  recomputeTowns();
  return t;
}
export function foundTown(x, y) {
  const r = canFound(x, y); if (!r.ok) return r;
  pay(FOUND_COST);
  const t = addTown(x, y, { pop: 3 });
  emit('toast', `Settlers have founded ${t.name}!`); emit('founded', t); emit('change');
  return { ok: true, town: t };
}

// ---------------- neighbours ----------------
const NB_OK = { [B.GRASS]: 1, [B.FOREST]: 0.8, [B.SAVANNA]: 0.7, [B.STEPPE]: 0.7, [B.JUNGLE]: 0.5, [B.TAIGA]: 0.4, [B.HILLS]: 0.6, [B.DESERT]: 0.08, [B.TUNDRA]: 0.12 };
export function generateNeighbors() {
  const rng = mulberry32(90210);
  const list = [], cells = new Set();
  for (let a = 0; a < 400000 && list.length < 600; a++) {
    const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
    const b = world.biome[y * W + x], w = NB_OK[b];
    if (!w || rng() > w) continue;
    const ck = `${Math.floor(x / 22)},${Math.floor(y / 44)}`;
    if (cells.has(ck)) continue;
    cells.add(ck);
    let surplus = WOODS.has(b) ? 'wood' : b === B.HILLS ? 'stone' : b === B.DESERT ? 'gold' : 'food';
    for (let dy = -4; dy <= 4; dy++) for (let dx = -2; dx <= 2; dx++) if (biomeAt(x + dx, y + dy) === B.MOUNTAIN) surplus = 'iron';
    const choices = RES.filter((r) => r !== surplus);
    list.push({
      id: list.length, name: makeName(rng), x, y, pop: Math.round(8 + rng() * 50),
      surplus, want: choices[Math.floor(rng() * choices.length)], friend: 0, joined: false,
      hue: Math.floor(rng() * 360),
    });
  }
  return list;
}
// ---- neighbour personalities ----
const TITLES = ['Elder', 'Reeve', 'Headwoman', 'Headman', 'Warden', 'Matron', 'Steward'];
const FIRST = ['Mira', 'Oswin', 'Talia', 'Bram', 'Ysolde', 'Corin', 'Ada', 'Fenn', 'Lio', 'Sela', 'Dunstan', 'Ivo', 'Nessa', 'Rowan', 'Tamsin', 'Edric', 'Liora', 'Hale', 'Wynn', 'Petra'];
export const TRAITS = {
  cheerful: { label: 'Cheerful', gift: 1.2, req: 1, story: 1.3, blurb: 'Always glad of a visit.' },
  proud: { label: 'Proud', gift: 0.8, req: 1.5, story: 1, blurb: 'Values help when it counts most.' },
  shy: { label: 'Shy', gift: 0.9, req: 1, story: 0.6, blurb: 'Warms up slowly, but stays loyal.' },
  generous: { label: 'Generous', gift: 1, req: 1, story: 1.4, blurb: 'Gives as freely as they receive.' },
  curious: { label: 'Curious', gift: 1, req: 1.2, story: 1.2, blurb: 'Full of questions and small requests.' },
};
const TRAIT_KEYS = Object.keys(TRAITS);
function personality(n) {
  if (n.leader) return;
  n.leader = `${TITLES[(hash2(n.id, 1, 51) * TITLES.length) | 0]} ${FIRST[(hash2(n.id, 2, 52) * FIRST.length) | 0]}`;
  n.trait = TRAIT_KEYS[(hash2(n.id, 3, 53) * TRAIT_KEYS.length) | 0];
  n.log = n.log || []; n.req = n.req || null;
}
function addLog(n, text) { n.log.unshift({ day: Math.floor(S.day), text }); if (n.log.length > 4) n.log.length = 4; }
const REQUESTS = {
  food: (v) => `${v}'s harvest was poor this year. Could you spare some food?`,
  wood: (v) => `${v} is raising a new barn and needs timber.`,
  stone: (v) => `${v} wants to dig a proper well and asks for stone.`,
  gold: (v) => `${v}'s spring fair is coming, and they hope to borrow a little gold.`,
  iron: (v) => `The smith in ${v} needs iron for new ploughs.`,
};
export function fulfil(n) {
  const r = n.req; if (!r || !inContact(n) || S.res[r.res] < r.amt) return false;
  S.res[r.res] -= r.amt;
  const tr = TRAITS[n.trait];
  n.friend = Math.min(100, n.friend + Math.round(20 * tr.req));
  gain(r.reward);
  addLog(n, `You helped with ${r.amt} ${r.res}. ${n.leader} sent ${Object.entries(r.reward).map(([k, v]) => `${v} ${k}`).join(', ')} in thanks.`);
  n.req = null; S.stats.helped = (S.stats.helped || 0) + 1;
  emit('toast', `${n.leader} of ${n.name} thanks you warmly!`); emit('change');
  return true;
}
const STORIES = [
  (n) => { const f = 10 + Math.round(n.pop / 4); gain({ food: f }); return `${n.name} held a harvest festival and sent you ${f} food.`; },
  (n) => { const a = 12; gain({ [n.surplus]: a }); return `${n.leader} sent a basket of ${n.surplus} (${a}) as thanks for your friendship.`; },
  (n) => { n.friend = Math.min(100, n.friend + 2); return `Travellers from ${n.name} say ${S.name} is the talk of the valley.`; },
  (n) => `Children from ${n.name} came to watch your builders at work.`,
  (n) => `A wedding in ${n.name}! Your folk were invited to the dancing.`,
  (n) => `${n.leader} of ${n.name} stopped by to admire your town.`,
];
function neighbourLife(dd) {
  const caps = [20, 30, 40, 55, 70];
  for (const n of S.neighbors) {
    if (n.joined) continue;
    personality(n);
    if (n.pop < 120) n.pop += n.pop * 0.002 * dd; // villages grow slowly by themselves
    if (n.req && S.day > n.req.until) { addLog(n, 'Their need passed; they managed on their own.'); n.req = null; }
    if (!inContact(n)) continue;
    const tr = TRAITS[n.trait];
    if (!n.req && Math.random() < 0.012 * tr.req * dd) {
      const opts = RES.filter((r) => r !== n.surplus && (r !== 'iron' || S.tier >= 1));
      const res = opts[(Math.random() * opts.length) | 0];
      const amt = Math.round((caps[S.tier] * (0.7 + Math.random() * 0.6)) / 5) * 5;
      const reward = n.surplus === res ? { gold: Math.round(amt * 0.8) } : { [n.surplus]: Math.round(amt * 1.2) };
      n.req = { res, amt, until: S.day + 20, reward, text: REQUESTS[res](n.name) };
      emit('request', n);
    } else if (n.friend >= 40 && Math.random() < 0.004 * tr.story * dd) {
      const text = STORIES[(Math.random() * STORIES.length) | 0](n);
      addLog(n, text); emit('story', { n, text });
    }
  }
}
// Extra huts around villages that have grown: tile idx -> neighbour.
export const nbExtra = new Map();
function placeExtraHuts() {
  nbExtra.clear();
  for (const n of S.neighbors) {
    if (n.joined || n.pop < 40) continue;
    const want = Math.min(5, Math.floor((n.pop - 40) / 16) + 1);
    let k = 0;
    for (const [x, y] of neighbors(n.x, n.y)) {
      if (k >= want) break;
      if (y < 1 || y >= H - 1) continue;
      const i = idxOf(x, y), b = world.biome[i];
      if (isWater(b) || b === B.MOUNTAIN || b === B.SNOW || S.buildings.has(i) || S.nbIndex.has(i)) continue;
      nbExtra.set(i, n); k++;
    }
  }
}
function indexNeighbors() {
  S.nbIndex.clear();
  for (const n of S.neighbors) if (!n.joined) { S.nbIndex.set(idxOf(n.x, n.y), n); personality(n); }
  placeExtraHuts();
}
export const CONTACT_RANGE = 45;
export function inContact(n) { return S.towns.some((t) => groundDist2(n.x, n.y, t.x, t.y) <= CONTACT_RANGE ** 2); }
export function tradeOffers(n) {
  const bonus = Math.floor(n.friend * 0.1) + (count('market') ? 5 : 0) + (hasWonder('lighthouse') ? 4 : 0) + (n.trait === 'generous' ? 3 : 0);
  const offers = [{ give: { [n.want]: 20 }, get: { [n.surplus]: 14 + bonus } }];
  if (n.surplus !== 'gold') offers.push({ give: { gold: 15 }, get: { [n.surplus]: 16 + bonus } });
  else offers.push({ give: { food: 25 }, get: { gold: 10 + Math.floor(bonus / 2) } });
  return offers;
}
export function doTrade(n, k) {
  const o = tradeOffers(n)[k];
  if (!o || !inContact(n) || !affordable(o.give)) return false;
  pay(o.give); gain(o.get);
  n.friend = Math.min(100, n.friend + 4); S.stats.trades++;
  if (Math.random() < 0.25) addLog(n, `Traded ${Object.entries(o.give).map(([k, v]) => `${v} ${k}`).join(', ')} for ${Object.entries(o.get).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  emit('traded', n); emit('change');
  return true;
}
export const GIFT_AMOUNT = 25;
export function gift(n, res) {
  if (!inContact(n) || S.res[res] < GIFT_AMOUNT) return false;
  S.res[res] -= GIFT_AMOUNT;
  n.friend = Math.min(100, n.friend + Math.round((res === n.want ? 18 : 10) * TRAITS[n.trait || 'cheerful'].gift)); S.stats.gifts++;
  addLog(n, `You sent a gift of ${GIFT_AMOUNT} ${res}.`);
  emit('change');
  return true;
}
export function canInvite(n) {
  if (!inContact(n)) return { ok: false, reason: 'Too far away. Found a settlement nearer to them.' };
  if (n.friend < 100) return { ok: false, reason: 'They need to be close friends first (100 friendship).' };
  if (S.tier < 2) return { ok: false, reason: 'Your realm must be a Town to welcome others.' };
  if (S.towns.length >= maxTowns()) return { ok: false, reason: 'No room for another settlement at this tier.' };
  return { ok: true };
}
export function invite(n) {
  if (!canInvite(n).ok) return false;
  n.joined = true; indexNeighbors();
  const t = addTown(n.x, n.y, { name: n.name, pop: n.pop, built: true });
  // They bring their homes and fields with them.
  const rng = mulberry32(n.id * 7 + 1);
  let houses = Math.ceil(n.pop / 6), farms = Math.ceil(n.pop / 12);
  for (let a = 0; a < 200 && (houses > 0 || farms > 0); a++) {
    const x = n.x + Math.round((rng() - 0.5) * 6), y = n.y + Math.round((rng() - 0.5) * 12);
    if (!canZone(x, y)) continue;
    const type = houses > 0 ? 'house' : 'farm';
    S.buildings.set(idxOf(x, y), { t: type, p: 1, town: t.id, m: yieldMult(type, x, y), z: 1 });
    if (type === 'house') houses--; else farms--;
  }
  S.stats.joins++;
  recomputeTowns();
  emit('toast', `${n.name} has joined your kingdom!`); emit('joined', t); emit('change');
  return true;
}

// ---------------- quests ----------------
const Q = (id, text, check, reward) => ({ id, text, check, reward });
export const QUESTS = [
  Q('farm1', 'Plant a farm field (Zones → Farmland)', () => count('farm') >= 1, { wood: 20 }),
  Q('house1', 'Build cottages (Zones → Housing)', () => count('house') >= 1, { wood: 15, food: 20 }),
  Q('lumber', 'Build a Lumber Camp by the woods', () => count('lumber') >= 1, { stone: 15 }),
  Q('pop15', 'Grow to 15 villagers', () => totalPop() >= 15, { gold: 25 }),
  Q('quarry', 'Build a Quarry near the hills', () => count('quarry') >= 1, { wood: 30 }),
  Q('trade', 'Trade with a neighbouring village', () => S.stats.trades >= 1, { gold: 30 }),
  Q('village', 'Become a Village (25 villagers)', () => S.tier >= 1, { food: 60, wood: 40 }),
  Q('tower', 'Raise a Watchtower', () => count('tower') >= 1, { stone: 30 }),
  Q('found', 'Found a second settlement', () => S.towns.length >= 2, { food: 50, wood: 50 }),
  Q('mine', 'Dig an Iron Mine', () => count('mine') >= 1, { gold: 40 }),
  Q('workshop3', 'Build 3 Workshops', () => count('workshop') >= 3, { iron: 20 }),
  Q('gift', 'Send a gift to a neighbour', () => S.stats.gifts >= 1, { gold: 20 }),
  Q('town', 'Become a Town (80 villagers)', () => S.tier >= 2, { stone: 80, gold: 60 }),
  Q('market', 'Open a Market', () => count('market') >= 1, { iron: 30 }),
  Q('join', 'Welcome a neighbour into your kingdom', () => S.stats.joins >= 1, { gold: 100 }),
  Q('wonder1', 'Complete a Wonder', () => WONDERS.some(hasWonder), { gold: 150, iron: 50 }),
  Q('city', 'Become a City (200 villagers)', () => S.tier >= 3, { stone: 200, gold: 200 }),
  Q('kingdom', 'Become a Kingdom (500 villagers)', () => S.tier >= 4, { gold: 500 }),
  Q('harbour', 'Build a Harbour on the coast', () => count('harbour') >= 1, { gold: 80 }),
  Q('charm1', 'Give a town its first civic improvement', () => S.towns.some((t) => charm(t) >= 1), { stone: 60 }),
  Q('route1', 'Open a sea route to another continent', () => routesDone() >= 1, { gold: 200, iron: 40 }),
  Q('cont3', 'Settle on three continents', () => realmContinents().length >= 3, { gold: 300 }),
  Q('charm5', 'Make one town as lovely as can be (all five improvements)', () => S.towns.some((t) => charm(t) >= 5), { gold: 250 }),
  Q('routes5', 'Open five sea routes', () => routesDone() >= 5, { gold: 500 }),
  Q('wonders', 'Complete all five Wonders', () => WONDERS.every(hasWonder), { gold: 1000 }),
  Q('cont6', 'Settle on six continents', () => realmContinents().length >= 6, { gold: 1000 }),
];
export const activeQuests = () => QUESTS.filter((q) => !S.questsDone.has(q.id)).slice(0, 3);

// ---------------- simulation ----------------
let acc = 0;
const STEP = 0.25; // days
// Pacing: a calm game meant to be enjoyed over days. One in-game day lasts DAY_SECONDS real seconds.
export const DAY_SECONDS = 24;
export const PACE = {
  build: 2,        // construction takes this many times longer than the listed days
  builders: 150,    // one extra builder crew per this many villagers in a town
  growth: 0.08,    // how quickly families move into empty homes
  minGrowth: 0.3,  // newcomers a day while a hamlet (<30 folk) has room, so the start feels alive
  prod: 0.6,       // production per worker
  eat: 0.6,        // food eaten per villager (kept in step with production)
};

export function update(dtSec) {
  if (!S.started || S.speed === 0) return;
  acc += (dtSec / DAY_SECONDS) * S.speed;
  let steps = 0;
  while (acc >= STEP && steps < 40) { acc -= STEP; step(STEP); steps++; }
  if (steps) emit('tick');
}

function step(dd) {
  const lib = hasWonder('library') ? 1.1 : 1;
  const gardens = hasWonder('gardens') ? 1.25 : 1;
  const gcGold = (hasWonder('greatcastle') ? 1.2 : 1) * (1 + 0.08 * routesDone());
  const lh = hasWonder('lighthouse') ? 1.5 : 1;
  let changed = false;

  // Construction
  for (const [i, b] of S.buildings) {
    if (b.p >= 1) continue;
    const t = townById(b.town);
    b.p += (dd / (DEFS[b.t].time * PACE.build)) * (t && t.pop >= 2 ? 1 : 0.5);
    if (b.p >= 1) {
      b.p = 1; changed = true;
      emit('built', { b, i, x: i % W, y: Math.floor(i / W) });
    }
  }
  if (changed) recomputeTowns();

  // Villagers build zoned tiles, one or a few at a time per town.
  if (S.zones.size) {
    const busy = new Map();
    for (const b of S.buildings.values()) if (b.p < 1 && b.z) busy.set(b.town, (busy.get(b.town) || 0) + 1);
    const best = new Map();
    for (const [i, z] of S.zones) {
      const x = i % W, y = Math.floor(i / W), t = ownerOf(x, y);
      if (!t) continue;
      if ((busy.get(t.id) || 0) >= 1 + Math.floor(t.pop / PACE.builders)) continue;
      const d = groundDist2(x, y, t.x, t.y), cur = best.get(t.id);
      if (!cur || d < cur.d) best.set(t.id, { i, x, y, z, d, t });
    }
    for (const c of best.values()) {
      const type = ZONES[c.z].builds, def = DEFS[type];
      if (!affordable(def.cost)) continue;
      pay(def.cost); S.zones.delete(c.i);
      S.buildings.set(c.i, { t: type, p: 0, town: c.t.id, m: yieldMult(type, c.x, c.y), z: 1 });
      emit('change');
    }
  }

  // Production
  const pop = totalPop();
  let jobs = 0; for (const t of S.towns) jobs += t.jobs;
  const eff = jobs ? Math.min(1, pop / jobs) : 1;
  const before = { ...S.res };
  for (const [i, b] of S.buildings) {
    if (b.p < 1) continue;
    const d = DEFS[b.t]; if (!d.prod) continue;
    // Fields rest in winter and give a harvest boost in late summer and autumn (stronger far from the equator).
    const season = b.t === 'farm' ? farmSeason(S.day, tileLat(Math.floor(i / W))) : 1;
    for (const [r, v] of Object.entries(d.prod)) {
      let amt = v * dd * PACE.prod * (b.t === 'townhall' ? 1 : eff) * (b.m || 1) * lib * season;
      if (r === 'food') amt *= gardens * (b.t === 'dock' ? lh : 1);
      if (r === 'gold') amt *= gcGold;
      S.res[r] += amt;
    }
  }
  S.res.gold += pop * 0.02 * PACE.prod * dd * gcGold;

  // Food and growth: nobody starves, growth just pauses.
  const eat = pop * 0.1 * PACE.eat * dd;
  S.fed = S.res.food >= eat;
  S.res.food = Math.max(0, S.res.food - eat);
  for (const t of S.towns) {
    if (t.pop < t.cap && S.fed) t.pop = Math.min(t.cap, t.pop + Math.max(t.pop < 30 ? PACE.minGrowth : 0.02, (t.cap - t.pop) * 0.06 * PACE.growth) * dd);
    else if (t.pop > t.cap) t.pop = Math.max(t.cap, t.pop - 0.5 * dd);
  }
  for (const r of RES) S.rates[r] = S.rates[r] * 0.8 + ((S.res[r] - before[r]) / dd) * 0.2;
  neighbourLife(dd);
  for (const r of S.routes || []) {
    if (r.p >= 1) continue;
    r.p = Math.min(1, r.p + dd / ROUTE_DAYS);
    if (r.p >= 1) { const a = townById(r.a), b = townById(r.b); emit('route', { a, b }); emit('toast', `⛵ A sea route now links ${a ? a.name : '?'} and ${b ? b.name : '?'}!`); }
  }
  if ((S._hutT = (S._hutT || 0) + dd) > 2) { S._hutT = 0; placeExtraHuts(); }
  // Families improve their homes as a town grows (one at a time, when the realm can afford it).
  for (const t of S.towns) {
    if (Math.random() > 0.12 * dd) continue;
    let cand = null;
    for (const [i, b] of S.buildings) {
      if (b.town !== t.id || b.t !== 'house' || b.p < 1) continue;
      const lv = b.lv || 1;
      if (lv < 3 && upgradeOk(t, lv + 1) && affordable(UPGRADE_COST[lv])) { cand = [i, b]; if (Math.random() < 0.3) break; }
    }
    if (!cand) continue;
    const b = cand[1], lv = (b.lv || 1) + 1;
    pay(UPGRADE_COST[lv - 1]); b.lv = lv;
    t.upMsg = t.upMsg || {};
    if (!t.upMsg[lv]) { t.upMsg[lv] = 1; emit('toast', lv === 2 ? `Families in ${t.name} are building finer town houses.` : `The first manor rises in ${t.name}!`); }
    recomputeTowns(); emit('change');
  }

  // Tiers
  const p = totalPop();
  while (S.tier < TIERS.length - 1 && p >= TIERS[S.tier + 1].pop) {
    S.tier++; recomputeTowns();
    emit('tier', S.tier);
  }
  // Quests
  for (const q of QUESTS) {
    if (!S.questsDone.has(q.id) && q.check()) { S.questsDone.add(q.id); gain(q.reward); emit('quest', q); }
  }
  S.day += dd;
  const cap = S.towns.find((t) => t.capital) || S.towns[0];
  if (cap) {
    const si = seasonIndex(S.day, tileLat(cap.y));
    if (S.lastSeason !== undefined && si !== S.lastSeason) emit('season', { index: si, lat: tileLat(cap.y) });
    S.lastSeason = si;
  }
}

// ---------------- new game / save / load ----------------
export function newGame(name, x, y) {
  S.started = true; S.name = name || 'Hearthlands'; S.day = 0; S.tier = 0; S.speed = 1;
  S.res = { food: 60, wood: 50, stone: 20, gold: 30, iron: 0 };
  S.towns = []; S.buildings = new Map(); S.zones = new Map(); S.nextTownId = 1;
  S.questsDone = new Set(); S.stats = { trades: 0, gifts: 0, joins: 0 }; S.routes = [];
  S.tutorial = 0;
  S.neighbors = generateNeighbors();
  addTown(x, y, { capital: true, name: S.name, pop: 4, built: true });
  // Keep the start area free of neighbouring villages.
  S.neighbors = S.neighbors.filter((n) => groundDist2(n.x, n.y, x, y) > 12 * 12);
  // Make sure a few friendly faces are in reach.
  indexNeighbors();
  save();
  emit('change');
}

// ---- Save slots: several realms, each autosaved on the device ----
export const SLOT_COUNT = 3;
const LEGACY_KEY = 'hearthlands-save-v1';
const slotKey = (n) => `hearthlands-slot-${n}`;
export let currentSlot = 1;
export function setSlot(n) { currentSlot = n; }
function migrateLegacy() {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old && !localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), old);
    if (old) localStorage.removeItem(LEGACY_KEY);
  } catch (e) { /* ignore */ }
}
export function save() {
  if (!S.started) return;
  const capital = S.towns.find((t) => t.capital) || S.towns[0];
  const data = {
    v: 1, name: S.name, day: S.day, speed: S.speed, tier: S.tier, res: S.res, towns: S.towns,
    buildings: [...S.buildings].map(([i, b]) => [i, b.t, +b.p.toFixed(3), b.town, +(b.m || 1).toFixed(2), b.z ? 1 : 0, b.lv || 1]),
    zones: [...S.zones], nb: S.neighbors.filter((n) => n.friend || n.joined || n.req || (n.log && n.log.length) || n.pop > 70).map((n) => [n.id, n.friend, n.joined ? 1 : 0, +n.pop.toFixed(1), n.req || null, n.log || []]),
    quests: [...S.questsDone], stats: S.stats, routes: S.routes || [], cam: S.cam, nextTownId: S.nextTownId, tutorial: S.tutorial,
    meta: {
      pop: Math.floor(totalPop()), savedAt: Date.now(),
      place: capital && world.country ? (world.countryNames[world.country[idxOf(capital.x, capital.y)] - 1] || '') : '',
    },
  };
  try { localStorage.setItem(slotKey(currentSlot), JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  saveSettings();
}
// Summaries for the title screen (null for an empty slot).
export function slotInfo() {
  migrateLegacy();
  const out = [];
  for (let n = 1; n <= SLOT_COUNT; n++) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { d = null; }
    out.push(d && d.v === 1 ? { slot: n, name: d.name, tier: d.tier, day: d.day, pop: d.meta ? d.meta.pop : null, place: d.meta ? d.meta.place : '', savedAt: d.meta ? d.meta.savedAt : 0 } : null);
  }
  return out;
}
export function hasSave() { return slotInfo().some(Boolean); }
export function load(n = currentSlot) {
  migrateLegacy();
  let d;
  try { d = JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  currentSlot = n;
  S.started = true; S.name = d.name; S.day = d.day;
  S.speed = d.speed ? 1 : 0; // only pause / play now
  S.tier = d.tier; S.res = d.res;
  S.towns = d.towns; S.routes = d.routes || []; S.nextTownId = d.nextTownId; S.stats = d.stats; S.questsDone = new Set(d.quests);
  S.tutorial = d.tutorial ?? 99; // realms from before the tutorial existed skip it
  S.buildings = new Map(d.buildings.map(([i, t, p, town, m, z, lv]) => [i, { t, p, town, m, z, lv: lv || 1 }]));
  S.zones = new Map(d.zones);
  S.neighbors = generateNeighbors();
  const cap = S.towns.find((t) => t.capital) || S.towns[0];
  if (cap) S.neighbors = S.neighbors.filter((n2) => groundDist2(n2.x, n2.y, cap.x, cap.y) > 144 || d.nb.some((e) => e[0] === n2.id));
  for (const [id, f, j, p, req, log] of d.nb) { const q = S.neighbors.find((r) => r.id === id); if (q) { q.friend = f; q.joined = !!j; q.pop = p; q.req = req || null; q.log = log || []; } }
  indexNeighbors();
  if (d.cam) Object.assign(S.cam, d.cam);
  recomputeTowns();
  return true;
}
export function deleteSlot(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) { /* ignore */ } }
export function resetSave() { deleteSlot(currentSlot); }
export function saveSettings() { try { localStorage.setItem('hearthlands-settings', JSON.stringify(S.settings)); } catch (e) { /* ignore */ } }
export function loadSettings() { try { Object.assign(S.settings, JSON.parse(localStorage.getItem('hearthlands-settings')) || {}); } catch (e) { /* ignore */ } }

// Start-location summary: what is around a tile.
export function surveyStart(x, y) {
  const c = { wood: 0, hills: 0, water: 0, farm: 0 };
  for (let dy = -10; dy <= 10; dy++) for (let dx = -5; dx <= 5; dx++) {
    const b = biomeAt(x + dx, y + dy);
    if (WOODS.has(b)) c.wood++; if (b === B.HILLS || b === B.MOUNTAIN) c.hills++;
    if (b === B.SHALLOW) c.water++; if ((FARM_MULT[b] || 0) >= 0.9) c.farm++;
  }
  return c;
}
export function canStart(x, y) {
  const b = biomeAt(x, y);
  if (isWater(b)) return { ok: false, reason: 'That is the sea. Pick a spot on land.' };
  if (!BUILDABLE.has(b)) return { ok: false, reason: `${BIOMES[b].name} is too harsh for a first home.` };
  return { ok: true };
}
