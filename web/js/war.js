// Kingdoms that grow and conquer each other, raids on your towns, garrisons and your field army.
import { S, on, emit, townById, groundDist2, continentAt, hasTech, loseTown, annexVillage, TIERS, RES_NAMES } from './game.js';
import { W, tileWX, tileWY } from './world.js';
import { YEAR } from './seasons.js';
import { kingdoms, realmsChanged } from './kingdoms.js';
import * as L from './life.js';

const dist = (a, b) => Math.sqrt(groundDist2(a.x, a.y, b.x, b.y));
const nbById = (id) => S.neighbors.find((n) => n.id === id);
const realmById = (id) => (S.realms || []).find((r) => r.id === id);
const near = (a) => S.towns.some((t) => dist(a, t) < 200);
const capital = () => S.towns.find((t) => t.capital) || S.towns[0];

// ---------------- strength and defence ----------------
export const soldierPow = () => (1 + (hasTech('drill') ? 0.2 : 0)) * (S.res.tools > 1 ? 1.15 : 1);
export const armyPow = () => (S.army ? S.army.n : 0) * soldierPow() * (hasTech('tactics') ? 1.25 : 1);
function townBuildings(t, type) { let n = 0; for (const b of S.buildings.values()) if (b.town === t.id && b.t === type && b.p >= 1) n++; return n; }
export const garrisonCap = (t) => 10 * townBuildings(t, 'barracks') + 10 * townBuildings(t, 'fort');
export function defenceOf(t) {
  const fm = hasTech('fortifications') ? 1.3 : 1;
  let d = (t.garrison || 0) * soldierPow() + townBuildings(t, 'tower') * 4 * fm + townBuildings(t, 'fort') * 15 * fm + (t.capital ? 6 : 2);
  if (S.army && !S.army.march && S.army.at === t.id) d += armyPow();
  return Math.round(d);
}
export const soldiers = () => S.towns.reduce((s, t) => s + (t.garrison || 0), 0) + (S.army ? S.army.n : 0);

// ---------------- kingdoms grow and conquer ----------------
function stepRealms(dd) {
  const ks = kingdoms(); if (!ks.length) return;
  let changed = false;
  for (const k of ks) {
    const r = k.r, pop = k.members.reduce((s, n) => s + n.pop, 0);
    const target = 10 + k.members.length * 5 + pop * 0.08 + S.tier * 6 + (S.day / YEAR) * 1.5;
    r.str += (target - r.str) * Math.min(1, 0.02 * dd);
    // peacefully take in an independent village nearby
    if (Math.random() < 0.012 * dd) {
      let best = null, bd = 40 * 40;
      for (const n of S.neighbors) {
        if (n.joined || n.realm || n.friend >= 60 || S.towns.some((t) => groundDist2(n.x, n.y, t.x, t.y) < 15 * 15)) continue;
        for (const m of k.members) { const dd2 = groundDist2(n.x, n.y, m.x, m.y); if (dd2 < bd) { bd = dd2; best = n; } }
      }
      if (best) { r.members.push(best.id); changed = true; if (S.towns.some((t) => dist(best, t) < 60) && Math.random() < 0.5) emit('toast', `🏰 ${best.name} has been drawn into the ${r.name}.`); }
    }
  }
  // the strong swallow the weak
  if (Math.random() < 0.01 * dd && ks.length > 1) {
    const a = ks[Math.floor(Math.random() * ks.length)];
    let b = null, bd = 60 * 60;
    for (const o of ks) { if (o === a) continue; const dd2 = groundDist2(a.cap.x, a.cap.y, o.cap.x, o.cap.y); if (dd2 < bd) { bd = dd2; b = o; } }
    if (b && a.r.str > b.r.str * 1.25) {
      // take their village nearest to us; if it is their capital, the whole kingdom falls
      let pick = b.members[0], pd = Infinity;
      for (const m of b.members) { const dd2 = groundDist2(m.x, m.y, a.cap.x, a.cap.y); if (dd2 < pd) { pd = dd2; pick = m; } }
      if (pick.id === b.r.cap || b.members.length <= 2) {
        a.r.members.push(...b.r.members); a.r.str += b.r.str * 0.5; S.realms = S.realms.filter((q) => q !== b.r);
        if (near(b.cap)) emit('toast', `⚔️ The ${b.r.name} has fallen to the ${a.r.name}!`);
      } else {
        b.r.members = b.r.members.filter((id) => id !== pick.id); a.r.members.push(pick.id); a.r.str -= b.r.str * 0.1; b.r.str *= 0.8;
        if (near(pick)) emit('toast', `⚔️ The ${a.r.name} has taken ${pick.name} from the ${b.r.name}.`);
      }
      changed = true;
    }
  }
  if (changed) realmsChanged();
}

// ---------------- garrisons ----------------
function stepGarrisons(dd) {
  for (const t of S.towns) {
    const cap = garrisonCap(t), g = t.garrison || 0, rax = townBuildings(t, 'barracks');
    if (g < cap && rax) {
      const add = Math.min(cap - g, 0.5 * rax * dd, S.res.gold / 4, S.res.food / 3);
      if (add > 0) { t.garrison = g + add; S.res.gold -= add * 4; S.res.food -= add * 3; }
    }
  }
  // soldiers eat and are paid a little; if the granaries are empty, a few drift home
  const n = soldiers();
  if (n > 0) {
    S.res.food = Math.max(0, S.res.food - n * 0.05 * dd); S.res.gold = Math.max(0, S.res.gold - n * 0.03 * dd);
    if (S.res.food <= 0) for (const t of S.towns) t.garrison = (t.garrison || 0) * (1 - 0.01 * dd);
  }
}

// ---------------- raids ----------------
function stepRaids(dd) {
  S.raids ||= [];
  for (const raid of [...S.raids]) {
    const t = townById(raid.to);
    if (!t) { S.raids = S.raids.filter((q) => q !== raid); continue; }
    if (S.day >= raid.start + raid.days) { resolveRaid(raid, t); S.raids = S.raids.filter((q) => q !== raid); }
  }
  if (S.tier < 1 || S.raids.length) return;
  S.nextRaid ??= S.day + 24; // a quiet spell after becoming a Village
  if (S.day < S.nextRaid) return;
  // who is close enough, on the same continent, and not paid off?
  const opts = [];
  for (const k of kingdoms()) {
    if (k.r.tribute && k.r.tribute > S.day) continue;
    for (const t of S.towns) {
      const cont = continentAt(t.x, t.y);
      for (const m of k.members) { const d = dist(m, t); if (d < 110 && continentAt(m.x, m.y) === cont) opts.push({ k, t, m, d }); }
    }
  }
  if (!opts.length) { S.nextRaid = S.day + 12; return; }
  opts.sort((a, b) => a.d - b.d);
  const o = opts[Math.floor(Math.random() * Math.min(4, opts.length))];
  const str = Math.round(o.k.r.str * (0.15 + Math.random() * 0.15) * (1 + S.tier * 0.12) * (o.k.r.agg || 1));
  const days = Math.max(3, o.d / 6);
  const raid = { id: Date.now() % 1e9, realm: o.k.r.id, name: o.k.r.name, hue: o.k.r.hue, from: { x: o.m.x, y: o.m.y }, to: o.t.id, str, start: S.day, days };
  S.raids.push(raid);
  const def = defenceOf(o.t);
  emit('raid', raid);
  emit('toast', `⚔️ Raiders from the ${raid.name} are marching on ${o.t.name}! About ${Math.ceil(days)} days away. Their strength ${str}, your defence ${def}.`);
}
function resolveRaid(raid, t) {
  const def = defenceOf(t), r = realmById(raid.realm), pow = soldierPow();
  if (def >= raid.str) {
    const gold = Math.round(raid.str * 3);
    S.res.gold += gold; S.stats.raidsRepelled = (S.stats.raidsRepelled || 0) + 1;
    t.garrison = Math.max(0, (t.garrison || 0) - (raid.str * 0.15) / pow);
    if (r) r.str *= 0.85;
    (t.chron ||= []).unshift({ d: Math.floor(S.day), s: `Raiders from the ${raid.name} were driven off.` });
    emit('toast', `🛡️ ${t.name} drove off the raiders from the ${raid.name}! They left behind ${gold} gold.`);
  } else {
    const frac = Math.min(0.6, Math.max(0.2, 1 - def / raid.str)) * 0.5;
    const lost = [];
    for (const res of ['food', 'gold', 'wood', 'stone', 'iron', 'bread', 'cloth', 'ale', 'tools']) { const amt = Math.floor(Math.min((S.res[res] || 0) * frac, raid.str * (res === 'gold' ? 6 : 12))); if (amt > 0) { S.res[res] -= amt; if (lost.length < 3) lost.push(`${amt} ${RES_NAMES[res].toLowerCase()}`); } }
    t.garrison = (t.garrison || 0) * 0.4;
    if (S.army && !S.army.march && S.army.at === t.id) S.army.n = Math.floor(S.army.n * 0.6);
    S.stats.raidsLost = (S.stats.raidsLost || 0) + 1;
    if (r) r.str *= 0.92;
    if (raid.str > def * 2 && !t.capital && S.towns.length > 1 && Math.random() < 0.6) {
      const n = loseTown(t, raid.name, raid.hue);
      if (n && r) { r.members.push(n.id); realmsChanged(); }
      emit('toast', `🔥 ${t.name} has been captured by the ${raid.name}! Raise an army to win it back.`);
    } else {
      (t.chron ||= []).unshift({ d: Math.floor(S.day), s: `Raiders from the ${raid.name} carried off supplies.` });
      emit('toast', `🔥 Raiders broke through at ${t.name} and carried off ${lost.join(', ') || 'supplies'}. More soldiers, towers or a fort will help.`);
    }
  }
  S.nextRaid = S.day + 28 + Math.random() * 30 - S.tier * 2;
  emit('change');
}

// ---------------- your field army ----------------
export function muster(k) {
  let need = k;
  const ts = [...S.towns].sort((a, b) => (b.garrison || 0) - (a.garrison || 0));
  S.army ||= { n: 0, at: capital().id, march: null };
  if (S.army.march) return false;
  for (const t of ts) { const take = Math.min(need, Math.floor(t.garrison || 0)); t.garrison -= take; need -= take; S.army.n += take; if (!need) break; }
  emit('change'); return need < k;
}
export function disband() {
  if (!S.army || S.army.march) return false;
  const t = townById(S.army.at) || capital(); t.garrison = (t.garrison || 0) + S.army.n; S.army = null; emit('change'); return true;
}
const armyPos = () => { const a = S.army; if (!a) return null; if (a.march) { const f = Math.min(1, (S.day - a.march.start) / a.march.days); return { x: a.march.from.x + (a.march.to.x - a.march.from.x) * f, y: a.march.from.y + (a.march.to.y - a.march.from.y) * f }; } const t = townById(a.at) || capital(); return t ? { x: t.x, y: t.y } : null; };
function marchTo(kind, target, to) {
  const a = S.army; if (!a || a.march || a.n < 1) return false;
  const from = armyPos(), days = Math.max(1, dist(from, to) / (8 * (hasTech('tactics') ? 1.3 : 1)));
  a.march = { kind, target, from, to: { x: to.x, y: to.y }, start: S.day, days };
  emit('change'); return true;
}
export const marchDefend = (tid) => { const t = townById(tid); return t ? marchTo('defend', tid, t) : false; };
export const marchAttack = (nid) => { const n = nbById(nid); return n && attackable(n) ? marchTo('attack', nid, n) : false; };
export function villageDefence(n) { const r = realmById(n.realmId); return Math.round(n.pop * 0.6 + (r ? r.str * (n.id === r.cap ? 0.45 : 0.25) : 0)); }
export function attackable(n) { return !!(n && n.realm && !n.joined && S.towns.some((t) => dist(n, t) < 90 && continentAt(n.x, n.y) === continentAt(t.x, t.y))); }
export function targets() { const out = []; for (const k of kingdoms()) for (const n of k.members) if (attackable(n)) out.push(n); return out.sort((a, b) => villageDefence(a) - villageDefence(b)); }
function stepArmy() {
  const a = S.army; if (!a || !a.march) return;
  if (S.day < a.march.start + a.march.days) return;
  const m = a.march; a.march = null;
  if (m.kind === 'defend') { a.at = m.target; emit('toast', `🛡️ Your army has arrived at ${(townById(m.target) || {}).name || 'town'} and stands guard.`); emit('change'); return; }
  const n = nbById(m.target);
  if (!n || n.joined || !n.realm) { a.at = capital().id; emit('toast', 'Your army found nothing to fight and marched home.'); return; }
  const r = realmById(n.realmId), def = villageDefence(n), pow = armyPow();
  if (pow >= def) {
    const wasCap = r && r.cap === n.id;
    a.n = Math.max(1, Math.round(a.n * (1 - Math.min(0.4, (def / Math.max(1, pow)) * 0.4))));
    if (r) { r.members = r.members.filter((id) => id !== n.id); r.str *= 0.8; }
    annexVillage(n, 'conquered');
    const t = S.towns[S.towns.length - 1]; if (t) { a.at = t.id; t.garrison = 0; }
    if (wasCap && r) { S.realms = S.realms.filter((q) => q !== r); emit('toast', `👑 With its capital taken, the ${r.name} breaks apart!`); }
    realmsChanged(); S.stats.battlesWon = (S.stats.battlesWon || 0) + 1;
  } else {
    a.n = Math.floor(a.n * 0.5); a.at = capital().id;
    if (r) r.str *= 0.9;
    emit('toast', `⚔️ Your army could not take ${n.name} (defence ${def}) and fell back home with ${a.n} soldiers.`);
    if (a.n < 1) S.army = null;
  }
  emit('change');
}
export function tributeCost(r) { return Math.round(r.str * 4); }
export function payTribute(id) { const r = realmById(id); if (!r) return false; const c = tributeCost(r); if (S.res.gold < c) return false; S.res.gold -= c; r.tribute = S.day + YEAR; emit('toast', `🕊️ The ${r.name} accepts your tribute and will leave you be for a year.`); emit('change'); return true; }
export const realmList = () => kingdoms().map((k) => ({ ...k, near: S.towns.some((t) => k.members.some((m) => dist(m, t) < 110)) })).filter((k) => k.near).sort((a, b) => b.r.str - a.r.str);

on('stepped', (dd) => {
  if (!S.started) return;
  stepGarrisons(dd); stepRaids(dd); stepArmy(dd);
  if (Math.floor(S.day / 2) !== Math.floor((S.day - dd) / 2)) stepRealms(2);
});

// ---------------- on the map ----------------
function soldierGroup(ctx, x, y, s, n, col, banner, face, t) {
  for (let k = 0; k < n; k++) {
    const ox = ((k % 3) - 1) * 4.5 * s - face * Math.floor(k / 3) * 5 * s, oy = (Math.floor(k / 3) % 2) * 2 * s + ((k % 3) - 1) * 1.5 * s, bob = Math.abs(Math.sin(t * 8 + k)) * 0.8 * s;
    const px = x + ox, py = y + oy;
    ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(px, py, 2.2 * s, 1 * s, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(px - 1.5 * s, py - 6 * s - bob, 3 * s, 4.6 * s);
    ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(px, py - 7.4 * s - bob, 1.6 * s, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(px - 1 * s, py - 7.4 * s - bob, 2 * s, 1.2 * s);
    ctx.strokeStyle = '#6a5040'; ctx.lineWidth = Math.max(0.6, 0.6 * s); ctx.beginPath(); ctx.moveTo(px + face * 2 * s, py - 1 * s - bob); ctx.lineTo(px + face * 3 * s, py - 13 * s - bob); ctx.stroke();
  }
  const bx = x + face * 6 * s, by = y - 2 * s;
  ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 20 * s); ctx.stroke();
  ctx.fillStyle = banner; ctx.fillRect(bx, by - 19.5 * s, 6 * s, 5 * s);
}
export function drawWar(ctx, v) {
  const t = v.time;
  const draw = (wx, wy, n, col, banner, face, label) => {
    const X = v.sx(tileWX(Math.round(wx), Math.round(wy)) + (wx - Math.round(wx))), Y = v.sy(tileWY(Math.round(wy)) + (wy - Math.round(wy)) * 0.25);
    if (X < -60 || X > v.cw + 60 || Y < -60 || Y > v.ch + 60) return;
    if (v.tw >= 14) soldierGroup(ctx, X, Y, v.s * 1.5, Math.min(9, Math.max(4, Math.round(n / 4))), col, banner, face, t);
    else { ctx.fillStyle = banner; ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚔', X, Y + 0.5); }
    if (label) { ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.7)'; ctx.strokeText(label, X, Y - (v.tw >= 14 ? 26 * v.s : 12)); ctx.fillStyle = '#fff4dc'; ctx.fillText(label, X, Y - (v.tw >= 14 ? 26 * v.s : 12)); }
  };
  for (const r of S.raids || []) {
    const to = townById(r.to); if (!to) continue;
    const f = Math.min(1, (S.day - r.start) / r.days), x = r.from.x + (to.x - r.from.x) * f, y = r.from.y + (to.y - r.from.y) * f;
    draw(x, y, r.str, '#7a2a24', `hsl(${r.hue},60%,45%)`, to.x >= r.from.x ? 1 : -1, `Raiders · ${r.str}`);
  }
  const a = S.army;
  if (a && a.march) { const p = armyPos(); draw(p.x, p.y, a.n, '#3a5a8a', '#d9a440', a.march.to.x >= a.march.from.x ? 1 : -1, `Your army · ${a.n}`); }
}
export { armyPos };
