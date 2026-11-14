// Game state, rules and simulation.
import { W, H, B, BIOMES, world, idxOf, wrapX, tileWX, tileWY, neighbors, biomeAt, isWater, tileLat } from './world.js';
import { mulberry32, hash2 } from './noise.js';

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
  market: { name: 'Market', cost: { wood: 40, stone: 30, gold: 20 }, prod: { gold: 1.5 }, jobs: 3, time: 5, tier: 2, desc: 'Earns gold and sweetens every trade.' },
  library: { name: 'Grand Library', wonder: true, cost: { wood: 300, stone: 200, gold: 300 }, time: 30, tier: 2, desc: '+10% to all production.' },
  gardens: { name: 'Royal Gardens', wonder: true, cost: { food: 300, wood: 200, gold: 150 }, time: 25, tier: 2, desc: '+25% food from every source.' },
  lighthouse: { name: 'Great Lighthouse', wonder: true, cost: { stone: 300, wood: 200, iron: 80 }, time: 30, tier: 2, desc: 'Coastal. +50% fishing and better trades.' },
  greatcastle: { name: 'Great Castle', wonder: true, cost: { stone: 400, iron: 100, gold: 200 }, time: 40, tier: 3, desc: '+4 border for every town, +20% gold.' },
  cathedral: { name: 'Cathedral', wonder: true, cost: { stone: 500, gold: 300, iron: 50 }, time: 40, tier: 3, desc: '+30% housing everywhere.' },
};
export const MANUAL = ['lumber', 'dock', 'quarry', 'mine', 'tower', 'market'];
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
  questsDone: new Set(), stats: { trades: 0, gifts: 0, joins: 0 },
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
      t.capRaw += d.cap || 0; t.jobs += d.jobs || 0;
    }
  }
  for (const t of S.towns) {
    const cap = TIERS[S.tier].radiusCap;
    t.radius = Math.min(cap, (t.capital ? 5 : 4) + t.n * 0.3) + t.towers * 3 + gc;
    t.cap = Math.round(t.capRaw * cath);
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
  if ((type === 'dock' || type === 'lighthouse') && !adjacent(x, y, (n) => n === B.SHALLOW || n === B.OCEAN)) return { ok: false, reason: 'Must touch the water.' };
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
  if (!b || b.t === 'townhall') return false;
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
  if (S.towns.length >= TIERS[S.tier].maxTowns) return { ok: false, reason: `A ${TIERS[S.tier].name} can hold ${TIERS[S.tier].maxTowns} settlements. Grow to unlock more.` };
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
function indexNeighbors() {
  S.nbIndex.clear();
  for (const n of S.neighbors) if (!n.joined) S.nbIndex.set(idxOf(n.x, n.y), n);
}
export const CONTACT_RANGE = 45;
export function inContact(n) { return S.towns.some((t) => groundDist2(n.x, n.y, t.x, t.y) <= CONTACT_RANGE ** 2); }
export function tradeOffers(n) {
  const bonus = Math.floor(n.friend * 0.1) + (count('market') ? 5 : 0) + (hasWonder('lighthouse') ? 4 : 0);
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
  emit('traded', n); emit('change');
  return true;
}
export const GIFT_AMOUNT = 25;
export function gift(n, res) {
  if (!inContact(n) || S.res[res] < GIFT_AMOUNT) return false;
  S.res[res] -= GIFT_AMOUNT;
  n.friend = Math.min(100, n.friend + (res === n.want ? 18 : 10)); S.stats.gifts++;
  emit('change');
  return true;
}
export function canInvite(n) {
  if (!inContact(n)) return { ok: false, reason: 'Too far away. Found a settlement nearer to them.' };
  if (n.friend < 100) return { ok: false, reason: 'They need to be close friends first (100 friendship).' };
  if (S.tier < 2) return { ok: false, reason: 'Your realm must be a Town to welcome others.' };
  if (S.towns.length >= TIERS[S.tier].maxTowns) return { ok: false, reason: 'No room for another settlement at this tier.' };
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
  Q('wonders', 'Complete all five Wonders', () => WONDERS.every(hasWonder), { gold: 1000 }),
];
export const activeQuests = () => QUESTS.filter((q) => !S.questsDone.has(q.id)).slice(0, 3);

// ---------------- simulation ----------------
let acc = 0;
const STEP = 0.25; // days
export const DAY_SECONDS = 3;

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
  const gcGold = hasWonder('greatcastle') ? 1.2 : 1;
  const lh = hasWonder('lighthouse') ? 1.5 : 1;
  let changed = false;

  // Construction
  for (const [i, b] of S.buildings) {
    if (b.p >= 1) continue;
    const t = townById(b.town);
    b.p += (dd / DEFS[b.t].time) * (t && t.pop >= 2 ? 1 : 0.5);
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
      if ((busy.get(t.id) || 0) >= 1 + Math.floor(t.pop / 15)) continue;
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
  for (const b of S.buildings.values()) {
    if (b.p < 1) continue;
    const d = DEFS[b.t]; if (!d.prod) continue;
    for (const [r, v] of Object.entries(d.prod)) {
      let amt = v * dd * (b.t === 'townhall' ? 1 : eff) * (b.m || 1) * lib;
      if (r === 'food') amt *= gardens * (b.t === 'dock' ? lh : 1);
      if (r === 'gold') amt *= gcGold;
      S.res[r] += amt;
    }
  }
  S.res.gold += pop * 0.02 * dd * gcGold;

  // Food and growth: nobody starves, growth just pauses.
  const eat = pop * 0.1 * dd;
  S.fed = S.res.food >= eat;
  S.res.food = Math.max(0, S.res.food - eat);
  for (const t of S.towns) {
    if (t.pop < t.cap && S.fed) t.pop = Math.min(t.cap, t.pop + Math.max(0.3, (t.cap - t.pop) * 0.06) * dd);
    else if (t.pop > t.cap) t.pop = Math.max(t.cap, t.pop - 0.5 * dd);
  }
  for (const r of RES) S.rates[r] = S.rates[r] * 0.8 + ((S.res[r] - before[r]) / dd) * 0.2;
  for (const n of S.neighbors) if (!n.joined && n.pop < 120) n.pop += n.pop * 0.002 * dd;

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
}

// ---------------- new game / save / load ----------------
export function newGame(name, x, y) {
  S.started = true; S.name = name || 'Hearthlands'; S.day = 0; S.tier = 0; S.speed = 1;
  S.res = { food: 60, wood: 50, stone: 20, gold: 30, iron: 0 };
  S.towns = []; S.buildings = new Map(); S.zones = new Map(); S.nextTownId = 1;
  S.questsDone = new Set(); S.stats = { trades: 0, gifts: 0, joins: 0 };
  S.neighbors = generateNeighbors();
  addTown(x, y, { capital: true, name: S.name, pop: 4, built: true });
  // Keep the start area free of neighbouring villages.
  S.neighbors = S.neighbors.filter((n) => groundDist2(n.x, n.y, x, y) > 12 * 12);
  // Make sure a few friendly faces are in reach.
  indexNeighbors();
  save();
  emit('change');
}

const SAVE_KEY = 'hearthlands-save-v1';
export function save() {
  if (!S.started) return;
  const data = {
    v: 1, name: S.name, day: S.day, speed: S.speed, tier: S.tier, res: S.res, towns: S.towns,
    buildings: [...S.buildings].map(([i, b]) => [i, b.t, +b.p.toFixed(3), b.town, +(b.m || 1).toFixed(2), b.z ? 1 : 0]),
    zones: [...S.zones], nb: S.neighbors.filter((n) => n.friend || n.joined).map((n) => [n.id, n.friend, n.joined ? 1 : 0, Math.round(n.pop)]),
    quests: [...S.questsDone], stats: S.stats, cam: S.cam, nextTownId: S.nextTownId,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  saveSettings();
}
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  S.started = true; S.name = d.name; S.day = d.day; S.speed = d.speed ?? 1; S.tier = d.tier; S.res = d.res;
  S.towns = d.towns; S.nextTownId = d.nextTownId; S.stats = d.stats; S.questsDone = new Set(d.quests);
  S.buildings = new Map(d.buildings.map(([i, t, p, town, m, z]) => [i, { t, p, town, m, z }]));
  S.zones = new Map(d.zones);
  S.neighbors = generateNeighbors();
  const cap = S.towns.find((t) => t.capital) || S.towns[0];
  if (cap) S.neighbors = S.neighbors.filter((n) => groundDist2(n.x, n.y, cap.x, cap.y) > 144 || d.nb.some((e) => e[0] === n.id));
  for (const [id, f, j, p] of d.nb) { const n = S.neighbors.find((q) => q.id === id); if (n) { n.friend = f; n.joined = !!j; n.pop = p; } }
  indexNeighbors();
  if (d.cam) Object.assign(S.cam, d.cam);
  recomputeTowns();
  return true;
}
export function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
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
