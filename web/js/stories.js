// Festivals, small requests from villagers, and the royal family.
import { W, H, B, world, idxOf, wrapX, tileLat } from './world.js';
import { S, on, emit, townById, affordable, ownerOf, canZone, count, setRulerFx, totalPop, TIERS } from './game.js';
import { YEAR, seasonIndex, SEASONS } from './seasons.js';
import { ageOf, fullName, personById } from './folk.js';

// ---------------- festivals ----------------
export const FESTIVALS = [
  { key: 'blossom', name: 'Blossom Day', icon: '🌸', desc: 'Petals, music and garlands in the spring sunshine.' },
  { key: 'midsummer', name: 'Midsummer Fair', icon: '☀️', desc: 'Games, dancing and long golden evenings.' },
  { key: 'harvest', name: 'Harvest Fair', icon: '🍎', desc: 'Pies, cider and the year’s finest crops.' },
  { key: 'lights', name: 'Midwinter Lights', icon: '🏮', desc: 'Lanterns on every street to brighten the long nights.' },
];
// Special celebrations any time of year (one per town each season, alongside the seasonal festival).
export const SPECIALS = [
  { key: 'fair', name: 'Travelling Fair', icon: '🎠', tier: 1, cost: { food: 50, gold: 60 }, desc: 'A carousel, swings, sweets and stalls on the green.' },
  { key: 'wedding', name: 'Grand Wedding', icon: '💒', tier: 1, cost: { food: 60, gold: 30 }, desc: 'A happy couple weds in the town square, and everyone is invited.' },
  { key: 'tournament', name: 'Grand Tournament', icon: '🏇', tier: 2, cost: { food: 80, gold: 80 }, desc: 'Knights joust in the lists while the crowd cheers. Neighbours come from far around.' },
];
export const ALL_FESTS = () => [...FESTIVALS, ...SPECIALS];
export function canSpecial(t, key) {
  const sp = SPECIALS.find((x) => x.key === key);
  if (!sp || S.tier < sp.tier) return { ok: false, reason: `Unlocks at a later tier.` };
  if (t.fest && S.day < t.fest.until) return { ok: false, reason: 'A celebration is on right now!' };
  if (t.specSeason === seasonKey(t)) return { ok: false, reason: 'One special celebration a season.' };
  if (key === 'wedding' && !weddingPair(t)) return { ok: false, reason: 'No couple is ready to wed just now.' };
  if (!affordable(sp.cost)) return { ok: false, reason: 'Not enough food or gold.' };
  return { ok: true };
}
function weddingPair(t) {
  const singles = (t.folk || []).filter((p) => !p.p && ageOf(p) >= 20 && ageOf(p) <= 46);
  return singles.length >= 2 ? [singles[0], singles[singles.length - 1]] : null;
}
export function holdSpecial(t, key) {
  if (!canSpecial(t, key).ok) return false;
  const sp = SPECIALS.find((x) => x.key === key);
  for (const [r, v] of Object.entries(sp.cost)) S.res[r] -= v;
  t.fest = { key, until: S.day + FESTIVAL_DAYS, ale: false }; t.specSeason = seasonKey(t); t.glow = S.day + FESTIVAL_DAYS + 12;
  const reach = key === 'tournament' ? 70 : 45;
  const guests = S.neighbors.filter((n) => !n.joined && (n.x - t.x) ** 2 + ((n.y - t.y) / 2) ** 2 < reach * reach);
  for (const n of guests) n.friend = Math.min(100, n.friend + (key === 'tournament' ? 8 : 5));
  (S.festsHeld ||= {})[key] = (S.festsHeld[key] || 0) + 1;
  t.marketUntil = S.day + FESTIVAL_DAYS; t.marketFrom = guests.slice(0, 3).map((n) => n.id);
  let extra = '';
  if (key === 'wedding') { const [a, b] = weddingPair(t); a.p = b.i; b.p = a.i; b.l = a.l; S.stats.weddings = (S.stats.weddings || 0) + 1; extra = ` ${a.f} and ${b.f} are married!`; (t.chron ||= []).unshift({ d: Math.floor(S.day), s: `A grand wedding: ${a.f} and ${b.f} ${a.l} were married before the whole town.` }); }
  emit('festival', { t, f: sp, guests });
  emit('toast', `${sp.icon} ${sp.name} in ${t.name}!${extra}`);
  emit('change');
  return true;
}
export const FESTIVAL_COST = { food: 60, gold: 40 };
export const FESTIVAL_DAYS = 3;
export const festivalNow = (t) => FESTIVALS[seasonIndex(S.day, tileLat(t.y))];
export const seasonKey = (t) => Math.floor(S.day / 12) + ':' + seasonIndex(S.day, tileLat(t.y));
export function canFestival(t) {
  if (S.tier < 1) return { ok: false, reason: 'Festivals begin when your realm is a Village.' };
  if (t.fest && S.day < t.fest.until) return { ok: false, reason: 'A festival is on right now!' };
  if (t.festSeason === seasonKey(t)) return { ok: false, reason: 'One festival a season. Next season brings another.' };
  if (!affordable(FESTIVAL_COST)) return { ok: false, reason: 'Needs 60 food and 40 gold.' };
  return { ok: true };
}
export function holdFestival(t) {
  if (!canFestival(t).ok) return false;
  for (const [r, v] of Object.entries(FESTIVAL_COST)) S.res[r] -= v;
  const f = festivalNow(t), ale = Math.min(10, S.res.ale);
  S.res.ale -= ale;
  t.fest = { key: f.key, until: S.day + FESTIVAL_DAYS, ale: ale > 0 };
  t.festSeason = seasonKey(t);
  t.glow = S.day + FESTIVAL_DAYS + 12; // fond memories for a season afterwards
  // neighbours come to celebrate
  const guests = S.neighbors.filter((n) => !n.joined && (n.x - t.x) ** 2 + ((n.y - t.y) / 2) ** 2 < 45 * 45);
  for (const n of guests) n.friend = Math.min(100, n.friend + 5);
  (S.festsHeld ||= {})[f.key] = (S.festsHeld[f.key] || 0) + 1;
  t.marketUntil = S.day + FESTIVAL_DAYS; t.marketFrom = guests.slice(0, 3).map((n) => n.id); // visitors stream in
  emit('festival', { t, f, guests });
  emit('toast', `${f.icon} ${f.name} in ${t.name}!${guests.length ? ` Guests came from ${guests.slice(0, 3).map((n) => n.name).join(', ')}.` : ''}`);
  emit('change');
  return true;
}
// Royal visits: now and then a friendly neighbour's leader tours one of your towns, bringing gifts.
let nextVisit = 0;
function maybeRoyalVisit(dd) {
  if (S.day < nextVisit || S.tier < 1) return;
  nextVisit = S.day + 18 + Math.random() * 20;
  const friends = S.neighbors.filter((n) => !n.joined && n.friend >= 45);
  if (!friends.length) return;
  const n = friends[Math.floor(Math.random() * friends.length)];
  let best = null, bd = Infinity; for (const t of S.towns) { const d = (n.x - t.x) ** 2 + ((n.y - t.y) / 2) ** 2; if (d < bd) { bd = d; best = t; } }
  if (!best || bd > 90 * 90) return;
  best.royalVisit = { from: n.id, until: S.day + 3, name: n.leader || 'Their elder', village: n.name };
  const gift = 30 + Math.round(n.friend / 2);
  S.res.gold += gift; n.friend = Math.min(100, n.friend + 6);
  best.cheer = Math.max(best.cheer || 0, S.day + 6);
  emit('toast', `👑 ${n.leader || 'The elder'} of ${n.name} is visiting ${best.name}, with a gift of ${gift} gold!`);
}
on('stepped', (dd) => { if (S.started) maybeRoyalVisit(dd); });
export const festiveMood = (t) => (t.fest && S.day < t.fest.until ? 2 + (t.fest.ale ? 1 : 0) : t.glow && S.day < t.glow ? 1 : 0);

// ---------------- small requests from villagers ----------------
const ANIMALS = [['goat', '🐐'], ['sheep', '🐑'], ['hen', '🐔']];
const WISHES = ['well', 'tavern', 'school', 'chapel', 'apiary', 'stable'];
const WISH_NAMES = { well: 'a well', tavern: 'a tavern', school: 'a school', chapel: 'a chapel', apiary: 'an apiary', stable: 'stables' };
const GIFTS = [['bread', 10], ['cloth', 8], ['ale', 8], ['tools', 6], ['food', 30]];
function newRequest() {
  const towns = S.towns.filter((t) => (t.folk || []).length > 8);
  if (!towns.length) return;
  const t = towns[Math.floor(Math.random() * towns.length)];
  const adults = t.folk.filter((p) => ageOf(p) >= 16);
  if (!adults.length) return;
  const p = adults[Math.floor(Math.random() * adults.length)];
  const r = Math.random();
  let q = null;
  if (r < 0.4) {
    // a lost animal somewhere nearby: tap it to bring it home
    for (let k = 0; k < 40 && !q; k++) {
      const x = wrapX(t.x + Math.round((Math.random() - 0.5) * (t.radius * 2 + 6))), y = t.y + Math.round((Math.random() - 0.5) * (t.radius * 4 + 12));
      if (y < 1 || y >= H - 1) continue;
      const b = world.biome[y * W + x];
      if (b > 2 && !S.buildings.has(y * W + x) && !S.occupied.has(y * W + x) && !(world.river && world.river[y * W + x])) {
        const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
        q = { kind: 'lost', animal: a[0], icon: a[1], x, y, text: `${p.f}'s ${a[0]} has wandered off! It was last seen near ${t.name}. Can you spot it on the map?` };
      }
    }
  } else if (r < 0.7) {
    const have = new Set(); for (const b of S.buildings.values()) if (b.town === t.id && b.p >= 1) have.add(b.t);
    const opts = WISHES.filter((w) => !have.has(w));
    if (opts.length) { const w = opts[Math.floor(Math.random() * opts.length)]; q = { kind: 'build', want: w, text: `${p.f} ${p.l} dreams of ${WISH_NAMES[w]} in ${t.name}.` }; }
  } else {
    const g = GIFTS.filter(([k]) => k === 'food' || S.res[k] > 0 || Math.random() < 0.3);
    const [res, amt] = g[Math.floor(Math.random() * g.length)];
    q = { kind: 'gift', res, amt, text: `The ${p.l} family could use ${amt} ${res} after a hard week.` };
  }
  if (!q) return;
  Object.assign(q, { id: (S.nextReq = (S.nextReq || 0) + 1), town: t.id, pid: p.i, who: fullName(p), until: S.day + 30 });
  (S.requests ||= []).push(q);
  emit('request2', q);
}
export function completeRequest(q, quiet) {
  const t = townById(q.town);
  S.requests = (S.requests || []).filter((r) => r !== q);
  S.res.gold += 30;
  if (t) { t.cheer = S.day + 12; (t.chron ||= []).unshift({ d: Math.floor(S.day), s: `${q.who} is grateful: ${q.kind === 'lost' ? `their ${q.animal} is home safe` : q.kind === 'build' ? 'the town has just what they hoped for' : 'the family is back on its feet'}.` }); }
  if (t) { const p = personById(t, q.pid); if (p) p.thanked = (p.thanked || 0) + 1; }
  S.stats.helpedFolk = (S.stats.helpedFolk || 0) + 1;
  if (!quiet) emit('toast', `💛 ${q.who} thanks you! (+30 gold, ${t ? t.name : 'the town'} is cheerful)`);
  emit('change');
}
export function giveFor(q) {
  if (q.kind !== 'gift' || S.res[q.res] < q.amt) return false;
  S.res[q.res] -= q.amt; completeRequest(q); return true;
}
export function tapLost(x, y) {
  const q = (S.requests || []).find((r) => r.kind === 'lost' && Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 2);
  if (!q) return false;
  completeRequest(q); return true;
}
function stepRequests(dd) {
  for (const q of (S.requests || []).slice()) {
    if (q.kind === 'build') { const t = townById(q.town); if (t && count(q.want) && [...S.buildings.values()].some((b) => b.t === q.want && b.town === t.id && b.p >= 1)) completeRequest(q); }
    if (S.day > q.until) { S.requests = S.requests.filter((r) => r !== q); if (q.kind === 'lost') emit('toast', `The lost ${q.animal} found its own way home.`); }
  }
  if ((S.requests || []).length < 3 && S.tier >= 1 && Math.random() < 0.015 * dd) newRequest();
}
export const cheerMood = (t) => (t.cheer && S.day < t.cheer ? 1 : 0);

// ---------------- the royal family ----------------
const ROYAL = {
  m: ['Edmund', 'Aldric', 'Leopold', 'Casimir', 'Rowan', 'Tobias', 'Alaric', 'Florian', 'Matthias', 'Osric', 'Julian', 'Anselm'],
  f: ['Eleanor', 'Isolde', 'Matilda', 'Rosalind', 'Beatrice', 'Adela', 'Cecily', 'Helena', 'Philippa', 'Agnes', 'Sabine', 'Clemence'],
};
const TITLES = [['Lord', 'Lady'], ['Baron', 'Baroness'], ['Count', 'Countess'], ['Duke', 'Duchess'], ['King', 'Queen'], ['Emperor', 'Empress']];
const HEIR_TITLES = [['young Lord', 'young Lady'], ['young Lord', 'young Lady'], ['Viscount', 'Viscountess'], ['Marquess', 'Marchioness'], ['Prince', 'Princess'], ['Crown Prince', 'Crown Princess']];
const pickName = (g) => ROYAL[g][Math.floor(Math.random() * ROYAL[g].length)];
let rid = 1;
// ---------------- ruler traits ----------------
// Each ruler is born with one gift and learns more as their reign goes on; you choose which.
export const RULER_TRAITS = {
  wise: { icon: '🦉', name: 'Wise', desc: '+15% knowledge.', fx: { know: 0.15 } },
  builder: { icon: '🔨', name: 'Master Builder', desc: 'Everything is built 15% faster.', fx: { build: 0.15 } },
  diplomat: { icon: '🕊️', name: 'Diplomat', desc: 'Gifts make 25% more friends.', fx: { friend: 0.25 } },
  shrewd: { icon: '💰', name: 'Shrewd', desc: '+10% gold.', fx: { gold: 0.1 } },
  green: { icon: '🌾', name: 'Green-fingered', desc: '+10% food.', fx: { food: 0.1 } },
  beloved: { icon: '❤️', name: 'Beloved', desc: 'Every town a little happier.', fx: { mood: 0.5 } },
  scholarly: { icon: '📖', name: 'Scholarly', desc: 'Villagers learn their trades 15% faster.', fx: { learn: 0.15 } },
  patron: { icon: '🎨', name: 'Patron of the Arts', desc: 'A little happier towns and a little more knowledge.', fx: { mood: 0.3, know: 0.05 } },
};
const TRAIT_KEYS = Object.keys(RULER_TRAITS);
export function rulerFxNow() {
  const r = ruler(); if (!r || !r.traits) return null;
  const fx = {}; for (const k of r.traits) for (const [a, v] of Object.entries(RULER_TRAITS[k].fx)) fx[a] = (fx[a] || 0) + v;
  return fx;
}
setRulerFx(rulerFxNow);
function stepTraits() {
  const r = ruler(); if (!r) return;
  r.traits ||= [TRAIT_KEYS[Math.floor(Math.random() * TRAIT_KEYS.length)]];
  r.crowned ??= S.day;
  const reignY = (S.day - r.crowned) / YEAR, slots = 1 + (reignY >= 4 ? 1 : 0) + (reignY >= 10 ? 1 : 0);
  if (r.traits.length < slots && !r.offers) {
    r.offers = TRAIT_KEYS.filter((k) => !r.traits.includes(k)).sort(() => Math.random() - 0.5).slice(0, 3);
    emit('toast', `👑 ${titleOf(r)} ${r.n} has grown into the crown. Choose a new trait in the Realm panel.`);
  }
}
export function chooseTrait(k) { const r = ruler(); if (!r || !r.offers || !r.offers.includes(k)) return false; r.traits.push(k); r.offers = null; emit('change'); return true; }
function royal(g, age, role) { return { traits: [TRAIT_KEYS[Math.floor(Math.random() * TRAIT_KEYS.length)]], i: rid++, n: pickName(g), g, b: S.day - age * YEAR - Math.random() * YEAR, role, hair: ['#3c2a20', '#8a5a2c', '#d8b060', '#a04a2c', '#2a2a2a'][Math.floor(Math.random() * 5)], skin: ['#f0c8a0', '#e0a878', '#c08858', '#8a5a3a'][Math.floor(Math.random() * 4)] }; }
export function ensureRoyals() {
  if (S.royal && S.royal.members) return;
  const g = Math.random() < 0.5 ? 'f' : 'm';
  S.royal = { members: [royal(g, 26 + Math.floor(Math.random() * 6), 'ruler')], reign: 1 };
}
export const ruler = () => S.royal && S.royal.members.find((m) => m.role === 'ruler');
export const titleOf = (m) => { const k = m.g === 'f' ? 1 : 0; return m.role === 'heir' ? HEIR_TITLES[S.tier][k] : m.role === 'ruler' ? TITLES[S.tier][k] : m.role === 'consort' ? (m.g === 'f' ? 'Consort' : 'Consort') : 'Dowager'; };
export const rAge = (m) => Math.max(0, Math.floor((S.day - m.b) / YEAR));
export const rulerLine = () => { const r = ruler(); return r ? `${titleOf(r)} ${r.n}${numberFor(r) > 1 ? ` ${roman(numberFor(r))}` : ''}` : ''; };
function numberFor(r) { return S.royal.names ? S.royal.names[r.n] || 1 : 1; }
const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
function rchron(text) {
  const cap = S.towns.find((t) => t.capital) || S.towns[0];
  if (cap) (cap.chron ||= []).unshift({ d: Math.floor(S.day), s: text });
  (S.royal.log ||= []).unshift({ d: Math.floor(S.day), s: text }); if (S.royal.log.length > 12) S.royal.log.length = 12;
  emit('toast', `👑 ${text}`);
}
function stepRoyals() {
  ensureRoyals();
  stepTraits();
  const ms = S.royal.members, r = ruler(); if (!r) return;
  const consort = ms.find((m) => m.role === 'consort');
  if (!consort && rAge(r) >= 22 && rAge(r) < 50 && Math.random() < 0.01) {
    const c = royal(r.g === 'f' ? (Math.random() < 0.85 ? 'm' : 'f') : (Math.random() < 0.85 ? 'f' : 'm'), Math.max(20, rAge(r) - 3 + Math.floor(Math.random() * 6)), 'consort');
    ms.push(c); rchron(`${titleOf(r)} ${r.n} married ${c.n}. The whole realm celebrated!`);
  }
  const heirs = ms.filter((m) => m.role === 'heir');
  if (consort && heirs.length < 3 && rAge(r) < 45 && Math.random() < 0.006) {
    const h = royal(Math.random() < 0.5 ? 'f' : 'm', 0, 'heir'); h.b = S.day; ms.push(h);
    rchron(`A royal baby! ${h.n} was born to ${r.n} and ${consort.n}.`);
  }
  // the eldest retired royals gently leave the family list, fondly remembered
  for (const m of ms) if (m.role === 'retired' && rAge(m) >= 84 && Math.random() < 0.02) { m.role = 'gone'; (S.royal.log ||= []).unshift({ d: Math.floor(S.day), s: `${m.n} is fondly remembered by all the realm.` }); }
  S.royal.members = ms.filter((m) => m.role !== 'gone');
  // a peaceful handing on of the crown
  if (rAge(r) >= 68 && Math.random() < 0.01) {
    const heir = heirs.filter((h) => rAge(h) >= 18).sort((a, b) => a.b - b.b)[0];
    if (heir) {
      r.role = 'retired'; if (consort) consort.role = 'retired';
      heir.role = 'ruler'; heir.crowned = S.day; heir.offers = null; heir.traits = (heir.traits || []).slice(0, 1); S.royal.reign++;
      S.royal.names ||= {}; S.royal.names[heir.n] = (S.royal.names[heir.n] || 0) + 1;
      for (const m of ms) if (m.role === 'retired' && rAge(m) > 72) m.role = 'gone';
      S.royal.members = ms.filter((m) => m.role !== 'gone');
      rchron(`${r.n} retired to a country estate, and ${heir.n} was crowned. Long may they reign!`);
      S.stats.coronations = (S.stats.coronations || 0) + 1;
    }
  }
}
// A simple painted portrait (original design) for the royal panel.
export function portrait(m, size = 54) {
  const crown = m.role === 'ruler' ? `<path d="M17 15l4 5 6-7 6 7 4-5v8H17z" fill="#e8b84a" stroke="#a87a1a" stroke-width="1"/>` : m.role === 'heir' ? `<path d="M21 17l3 3 3-4 3 4 3-3v5H21z" fill="#d8c070" stroke="#a87a1a" stroke-width="0.8"/>` : '';
  const hairLong = m.g === 'f' ? `<path d="M15 30c0-12 6-17 12-17s12 5 12 17v14H15z" fill="${m.hair}"/>` : `<path d="M16 27c0-9 5-13 11-13s11 4 11 13c-2-3-6-5-11-5s-9 2-11 5z" fill="${m.hair}"/>`;
  const robe = m.role === 'ruler' ? '#8a2a3a' : m.role === 'heir' ? '#3a5a8a' : '#5a6a4a';
  return `<svg viewBox="0 0 54 54" width="${size}" height="${size}" aria-hidden="true"><circle cx="27" cy="27" r="26" fill="#efe4cc" stroke="#c9a35a" stroke-width="2"/>
    ${hairLong}<path d="M12 54c0-10 7-15 15-15s15 5 15 15z" fill="${robe}"/><path d="M22 41h10l-5 6z" fill="#f4ead8"/>
    <circle cx="27" cy="29" r="9" fill="${m.skin}"/><circle cx="24" cy="29" r="1" fill="#2a1d14"/><circle cx="30" cy="29" r="1" fill="#2a1d14"/>
    <path d="M24.5 33q2.5 2 5 0" stroke="#7a3a2a" stroke-width="1" fill="none" stroke-linecap="round"/>${crown}</svg>`;
}

on('stepped', (dd) => {
  if (!S.started) return;
  stepRequests(dd);
  if ((S._royalT = (S._royalT || 0) + dd) >= 1) { S._royalT = 0; stepRoyals(); }
});

// ---------------- the year in review ----------------
// Each new year, a cosy card of what happened: births, weddings, building, the best-growing town.
on('built', () => { S.stats.builtTotal = (S.stats.builtTotal || 0) + 1; });
on('stepped', () => {
  if (!S.started) return;
  const y = Math.floor(S.day / YEAR);
  if (!S.yearMark || S.yearMark.day > S.day) { S.yearMark = snapshot(); return; }
  if (y > Math.floor(S.yearMark.day / YEAR)) {
    const a = S.yearMark, b = snapshot();
    const best = S.towns.map((t) => [t, t.pop - (a.towns[t.id] || 0)]).sort((p, q) => q[1] - p[1])[0];
    const report = { year: y, pop: [a.pop, b.pop], births: b.births - a.births, weddings: b.weddings - a.weddings, built: b.built - a.built,
      research: b.research - a.research, best: best && best[1] > 0 ? [best[0].name, Math.round(best[1])] : null, tier: TIERS[S.tier].name,
      gold: Math.round(b.gold - a.gold), mile: (S.miles || []).filter((m) => m.d >= a.day).slice(-3).map((m) => m.icon + ' ' + m.s) };
    S.yearMark = b; S.lastReport = report;
    emit('yearreport', report);
  }
});
function snapshot() {
  const towns = {}; for (const t of S.towns) towns[t.id] = t.pop;
  return { day: S.day, pop: Math.round(totalPop()), births: S.stats.births || 0, weddings: S.stats.weddings || 0, built: S.stats.builtTotal || 0, research: S.research ? S.research.done.length : 0, gold: S.res.gold, towns };
}
