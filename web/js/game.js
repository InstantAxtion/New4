// Game state, rules and simulation.
import { W, H, B, BIOMES, world, idxOf, wrapX, tileWX, tileWY, neighbors, biomeAt, isWater, tileLat, riverAt } from './world.js';
import { mulberry32, hash2 } from './noise.js';
import { farmSeason, seasonIndex } from './seasons.js';
import { styleAt } from './regions.js';

export const RES = ['food', 'wood', 'stone', 'gold', 'iron'];
export const RES_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold', iron: 'Iron', bread: 'Bread', tools: 'Tools', cloth: 'Cloth', ale: 'Ale & wine', pottery: 'Pottery', glass: 'Glass', spices: 'Spices', books: 'Books', flour: 'Flour', wool: 'Wool' };
// Goods are made from basic resources in simple one-step workshops.
export const GOODS = ['bread', 'tools', 'cloth', 'ale', 'pottery', 'glass', 'spices', 'books', 'flour', 'wool'];
export const ALL_RES = [...RES, ...GOODS];

export const TIERS = [
  { name: 'Hamlet', pop: 0, maxTowns: 1, radiusCap: 6 },
  { name: 'Village', pop: 25, maxTowns: 2, radiusCap: 8 },
  { name: 'Town', pop: 80, maxTowns: 4, radiusCap: 10 },
  { name: 'City', pop: 200, maxTowns: 7, radiusCap: 13 },
  { name: 'Kingdom', pop: 500, maxTowns: 12, radiusCap: 16 },
  { name: 'Empire', pop: 1200, maxTowns: 16, radiusCap: 18 },
];

export const DEFS = {
  townhall: { name: 'Town Hall', cap: 8, prod: { gold: 0.3 }, time: 2, hidden: true },
  house: { name: 'Cottages', zone: 'housing', cost: { wood: 8 }, cap: 6, time: 2, tier: 0 },
  farm: { name: 'Farm Fields', zone: 'farmland', cost: { wood: 6 }, prod: { food: 1.4 }, jobs: 2, time: 1.5, tier: 0 },
  workshop: { name: 'Workshop', zone: 'workshop', cost: { wood: 12, stone: 6 }, prod: { gold: 0.8 }, jobs: 3, time: 3, tier: 1 },
  pasture: { name: 'Pasture', zone: 'pasture', cost: { wood: 5 }, prod: { food: 0.7, wool: 0.15 }, jobs: 1, time: 1.2, tier: 0 },
  woodlot: { name: 'Woodlot', zone: 'woodlot', cost: { food: 4 }, prod: { wood: 0.55 }, jobs: 1, time: 1.5, tier: 0 },
  park: { name: 'Park', zone: 'park', cost: { wood: 6, stone: 4 }, time: 1.2, tier: 0, mood: 1 },
  pit: { name: 'Mining Pit', zone: 'mining', cost: { wood: 10 }, prod: { stone: 0.45, iron: 0.08 }, jobs: 2, time: 2, tier: 1 },
  shops: { name: 'Shops', zone: 'shops', cost: { wood: 14, stone: 8 }, prod: { gold: 0.7 }, jobs: 2, time: 3, tier: 2 },
  lumber: { name: 'Lumber Camp', cost: { wood: 10 }, prod: { wood: 1.5 }, jobs: 2, time: 2, tier: 0, desc: 'Build on or beside woodland, taiga or jungle.' },
  dock: { name: 'Fishing Dock', cost: { wood: 12 }, prod: { food: 1.6 }, jobs: 2, time: 2, tier: 0, desc: 'Build on land touching the water.' },
  quarry: { name: 'Quarry', cost: { wood: 15 }, prod: { stone: 1 }, jobs: 3, time: 3, tier: 0, desc: 'Works anywhere; full output near hills, mountains or rocky ground, half elsewhere.' },
  mine: { name: 'Iron Mine', cost: { wood: 20, stone: 15 }, prod: { iron: 0.6 }, jobs: 3, time: 4, tier: 1, desc: 'Build on hills or beside mountains.' },
  tower: { name: 'Watchtower', cost: { wood: 20, stone: 25 }, jobs: 1, time: 4, tier: 1, radius: 3, desc: 'Pushes the town border outward.' },
  shipyard: { name: 'Shipyard', cost: { wood: 50, stone: 20 }, prod: { food: 0.8 }, jobs: 3, time: 5, tier: 1, desc: 'On a shore or riverbank. A fishing fleet (+food, docks here +25%) and ferries that carry settlers across short stretches of sea.' },
  harbour: { name: 'Harbour', cost: { wood: 80, stone: 60, gold: 40 }, prod: { gold: 1 }, jobs: 4, time: 8, tier: 2, desc: 'On the coast. Settlers and traders sail from here to other continents.' },
  green: { name: 'Town Green', hidden: true, civic: true, time: 1 },
  barracks: { name: 'Barracks', cost: { wood: 40, stone: 30 }, jobs: 1, time: 3, tier: 1, cat: 'military', desc: 'Trains soldiers for this town’s garrison (up to 10 each), for a little gold and food.' },
  fort: { name: 'Stone Fort', research: 'fortifications', cost: { stone: 120, wood: 40, iron: 20 }, jobs: 2, time: 6, tier: 2, cat: 'military', desc: 'A strong keep: +15 defence and room for 10 more soldiers in this town.' },
  stonebridge: { name: 'Stone Bridge', cost: { stone: 40, wood: 10 }, prod: { gold: 0.15 }, time: 4, tier: 1, cat: 'everyday', desc: 'Built across a river. Roads cross it, and travellers pay a coin or two.' },
  tunnel: { name: 'Mountain Tunnel', cost: { stone: 60, wood: 30, iron: 10 }, time: 6, tier: 2, cat: 'everyday', desc: 'Dug into a mountain inside your borders, so roads can pass straight through the range.' },
  fountain: { name: 'Fountain Square', hidden: true, civic: true, time: 1 },
  market: { name: 'Market', cost: { wood: 40, stone: 30, gold: 20 }, prod: { gold: 1.5 }, jobs: 3, time: 5, tier: 2, desc: 'Earns gold and sweetens every trade.' },
  // ---- everyday buildings (lift a town's mood) ----
  well: { name: 'Well', cost: { stone: 15 }, time: 2, tier: 0, mood: 1, cat: 'everyday', desc: 'Fresh water close to home.' },
  apiary: { name: 'Apiary', cost: { wood: 15 }, prod: { food: 0.5 }, jobs: 1, time: 2, tier: 0, mood: 1, cat: 'everyday', desc: 'Bees, honey and wildflowers.' },
  windmill: { name: 'Windmill', cost: { wood: 30, stone: 10 }, jobs: 1, time: 3, tier: 1, mood: 1, cat: 'everyday', desc: "Grinds grain: +15% food from this town's farms." },
  chapel: { name: 'Chapel', cost: { wood: 30, stone: 30 }, jobs: 1, time: 4, tier: 1, mood: 2, cat: 'everyday', desc: 'A quiet place for the whole town.' },
  tavern: { name: 'Tavern', cost: { wood: 40, stone: 10 }, use: { ale: 0.2 }, jobs: 2, time: 4, tier: 1, mood: 1, cat: 'everyday', desc: 'Warm and lively. Even merrier when it can serve ale or wine.' },
  yard: { name: "Builder's Yard", cost: { wood: 40, stone: 20 }, jobs: 2, time: 3, tier: 0, cat: 'everyday', desc: '+2 builder crews for this town, so more zoned tiles go up at once, and building here is 25% faster (up to two yards).' },
  stable: { name: 'Stables', cost: { wood: 40, stone: 15, food: 30 }, jobs: 2, time: 4, tier: 1, cat: 'everyday', desc: 'Horses! Riders and carts speed about town, settlers set out faster, traders bring more, and horses help plough the fields.' },
  school: { name: 'School', cost: { wood: 40, stone: 30, gold: 20 }, jobs: 2, time: 5, tier: 2, mood: 1, cat: 'everyday', desc: 'Villagers learn their trades faster.' },
  // ---- goods workshops ----
  bakery: { name: 'Bakery', cost: { wood: 30, stone: 15 }, use: { food: 1.2 }, prod: { bread: 1.6 }, jobs: 2, time: 3, tier: 1, cat: 'goods', desc: 'Turns food into bread, which feeds folk well and lifts their mood.' },
  brewery: { name: 'Brewery', cost: { wood: 30, stone: 10 }, use: { food: 0.8 }, prod: { ale: 0.6 }, jobs: 2, time: 3, tier: 1, cat: 'goods', desc: 'Brews ale for the taverns.' },
  weaver: { name: 'Weaver', cost: { wood: 25 }, use: { food: 0.3 }, prod: { cloth: 0.5 }, jobs: 2, time: 3, tier: 1, cat: 'goods', desc: 'Weaves cloth. Fine clothes make folk happier.' },
  gristmill: { name: 'Grist Mill', research: 'milling', cost: { wood: 30, stone: 15 }, use: { food: 1 }, prod: { flour: 0.9 }, jobs: 2, time: 3, tier: 1, cat: 'goods', desc: 'Grinds grain into flour. Bakers make far more bread from flour.' },
  granary: { name: 'Granary', cost: { wood: 25, stone: 10 }, time: 2, tier: 0, cat: 'everyday', store: { food: 600 }, desc: 'Holds 600 more food, so good harvests are never wasted.' },
  warehouse: { name: 'Warehouse', research: 'storehouses', cost: { wood: 40, stone: 30 }, time: 3, tier: 1, cat: 'everyday', store: { wood: 500, stone: 500, iron: 200, goods: 200 }, desc: 'Holds 500 more wood and stone, plus iron and goods.' },
  potter: { name: 'Potter', research: 'kilns', cost: { wood: 20, stone: 10 }, use: { stone: 0.3 }, prod: { pottery: 0.5 }, jobs: 2, time: 3, tier: 1, cat: 'goods', desc: 'Shapes clay into pots and jugs. Homes with pottery are happier.' },
  glassworks: { name: 'Glassworks', research: 'glassmaking', cost: { wood: 30, stone: 30 }, use: { wood: 0.4, stone: 0.2 }, prod: { glass: 0.4 }, jobs: 2, time: 4, tier: 2, cat: 'goods', desc: 'Glass windows: towns hold 5% more people while glass is in store.' },
  spicehouse: { name: 'Spice House', research: 'spicetrade', cost: { wood: 25, stone: 15, gold: 20 }, use: { gold: 0.25 }, prod: { spices: 0.4 }, jobs: 2, time: 3, tier: 2, cat: 'goods', desc: 'Buys spices from far-off traders. Spiced food lifts every town, and neighbours pay more in trades.' },
  scriptorium: { name: 'Scriptorium', research: 'scholarship', cost: { wood: 30, stone: 30, gold: 30 }, use: { cloth: 0.08, gold: 0.15 }, prod: { books: 0.3 }, jobs: 2, time: 5, tier: 3, cat: 'goods', desc: 'Copies books. Villagers learn faster and towns are happier.' },
  smithy: { name: 'Smithy', cost: { wood: 30, stone: 30 }, use: { iron: 0.3, wood: 0.5 }, prod: { tools: 0.4 }, jobs: 3, time: 4, tier: 2, cat: 'goods', desc: 'Forges tools: building goes faster and every trade works a little better.' },
  // ---- regional specialties (only towns of that style can build them) ----
  vineyard: { name: 'Vineyard', style: 'mediterranean', cost: { wood: 25 }, prod: { ale: 0.8 }, jobs: 2, time: 3, tier: 1, mood: 1, cat: 'special', desc: 'Mediterranean towns: sun-warmed grapes and wine.' },
  riceterrace: { name: 'Rice Terraces', style: 'eastasian', cost: { wood: 15, stone: 15 }, prod: { food: 2 }, jobs: 3, time: 3, tier: 1, cat: 'special', desc: 'Curved-eave towns: rich harvests, best on hills.' },
  icehut: { name: 'Ice-fishing Hut', style: 'nordic', cost: { wood: 15 }, prod: { food: 1.5 }, jobs: 2, time: 2, tier: 1, cat: 'special', noSeason: true, desc: 'Nordic towns: fishing all year round, even in deep winter. Touch the water.' },
  oasis: { name: 'Oasis Garden', style: 'desert', cost: { wood: 20, stone: 10 }, prod: { food: 1.2 }, jobs: 2, time: 3, tier: 1, mood: 1, cat: 'special', desc: 'Adobe towns: palms, dates and cool shade.' },
  cacao: { name: 'Cacao Grove', style: 'tropical', cost: { wood: 20 }, prod: { gold: 1 }, jobs: 2, time: 3, tier: 1, mood: 1, cat: 'special', desc: 'Tropical towns: cacao, much loved by traders.' },
  orchard: { name: 'Orchard', style: 'temperate', cost: { wood: 20 }, prod: { food: 1.1, ale: 0.2 }, jobs: 2, time: 3, tier: 1, mood: 1, cat: 'special', desc: 'Timber-framed towns: apples and cider.' },
  library: { name: 'Grand Library', wonder: true, cost: { wood: 300, stone: 200, gold: 300 }, time: 30, tier: 2, desc: '+10% to all production.' },
  gardens: { name: 'Royal Gardens', wonder: true, cost: { food: 300, wood: 200, gold: 150 }, time: 25, tier: 2, desc: '+25% food from every source.' },
  lighthouse: { name: 'Great Lighthouse', wonder: true, cost: { stone: 300, wood: 200, iron: 80 }, time: 30, tier: 2, desc: 'Coastal. +50% fishing and better trades.' },
  greatcastle: { name: 'Great Castle', wonder: true, cost: { stone: 400, iron: 100, gold: 200 }, time: 40, tier: 3, desc: '+4 border for every town, +20% gold.' },
  cathedral: { name: 'Cathedral', wonder: true, cost: { stone: 500, gold: 300, iron: 50 }, time: 40, tier: 3, desc: '+30% housing everywhere.' },
  // ---- regional wonders ----
  monastery: { name: 'Cliff Monastery', wonder: true, cost: { stone: 400, wood: 200, gold: 200 }, time: 40, tier: 3, desc: 'Beside mountains. +1 mood in every town.' },
  bridge: { name: 'Great Bridge', wonder: true, cost: { stone: 500, iron: 120, tools: 40 }, time: 45, tier: 3, desc: 'On a shore. +15% gold, and neighbours visit more often.' },
  observatory: { name: 'Observatory', wonder: true, cost: { stone: 300, gold: 300, tools: 30 }, time: 40, tier: 3, desc: 'On desert, steppe or hills. Villagers learn faster; +5% to everything.' },
  dome: { name: 'Botanical Dome', wonder: true, cost: { stone: 300, gold: 250, cloth: 40 }, time: 40, tier: 3, desc: 'On green land. +1 mood everywhere and +10% food.' },
};
// Daily upkeep for bigger buildings. If it can't be paid the building idles (never breaks).
export const UPKEEP = {
  shipyard: { wood: 0.08 },
  tower: { wood: 0.05 }, harbour: { wood: 0.15, gold: 0.1 }, market: { wood: 0.08 },
  chapel: { gold: 0.05 }, tavern: { food: 0.1 }, school: { gold: 0.1 }, stable: { food: 0.15 }, windmill: { wood: 0.03 },
  bakery: { wood: 0.04 }, brewery: { wood: 0.04 }, weaver: { wood: 0.03 }, smithy: { stone: 0.04 },
  library: { gold: 0.3 }, gardens: { food: 0.3 }, lighthouse: { wood: 0.2 }, greatcastle: { stone: 0.3 }, cathedral: { gold: 0.3 },
  monastery: { food: 0.2 }, bridge: { stone: 0.2 }, observatory: { gold: 0.3 }, dome: { wood: 0.2 },
};
// Each town may master one trade: +30% for it, -10% for its other work.
export const SPECS = {
  farming: { name: 'Farming', icon: '🌾', desc: 'Fields, fishing, orchards and the like.' },
  crafts: { name: 'Crafts', icon: '⚒', desc: 'Workshops, bakeries, breweries, weavers and smiths.' },
  trade: { name: 'Trade', icon: '💰', desc: 'Markets, harbours and taxes; better deals with neighbours.' },
  industry: { name: 'Industry', icon: '⛏', desc: 'Lumber camps, quarries and mines.' },
  learning: { name: 'Learning', icon: '📖', desc: 'Villagers learn twice as fast, and the town is happier.' },
};
const SPEC_OF = {
  farm: 'farming', pasture: 'farming', dock: 'farming', apiary: 'farming', riceterrace: 'farming', icehut: 'farming', oasis: 'farming', orchard: 'farming', vineyard: 'farming',
  workshop: 'crafts', shops: 'trade', bakery: 'crafts', brewery: 'crafts', weaver: 'crafts', smithy: 'crafts',
  market: 'trade', harbour: 'trade', townhall: 'trade', cacao: 'trade',
  lumber: 'industry', woodlot: 'industry', pit: 'industry', quarry: 'industry', mine: 'industry',
};
export const SPEC_TIER = 1, SPEC_CHANGE_COST = { gold: 100 };
export function specMult(t, type) {
  if (!t || !t.spec) return 1;
  const c = SPEC_OF[type];
  if (t.spec === 'learning') return 0.95;
  return c === t.spec ? 1.3 : c ? 0.9 : 1;
}
export function setSpec(t, key) {
  if (!SPECS[key] || S.tier < SPEC_TIER || t.spec === key) return false;
  if (t.spec) { if (!affordable(SPEC_CHANGE_COST)) return false; pay(SPEC_CHANGE_COST); }
  t.spec = key; emit('toast', `${t.name} now specialises in ${SPECS[key].name} ${SPECS[key].icon}.`); emit('change');
  return true;
}
export const EVERYDAY = ['granary', 'warehouse', 'yard', 'well', 'apiary', 'windmill', 'chapel', 'tavern', 'school', 'stable'];
// Builder crews per town: one to start, one more per 150 folk, and two per Builder's Yard.
export const yardsIn = (t) => { let n = 0; for (const b of S.buildings.values()) if (b.t === 'yard' && b.town === t.id && b.p >= 1 && !b.idle) n++; return n; };
export const crewsOf = (t) => 1 + Math.floor(t.pop / PACE.builders) + 2 * yardsIn(t) + (hasTalent('crews') ? 1 : 0);
export function crewsBusy(t) { let n = 0; for (const b of S.buildings.values()) if (b.town === t.id && b.p < 1 && b.z) n++; return n; }
export function zonesWaiting(t) { let n = 0; for (const i of S.zones.keys()) if (ownerOf(i % W, Math.floor(i / W)) === t) n++; return n; }
export const hasStables = () => count('stable') >= 1;
export const GOODS_BUILDINGS = ['gristmill', 'bakery', 'brewery', 'weaver', 'smithy', 'potter', 'glassworks', 'spicehouse', 'scriptorium'];
export const SPECIALTIES = ['orchard', 'icehut', 'vineyard', 'oasis', 'cacao', 'riceterrace'];
export const NEW_WONDERS = ['monastery', 'bridge', 'observatory', 'dome'];
export const townStyleOf = (t) => t.style || (t.style = styleAt(t.x, t.y));
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
// ---- town mood: never punishes, happier towns grow faster ----
export const MOODS = [{ name: 'Content', face: '🙂' }, { name: 'Happy', face: '😊' }, { name: 'Joyful', face: '😄' }];
const MOOD_SOURCES = [
  ['well', 'A well', 1], ['apiary', 'Honey from the apiary', 1], ['windmill', 'The windmill', 1], ['chapel', 'A chapel', 2],
  ['tavern', 'A tavern', 1], ['school', 'A school', 1], ['park', 'A park', 1],
  ['vineyard', 'Their vineyard', 1], ['oasis', 'The oasis garden', 1], ['cacao', 'The cacao grove', 1], ['orchard', 'The orchard', 1],
];
export function moodOf(t) {
  const have = new Set();
  for (const b of S.buildings.values()) if (b.town === t.id && b.p >= 1 && !b.idle) have.add(b.t);
  const parts = [], missing = [];
  let score = 0;
  for (const [type, label, v] of MOOD_SOURCES) {
    const d = DEFS[type];
    if (have.has(type)) { parts.push([label, v]); score += v; }
    else if (!d.style && d.tier <= S.tier) missing.push(DEFS[type].name);
  }
  if (t.served) { parts.push(['Ale or wine at the tavern', 1]); score += 1; }
  if (S.res.bread > 0.5) { parts.push(['Fresh bread', 1]); score += 1; }
  if (S.res.cloth > 0.5) { parts.push(['Fine clothes', 1]); score += 1; }
  if (S.res.pottery > 0.5) { parts.push(['Pots and jugs at home', 1]); score += 1; }
  if (S.res.spices > 0.5) { parts.push(['Spiced food', 1]); score += 1; }
  if (S.res.books > 0.5) { parts.push(['Books to read', 1]); score += 1; }
  if (S.golden) { parts.push(['A golden age', 1]); score += 1; }
  if (hasTech('harmony')) { parts.push(['Golden Harmony', 1]); score += 1; }
  if (hasTech('theatre')) { parts.push(['An evening at the theatre', 0.5]); score += 0.5; }
  { const rm = rulerMood(); if (rm) { parts.push(['A beloved ruler', rm]); score += rm; } }
  if (hasTalent('joy')) { parts.push(['A merry realm', 1]); score += 1; }
  if ((S.caravans || []).some(([a, b]) => a === t.id || b === t.id)) { parts.push(['Goods by caravan', 1]); score += 1; }
  const c = charm(t); if (c) { parts.push(['Civic charm', c * 0.5]); score += c * 0.5; }
  if (t.spec === 'learning') { parts.push(['A town of learning', 1]); score += 1; }
  if (t.fest && S.day < t.fest.until) { const v = 2 + (t.fest.ale ? 1 : 0); parts.push(['A festival!', v]); score += v; }
  else if (t.glow && S.day < t.glow) { parts.push(['Fond festival memories', 1]); score += 1; }
  if (t.cheer && S.day < t.cheer) { parts.push(['A good deed done', 1]); score += 1; }
  if (t.jobSkill && ((t.jobSkill.tavern || 0) >= 50 || (t.jobSkill.chapel || 0) >= 50)) { parts.push(['Warm hospitality and kindness', 0.5]); score += 0.5; }
  if (hasWonder('monastery')) { parts.push(['The Cliff Monastery', 1]); score += 1; }
  if (hasWonder('dome')) { parts.push(['The Botanical Dome', 1]); score += 1; }
  const level = score >= 6 ? 2 : score >= 2.5 ? 1 : 0;
  return { score, level, parts, missing };
}
function updateMoods() {
  for (const t of S.towns) {
    const m = moodOf(t), prev = t.mood ? t.mood.level : 0;
    t.mood = { score: m.score, level: m.level };
    if (m.level > prev && m.level === 2) emit('toast', `${MOODS[2].face} ${t.name} is joyful!`);
  }
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
      if (!taken(i) && BUILDABLE.has(b) && !nearNeighbor(x, y) && ownerOf(x, y) === t) spot = i;
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
export const MANUAL = ['lumber', 'dock', 'quarry', 'mine', 'tower', 'barracks', 'fort', 'market', 'shipyard', 'harbour', 'stonebridge', 'tunnel'];
export const WONDERS = ['library', 'gardens', 'lighthouse', 'greatcastle', 'cathedral'];
export const ALL_WONDERS = [...WONDERS, 'monastery', 'bridge', 'observatory', 'dome'];
// Grand buildings that cover 2×2 tiles: the anchor tile plus three more below it.
export const BIG = new Set([...WONDERS, 'market']);
const STEP_G = [[0, 1, 1], [-1, 0, -1], [-1, 0, 1], [0, 1, -1]];
export const stepG = (x, y, d) => [wrapX(x + ((y & 1) ? STEP_G[d][1] : STEP_G[d][0])), y + STEP_G[d][2]];
export function footprint(x, y) { const [bx, by] = stepG(x, y, 0), [cx, cy] = stepG(x, y, 2); return [[x, y], [bx, by], [cx, cy], [x, y + 2]]; }
export function recomputeOccupied() {
  S.occupied = new Map();
  for (const [i, b] of S.buildings) if (BIG.has(b.t)) { const x = i % W, y = Math.floor(i / W); for (const [fx, fy] of footprint(x, y).slice(1)) S.occupied.set(idxOf(fx, fy), i); }
}
export const taken = (i) => S.buildings.has(i) || S.occupied.has(i) || S.canals.has(i);
// Stone bridges and tunnels carry roads over rivers and through mountains.
export const CROSSINGS = new Set(['stonebridge', 'tunnel']);
export const crossing = (i) => { const b = S.buildings.get(i); return !!b && CROSSINGS.has(b.t) && b.p >= 1; };
export const anchorOf = (i) => (S.occupied.has(i) ? S.occupied.get(i) : i);
export const ZONES = {
  housing: { name: 'Housing', builds: 'house', color: '#f07a48' },
  farmland: { name: 'Farmland', builds: 'farm', color: '#e6cf3a' },
  pasture: { name: 'Pasture', builds: 'pasture', color: '#7cc464' },
  woodlot: { name: 'Woodlot', builds: 'woodlot', color: '#2f8a5a' },
  park: { name: 'Park', builds: 'park', color: '#e88ac0' },
  workshop: { name: 'Workshops', builds: 'workshop', color: '#8a7ef0' },
  mining: { name: 'Mining', builds: 'pit', color: '#a08a70' },
  shops: { name: 'Shops', builds: 'shops', color: '#40a8d8' },
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
  res: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0, bread: 0, tools: 0, cloth: 0, ale: 0 },
  rates: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0, bread: 0, tools: 0, cloth: 0, ale: 0, pottery: 0, glass: 0, spices: 0, books: 0, flour: 0, wool: 0 },
  towns: [], buildings: new Map(), zones: new Map(), proads: new Set(), canals: new Set(), caravans: [],
  neighbors: [], nbIndex: new Map(), occupied: new Map(),
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
// Prestige: the realm's renown, from everything it has done.
export function prestige() { return Math.round(rawPrestige() * (hasTalent('fame') ? 1.25 : 1)); }
function rawPrestige() {
  let w = 0; for (const b of S.buildings.values()) if (b.p >= 1 && DEFS[b.t] && DEFS[b.t].wonder) w++;
  const friends = S.neighbors.filter((n) => n.friend >= 60 || n.joined).length;
  return Math.round(totalPop() * 2 + S.towns.length * 60 + w * 400 + (S.explored || []).length * 40 + friends * 25 + S.questsDone.size * 15 + (S.stats.coronations || 0) * 100 + (S.festsHeld ? Object.keys(S.festsHeld).length * 30 : 0) + (S.golden ? 1000 : 0));
}
export const PRESTIGE_RANKS = [[0, 'Humble'], [500, 'Known'], [1500, 'Respected'], [4000, 'Renowned'], [9000, 'Famed'], [18000, 'Legendary']];
export const prestigeRank = (p) => PRESTIGE_RANKS.filter(([v]) => p >= v).pop()[1];
// A trade's own skill: from 0.9x for raw beginners to 1.3x for a town of masters.
// What research and talents add to each building's work.
const FIELDS = new Set(['farm', 'orchard', 'riceterrace', 'vineyard', 'oasis']);
function techMult(type, r, i) {
  let m = hasTech('tools') ? 1.05 : 1;
  if (r === 'food') {
    if (FIELDS.has(type)) m *= (hasTech('rotation') ? 1.1 : 1) * (hasTech('plough') ? 1.1 : 1) * (hasTech('irrigation') ? 1.1 : 1);
    if (type === 'pasture' && hasTech('plough')) m *= 1.1;
    if ((type === 'dock' || type === 'shipyard') && hasTech('navigation')) m *= 1.2;
    if (hasTalent('bounty')) m *= 1.15;
    if (hasTalent('granary') && FIELDS.has(type) && i !== undefined && farmSeason(S.day, tileLat(Math.floor(i / W))) < 0.6) m *= 1.25;
  }
  if (r === 'stone' && (type === 'quarry' || type === 'pit')) m *= (hasTech('masonry') ? 1.2 : 1) * (hasTech('engineering') ? 1.15 : 1);
  if (r === 'iron' && hasTech('engineering')) m *= 1.15;
  if (r === 'gold') m *= (hasTech('guilds') ? 1.15 : 1) * (hasTech('banking') ? 1.2 : 1) * (hasTalent('coin') ? 1.1 : 1);
  if (type === 'pasture' && hasTech('husbandry')) m *= 1.15;
  if (r === 'wool' && hasTech('shearing')) m *= 1.3;
  if (type === 'dock' && hasTech('nets')) m *= 1.1;
  if (r === 'pottery' && hasTech('kilns')) m *= 1.15;
  if (r === 'glass' && hasTech('glassmaking')) m *= 1.1;
  if (r === 'ale' && hasTech('brewing')) m *= 1.15;
  if ((type === 'lumber' || type === 'woodlot') && hasTech('forestry')) m *= 1.15;
  if ((r === 'iron' || r === 'stone') && (type === 'mine' || type === 'pit') && hasTech('deepmining')) m *= 1.15;
  if ((type === 'shipyard' || type === 'harbour') && hasTech('shipbuilding')) m *= 1.2;
  if (r === 'gold' && (type === 'market' || type === 'shops') && hasTech('grandmarkets')) m *= 1.15;
  if (hasTech('enlightenment')) m *= 1.1;
  if (r === 'food') m *= rulerMult('food');
  if (r === 'gold') m *= rulerMult('gold');
  if (hasTech('waterwheel') && (type === 'workshop' || type === 'windmill' || GOODS_BUILDINGS.includes(type))) m *= 1.1;
  return m;
}
export const techBuild = (type) => { const w = DEFS[type] && DEFS[type].wonder; return (hasTech('carpentry') ? 1.15 : 1) * (hasTech('engineering') ? 1.25 : 1) * (hasTalent('quick') ? 1.2 : 1) * (hasTalent('grand') && w ? 1.4 : 1) * (w && hasTech('stonework') ? 1.2 : 1) * (w && hasTech('greatbuilders') ? 1.25 : 1) * rulerMult('build'); };
// Two-step chains: grain to flour to bread, fleece to wool to cloth.
const CHAIN = { bakery: { res: 'flour', use: 0.7, boost: 1.4 }, weaver: { res: 'wool', use: 0.35, boost: 1.5 } };
// ---------------- storage ----------------
// Gentle limits: a full store simply stops filling, and a little of the extra is sold for gold.
export function storeCap(r) {
  if (r === 'gold') return Infinity;
  const base = { food: 400, wood: 400, stone: 300, iron: 150 }[r] ?? 120;
  let c = base + S.towns.length * 100;
  for (const b of S.buildings.values()) if (b.p >= 1 && DEFS[b.t] && DEFS[b.t].store) { const st = DEFS[b.t].store; c += st[r] ?? (GOODS.includes(r) ? st.goods || 0 : 0); }
  if (hasTech('storehouses')) c *= 1.2;
  return Math.round(c);
}
let capCache = null, capStamp = -1;
export function caps() { if (capStamp !== S.buildings.size + S.towns.length * 1000 + (S.research ? S.research.done.length * 1e6 : 0)) { capStamp = S.buildings.size + S.towns.length * 1000 + (S.research ? S.research.done.length * 1e6 : 0); capCache = {}; for (const r of ALL_RES) capCache[r] = storeCap(r); } return capCache; }
// ---------------- building levels ----------------
// Workplaces improve by themselves with time and their workers' skill: level 2, then 3.
export const LEVEL_MULT = [1, 1, 1.15, 1.3];
function levelUp(t) {
  for (const [i, b] of S.buildings) {
    if (b.t === 'house' || b.p < 1 || !DEFS[b.t] || !DEFS[b.t].jobs) continue;
    const tw = townById(b.town), sk = tw && tw.jobSkill ? tw.jobSkill[b.t] || 0 : 0, age = S.day - (b.d || 0), lv = b.lv || 1;
    const next = lv === 1 && age >= 24 && sk >= 30 ? 2 : lv === 2 && age >= 60 && sk >= 60 ? 3 : 0;
    if (next) { b.lv = next; emit('upgraded', { b, i, x: i % W, y: Math.floor(i / W) }); }
  }
}
// ---------------- town fame ----------------
const FAME = { food: 'Breadbasket', wood: 'Timber Town', stone: 'Stonemasons’ Town', gold: 'Merchant Town', iron: 'Iron Town', bread: 'Bakers’ Town', tools: 'Smiths’ Town', cloth: 'Weavers’ Town', ale: 'Famous Ale Town', pottery: 'Potters’ Town', glass: 'Glassmakers’ Town', spices: 'Spice Town', books: 'Town of Scholars', flour: 'Millers’ Town', wool: 'Wool Town' };
const FAME_MIN = { food: 5, wood: 3, stone: 2, gold: 3, iron: 0.8 };
function updateFame() {
  for (const t of S.towns) {
    const pr = t.prod || {}; let best = null, bv = 0, total = 0;
    for (const [r, v] of Object.entries(pr)) { const w = v / (FAME_MIN[r] || 0.5); total += w; if (w > bv) { bv = w; best = r; } }
    const ok = best && bv >= 1 && bv >= total * 0.35;
    const title = ok ? (best === 'ale' && townStyleOf(t) === 'mediterranean' ? 'Famous Wine Town' : FAME[best] || null) : null;
    if (title && (!t.fame || t.fame.r !== best)) { t.fame = { r: best, title }; emit('fame', t); }
    else if (!title && t.fame && bv < 0.7) t.fame = null;
  }
}
export const fameMult = (t, r) => (t && t.fame && t.fame.r === r ? 1.1 : 1);
// ---------------- contracts ----------------
// A friendly neighbour asks for a large delivery over a year; finishing it brings a fine reward.
export function stepContracts() {
  S.contracts ||= [];
  S.contracts = S.contracts.filter((c) => (c.state === 'offer' ? S.day < c.until : c.state === 'active' ? S.day < c.until : S.day < c.until + 6));
  const offers = S.contracts.filter((c) => c.state === 'offer').length, active = S.contracts.filter((c) => c.state === 'active').length;
  if (offers >= 2 || active >= 3 || S.tier < 1 || Math.random() > 0.02) return;
  const nbs = S.neighbors.filter((n) => !n.joined && n.friend >= 30 && inContact(n) && !S.contracts.some((c) => c.nb === n.id));
  if (!nbs.length) return;
  const n = nbs[Math.floor(Math.random() * nbs.length)];
  const res = ['food', 'wood', 'stone', ...(S.tier >= 2 ? ['iron', 'bread', 'cloth'] : [])][Math.floor(Math.random() * (S.tier >= 2 ? 6 : 3))];
  const total = Math.round(((res === 'iron' ? 60 : ['bread', 'cloth'].includes(res) ? 50 : 200) * (1 + S.tier * 0.4)) / 10) * 10;
  const reward = { gold: Math.round(total * (res === 'iron' || res === 'bread' || res === 'cloth' ? 3 : 1) * 0.9 * (hasTech('diplomacy') ? 1.2 : 1)) };
  S.contracts.push({ id: Date.now() % 1e9 + Math.floor(Math.random() * 1000), nb: n.id, name: n.name, leader: n.leader, res, total, sent: 0, reward, state: 'offer', until: S.day + 10 });
  emit('toast', `📜 ${n.leader || 'The elder'} of ${n.name} offers a contract: ${total} ${RES_NAMES[res].toLowerCase()} over a year.`);
}
export function acceptContract(id) { const c = (S.contracts || []).find((q) => q.id === id); if (!c || c.state !== 'offer') return false; c.state = 'active'; c.until = S.day + 48; emit('change'); return true; }
export function declineContract(id) { S.contracts = (S.contracts || []).filter((q) => q.id !== id); emit('change'); }
export function sendContract(id) {
  const c = (S.contracts || []).find((q) => q.id === id); if (!c || c.state !== 'active') return false;
  const amt = Math.min(c.total - c.sent, Math.max(5, Math.round(c.total / 8)), Math.floor(S.res[c.res]));
  if (amt <= 0) return false;
  S.res[c.res] -= amt; c.sent += amt;
  if (c.sent >= c.total) {
    c.state = 'done'; gain(c.reward); S.stats.contracts = (S.stats.contracts || 0) + 1;
    const n = S.neighbors.find((q) => q.id === c.nb); if (n) n.friend = Math.min(100, n.friend + 20);
    emit('toast', `📜 Contract fulfilled for ${c.name}! They send ${c.reward.gold} gold with warm thanks.`);
  }
  emit('change'); return true;
}
export function jobSkillMult(t, type) { const v = t && t.jobSkill ? t.jobSkill[type] : undefined; return v === undefined ? 1 : 0.9 + (v / 100) * 0.4; }
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
// Streets are reserved: set by the road planner (life.js) to avoid a circular import.
let streetCheck = () => false;
let ferryCheck = () => false;
export function setFerryCheck(f) { ferryCheck = f; }
export function setStreetCheck(f) { streetCheck = f; }
export const byRiver = (x, y) => neighbors(x, y).some(([nx, ny]) => ny >= 0 && ny < H && (riverAt(nx, ny) || S.canals.has(idxOf(wrapX(nx), ny))));
const adjacent = (x, y, pred) => neighbors(x, y).some(([nx, ny]) => ny >= 0 && ny < H && pred(biomeAt(nx, ny)));
const affordable = (cost) => Object.entries(cost || {}).every(([k, v]) => S.res[k] >= v);
const pay = (cost) => Object.entries(cost || {}).forEach(([k, v]) => (S.res[k] -= v));
const gain = (r) => Object.entries(r || {}).forEach(([k, v]) => (S.res[k] += v));
export { affordable };

// Districts: once a town is big enough, each quarter around its hall gets a name from what stands there.
const DISTRICT_KIND = { house: 'home', farm: 'field', pasture: 'field', orchard: 'field', vineyard: 'field', riceterrace: 'field', shops: 'market', market: 'market', workshop: 'craft', bakery: 'craft', brewery: 'craft', weaver: 'craft', smithy: 'craft', potter: 'craft', glassworks: 'craft', park: 'green', green: 'green', woodlot: 'wood', lumber: 'wood', pit: 'mine', mine: 'mine', quarry: 'mine', dock: 'harbour', shipyard: 'harbour', harbour: 'harbour' };
const DISTRICT_NAMES = { home: ['Hearth Row', 'Cottage Lane', 'Homesteads', 'Hollyhock End'], field: ['Fieldside', 'Barley End', 'Meadowside'], market: ['Market Quarter', 'Merchants’ Row'], craft: ['Craftsmen’s Row', 'Anvil Lane', 'Kiln Street'], green: ['The Gardens', 'Greenside'], wood: ['Woodside', 'Timber End'], mine: ['Miners’ End', 'Quarry Hill'], harbour: ['Harbourside', 'Quayside'] };
function computeDistricts(t) {
  if (t.n < 36) { t.districts = []; return; }
  const q = [0, 1, 2, 3].map(() => ({ n: 0, sx: 0, sy: 0, kinds: {}, river: 0, near: 0 }));
  const hx = tileWX(t.x, t.y), hy = tileWY(t.y);
  for (const [i, b] of S.buildings) {
    if (b.town !== t.id || b.p < 1 || b.t === 'townhall') continue;
    const x = i % W, y = Math.floor(i / W), dx = tileWX(x, y) - hx, dy = (tileWY(y) - hy) * 2;
    const k = (dx >= 0 ? 1 : 0) + (dy >= 0 ? 2 : 0), Q = q[k];
    Q.n++; Q.sx += x; Q.sy += y; const kind = DISTRICT_KIND[b.t]; if (kind) Q.kinds[kind] = (Q.kinds[kind] || 0) + 1;
    if (byRiver(x, y)) Q.river++; Q.near += Math.hypot(dx, dy);
  }
  const used = new Set(), out = [];
  const oldest = q.map((Q, k) => [Q.n >= 6 ? Q.near / Q.n : Infinity, k]).sort((a, b) => a[0] - b[0])[0][1];
  q.forEach((Q, k) => {
    if (Q.n < 8) return;
    let kind = Object.entries(Q.kinds).sort((a, b) => b[1] - a[1])[0]; kind = kind ? kind[0] : 'home';
    let name = k === oldest ? 'Old Town' : Q.river > Q.n * 0.25 && kind === 'home' ? 'Riverside' : null;
    if (!name || used.has(name)) { const opts = DISTRICT_NAMES[kind] || DISTRICT_NAMES.home; name = opts.find((n) => !used.has(n)) || `${['North', 'East', 'West', 'South'][k]} ${opts[0]}`; }
    used.add(name); out.push({ name, x: Math.round(Q.sx / Q.n), y: Math.round(Q.sy / Q.n) });
  });
  t.districts = out;
}
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
    t.radius = Math.min(cap, (t.capital ? 5 : 4) + t.n * 0.3) + t.towers * 3 + gc + (hasTech('cartography') ? 2 : 0) + (hasTalent('border') ? 2 : 0) + (hasTech('surveying') ? 1 : 0);
    t.cap = Math.round(t.capRaw * cath * (1 + 0.04 * charm(t)) * (S.res.glass > 0.5 ? 1.05 : 1) * (hasTech('architecture') ? 1.1 : 1));
    computeDistricts(t);
  }
}

// ---------------- placement rules ----------------
export function canPlace(type, x, y, opt = {}) {
  if (y < 1 || y >= H - 3) return { ok: false, reason: 'Too far north or south.' };
  x = wrapX(x);
  const i = idxOf(x, y), b = world.biome[i], d = DEFS[type];
  const free = (j) => !taken(j) || (opt.moving !== undefined && anchorOf(j) === opt.moving);
  if (!free(i)) return { ok: false, reason: 'Something is already built here.' };
  if (BIG.has(type)) {
    const own0 = ownerOf(x, y);
    for (const [fx, fy] of footprint(x, y).slice(1)) {
      const j = idxOf(fx, fy), fb = world.biome[j];
      if (!free(j) || !BUILDABLE.has(fb) || riverAt(fx, fy) || streetCheck(j) || ownerOf(fx, fy) !== own0) return { ok: false, reason: 'Grand buildings need a clear 2×2 patch of land.' };
    }
  }
  if (isWater(b)) return { ok: false, reason: 'You cannot build on water.' };
  if (type === 'stonebridge') { if (!riverAt(x, y)) return { ok: false, reason: 'Stone bridges are built across a river.' }; }
  else if (riverAt(x, y)) return { ok: false, reason: 'A river flows here.' };
  if (type === 'tunnel') { if (b !== B.MOUNTAIN && b !== B.SNOW) return { ok: false, reason: 'Tunnels are dug into mountains.' }; }
  else if (streetCheck(i) && type !== 'stonebridge') return { ok: false, reason: 'A street runs here. Build beside it.' };
  if (!BUILDABLE.has(b) && type !== 'tunnel' && type !== 'stonebridge') return { ok: false, reason: `${BIOMES[b].name} is too rugged to build on.` };
  const own = ownerOf(x, y);
  if (!own) return { ok: false, reason: 'Outside your borders.' };
  const nb = nearNeighbor(x, y);
  if (nb) return { ok: false, reason: `Too close to ${nb.name}.` };
  if (d.tier > S.tier) return { ok: false, reason: `Unlocks at ${TIERS[d.tier].name}.` };
  if (d.research && !hasTech(d.research) && opt.moving === undefined) return { ok: false, reason: `Needs the research: ${(RESEARCH.find((r) => r.id === d.research) || {}).name}.` };
  if (d.wonder && wonderStarted(type) && opt.moving === undefined) return { ok: false, reason: 'This wonder is already built.' };
  if (d.style && townStyleOf(own) !== d.style) return { ok: false, reason: `Only ${d.desc.split(':')[0]} can build this.` };
  if ((type === 'icehut' || type === 'bridge') && !adjacent(x, y, (n) => n === B.SHALLOW || n === B.OCEAN || n === B.SEAICE) && !(type === 'bridge' && byRiver(x, y))) return { ok: false, reason: 'Must touch the water.' };
  if (type === 'monastery' && !adjacent(x, y, (n) => n === B.MOUNTAIN || n === B.SNOW)) return { ok: false, reason: 'Must stand beside mountains.' };
  if (type === 'observatory' && !(b === B.DESERT || b === B.STEPPE || b === B.HILLS || b === B.TUNDRA)) return { ok: false, reason: 'Needs open desert, steppe or hills.' };
  if (type === 'dome' && !(b === B.GRASS || b === B.FOREST || b === B.JUNGLE || b === B.SAVANNA)) return { ok: false, reason: 'Needs green land.' };
  if (type === 'lumber' && !WOODS.has(b) && !adjacent(x, y, (n) => WOODS.has(n))) return { ok: false, reason: 'Needs woodland nearby.' };
  if ((type === 'dock' || type === 'lighthouse' || type === 'harbour' || type === 'shipyard') && !adjacent(x, y, (n) => n === B.SHALLOW || n === B.OCEAN) && !((type === 'dock' || type === 'shipyard') && byRiver(x, y))) return { ok: false, reason: 'Must touch the water.' };
  if (type === 'mine' && !(b === B.HILLS || adjacent(x, y, (n) => n === B.MOUNTAIN || n === B.SNOW))) return { ok: false, reason: 'Needs hills or mountains.' };
  if (opt.moving === undefined && !affordable(d.cost)) return { ok: false, reason: 'Not enough resources.', own };
  return { ok: true, own };
}

const rocky = (x, y) => { const b = biomeAt(x, y); return b === B.HILLS || b === B.DESERT || b === B.TUNDRA || adjacent(x, y, (n) => n === B.HILLS || n === B.MOUNTAIN || n === B.SNOW); };
function yieldMult(type, x, y) {
  const b = biomeAt(x, y);
  if (type === 'farm') return (FARM_MULT[b] ?? 1) * (byRiver(x, y) ? 1.1 : 1); // fertile floodplain
  if (type === 'lumber') {
    let n = WOODS.has(b) ? 2 : 0;
    for (const [nx, ny] of neighbors(x, y)) if (WOODS.has(biomeAt(nx, ny))) n++;
    return 0.6 + Math.min(n, 8) * 0.1;
  }
  if (type === 'quarry') return rocky(x, y) ? 1 : 0.5;
  if (type === 'riceterrace') return b === B.HILLS ? 1.25 : 1;
  return 1;
}

export function placeBuilding(type, x, y, flip = false) {
  x = wrapX(x);
  const r = canPlace(type, x, y);
  if (!r.ok) return r;
  pay(DEFS[type].cost);
  const i = idxOf(x, y);
  S.zones.delete(i);
  S.buildings.set(i, { t: type, p: 0, town: r.own.id, m: yieldMult(type, x, y), f: flip ? 1 : 0 });
  if (BIG.has(type)) { for (const [fx, fy] of footprint(x, y)) S.zones.delete(idxOf(fx, fy)); recomputeOccupied(); }
  emit('placed', { type, x, y });
  emit('change');
  return r;
}

// Mining needs rocky ground: hills, desert or tundra, or beside hills and mountains.
export const canZoneAs = (z, x, y) => canZone(x, y) && (z !== 'mining' || rocky(wrapX(x), y));
export function canZone(x, y) {
  x = wrapX(x);
  if (y < 1 || y >= H - 1) return false;
  const i = idxOf(x, y), b = world.biome[i];
  if (taken(i) || !BUILDABLE.has(b) || riverAt(x, y) || streetCheck(i)) return false;
  if (!ownerOf(x, y) || nearNeighbor(x, y)) return false;
  return true;
}
// Roads you paint yourself are free; they can't cross buildings, water or rivers, and stay inside your borders.
export function canRoad(x, y) {
  x = wrapX(x);
  if (y < 1 || y >= H - 1) return false;
  const i = idxOf(x, y);
  if (S.proads.has(i)) return false;
  if (crossing(i)) return !!ownerOf(x, y);
  if (taken(i) || !BUILDABLE.has(world.biome[i]) || riverAt(x, y)) return false;
  return !!ownerOf(x, y) && !nearNeighbor(x, y);
}
// Canals: dug through open land inside your borders; boats use them and docks and farms count them as river.
// Caravans: your own wagon trains between two of your towns on the same continent.
export const CARAVAN_COST = { food: 20, gold: 30 };
export const maxCaravans = () => Math.max(0, S.towns.length - 1) + (S.tier >= 3 ? 2 : 0);
export function caravanPairs() {
  const out = [], has = new Set(S.caravans.map(([a, b]) => a + ':' + b));
  for (const a of S.towns) for (const b of S.towns) if (a.id < b.id && !has.has(a.id + ':' + b.id) && continentAt(a.x, a.y) === continentAt(b.x, b.y)) out.push([a, b]);
  return out;
}
export function startCaravan(aId, bId) {
  if (S.caravans.length >= maxCaravans() || !affordable(CARAVAN_COST)) return false;
  pay(CARAVAN_COST); S.caravans.push([Math.min(aId, bId), Math.max(aId, bId)]); emit('change'); return true;
}
export function stopCaravan(k) { S.caravans.splice(k, 1); emit('change'); }
export function canCanal(x, y) {
  x = wrapX(x);
  if (y < 1 || y >= H - 1) return false;
  const i = idxOf(x, y);
  if (S.canals.has(i) || S.buildings.has(i) || S.occupied.has(i) || !BUILDABLE.has(world.biome[i]) || riverAt(x, y)) return false;
  return !!ownerOf(x, y) && !nearNeighbor(x, y);
}
export function setZone(zone, x, y) {
  x = wrapX(x);
  const i = idxOf(x, y);
  if (zone === 'erase') { const a = S.zones.delete(i), r = S.proads.delete(i), c = S.canals.delete(i); if (a || r || c) { emit('change'); return true; } return false; }
  if (zone === 'road') { if (!canRoad(x, y)) return false; S.zones.delete(i); S.proads.add(i); emit('change'); return true; }
  if (zone === 'canal') { if (!canCanal(x, y)) return false; S.zones.delete(i); S.proads.delete(i); S.canals.add(i); emit('change'); return true; }
  if (ZONES[zone] && DEFS[ZONES[zone].builds].tier > S.tier) return false;
  if (!canZone(x, y) || S.zones.get(i) === zone || (zone === 'mining' && !rocky(x, y))) return false;
  S.zones.set(i, zone); emit('change');
  return true;
}

// Move a finished building somewhere else in your realm, free of charge.
export function moveBuilding(from, x, y) {
  const b = S.buildings.get(from); x = wrapX(x);
  if (!b || b.t === 'townhall' || DEFS[b.t].civic) return { ok: false, reason: 'This cannot be moved.' };
  const r = canPlace(b.t, x, y, { moving: from });
  if (!r.ok) return r;
  const i = idxOf(x, y);
  S.buildings.delete(from); S.buildings.set(i, b); b.town = r.own.id; b.m = yieldMult(b.t, x, y);
  for (const [fx, fy] of BIG.has(b.t) ? footprint(x, y) : [[x, y]]) S.zones.delete(idxOf(fx, fy));
  recomputeOccupied(); recomputeTowns(); emit('change');
  return r;
}
export function turnBuilding(i) { const b = S.buildings.get(i); if (!b) return false; b.f = b.f ? 0 : 1; emit('change'); return true; }
export function demolish(x, y) {
  const i = anchorOf(idxOf(x, y)), b = S.buildings.get(i);
  if (!b || b.t === 'townhall' || DEFS[b.t].civic) return false;
  const d = DEFS[b.t];
  if (b.p >= 1 || b.p > 0) Object.entries(d.cost || {}).forEach(([k, v]) => (S.res[k] += Math.floor(v * (b.p >= 1 ? 0.5 : 0.9))));
  S.buildings.delete(i);
  recomputeOccupied(); recomputeTowns(); emit('change');
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
  if (!realmContinents().includes(cont) && !hasHarbour() && !ferryCheck(x, y)) return { ok: false, reason: `Settlers need a Harbour to sail to ${cont} (or a Shipyard within a short ferry ride).` };
  const b = biomeAt(x, y);
  if (isWater(b) || !BUILDABLE.has(b) || riverAt(x, y)) return { ok: false, reason: 'Pick open land for a new settlement.' };
  for (const t of S.towns) if (groundDist2(x, y, t.x, t.y) < (t.radius + 3) ** 2) return { ok: false, reason: `Too close to ${t.name}.` };
  const nb = nearNeighbor(x, y, 5); if (nb) return { ok: false, reason: `Too close to ${nb.name}.` };
  if (!affordable(FOUND_COST)) return { ok: false, reason: `Needs ${FOUND_COST.food} food, ${FOUND_COST.wood} wood and ${FOUND_COST.gold} gold.` };
  return { ok: true };
}
export const FOUND_COST_BASE = { food: 50, wood: 50, gold: 30 };
export let FOUND_COST = FOUND_COST_BASE;

// ---------------- research tree ----------------
// Knowledge comes from schools, scriptoria, the library and the observatory; it fills whichever project you pick.
export const RESEARCH = [
  { id: 'rotation', era: 0, icon: '🌾', name: 'Crop Rotation', cost: 30, req: [], desc: '+10% food from fields and orchards.' },
  { id: 'carpentry', era: 0, icon: '🪚', name: 'Carpentry', cost: 30, req: [], desc: 'Everything is built 15% faster.' },
  { id: 'tools', era: 0, icon: '⚒️', name: 'Better Tools', cost: 30, req: [], desc: '+5% to all work.' },
  { id: 'plough', era: 1, icon: '🐂', name: 'Heavy Plough', cost: 70, req: ['rotation'], desc: '+10% food from fields and pastures.' },
  { id: 'herbal', era: 1, icon: '🌿', name: 'Herbal Lore', cost: 70, req: ['rotation'], desc: 'Families settle 15% faster.' },
  { id: 'masonry', era: 1, icon: '🧱', name: 'Masonry', cost: 70, req: ['carpentry'], desc: '+20% stone from quarries and pits.' },
  { id: 'waterwheel', era: 1, icon: '💧', name: 'Water Wheels', cost: 70, req: ['tools'], desc: '+10% from workshops, mills and goods makers.' },
  { id: 'irrigation', era: 2, icon: '🚿', name: 'Irrigation', cost: 140, req: ['plough'], desc: '+10% more food from fields.' },
  { id: 'navigation', era: 2, icon: '🧭', name: 'Navigation', cost: 140, req: ['herbal'], desc: '+20% fishing and better trades.' },
  { id: 'architecture', era: 2, icon: '📐', name: 'Architecture', cost: 140, req: ['masonry'], desc: 'Homes hold 10% more people.' },
  { id: 'guilds', era: 2, icon: '🏛️', name: 'Guilds', cost: 140, req: ['waterwheel'], desc: '+15% gold, and skills grow 20% faster.' },
  { id: 'cartography', era: 3, icon: '🗺️', name: 'Cartography', cost: 260, req: ['navigation'], desc: 'Every town’s border reaches 2 tiles further.' },
  { id: 'engineering', era: 3, icon: '⚙️', name: 'Engineering', cost: 260, req: ['architecture'], desc: 'Build 25% faster; +15% stone and iron.' },
  { id: 'printing', era: 3, icon: '📜', name: 'Printing Press', cost: 260, req: ['guilds'], desc: 'Skills grow 40% faster.' },
  { id: 'banking', era: 3, icon: '💰', name: 'Banking', cost: 260, req: ['guilds'], desc: '+20% gold.' },
  // more ideas, several of which open up new buildings
  { id: 'milling', era: 0, icon: '🌀', name: 'Milling', cost: 30, req: [], desc: 'Unlocks the Grist Mill: grain into flour for richer bread.', unlocks: ['gristmill'] },
  { id: 'husbandry', era: 0, icon: '🐑', name: 'Animal Husbandry', cost: 30, req: [], desc: '+15% from pastures.' },
  { id: 'nets', era: 0, icon: '🎣', name: 'Better Nets', cost: 30, req: [], desc: '+10% from fishing docks.' },
  { id: 'storehouses', era: 1, icon: '📦', name: 'Storehouses', cost: 70, req: ['carpentry'], desc: 'Unlocks the Warehouse; every store holds 20% more.', unlocks: ['warehouse'] },
  { id: 'kilns', era: 1, icon: '🏺', name: 'Kilns', cost: 70, req: ['tools'], desc: 'Unlocks the Potter; +15% pottery.', unlocks: ['potter'] },
  { id: 'shearing', era: 1, icon: '✂️', name: 'Shearing', cost: 70, req: ['husbandry'], desc: '+30% wool from pastures.' },
  { id: 'brewing', era: 1, icon: '🍺', name: 'Brewing', cost: 70, req: ['milling'], desc: '+15% ale and wine.' },
  { id: 'forestry', era: 1, icon: '🌲', name: 'Forestry', cost: 70, req: ['tools'], desc: '+15% from lumber camps and woodlots.' },
  { id: 'roadbuilding', era: 1, icon: '🛤️', name: 'Road Building', cost: 70, req: ['carpentry'], desc: 'Caravans and highways bring 25% more gold.' },
  { id: 'glassmaking', era: 2, icon: '🪟', name: 'Glassmaking', cost: 140, req: ['kilns'], desc: 'Unlocks the Glassworks; +10% glass.', unlocks: ['glassworks'] },
  { id: 'spicetrade', era: 2, icon: '🌶️', name: 'Spice Trade', cost: 140, req: ['navigation'], desc: 'Unlocks the Spice House.', unlocks: ['spicehouse'] },
  { id: 'medicine', era: 2, icon: '⚕️', name: 'Medicine', cost: 140, req: ['herbal'], desc: 'Families settle 10% faster again.' },
  { id: 'deepmining', era: 2, icon: '⛏️', name: 'Deep Mining', cost: 140, req: ['masonry'], desc: '+15% iron and stone from mines and pits.' },
  { id: 'surveying', era: 2, icon: '📏', name: 'Surveying', cost: 140, req: ['roadbuilding'], desc: 'Every town’s border reaches 1 tile further.' },
  { id: 'scholarship', era: 3, icon: '🎓', name: 'Scholarship', cost: 260, req: ['guilds'], desc: 'Unlocks the Scriptorium; +20% knowledge.', unlocks: ['scriptorium'] },
  { id: 'shipbuilding', era: 3, icon: '⛵', name: 'Shipbuilding', cost: 260, req: ['navigation'], desc: '+20% from shipyards and harbours.' },
  { id: 'stonework', era: 3, icon: '🗿', name: 'Fine Stonework', cost: 260, req: ['deepmining'], desc: 'Wonders go up 20% faster.' },
  { id: 'theatre', era: 3, icon: '🎭', name: 'Theatre', cost: 260, req: ['medicine'], desc: 'Towns are a little happier.' },
  { id: 'diplomacy', era: 3, icon: '🤝', name: 'Diplomacy', cost: 260, req: ['spicetrade'], desc: 'Gifts make 25% more friends; contracts pay 20% more.' },
  { id: 'astronomy', era: 4, icon: '🔭', name: 'Astronomy', cost: 400, req: ['scholarship'], desc: '+25% knowledge.' },
  { id: 'grandmarkets', era: 4, icon: '🏪', name: 'Grand Markets', cost: 400, req: ['banking'], desc: '+15% gold from markets and shops.' },
  { id: 'greatbuilders', era: 4, icon: '🏗️', name: 'Great Builders', cost: 400, req: ['stonework', 'engineering'], desc: 'Wonders go up another 25% faster.' },
  { id: 'universities', era: 4, icon: '🏫', name: 'Universities', cost: 400, req: ['printing'], desc: 'Skills grow 30% faster.' },
  { id: 'drill', era: 1, icon: '🛡️', name: 'Drill', cost: 70, req: ['tools'], desc: 'Soldiers fight 20% better.' },
  { id: 'fortifications', era: 2, icon: '🏰', name: 'Fortifications', cost: 140, req: ['drill', 'masonry'], desc: 'Unlocks the Stone Fort; towers and forts defend 30% better.', unlocks: ['fort'] },
  { id: 'tactics', era: 3, icon: '⚔️', name: 'Tactics', cost: 260, req: ['fortifications'], desc: 'Your field army fights 25% better and marches faster.' },
  { id: 'harmony', era: 5, icon: '☀️', name: 'Golden Harmony', cost: 600, req: ['printing', 'banking', 'engineering'], desc: 'Every town is a little happier (+1 mood).' },
  { id: 'enlightenment', era: 5, icon: '✨', name: 'Enlightenment', cost: 800, req: ['astronomy', 'universities', 'grandmarkets'], desc: '+10% to everything your realm makes.' },
];
export const ERAS = ['Early days', 'Growing', 'Flourishing', 'Renowned', 'Golden', 'Legend'];
// The ruler's traits (set by the royal family module).
let rulerFx = () => null; export function setRulerFx(f) { rulerFx = f; }
export const rulerMult = (k) => { const fx = rulerFx(); return fx && fx[k] ? 1 + fx[k] : 1; };
export const rulerMood = () => { const fx = rulerFx(); return fx && fx.mood ? fx.mood : 0; };
export const hasTech = (id) => !!(S.research && S.research.done.includes(id));
export const canResearch = (r) => !hasTech(r.id) && r.req.every(hasTech);
export function pickResearch(id) { const r = RESEARCH.find((q) => q.id === id); if (!r || !canResearch(r)) return false; S.research.cur = id; emit('change'); return true; }
export function knowledgeRate() {
  let k = 0.5;
  for (const b of S.buildings.values()) if (b.p >= 1 && !b.idle) k += { school: 1.2, scriptorium: 1.8, library: 3, observatory: 2, monastery: 1, chapel: 0.3 }[b.t] || 0;
  for (const t of S.towns) if (t.spec === 'learning') k += 1;
  if (S.res.books > 0.5) k *= 1.2;
  k *= (hasTech('scholarship') ? 1.2 : 1) * (hasTech('astronomy') ? 1.25 : 1) * rulerMult('know');
  return k * (hasTalent('teach') ? 1.15 : 1);
}
function stepResearch(dd) {
  const R = (S.research ||= { cur: null, prog: 0, done: [], bank: 0 });
  let k = knowledgeRate() * dd * 0.6;
  if (!R.cur) { R.bank = Math.min(600, (R.bank || 0) + k); return; }
  if (R.bank > 0) { const take = Math.min(R.bank, k * 3); R.bank -= take; k += take; }
  R.prog += k;
  const r = RESEARCH.find((q) => q.id === R.cur);
  if (r && R.prog >= r.cost) { R.done.push(r.id); R.prog = 0; R.cur = null; recomputeTowns(); emit('researched', r); }
}
// ---------------- realm talents ----------------
// A point each time the realm grows a tier, and more as its prestige spreads.
export const TALENTS = [
  { branch: 'Steward', icon: '🌾', nodes: [['bounty', 'Bountiful Harvests', '+15% food.'], ['feast', 'Full Tables', 'Towns grow 20% faster while the stores hold plenty of food.'], ['granary', 'Great Granaries', 'Fields keep giving a little in winter (+25% winter harvest).']] },
  { branch: 'Builder', icon: '🔨', nodes: [['quick', 'Quick Hands', 'Build 20% faster.'], ['crews', 'Extra Crews', '+1 builder crew in every town.'], ['grand', 'Grand Designs', 'Wonders go up 40% faster.']] },
  { branch: 'Merchant', icon: '💰', nodes: [['coin', 'Sharp Ledgers', '+10% gold.'], ['friends', 'Warm Welcome', 'Gifts make 50% more friendship.'], ['roads', 'Busy Roads', 'Caravans earn twice as much.']] },
  { branch: 'Patron', icon: '🎓', nodes: [['teach', 'Patron of Learning', 'Skills and knowledge grow 15% faster.'], ['joy', 'Merry Realm', 'Every town is a little happier.'], ['fame', 'Far-famed', '+25% prestige.']] },
  { branch: 'Explorer', icon: '🧭', nodes: [['scout', 'Pathfinders', 'Explorers travel 30% faster.'], ['border', 'Wide Lands', 'Every border reaches 2 tiles further.'], ['settler', 'Eager Settlers', 'New settlements cost half as much.']] },
];
export const hasTalent = (id) => !!(S.talents && S.talents.includes(id));
export function talentPoints() { let base = 0; for (const b of S.buildings.values()) if (b.p >= 1 && DEFS[b.t] && DEFS[b.t].wonder) base++; return S.tier + Math.floor(Math.min(40000, rawPrestige()) / 2500) + base; }
export const talentsFree = () => talentPoints() - (S.talents || []).length;
export function takeTalent(id) {
  const br = TALENTS.find((b) => b.nodes.some((n) => n[0] === id)); if (!br || hasTalent(id) || talentsFree() <= 0) return false;
  const k = br.nodes.findIndex((n) => n[0] === id); if (k > 0 && !hasTalent(br.nodes[k - 1][0])) return false;
  (S.talents ||= []).push(id);
  FOUND_COST = hasTalent('settler') ? { food: 25, wood: 25, gold: 15 } : FOUND_COST_BASE;
  recomputeTowns(); emit('change'); return true;
}

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
  const horses = hasStables();
  const t = addTown(x, y, { pop: horses ? 6 : 3 });
  if (horses) { const h = S.buildings.get(idxOf(x, y)); if (h) h.p = 0.5; } // settlers ride in with supplies
  emit('toast', horses ? `Settlers rode in on horseback and founded ${t.name}!` : `Settlers have founded ${t.name}!`); emit('founded', t); emit('change');
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
  const caps = [20, 30, 40, 55, 70, 90];
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
// Seasonal prices around the capital: food and wood are dear in winter, food is cheap at harvest.
const PRICES = { food: [1, 0.9, 0.85, 1.25], wood: [1, 0.95, 1, 1.15], stone: [1, 1, 1, 1.05], gold: [1, 1, 1, 1], iron: [1, 1, 1, 1] };
export function priceSeason() { const c = S.towns.find((t) => t.capital) || S.towns[0]; return c ? seasonIndex(S.day, tileLat(c.y)) : 0; }
export function priceOf(r) { return (PRICES[r] || [1, 1, 1, 1])[priceSeason()]; }
export function priceNote() {
  return ['Spring: prices are steady.', 'Summer: food is plentiful and a little cheaper.', 'Autumn harvest: food is cheap.', 'Winter: food and firewood are dear, so they fetch more.'][priceSeason()];
}
export function tradeOffers(n) {
  const bonus = Math.floor(n.friend * 0.1) + (count('market') ? 5 : 0) + (hasWonder('lighthouse') ? 4 : 0) + (n.trait === 'generous' ? 3 : 0) + (hasStables() ? 3 : 0) + (hasTech('navigation') ? 2 : 0) + Math.min(6, 2 * S.towns.filter((t) => t.spec === 'trade').length);
  const pm = (r) => priceOf(r), sp = S.res.spices > 0.5 ? 1.08 : 1;
  const offers = [{ give: { [n.want]: 20 }, get: { [n.surplus]: Math.max(4, Math.round((14 + bonus) * pm(n.want) / pm(n.surplus) * sp)) } }];
  if (n.surplus !== 'gold') offers.push({ give: { gold: 15 }, get: { [n.surplus]: Math.max(4, Math.round((16 + bonus) / pm(n.surplus) * sp)) } });
  else offers.push({ give: { food: 25 }, get: { gold: Math.max(4, Math.round((10 + Math.floor(bonus / 2)) * pm('food') * sp)) } });
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
  n.friend = Math.min(100, n.friend + Math.round((res === n.want ? 18 : 10) * TRAITS[n.trait || 'cheerful'].gift * (hasStables() ? 1.15 : 1) * (hasTalent('friends') ? 1.5 : 1) * (hasTech('diplomacy') ? 1.25 : 1) * rulerMult('friend'))); S.stats.gifts++;
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
  return annexVillage(n, 'joined');
}
// A village becomes one of your towns (by invitation, or by conquest).
// Raiders capture an outlying town: it becomes a village of their kingdom (it can be won back).
export function loseTown(t, realmName, hue) {
  if (!t || t.capital) return null;
  for (const [i, b] of [...S.buildings]) if (b.town === t.id) S.buildings.delete(i);
  for (const i of [...S.zones.keys()]) if (groundDist2(i % W, Math.floor(i / W), t.x, t.y) <= t.radius * t.radius) S.zones.delete(i);
  S.towns = S.towns.filter((q) => q !== t);
  S.caravans = (S.caravans || []).filter(([a, b]) => a !== t.id && b !== t.id);
  const n = { id: 100000 + Math.floor(Math.random() * 899999), name: t.name, x: t.x, y: t.y, pop: Math.max(8, Math.round(t.pop * 0.5)), surplus: 'food', want: 'gold', friend: 0, joined: false, hue, captured: true };
  (S.capV ||= []).push(n); S.neighbors.push(n); n.realm = realmName;
  recomputeOccupied(); recomputeTowns(); indexNeighbors(); emit('change');
  return n;
}
export function annexVillage(n, how = 'joined') {
  n.joined = true; n.realm = null; indexNeighbors();
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
  if (how === 'joined') S.stats.joins++; else S.stats.conquests = (S.stats.conquests || 0) + 1;
  recomputeTowns();
  emit('toast', how === 'joined' ? `${n.name} has joined your kingdom!` : `⚔️ ${n.name} is now part of your realm!`); emit('joined', t); emit('change');
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
  Q('well', 'Dig a Well (Build → Everyday)', () => count('well') >= 1, { stone: 20 }),
  Q('village', 'Become a Village (25 villagers)', () => S.tier >= 1, { food: 60, wood: 40 }),
  Q('happy', 'Make a town Happy 😊', () => S.towns.some((t) => t.mood && t.mood.level >= 1), { gold: 40 }),
  Q('bread', 'Bake your first bread', () => count('bakery') >= 1 && S.res.bread > 0, { food: 60 }),
  Q('specialty', "Build your region's specialty", () => SPECIALTIES.some((k) => count(k) >= 1), { gold: 60 }),
  Q('yard', "Open a Builder's Yard for more builders", () => count('yard') >= 1, { wood: 30 }),
  Q('stable', 'Build Stables and bring horses to town', () => count('stable') >= 1, { food: 40, wood: 30 }),
  Q('spec', 'Choose a speciality for a town', () => S.towns.some((t) => t.spec), { gold: 40 }),
  Q('wedding', 'Celebrate a wedding in your realm', () => (S.stats.weddings || 0) >= 1, { food: 40, gold: 20 }),
  Q('tower', 'Raise a Watchtower', () => count('tower') >= 1, { stone: 30 }),
  Q('found', 'Found a second settlement', () => S.towns.length >= 2, { food: 50, wood: 50 }),
  Q('mine', 'Dig an Iron Mine', () => count('mine') >= 1, { gold: 40 }),
  Q('workshop3', 'Build 3 Workshops', () => count('workshop') >= 3, { iron: 20 }),
  Q('gift', 'Send a gift to a neighbour', () => S.stats.gifts >= 1, { gold: 20 }),
  Q('town', 'Become a Town (80 villagers)', () => S.tier >= 2, { stone: 80, gold: 60 }),
  Q('market', 'Open a Market', () => count('market') >= 1, { iron: 30 }),
  Q('tools', 'Forge tools at a Smithy', () => count('smithy') >= 1 && S.res.tools > 0, { iron: 30 }),
  Q('joyful', 'Make a town Joyful 😄', () => S.towns.some((t) => t.mood && t.mood.level >= 2), { gold: 120 }),
  Q('master', 'A villager becomes a master of their trade', () => (S.stats.masters || 0) >= 1, { gold: 100 }),
  Q('join', 'Welcome a neighbour into your kingdom', () => S.stats.joins >= 1, { gold: 100 }),
  Q('wonder1', 'Complete a Wonder', () => WONDERS.some(hasWonder), { gold: 150, iron: 50 }),
  Q('city', 'Become a City (200 villagers)', () => S.tier >= 3, { stone: 200, gold: 200 }),
  Q('newwonder', 'Complete a regional wonder', () => NEW_WONDERS.some(hasWonder), { gold: 300 }),
  Q('kingdom', 'Become a Kingdom (500 villagers)', () => S.tier >= 4, { gold: 500 }),
  Q('empire', 'Become an Empire (1,200 villagers) and begin a golden age', () => S.tier >= 5, { gold: 1500 }),
  Q('harbour', 'Build a Harbour on the coast', () => count('harbour') >= 1, { gold: 80 }),
  Q('charm1', 'Give a town its first civic improvement', () => S.towns.some((t) => charm(t) >= 1), { stone: 60 }),
  Q('route1', 'Open a sea route to another continent', () => routesDone() >= 1, { gold: 200, iron: 40 }),
  Q('cont3', 'Settle on three continents', () => realmContinents().length >= 3, { gold: 300 }),
  Q('charm5', 'Make one town as lovely as can be (all five improvements)', () => S.towns.some((t) => charm(t) >= 5), { gold: 250 }),
  Q('routes5', 'Open five sea routes', () => routesDone() >= 5, { gold: 500 }),
  Q('wonders', 'Complete all five Wonders', () => WONDERS.every(hasWonder), { gold: 1000 }),
  Q('cont6', 'Settle on six continents', () => realmContinents().length >= 6, { gold: 1000 }),
  Q('granary', 'Build a Granary to store the harvest', () => count('granary') >= 1, { wood: 30 }),
  Q('research1', 'Learn your first idea (Research)', () => !!(S.research && S.research.done.length >= 1), { gold: 30 }),
  Q('talent1', 'Take your first talent (Research → Talents)', () => (S.talents || []).length >= 1, { gold: 40 }),
  Q('flour', 'Grind flour at a Grist Mill', () => count('gristmill') >= 1 && S.res.flour > 0, { food: 80 }),
  Q('level2', 'A workplace improves to level 2', () => [...S.buildings.values()].some((b) => b.t !== 'house' && (b.lv || 1) >= 2), { gold: 60 }),
  Q('contract1', 'Fulfil a contract for a neighbour', () => (S.stats.contracts || 0) >= 1, { gold: 100 }),
  Q('fame1', 'A town becomes famous for what it makes', () => S.towns.some((t) => t.fame), { gold: 80 }),
  Q('research10', 'Learn ten ideas', () => !!(S.research && S.research.done.length >= 10), { gold: 200 }),
  Q('research25', 'Learn twenty-five ideas', () => !!(S.research && S.research.done.length >= 25), { gold: 500 }),
];
// Goals come in chapters, each with its own reward at the end.
export const CHAPTERS = [
  { id: 'c1', icon: '🌱', name: 'A Humble Start', goals: ['farm1', 'house1', 'lumber', 'pop15', 'quarry', 'well', 'granary'], reward: { gold: 40, wood: 40 } },
  { id: 'c2', icon: '🏘️', name: 'Village Life', goals: ['trade', 'village', 'happy', 'research1', 'yard', 'wedding', 'specialty'], reward: { gold: 80, food: 80 } },
  { id: 'c3', icon: '🌳', name: 'Growing Roots', goals: ['spec', 'bread', 'stable', 'tower', 'found', 'mine', 'gift', 'talent1'], reward: { gold: 120, stone: 80 } },
  { id: 'c4', icon: '🏪', name: 'A Market Town', goals: ['town', 'workshop3', 'market', 'tools', 'flour', 'level2', 'contract1', 'fame1'], reward: { gold: 200, iron: 40 } },
  { id: 'c5', icon: '⭐', name: 'Joy and Mastery', goals: ['joyful', 'master', 'join', 'harbour', 'charm1', 'research10'], reward: { gold: 300 } },
  { id: 'c6', icon: '🏛️', name: 'City of Wonders', goals: ['wonder1', 'city', 'newwonder', 'route1', 'cont3', 'research25'], reward: { gold: 500, iron: 80 } },
  { id: 'c7', icon: '👑', name: 'Kingdom and Beyond', goals: ['kingdom', 'charm5', 'routes5', 'wonders', 'cont6', 'empire'], reward: { gold: 1500 } },
];
export const currentChapter = () => CHAPTERS.find((c) => c.goals.some((g) => !S.questsDone.has(g))) || null;
export const activeQuests = () => { const c = currentChapter(); return c ? c.goals.filter((g) => !S.questsDone.has(g)).map((g) => QUESTS.find((q) => q.id === g)).filter(Boolean).slice(0, 3) : []; };

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
  const hasTools = S.res.tools > 1;
  const obs = hasWonder('observatory') ? 1.05 : 1, dome = hasWonder('dome') ? 1.1 : 1, bridge = hasWonder('bridge') ? 1.15 : 1;
  let changed = false;

  // Construction
  for (const t of S.towns) t._yards = yardsIn(t);
  for (const [i, b] of S.buildings) {
    if (b.p >= 1) continue;
    const t = townById(b.town);
    b.p += (dd / (DEFS[b.t].time * PACE.build)) * (t && t.pop >= 2 ? 1 : 0.5) * (hasTools ? 1.25 : 1) * (t ? 1 + 0.25 * Math.min(2, t._yards || 0) : 1) * (t && t.jobSkill && t.jobSkill.yard ? 1 + t.jobSkill.yard / 300 : 1) * techBuild(b.t); // skilled carpenters build faster
    if (b.p >= 1) {
      b.p = 1; changed = true;
      b.d = S.day; emit('built', { b, i, x: i % W, y: Math.floor(i / W) });
    }
  }
  if (changed) recomputeTowns();

  // Villagers build zoned tiles, one or a few at a time per town.
  if (S.zones.size) {
    const busy = new Map();
    for (const b of S.buildings.values()) if (b.p < 1 && b.z) busy.set(b.town, (busy.get(b.town) || 0) + 1);
    // every free builder crew in a town picks up the nearest zoned tile
    const cands = new Map();
    for (const [i, z] of S.zones) {
      const x = i % W, y = Math.floor(i / W), t = ownerOf(x, y);
      if (!t || (busy.get(t.id) || 0) >= crewsOf(t) || streetCheck(i)) continue;
      if (!cands.has(t.id)) cands.set(t.id, []);
      cands.get(t.id).push({ i, x, y, z, d: groundDist2(x, y, t.x, t.y), t });
    }
    for (const list of cands.values()) {
      const t = list[0].t;
      let free = crewsOf(t) - (busy.get(t.id) || 0);
      list.sort((a, b) => a.d - b.d);
      for (const c of list) {
        if (free <= 0) break;
        const type = ZONES[c.z].builds, def = DEFS[type];
        if (!affordable(def.cost)) continue;
        pay(def.cost); S.zones.delete(c.i);
        S.buildings.set(c.i, { t: type, p: 0, town: t.id, m: yieldMult(type, c.x, c.y), z: 1 });
        free--;
        emit('change');
      }
    }
  }

  // Production
  const pop = totalPop();
  let jobs = 0; for (const t of S.towns) jobs += t.jobs;
  const eff = jobs ? Math.min(1, pop / jobs) : 1;
  const before = { ...S.res };
  const mills = new Set(); let producers = 0, changedIdle = false;
  const yardTowns = new Set(); for (const b of S.buildings.values()) if (b.t === 'shipyard' && b.p >= 1 && !b.idle) yardTowns.add(b.town);
  for (const b of S.buildings.values()) if (b.t === 'windmill' && b.p >= 1 && !b.idle) mills.add(b.town);
  for (const t of S.towns) { t.served = false; t._p = {}; }
  const cp = caps();
  for (const [i, b] of S.buildings) {
    if (b.p < 1) continue;
    const d = DEFS[b.t];
    const t = townById(b.town);
    // Upkeep: pay a little each day, or idle until it can be paid (nothing ever breaks).
    const up = UPKEEP[b.t];
    if (up) {
      let ok = true;
      for (const [r, v] of Object.entries(up)) if (S.res[r] < v * dd) { ok = false; break; }
      if (ok) { for (const [r, v] of Object.entries(up)) S.res[r] -= v * dd; if (b.idle) { b.idle = false; changedIdle = true; } }
      else { if (!b.idle) { b.idle = true; changedIdle = true; } continue; }
    }
    // Workshops need their inputs; they slow down gracefully when stores run low.
    let f = 1, bonus = 1;
    const alt = CHAIN[b.t];
    if (alt && S.res[alt.res] > alt.use * dd) { S.res[alt.res] -= alt.use * dd * PACE.prod; bonus = alt.boost; } // the better ingredient
    else if (d.use) {
      for (const [r, v] of Object.entries(d.use)) { const need = v * dd * PACE.prod; f = Math.min(f, need > 0 ? Math.min(1, S.res[r] / need) : 1); }
      for (const [r, v] of Object.entries(d.use)) S.res[r] = Math.max(0, S.res[r] - v * dd * PACE.prod * f);
      if (b.t === 'tavern' && t && f > 0.5) t.served = true;
    }
    if (!d.prod || f <= 0) continue;
    producers++;
    // Fields rest in winter and give a harvest boost in late summer and autumn (stronger far from the equator).
    const seasonal = (b.t === 'farm' || b.t === 'riceterrace' || b.t === 'orchard' || b.t === 'vineyard') && !d.noSeason;
    const season = seasonal ? farmSeason(S.day, tileLat(Math.floor(i / W))) : 1;
    const skill = ((t && t.skillMult) || 1) * jobSkillMult(t, b.t);
    for (const [r, v] of Object.entries(d.prod)) {
      let amt = v * dd * PACE.prod * f * (b.t === 'townhall' ? 1 : eff) * (b.m || 1) * lib * season * skill * obs * (hasTools ? 1.08 : 1) * specMult(t, b.t);
      if (r === 'food') amt *= gardens * dome * (b.t === 'dock' ? lh * (yardTowns.has(b.town) ? 1.25 : 1) : 1) * (b.t === 'farm' && mills.has(b.town) ? 1.15 : 1);
      if (r === 'gold') amt *= gcGold * bridge;
      amt *= (S.golden ? 1.1 : 1) * techMult(b.t, r, i) * LEVEL_MULT[b.lv && b.t !== 'house' ? b.lv : 1] * fameMult(t, r) * bonus;
      const cap = cp[r];
      if (S.res[r] >= cap) { S.res.gold += amt * 0.1; amt = 0; } // a full store: the extra is sold for a little gold
      else if (S.res[r] + amt > cap) amt = cap - S.res[r];
      S.res[r] += amt; if (t) t._p[r] = (t._p[r] || 0) + amt;
    }
  }
  if (changedIdle) { recomputeTowns(); emit('change'); }
  // Tools wear out slowly; cloth is worn; bread is eaten in place of some food.
  if (S.res.tools > 0) S.res.tools = Math.max(0, S.res.tools - 0.003 * producers * dd);
  S.res.gold += pop * 0.02 * PACE.prod * dd * gcGold;
  S.caravans = (S.caravans || []).filter(([a, b]) => townById(a) && townById(b));
  S.res.gold += S.caravans.length * 0.3 * PACE.prod * dd * (hasTalent('roads') ? 2 : 1) * (hasTech('roadbuilding') ? 1.25 : 1);
  stepResearch(dd);
  stepContracts();
  if (Math.floor(S.day / 4) !== Math.floor((S.day - dd) / 4)) { levelUp(); updateFame(); }

  // Food and growth: nobody starves, growth just pauses.
  const breadEat = Math.min(S.res.bread * 0.5, pop * 0.0015 * dd); // a loaf now and then, so bread keeps in the stores
  S.res.bread -= breadEat;
  S.res.cloth = Math.max(0, S.res.cloth - pop * 0.0004 * dd);
  for (const [g, k] of [['pottery', 0.0003], ['spices', 0.0004], ['books', 0.0002], ['glass', 0.0002]]) S.res[g] = Math.max(0, S.res[g] - pop * k * dd);
  const eat = Math.max(0, pop * 0.1 * PACE.eat * dd - breadEat * 2);
  S.fed = S.res.food >= eat;
  S.res.food = Math.max(0, S.res.food - eat);
  updateMoods();
  for (const t of S.towns) {
    const mg = (1 + 0.2 * (t.mood ? t.mood.level : 0)) * (hasTech('herbal') ? 1.15 : 1) * (hasTech('medicine') ? 1.1 : 1) * (hasTalent('feast') && S.res.food > 150 ? 1.2 : 1); // happier towns attract families faster (mood never punishes)
    if (t.pop < t.cap && S.fed) t.pop = Math.min(t.cap, t.pop + Math.max(t.pop < 30 ? PACE.minGrowth : 0.02, (t.cap - t.pop) * 0.06 * PACE.growth) * mg * dd);
    else if (t.pop > t.cap) t.pop = Math.max(t.cap, t.pop - 0.5 * dd);
  }
  for (const r of ALL_RES) S.rates[r] = (S.rates[r] || 0) * 0.8 + ((S.res[r] - before[r]) / dd) * 0.2;
  for (const t of S.towns) { const pr = (t.prod ||= {}); for (const r of ALL_RES) { const v = ((t._p && t._p[r]) || 0) / dd; pr[r] = (pr[r] || 0) * 0.8 + v * 0.2; if (pr[r] < 0.005 && !v) delete pr[r]; } delete t._p; }
  if (S.tier >= 5 && !S.golden) { S.golden = true; emit('golden'); }
  emit('stepped', dd);
  neighbourLife(dd);
  // Market day every 8 days in towns with a market: neighbours bring wagons, a little gold and goodwill.
  const md = Math.floor(S.day / 8), mdNext = Math.floor((S.day + dd) / 8);
  if (mdNext > md) {
    for (const t of S.towns) {
      let hasMarket = false;
      for (const b of S.buildings.values()) if (b.t === 'market' && b.town === t.id && b.p >= 1) { hasMarket = true; break; }
      if (!hasMarket) continue;
      const visitors = S.neighbors.filter((n) => !n.joined && groundDist2(n.x, n.y, t.x, t.y) <= CONTACT_RANGE ** 2).slice(0, 3);
      S.res.gold += 5 + t.pop * 0.05;
      for (const n of visitors) n.friend = Math.min(100, n.friend + 1);
      t.marketUntil = S.day + dd + 1.5;
      t.marketFrom = visitors.map((n) => n.id);
      emit('marketday', { t, visitors });
    }
  }
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
  for (const c of CHAPTERS) if (!S.questsDone.has(c.id) && c.goals.every((g) => S.questsDone.has(g))) { S.questsDone.add(c.id); gain(c.reward); emit('chapter', c); }
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
  S.res = { food: 60, wood: 50, stone: 20, gold: 30, iron: 0, bread: 0, tools: 0, cloth: 0, ale: 0, pottery: 0, glass: 0, spices: 0, books: 0, flour: 0, wool: 0 };
  S.hints = []; S.golden = false; S.undo = []; S.research = { cur: null, prog: 0, done: [], bank: 0 }; S.talents = []; S.contracts = []; S.yearMark = null; S.lastReport = null; S.realms = null; S.army = null; S.raids = []; S.capV = []; FOUND_COST = FOUND_COST_BASE;
  S.expeditions = []; S.explored = []; S.journal = []; S.treasures = {}; S.festsHeld = {}; S.requests = []; S.nextReq = 0; S.royal = null; S.hist = []; S.miles = [];
  S.towns = []; S.buildings = new Map(); S.zones = new Map(); S.proads = new Set(); S.canals = new Set(); S.caravans = []; S.occupied = new Map(); S.nextTownId = 1;
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
    buildings: [...S.buildings].map(([i, b]) => [i, b.t, +b.p.toFixed(3), b.town, +(b.m || 1).toFixed(2), b.z ? 1 : 0, b.lv || 1, b.f || 0, Math.round(b.d || 0)]),
    zones: [...S.zones], proads: [...S.proads], canals: [...S.canals], caravans: S.caravans || [], nb: S.neighbors.filter((n) => n.friend || n.joined || n.req || (n.log && n.log.length) || n.pop > 70).map((n) => [n.id, n.friend, n.joined ? 1 : 0, +n.pop.toFixed(1), n.req || null, n.log || []]),
    quests: [...S.questsDone], stats: S.stats, routes: S.routes || [], hints: S.hints || [], golden: S.golden ? 1 : 0, research: S.research, talents: S.talents || [], contracts: S.contracts || [], yearMark: S.yearMark || null, realms: S.realms || null, army: S.army || null, raids: S.raids || [], capV: (S.capV || []).filter((n) => !n.joined), garrison: S.towns.map((t) => [t.id, Math.round((t.garrison || 0) * 10) / 10]),
    expeditions: S.expeditions || [], explored: S.explored || [], journal: S.journal || [], treasures: S.treasures || {}, festsHeld: S.festsHeld || {},
    requests: S.requests || [], nextReq: S.nextReq || 0, royal: S.royal || null, hist: S.hist || [], miles: S.miles || [], nextFolk: S.nextFolk || 1, cam: S.cam, nextTownId: S.nextTownId, tutorial: S.tutorial,
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
  S.speed = d.speed === 2 ? 2 : d.speed ? 1 : 0; // pause, play or double speed
  S.tier = d.tier; S.res = d.res;
  S.towns = d.towns; S.routes = d.routes || []; S.nextTownId = d.nextTownId; S.stats = d.stats; S.questsDone = new Set(d.quests);
  S.tutorial = d.tutorial ?? 99; // realms from before the tutorial existed skip it
  for (const g of GOODS) if (S.res[g] === undefined) S.res[g] = 0;
  S.hints = d.hints || []; S.golden = !!d.golden; S.undo = []; S.research = d.research || { cur: null, prog: 0, done: [], bank: 0 }; S.talents = d.talents || []; S.contracts = d.contracts || []; S.yearMark = d.yearMark || null; S.realms = d.realms || null; S.army = d.army || null; S.raids = d.raids || []; for (const [id, g] of d.garrison || []) { const t = S.towns.find((q) => q.id === id); if (t) t.garrison = g; } FOUND_COST = hasTalent('settler') ? { food: 25, wood: 25, gold: 15 } : FOUND_COST_BASE;
  S.expeditions = d.expeditions || []; S.explored = d.explored || []; S.journal = d.journal || []; S.treasures = d.treasures || {}; S.festsHeld = d.festsHeld || {};
  S.requests = d.requests || []; S.nextReq = d.nextReq || 0; S.royal = d.royal || null; S.hist = d.hist || []; S.miles = d.miles || []; if (d.nextFolk) S.nextFolk = d.nextFolk;
  S.buildings = new Map(d.buildings.map(([i, t, p, town, m, z, lv, f, bd]) => [i, { t, p, town, m, z, lv: lv || 1, f: f || 0, d: bd || 0 }])); recomputeOccupied();
  S.zones = new Map(d.zones); S.proads = new Set(d.proads || []); S.canals = new Set(d.canals || []); S.caravans = d.caravans || [];
  S.neighbors = generateNeighbors(); S.capV = d.capV || []; S.neighbors.push(...S.capV);
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
  if (riverAt(x, y)) return { ok: false, reason: 'A river runs here. Pick a spot on its bank.' };
  if (!BUILDABLE.has(b)) return { ok: false, reason: `${BIOMES[b].name} is too harsh for a first home.` };
  return { ok: true };
}
