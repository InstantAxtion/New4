// Villagers with lives: names, ages, families, jobs, skills and gentle life events.
// The population number stays the source of truth; this module keeps a named person for each villager.
import { S, DEFS, on, emit, townById, hasWonder, townStyleOf } from './game.js';
import { idxOf } from './world.js';
import { YEAR } from './seasons.js';

// Name pools by building style (common given names and family names, for flavour).
const NAMES = {
  temperate: { f: ['Alice', 'Ben', 'Clara', 'Daniel', 'Edith', 'Felix', 'Grace', 'Henry', 'Ivy', 'James', 'Lucy', 'Martin', 'Nora', 'Oliver', 'Rose', 'Thomas', 'Violet', 'Walter', 'Hugo', 'Elsie'],
    l: ['Miller', 'Thatcher', 'Baker', 'Cooper', 'Fletcher', 'Weaver', 'Mason', 'Turner', 'Fisher', 'Carter', 'Shepherd', 'Brook'] },
  nordic: { f: ['Astrid', 'Bjorn', 'Freya', 'Erik', 'Ingrid', 'Leif', 'Sigrid', 'Nils', 'Linnea', 'Anders', 'Elin', 'Oskar', 'Saga', 'Tove', 'Arne', 'Maja', 'Rune', 'Liv', 'Sven', 'Hedda'],
    l: ['Lund', 'Berg', 'Dahl', 'Strand', 'Holm', 'Fjeld', 'Lind', 'Moen', 'Sand', 'Vik', 'Ask', 'Eng'] },
  mediterranean: { f: ['Sofia', 'Marco', 'Elena', 'Luca', 'Chiara', 'Nikos', 'Lucia', 'Pablo', 'Irene', 'Mateo', 'Giulia', 'Andreas', 'Carmen', 'Dario', 'Marta', 'Teo', 'Anna', 'Paolo', 'Rosa', 'Iker'],
    l: ['Rossi', 'Costa', 'Marino', 'Ferrer', 'Romano', 'Vidal', 'Greco', 'Serra', 'Bianchi', 'Moreno', 'Conti', 'Ruiz'] },
  desert: { f: ['Amira', 'Omar', 'Layla', 'Karim', 'Yasmin', 'Tariq', 'Salma', 'Hassan', 'Nadia', 'Samir', 'Zahra', 'Idris', 'Hana', 'Malik', 'Dalia', 'Rami', 'Noor', 'Faris', 'Leila', 'Amin'],
    l: ['Haddad', 'Nasser', 'Saleh', 'Mansour', 'Khalil', 'Darwish', 'Aziz', 'Farah', 'Rahman', 'Hamdan', 'Sabri', 'Qasim'] },
  tropical: { f: ['Ana', 'Tiago', 'Luana', 'Kofi', 'Ama', 'Rafael', 'Maya', 'Joao', 'Ayo', 'Bianca', 'Kwame', 'Isabela', 'Dayo', 'Lia', 'Caio', 'Esi', 'Nia', 'Davi', 'Zola', 'Ines'],
    l: ['Silva', 'Santos', 'Mensah', 'Oliveira', 'Okafor', 'Costa', 'Asante', 'Lima', 'Adeyemi', 'Rocha', 'Boateng', 'Souza'] },
  eastasian: { f: ['Mei', 'Hiro', 'Yuna', 'Jun', 'Lan', 'Kenji', 'Ji-woo', 'Ming', 'Sora', 'Hana', 'Tao', 'Rin', 'Min-jun', 'Aiko', 'Wei', 'Yui', 'Kai', 'Xin', 'Haru', 'Seo-yeon'],
    l: ['Chen', 'Sato', 'Kim', 'Wang', 'Tanaka', 'Li', 'Park', 'Zhang', 'Suzuki', 'Liu', 'Choi', 'Mori'] },
};
export const JOBS = {
  farm: 'Farmer', lumber: 'Woodcutter', quarry: 'Stonecutter', mine: 'Miner', dock: 'Fisher', workshop: 'Craftsperson', market: 'Merchant',
  harbour: 'Sailor', tower: 'Lookout', bakery: 'Baker', brewery: 'Brewer', weaver: 'Weaver', smithy: 'Smith', tavern: 'Innkeeper',
  chapel: 'Chapel keeper', school: 'Teacher', apiary: 'Beekeeper', windmill: 'Miller', vineyard: 'Vintner', riceterrace: 'Rice grower',
  icehut: 'Ice fisher', stable: 'Stablehand', oasis: 'Gardener', cacao: 'Cacao grower', orchard: 'Orchard keeper',
};
const PET_NAMES = ['Biscuit', 'Pepper', 'Maple', 'Bramble', 'Clover', 'Juniper', 'Bean', 'Hazel', 'Sage', 'Tansy', 'Rusty', 'Willow',
  'Pudding', 'Socks', 'Mittens', 'Barley', 'Fennel', 'Nutmeg', 'Poppy', 'Toffee', 'Pebble', 'Acorn', 'Thistle', 'Sooty'];
const newPet = () => ({ k: Math.random() < 0.55 ? 'dog' : 'cat', n: PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)] });
// A family's pet lives with either partner.
export function petOf(t, p) {
  if (p.pet) return p.pet;
  const q = p.p ? personById(t, p.p) : null; if (q && q.pet) return q.pet;
  for (const id of p.par || []) { const r = personById(t, id); if (r && r.pet && ageOf(p) < 18) return r.pet; }
  return null;
}
export const ageOf = (p) => Math.max(0, Math.floor((S.day - p.b) / YEAR));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const nameSet = (t) => NAMES[townStyleOf(t)] || NAMES.temperate;
export const fullName = (p) => `${p.f} ${p.l}`;
export const personById = (t, id) => (t.folk || []).find((p) => p.i === id);

function newPerson(t, ageYears, last) {
  const ns = nameSet(t);
  S.nextFolk = (S.nextFolk || 1) + 1;
  return { i: S.nextFolk, f: pick(ns.f), l: last || pick(ns.l), b: S.day - ageYears * YEAR - Math.random() * YEAR, j: null, k: Math.round(Math.random() * 20), p: 0, par: [] };
}
function chron(t, text, notice = false) {
  (t.chron ||= []).unshift({ d: Math.floor(S.day), s: text });
  if (t.chron.length > 14) t.chron.length = 14;
  // Gentle notices, at most one every few in-game days.
  if (notice && S.day - (S._folkNote || -99) > 3) { S._folkNote = S.day; emit('folk', text); }
}

// A settled population for towns that have no named folk yet (old saves, joined villages).
function bootstrap(t, n) {
  const folk = t.folk;
  const adults = [];
  for (let k = 0; k < n; k++) {
    const r = Math.random();
    const age = r < 0.22 ? Math.floor(Math.random() * 16) : r < 0.86 ? 16 + Math.floor(Math.random() * 46) : 62 + Math.floor(Math.random() * 16);
    const p = newPerson(t, age); folk.push(p); if (age >= 18 && age < 62) adults.push(p);
  }
  // pair about half the adults, and give children to couples
  for (let k = 0; k + 1 < adults.length; k += 2) if (Math.random() < 0.55) { adults[k].p = adults[k + 1].i; adults[k + 1].p = adults[k].i; adults[k + 1].l = adults[k].l; if (Math.random() < 0.45) adults[k].pet = newPet(); }
  const couples = adults.filter((p) => p.p && p.i < p.p);
  for (const c of folk) if (ageOf(c) < 16 && couples.length) { const a = pick(couples); c.l = a.l; c.par = [a.i, a.p]; }
}

function addOne(t) {
  const folk = t.folk;
  const couples = folk.filter((p) => p.p && p.i < p.p && ageOf(p) >= 20 && ageOf(p) <= 44);
  const kids = folk.filter((p) => ageOf(p) < 16).length;
  // most growth is newcomers; babies arrive while the town has a natural share of children
  if (couples.length && kids < folk.length * 0.22 && Math.random() < 0.35) {
    const a = pick(couples), b = personById(t, a.p);
    const baby = newPerson(t, 0, a.l); baby.b = S.day; baby.par = [a.i, a.p];
    folk.push(baby);
    chron(t, `${a.f} and ${b ? b.f : 'their partner'} ${a.l} welcomed a baby, ${baby.f}.`, Math.random() < 0.35);
    S.stats.births = (S.stats.births || 0) + 1;
  } else {
    const p = newPerson(t, 18 + Math.random() * 24);
    if (Math.random() < 0.2) p.pet = newPet();
    folk.push(p);
    if (Math.random() < 0.15) chron(t, `${fullName(p)} arrived to make a new home in ${t.name}.`);
  }
}

function assignJobs(t, bmap) {
  const slots = new Map();
  for (const b of bmap) { const d = DEFS[b.t]; if (d.jobs && JOBS[b.t]) slots.set(b.t, (slots.get(b.t) || 0) + d.jobs); }
  const filled = new Map();
  const free = [];
  for (const p of t.folk) {
    const age = ageOf(p);
    if (age < 16 || age >= 65) { p.j = null; continue; }
    if (p.j && (slots.get(p.j) || 0) > (filled.get(p.j) || 0)) filled.set(p.j, (filled.get(p.j) || 0) + 1);
    else { p.j = null; free.push(p); }
  }
  for (const [type, n] of slots) {
    let have = filled.get(type) || 0;
    while (have < n && free.length) { const p = free.pop(); p.j = type; have++; }
  }
}

function lifeDay(t) {
  const folk = t.folk, school = !!t.hasSchool, obs = hasWonder('observatory');
  // learning, coming of age, retirement
  for (const p of folk) {
    const age = ageOf(p);
    if (p.j) {
      const before = p.k;
      p.k = Math.min(100, p.k + (2.5 / YEAR) * (school ? 1.5 : 1) * (obs ? 1.5 : 1) * (0.6 + Math.random() * 0.8));
      if (before < 80 && p.k >= 80) { chron(t, `${fullName(p)} has become a master ${JOBS[p.j].toLowerCase()}!`, true); S.stats.masters = (S.stats.masters || 0) + 1; }
    }
    if (p.lastAge !== age) {
      if (p.lastAge !== undefined) {
        if (age === 16) chron(t, `${fullName(p)} came of age and is ready to work.`);
        else if (age === 65) chron(t, `${fullName(p)} retired after a life's work${p.k >= 80 ? ' as a master' : ''}.`);
        else if (age % 10 === 0 && age >= 50 && Math.random() < 0.5) chron(t, `${fullName(p)} celebrated a ${age}th birthday.`);
      }
      p.lastAge = age;
    }
  }
  // the very old leave gently for a quiet cottage in the hills
  for (let k = folk.length - 1; k >= 0; k--) {
    const p = folk[k];
    if (ageOf(p) >= 78 && Math.random() < 0.02) {
      chron(t, `${fullName(p)} retired to a quiet cottage in the countryside.`);
      const q = p.p && personById(t, p.p); if (q) q.p = 0;
      folk.splice(k, 1);
    }
  }
  // weddings
  const singles = folk.filter((p) => !p.p && ageOf(p) >= 20 && ageOf(p) <= 46);
  if (singles.length >= 2 && Math.random() < Math.min(0.06, singles.length * 0.003)) {
    const a = singles.splice(Math.floor(Math.random() * singles.length), 1)[0], b = pick(singles);
    a.p = b.i; b.p = a.i; b.l = a.l;
    if (Math.random() < 0.35) a.pet = newPet();
    chron(t, `${a.f} and ${b.f} were married. The ${a.l} family grows!`, true);
  }
  // now and then a family takes in a puppy or a kitten
  const petless = folk.filter((p) => p.p && p.i < p.p && !petOf(t, p));
  if (petless.length && Math.random() < 0.15) {
    const a = pick(petless); a.pet = newPet();
    chron(t, `The ${a.l} family took in a ${a.pet.k === 'dog' ? 'puppy' : 'kitten'} named ${a.pet.n}.`);
    S.stats.weddings = (S.stats.weddings || 0) + 1;
  }
}

// A young couple (and their small children) moves to another of your settlements with room to spare.
function maybeMove() {
  if (S.towns.length < 2 || Math.random() > 0.02) return;
  const from = S.towns.filter((t) => t.folk && t.folk.length >= 30).sort(() => Math.random() - 0.5)[0];
  if (!from) return;
  const to = S.towns.filter((t) => t !== from && t.cap - t.pop >= 3).sort((a, b) => (b.cap - b.pop) - (a.cap - a.pop))[0];
  if (!to) return;
  const a = from.folk.find((p) => p.p && ageOf(p) >= 20 && ageOf(p) <= 36 && Math.random() < 0.3);
  if (!a) return;
  const b = personById(from, a.p); if (!b) return;
  const kids = from.folk.filter((c) => c.par && c.par.includes(a.i) && ageOf(c) < 12);
  const movers = [a, b, ...kids];
  from.folk = from.folk.filter((p) => !movers.includes(p));
  for (const p of movers) { p.j = null; (to.folk ||= []).push(p); }
  from.pop = Math.max(1, from.pop - movers.length); to.pop += movers.length;
  chron(from, `${a.f} and ${b.f} ${a.l} moved to ${to.name} to start a new life.`);
  chron(to, `The ${a.l} family arrived from ${from.name}.`, true);
}

let dayAcc = 0, jobAcc = 0;
on('marketday', ({ t, visitors }) => {
  chron(t, visitors.length ? `Market day! Traders came from ${visitors.map((n) => n.name).join(', ')}.` : 'Market day: stalls full of local goods.', false);
});
on('stepped', (dd) => {
  dayAcc += dd; jobAcc += dd;
  const newDay = dayAcc >= 1, jobs = jobAcc >= 2;
  if (newDay) dayAcc = 0;
  if (jobs) jobAcc = 0;
  const byTown = jobs ? new Map() : null;
  if (jobs) for (const b of S.buildings.values()) if (b.p >= 1) { if (!byTown.has(b.town)) byTown.set(b.town, []); byTown.get(b.town).push(b); }
  for (const t of S.towns) {
    t.folk ||= [];
    const target = Math.floor(t.pop);
    if (t.folk.length === 0 && target > 3) bootstrap(t, target);
    else {
      let guard = 0;
      while (t.folk.length < target && guard++ < 20) addOne(t);
      while (t.folk.length > target + 2) t.folk.splice(Math.floor(Math.random() * t.folk.length), 1);
    }
    if (jobs) {
      const bs = byTown.get(t.id) || [];
      t.hasSchool = bs.some((b) => b.t === 'school');
      assignJobs(t, bs);
      const workers = t.folk.filter((p) => p.j);
      t.skillMult = workers.length ? 1 + (workers.reduce((s, p) => s + p.k, 0) / workers.length / 100) * 0.15 : 1;
    }
    if (newDay) lifeDay(t);
  }
  if (newDay) maybeMove();
});

// A short, gentle line about someone's day.
export function thought(t, p) {
  const age = ageOf(p), job = p.j ? JOBS[p.j] : null;
  const mood = t.mood ? t.mood.level : 0;
  const lines = [];
  if (age < 6) lines.push('Toddles after the hens and laughs at everything.', 'Fast asleep after a busy morning.');
  else if (age < 16) lines.push(t.hasSchool ? 'Learning letters at the school.' : 'Wishes the town had a school.', 'Racing friends down to the fields.', 'Helping out at home today.');
  else if (age >= 65) lines.push('Telling stories of the old days to anyone who will listen.', 'Tending a little herb garden.', 'Enjoying a long, slow walk.');
  else if (job) lines.push(p.k >= 80 ? `Proud master ${job.toLowerCase()}, teaching apprentices.` : `Busy as a ${job.toLowerCase()}, getting better every season.`, `Thinking about supper after a day as a ${job.toLowerCase()}.`);
  else lines.push('Helping the builders around town.', 'Looking for work at one of the new buildings.');
  if (mood >= 2) lines.push(`Loves living in ${t.name}.`);
  if (S.res.bread > 1) lines.push('Smells fresh bread and is very content.');
  if (p.p) { const q = personById(t, p.p); if (q) lines.push(`Off to meet ${q.f} by the well.`); }
  const pet = petOf(t, p);
  if (pet) lines.push(pet.k === 'dog' ? `Taking ${pet.n} for a long walk.` : `${pet.n} the cat is asleep on the doorstep again.`);
  if (t.marketUntil && S.day < t.marketUntil) lines.push('Off to the market to see what the traders brought.');
  return lines[Math.floor((p.i * 7 + Math.floor(S.day / 3)) % lines.length)];
}
