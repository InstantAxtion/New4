// HUD, menus, sheets and interaction modes.
import { world, BIOMES, B, describeTile, idxOf, wrapX, tileWX, tileWY, tileLat, W } from './world.js';
import {
  S, M, RES, RES_NAMES, TIERS, DEFS, MANUAL, WONDERS, ZONES, FOUND_COST, GIFT_AMOUNT, CONTACT_RANGE,
  on, emit, totalPop, totalCap, townById, hasWonder, wonderStarted, count, ownerOf, canPlace, placeBuilding, setZone,
  demolish, canFound, foundTown, inContact, tradeOffers, doTrade, gift, canInvite, invite, activeQuests, QUESTS,
  CARAVAN_COST, maxCaravans, caravanPairs, startCaravan, stopCaravan, prestige, prestigeRank, priceNote, anchorOf, moveBuilding, turnBuilding, BIG, footprint, newGame, currentSlot as CUR, PACE, crewsOf, crewsBusy, zonesWaiting, yardsIn, UPKEEP, SPECS, SPEC_TIER, SPEC_CHANGE_COST, setSpec, GOODS, EVERYDAY, GOODS_BUILDINGS, SPECIALTIES, ALL_WONDERS, MOODS, moodOf, townStyleOf, TRAITS, IMPROVEMENTS, IMPROVE_TIER, charm, improve, continentAt, realmContinents, harbourTowns, routeOptions, openRoute, ROUTE_COST, ROUTE_DAYS, routesDone, maxTowns, fulfil, nbExtra, HOUSE_LEVELS, HOUSE_CAP_MULT, save, hasSave, load, resetSave, slotInfo, setSlot, deleteSlot, SLOT_COUNT, saveSettings, surveyStart, canStart, affordable, groundDist2, DAY_SECONDS,
} from './game.js';
import { SPR, spriteIcon } from './sprites.js';
import { panBy, cam, markDirty, flyTo, centerOn, clampCam, screenSize, TILE_MODE_TW, sx, sy, pickTile, setHover } from './render.js';
import { initAudio, sfx, haptic, applySettings, resumeAudio, VOLUMES, vol } from './audio.js';
import { tutorialActive, hint } from './tutorial.js';
import { ageOf, fullName, personById, JOBS, thought, petOf } from './folk.js';
import { walkerAt, clearTransient } from './render.js';
import { scatterBirds } from './alive.js';
import { stepTile, moonIcon } from './life.js';
import * as XP from './explore.js';
import * as ST from './stories.js';
import * as RC from './records.js';
import { STYLES } from './sprites.js';
import { townStyle } from './render.js';
import { seasonIndex, SEASONS, SEASON_ICONS, nightAt, farmSeason, setNightOff } from './seasons.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ICON = {
  food: '<svg viewBox="0 0 24 24"><path d="M12 22V8" stroke="#9a7a3a" stroke-width="1.8" fill="none"/><g fill="#e0b84a" stroke="#b08a2a" stroke-width=".8"><ellipse cx="9.5" cy="9" rx="2" ry="3.2" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3.2" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2" ry="3.2" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2" ry="3.2" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="5" rx="1.8" ry="3"/></g></svg>',
  wood: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="17" height="9" rx="3" fill="#a06a3e" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="3.5" ry="4.5" fill="#e3c08a" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="1.5" ry="2" fill="none" stroke="#b08050" stroke-width=".8"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M3 17 6 9l6-3 6 2 3 8-4 3H7Z" fill="#a8a29a" stroke="#6e6860" stroke-width="1"/><path d="M6 9l5 3 7-4M11 12l-1 7" stroke="#857e76" stroke-width=".9" fill="none"/></svg>',
  gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8b84a" stroke="#a87a1a" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#c8962a" stroke-width="1"/><path d="M12 8v8M10 10h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3" stroke="#a87a1a" stroke-width="1.1" fill="none"/></svg>',
  iron: '<svg viewBox="0 0 24 24"><path d="M3 16 6 9h12l3 7Z" fill="#8a96a6" stroke="#4e5a6a" stroke-width="1"/><path d="M6 9h12l-2 3H8Z" fill="#b4c0ce"/></svg>',
  bread: '<svg viewBox="0 0 24 24"><path d="M3 14c0-4 4-7 9-7s9 3 9 7v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="#d8a05a" stroke="#9a6a30" stroke-width="1"/><path d="M8 9.5l1.5 3M12 8.5v3.5M16 9.5l-1.5 3" stroke="#f2d6a0" stroke-width="1.3" stroke-linecap="round"/></svg>',
  tools: '<svg viewBox="0 0 24 24"><path d="M5 19 14 10" stroke="#8a5a3c" stroke-width="2.6" stroke-linecap="round"/><path d="M11 6l5-2 4 4-2 5-3-1Z" fill="#8a96a6" stroke="#4e5a6a" stroke-width="1"/></svg>',
  cloth: '<svg viewBox="0 0 24 24"><path d="M4 7h14l2 3-2 3H4Z" fill="#c0503e" stroke="#7a2a20" stroke-width="1"/><path d="M4 13h14l2 3-2 3H4Z" fill="#4a78a8" stroke="#2a4a70" stroke-width="1"/><path d="M7 7v6M11 7v6M15 7v6" stroke="#e8a080" stroke-width="0.8"/></svg>',
  ale: '<svg viewBox="0 0 24 24"><rect x="5" y="7" width="11" height="13" rx="2" fill="#d8a040" stroke="#8a5a20" stroke-width="1"/><path d="M5 9c0-3 11-3 11 0Z" fill="#fbf4e4"/><path d="M16 10h2.5a2 2 0 0 1 0 6H16" fill="none" stroke="#8a5a20" stroke-width="1.6"/></svg>',
  pottery: '<svg viewBox="0 0 24 24"><path d="M8 5h8l-1 3c3 1 4 4 4 7 0 3-3 5-7 5s-7-2-7-5c0-3 1-6 4-7Z" fill="#c87a50" stroke="#8a4a2a" stroke-width="1"/><path d="M6 14h12" stroke="#f0c8a0" stroke-width="1.2"/></svg>',
  glass: '<svg viewBox="0 0 24 24"><path d="M7 3h10l-1 17H8Z" fill="#a8dcef" fill-opacity=".8" stroke="#4a8aa8" stroke-width="1"/><path d="M9 6l1 11" stroke="#fff" stroke-width="1.2" opacity=".8"/></svg>',
  spices: '<svg viewBox="0 0 24 24"><path d="M4 14c0 4 4 6 8 6s8-2 8-6Z" fill="#8a5a3c" stroke="#5a3a20" stroke-width="1"/><path d="M5 14c1-4 4-6 7-6s6 2 7 6Z" fill="#d8742a"/><circle cx="10" cy="11" r="1" fill="#f0b030"/><circle cx="14" cy="10.5" r="1" fill="#a83a1a"/></svg>',
  books: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="5" height="15" fill="#a03030" stroke="#601818"/><rect x="9.5" y="7" width="5" height="13" fill="#305a90" stroke="#183060"/><rect x="15" y="4" width="5" height="16" fill="#3a7a3a" stroke="#1a4a1a" transform="rotate(8 17 12)"/></svg>',
  pop: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" fill="#e0b088"/><path d="M3 19c0-4 2-6 5-6s5 2 5 6Z" fill="#4a78a8"/><circle cx="16" cy="9" r="2.6" fill="#e0b088"/><path d="M12 19c.5-3.5 2-5 4-5s4 1.5 4.5 5Z" fill="#c0503e"/></svg>',
};
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString());
const costChips = (cost, check = true) => Object.entries(cost || {}).map(([k, v]) =>
  `<span class="chip ${check && S.res[k] < v ? 'short' : ''}">${ICON[k]}${v}</span>`).join('');
const iconCache = {};
function bIcon(type) {
  if (!iconCache[type]) {
    const spr = type === 'castle' ? SPR.build.castle[2] : (SPR.build[type] || SPR.build.scaffold)[0];
    iconCache[type] = spriteIcon(spr, 40);
  }
  return iconCache[type];
}

// Fly so the target sits in the upper part of the screen, above an open sheet.
function flyAbove(x, y, tw) {
  const { ch, cw } = screenSize();
  const sideSheet = cw > ch && ch <= 520;
  const rows = sideSheet ? 0 : Math.round((ch * 0.22) / tw / 0.25);
  flyTo(x, Math.min(3999, y + rows), tw);
}

// ---------------- toasts ----------------
export function toast(msg, big = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (big ? ' big' : ''); t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}

// ---------------- sheet ----------------
let sheetRender = null, sheetKind = null;
export function openSheet(kind, render) {
  sheetKind = kind; sheetRender = render;
  $('#sheet').classList.remove('hidden');
  document.body.classList.add('sheet-open');
  refreshSheet(true);
  highlightBottom();
}
export function closeSheet() {
  sheetKind = null; sheetRender = null;
  $('#sheet').classList.add('hidden');
  document.body.classList.remove('sheet-open');
  if (M.selected && (!M.mode)) { M.selected = null; markDirty(); }
  highlightBottom();
}
// Panels refresh as the realm changes, but never while a finger or pen is touching them
// and only when the content really changed, so taps are never swallowed by a redraw.
let touchingUI = false, sheetHTML = '';
function refreshSheet(reset) {
  if (!sheetRender) return;
  if (touchingUI && !reset) return;
  const ae = document.activeElement; if (!reset && ae && ae.tagName === 'INPUT' && ae.closest('#sheet') && ae.type === 'text') return; // never redraw under someone typing
  const body = $('#sheetbody'), top = body.scrollTop;
  const html = sheetRender();
  if (html === null) { closeSheet(); return; }
  if (!reset && html === sheetHTML) return;
  sheetHTML = html;
  body.innerHTML = html;
  body.scrollTop = reset ? 0 : top;
}
function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
const head = (title, sub) => `<div class="sh-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="close" data-act="close" aria-label="Close">✕</button></div>`;

// ---------------- modes ----------------
export function setMode(mode, background = false) {
  M.mode = mode;
  const bar = $('#modebar');
  document.body.classList.toggle('moding', !!mode && mode.kind !== 'start');
  if (!mode || mode.kind === 'start') { bar.classList.add('hidden'); markDirty(); highlightBottom(); return; }
  let html = '';
  if (mode.kind === 'build' || mode.kind === 'move') {
    const d = DEFS[mode.type];
    html = `<div class="mlabel"><img src="${bIcon(mode.type)}" alt="" style="${mode.flip ? 'transform:scaleX(-1)' : ''}"><span>${mode.kind === 'move' ? 'Move ' : ''}${d.name}</span></div>${mode.kind === 'build' ? `<div class="cost">${costChips(d.cost)}</div>` : ''}`
      + (mode.kind === 'build' ? `<button class="tool" data-act="flip"><span class="ic">⟲</span>Turn</button>` : '');
  } else if (mode.kind === 'zone') {
    html = Object.entries(ZONES).map(([k, z]) =>
      `<button class="tool ${mode.zone === k ? 'on' : ''} ${DEFS[z.builds].tier > S.tier ? 'disabled' : ''}" data-act="zone" data-arg="${k}"><span class="sw" style="background:${z.color}"></span>${z.name}</button>`).join('')
      + `<button class="tool ${mode.zone === 'road' ? 'on' : ''}" data-act="zone" data-arg="road"><span class="sw road"></span>Road</button>`
      + `<button class="tool ${mode.zone === 'canal' ? 'on' : ''}" data-act="zone" data-arg="canal"><span class="sw canal"></span>Canal</button>`
      + `<button class="tool ${mode.zone === 'erase' ? 'on' : ''}" data-act="zone" data-arg="erase"><span class="sw erase"></span>Erase</button>`
      + `<button class="tool ${S.undo && S.undo.length ? '' : 'disabled'}" data-act="undo"><span class="ic">↶</span>Undo</button>`;
    if (!S.settings.zoneHint && !tutorialActive()) { S.settings.zoneHint = true; saveSettings(); toast('Paint with your finger or S Pen. Two fingers move the map (with the S Pen, one finger does).'); }
  } else if (mode.kind === 'found') {
    html = `<div class="mlabel"><span>Pick land for settlers</span></div><div class="cost">${costChips(FOUND_COST)}</div>`;
  }
  html += `<button class="tool done" data-act="cancelmode"><span class="ic">✓</span>Done</button>`;
  bar.classList.toggle('zones', mode.kind === 'zone');
  if (!(background && touchingUI)) setHTML(bar, html); // a background refresh never redraws under a finger
  bar.classList.remove('hidden');
  markDirty(); highlightBottom();
}

// ---------------- HUD ----------------
function buildHUD() {
  $('#resbar').innerHTML = RES.map((r) => `<div class="res" id="res-${r}" title="${RES_NAMES[r]}">${ICON[r]}<div class="rv"><span class="v">0</span><small class="flat">+0</small></div></div>`).join('')
    + `<div class="res" id="res-pop" title="Villagers">${ICON.pop}<div class="rv"><span class="v">0</span><small class="flat">/0</small></div></div>`;
  $('#goodsbar').innerHTML = GOODS.map((r) => `<div class="res" id="res-${r}" title="${RES_NAMES[r]}">${ICON[r]}<div class="rv"><span class="v">0</span><small class="flat">+0</small></div></div>`).join('');
  $('#speed').innerHTML = [[0, '❚❚', 'Pause'], [1, '▶', 'Play']].map(([v, l, a]) => `<button data-speed="${v}" aria-label="${a}">${l}</button>`).join('');
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.speed = +b.dataset.speed; sfx('tap'); updateHUD();
  });
  $('#bottombar').innerHTML = [
    ['build', '🔨', 'Build'], ['zones', '🌾', 'Zones'], ['realm', '🏰', 'Realm'], ['menu', '☰', 'Menu'],
  ].map(([k, ic, l]) => `<button data-tab="${k}"><span class="ic">${ic}</span>${l}</button>`).join('');
  $('#bottombar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx('tap');
    const tab = b.dataset.tab;
    if (sheetKind === tab) { closeSheet(); return; }
    if (tab === 'zones') { closeSheet(); setMode(M.mode && M.mode.kind === 'zone' ? null : { kind: 'zone', zone: 'housing' }); return; }
    setMode(null);
    ({ build: showBuild, realm: showRealm, menu: showMenu })[tab]();
  });
  $('#zoomctl').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx('tap');
    if (b.dataset.z === 'home') { const c = S.towns.find((t) => t.capital) || S.towns[0]; if (c) flyTo(c.x, c.y, 56); return; }
    const k = b.dataset.z === 'in' ? 1.6 : 1 / 1.6;
    flyTo(null, null, cam.tw * k, 0.35, true);
  });
  $('#quests').addEventListener('click', (e) => {
    if (!e.target.closest('.qbtn')) return;
    const open = $('#quests').classList.toggle('open');
    if (open) { seenGoals = S.questsDone.size; renderQuests(true); }
  });
}
function highlightBottom() {
  document.querySelectorAll('#bottombar button').forEach((b) => {
    const t = b.dataset.tab;
    b.classList.toggle('on', sheetKind === t || (t === 'zones' && M.mode && M.mode.kind === 'zone'));
  });
}
const lastRes = {};
const LATE_GOODS = { pottery: 'potter', glass: 'glassworks', spices: 'spicehouse', books: 'scriptorium' };
export function updateHUD() {
  if (!S.started) return;
  $('#realmname').textContent = S.name;
  $('#tierbadge').textContent = TIERS[S.tier].name;
  $('#goodsbar').classList.toggle('hidden', !(S.tier >= 1 || GOODS.some((g) => S.res[g] > 0)));
  for (const r of [...RES, ...GOODS]) {
    const el = $('#res-' + r); if (!el) continue;
    if (LATE_GOODS[r]) el.classList.toggle('hidden', !(S.res[r] > 0 || count(LATE_GOODS[r]) > 0));
    const v = Math.floor(S.res[r]);
    el.querySelector('.v').textContent = fmt(v);
    const rate = S.rates[r] || 0;
    const sm = el.querySelector('small');
    sm.textContent = (rate >= 0 ? '+' : '') + rate.toFixed(1);
    sm.className = rate > 0.05 ? 'up' : rate < -0.05 ? 'down' : 'flat';
    if (lastRes[r] !== undefined && v - lastRes[r] >= 10) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    lastRes[r] = v;
  }
  const pe = $('#res-pop');
  pe.querySelector('.v').textContent = Math.floor(totalPop());
  const ps = pe.querySelector('small'); ps.textContent = '/' + totalCap(); ps.className = S.fed ? 'flat' : 'down';
  // Seasons follow the capital's hemisphere (Australia has summer while Europe has winter).
  const capT = S.towns.find((t) => t.capital) || S.towns[0];
  const si = seasonIndex(S.day, capT ? tileLat(capT.y) : 45);
  const y = Math.floor(S.day / 48) + 1, night = nightAt(S.day).n > 0.5;
  $('#date').textContent = `${night ? moonIcon() : SEASON_ICONS[si]} Year ${y} · ${SEASONS[si]} ${Math.floor(S.day % 12) + 1}`;
  $('#date2').textContent = $('#date').textContent;
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed));
  renderQuests();
}
let questSig = '', seenGoals = -1;
function renderQuests(force) {
  const qs = activeQuests();
  const done = S.questsDone.size;
  if (seenGoals < 0) seenGoals = done;
  const fresh = done - seenGoals;
  const sig = qs.map((q) => q.id).join(',') + '|' + fresh;
  if (sig === questSig && !force) return;
  questSig = sig;
  const open = $('#quests').classList.contains('open');
  $('#quests').innerHTML = `<button class="qbtn" aria-label="Goals">📜<span class="qbadge ${fresh > 0 && !open ? 'on' : ''}">${fresh > 0 ? fresh : ''}</span></button>
    <div class="qpanel"><h3>Gentle goals <span>${done}/${QUESTS.length}</span></h3><ul>${qs.map((q) =>
    `<li><div>${esc(q.text)}<span class="reward">Reward: ${Object.entries(q.reward).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ')}</span></div></li>`).join('') || '<li>Every goal complete. Your realm is a wonder.</li>'}</ul></div>`;
}

// ---------------- build menu ----------------
let buildTab = 'buildings';
function showBuild() {
  openSheet('build', () => {
    const styles = new Set(S.towns.map(townStyleOf));
    const list = buildTab === 'buildings' ? [...MANUAL, ...GOODS_BUILDINGS, ...SPECIALTIES.filter((k) => styles.has(DEFS[k].style))]
      : buildTab === 'everyday' ? EVERYDAY : ALL_WONDERS;
    const cards = list.map((t) => {
      const d = DEFS[t], locked = d.tier > S.tier, built = d.wonder && wonderStarted(t);
      return `<button class="card ${locked || built ? 'locked' : ''}" data-act="pick" data-arg="${t}">
        ${d.style ? '<span class="spec">Specialty</span>' : ''}
        ${locked ? `<span class="lock">${TIERS[d.tier].name}</span>` : built ? '<span class="lock">Built</span>' : ''}
        <img src="${bIcon(t)}" alt=""><b>${d.name}</b><div class="cost">${costChips(d.cost)}</div>
        <p>${d.desc || ''}${d.use ? ` Uses ${Object.entries(d.use).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.prod ? ` Makes ${Object.entries(d.prod).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.mood ? ` Mood +${d.mood}.` : ''}${UPKEEP[t] ? ` Upkeep ${Object.entries(UPKEEP[t]).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.jobs ? ` Needs ${d.jobs} worker${d.jobs > 1 ? 's' : ''}.` : ''}</p></button>`;
    }).join('');
    const tab = (k, l) => `<button data-act="btab" data-arg="${k}" class="${buildTab === k ? 'on' : ''}">${l}</button>`;
    return head('Build', buildTab === 'everyday' ? 'Everyday buildings make a town happier, and happy towns grow faster.' : 'Key buildings you place yourself. Homes, fields and workshops are painted with Zones.')
      + `<div class="tabs">${tab('buildings', 'Buildings')}${tab('everyday', 'Everyday')}${tab('wonders', 'Wonders')}</div>
      <div class="grid">${cards}</div>`;
  });
}

// ---------------- people ----------------
const AVATAR_BG = ['#f2d6c0', '#d8e8c8', '#cfe0f0', '#f0e0b0', '#e8d0e8', '#d8d8d0'];
function personCard(t, p) {
  if (!p) return head('Moved on', esc(t.name)) + '<div class="note">This villager has moved on. Tap someone else walking about.</div>';
  const age = ageOf(p), partner = p.p ? personById(t, p.p) : null;
  const kids = (t.folk || []).filter((c) => c.par && c.par.includes(p.i));
  const parents = (p.par || []).map((id) => personById(t, id)).filter(Boolean);
  const stage = age < 3 ? '👶' : age < 16 ? '🧒' : age >= 65 ? '🧓' : '🧑';
  const job = p.j ? JOBS[p.j] : age < 16 ? (age < 6 ? 'Little one' : 'Schoolchild') : age >= 65 ? 'Retired' : 'Helping the builders';
  const stars = p.j ? '★'.repeat(1 + Math.floor(p.k / 25)) + '☆'.repeat(4 - Math.floor(p.k / 25)) : '';
  const link = (q) => `<button class="btn small" data-act="person" data-arg="${t.id}:${q.i}">${esc(q.f)}</button>`;
  return head(esc(fullName(p)), `${esc(t.name)} · ${age} year${age === 1 ? '' : 's'} old`)
    + `<div class="person"><div class="avatar" style="background:${AVATAR_BG[p.i % AVATAR_BG.length]}">${stage}</div>
      <div><b>${job}</b>${p.k >= 80 && p.j ? ' · Master' : ''}<div class="stars">${stars}</div></div></div>
      <div class="note" style="font-style:italic">“${esc(thought(t, p))}”</div>
      <div class="kv">${partner ? `<span>Partner</span><span>${link(partner)}</span>` : ''}
      ${parents.length ? `<span>Parents</span><span>${parents.map(link).join(' ')}</span>` : ''}
      ${kids.length ? `<span>Children</span><span>${kids.map(link).join(' ')}</span>` : ''}
      <span>Family</span><span>The ${esc(p.l)} family</span>
      ${petOf(t, p) ? `<span>Pet</span><span>${petOf(t, p).k === 'dog' ? '🐕' : '🐈'} ${esc(petOf(t, p).n)}, a ${petOf(t, p).k}</span>` : ''}</div>
      ${renaming && renaming.pid === p.i ? `<div class="row"><input id="rnin" class="text" maxlength="16" value="${esc(renaming.pet ? petOf(t, p).n : p.f)}" style="flex:1;margin:0"><button class="btn small primary" data-act="rnsave" data-arg="${t.id}:${p.i}">Save</button></div>` : ''}
      <div class="row"><button class="btn small" data-act="follow" data-arg="${t.id}:${p.i}">👁 Follow</button><button class="btn small" data-act="tree" data-arg="${t.id}:${p.i}">🌳 Family tree</button>
      <button class="btn small" data-act="rename" data-arg="${t.id}:${p.i}">✏️ Rename</button>${petOf(t, p) ? `<button class="btn small" data-act="renamepet" data-arg="${t.id}:${p.i}">✏️ Rename ${petOf(t, p).k}</button>` : ''}</div>`;
}
let renaming = null;
// Family tree: grandparents down to grandchildren, as far as this town remembers.
function treeCard(t, p) {
  if (!p) return head('Family tree', esc(t.name)) + '<div class="note">This villager has moved on.</div>';
  const get = (id) => personById(t, id), kidsOf = (q) => (t.folk || []).filter((c) => c.par && c.par.includes(q.i));
  const parents = (p.par || []).map(get).filter(Boolean), grand = parents.flatMap((q) => (q.par || []).map(get).filter(Boolean));
  const partner = p.p ? get(p.p) : null, kids = kidsOf(p), grandkids = kids.flatMap(kidsOf);
  const sibs = parents.length ? kidsOf(parents[0]).filter((q) => q.i !== p.i) : [];
  const chip = (q, me) => `<button class="tchip ${me ? 'me' : ''}" data-act="person" data-arg="${t.id}:${q.i}"><b>${esc(q.f)}</b><small>${ageOf(q)} · ${q.j ? JOBS[q.j] : ageOf(q) < 16 ? 'child' : ageOf(q) >= 65 ? 'retired' : '—'}</small></button>`;
  const gen = (label, list) => list.length ? `<div class="tgen"><div class="tlabel">${label}</div><div class="trow">${list.map((q) => chip(q)).join('')}</div></div>` : '';
  return head(`The ${esc(p.l)} family`, `${esc(t.name)}`)
    + `<div class="tree">${gen('Grandparents', grand)}${gen('Parents', parents)}
      <div class="tgen"><div class="tlabel">${partner ? 'Couple' : 'Here'}</div><div class="trow">${chip(p, true)}${partner ? '<span class="tlink">♥</span>' + chip(partner) : ''}</div></div>
      ${gen('Brothers & sisters', sibs)}${gen('Children', kids)}${gen('Grandchildren', grandkids)}</div>
      ${!grand.length && !parents.length && !kids.length ? '<div class="note">A family just starting out. Weddings and babies will fill this tree.</div>' : ''}`;
}
export function showPerson(townId, pid) {
  const t = townById(townId); if (!t) return;
  openSheet('person', () => personCard(t, personById(t, pid)));
}

// ---------------- realm ----------------// ---------------- realm ----------------
function showRealm() {
  openSheet('realm', () => {
    const p = totalPop(), next = TIERS[S.tier + 1];
    const prog = next ? Math.min(1, (p - TIERS[S.tier].pop) / (next.pop - TIERS[S.tier].pop)) : 1;
    const f = canFound(0, 0);
    const foundLocked = S.tier < 1 || S.towns.length >= maxTowns();
    const contacts = S.neighbors.filter((n) => !n.joined && inContact(n)).sort((a, b) => b.friend - a.friend);
    ST.ensureRoyals();
    return head(esc(S.name), `${ST.rulerLine() ? esc(ST.rulerLine()) + ' · ' : ''}${TIERS[S.tier].name} · ${Math.floor(p)} villagers · ${S.towns.length} settlement${S.towns.length > 1 ? 's' : ''}`)
      + (next ? `<div class="note">Growing toward <b>${next.name}</b> at ${next.pop} villagers</div><div class="meter"><div style="width:${prog * 100}%"></div></div>` : '<div class="note">🌟 Your realm is an Empire, in a golden age: +10% to all production.</div>')
      + (() => { const pr = prestige(); return `<div class="kv"><span>Prestige</span><span>⭐ ${pr.toLocaleString()} · ${prestigeRank(pr)}</span></div>`; })()
      + (S.fed ? '' : '<div class="warn">The granaries are empty, so growth has paused. Zone more farmland or build a fishing dock.</div>')
      + `<div class="section"><h3>Settlements</h3><div class="list">${S.towns.map((t) =>
        `<button class="item" data-act="goto" data-arg="${t.id}"><div><b>${esc(t.name)}</b>${t.capital ? ' 👑' : ''}<div class="meta">${Math.floor(t.pop)}/${t.cap} folk · border ${t.radius.toFixed(1)}</div></div><span>➜</span></button>`).join('')}</div>
        <div class="row"><button class="btn leaf ${foundLocked ? 'disabled' : ''}" data-act="found">Found a new settlement</button><div class="cost">${costChips(FOUND_COST)}</div></div>
        ${foundLocked ? `<div class="note">${S.tier < 1 ? 'Unlocks when your realm becomes a Village.' : `A ${TIERS[S.tier].name} can hold ${maxTowns()} settlements.${S.tier >= 4 ? ' Each sea route makes room for one more.' : ''}`}</div>` : '<div class="note">Settlers can travel anywhere on Earth. Settle near neighbours to befriend them.</div>'}</div>
      ${contacts.some((n) => n.req) ? `<div class="section"><h3>✉ Letters</h3><div class="list">${contacts.filter((n) => n.req).map((n) =>
        `<button class="item" data-act="gonb" data-arg="${n.id}"><div><b>${esc(n.leader)} of ${esc(n.name)}</b><div class="meta">${esc(n.req.text)}</div></div><span>➜</span></button>`).join('')}</div></div>` : ''}
      ${requestsSection()}${royalSection()}${exploreSection()}${caravanSection()}
      <div class="row"><button class="btn small" data-act="history">📈 Realm history</button></div>
      <div class="section"><h3>Neighbours in reach</h3>${contacts.length ? `<div class="list">${contacts.slice(0, 12).map((n) =>
        `<button class="item" data-act="gonb" data-arg="${n.id}"><div><b>${esc(n.name)}</b><div class="meta">${Math.floor(n.pop)} folk · has ${n.surplus} · wants ${n.want}</div></div><span>${n.friend >= 100 ? '💛' : '🤝 ' + Math.floor(n.friend)}</span></button>`).join('')}</div>`
        : `<div class="note">No villages within ${CONTACT_RANGE} tiles yet. Explore the map or found settlements near others.</div>`}</div>
      <div class="section"><h3>Across the seas</h3>
        <div class="note">Your realm spans ${realmContinents().length} continent${realmContinents().length > 1 ? 's' : ''}: ${realmContinents().join(', ')}. ${harbourTowns().length ? `Harbours in ${harbourTowns().map((t) => esc(t.name)).join(', ')}.` : 'Build a Harbour (Town tier) to send settlers and ships to other continents.'}</div>
        ${(S.routes || []).length ? `<div class="list">${S.routes.map((r) => { const a = townById(r.a), b = townById(r.b);
          return `<div class="item"><div><b>${a ? esc(a.name) : '?'} ⛵ ${b ? esc(b.name) : '?'}</b><div class="meta">${r.p >= 1 ? 'Sea route open: +8% gold' : `Charting… ${Math.round(r.p * 100)}%`}</div></div><span>${r.p >= 1 ? '✅' : '🧭'}</span></div>`; }).join('')}</div>` : ''}
        ${routeOptions().slice(0, 6).map(([a, b], k) => `<div class="row"><button class="btn small primary ${affordable(ROUTE_COST) ? '' : 'disabled'}" data-act="route" data-arg="${k}">Chart a route: ${esc(a.name)} → ${esc(b.name)}</button><div class="cost">${costChips(ROUTE_COST)}</div></div>`).join('')}
        ${harbourTowns().length >= 1 && !routeOptions().length ? '<div class="note">Sea routes link harbour towns on different continents. Found a settlement across the sea and give it a harbour too.</div>' : ''}
        ${routeOptions().length ? `<div class="note">Charting a route takes about ${ROUTE_DAYS} days. Each open route adds 8% gold${S.tier >= 4 ? ' and room for one more settlement' : ''}.</div>` : ''}</div>
      <div class="section"><h3>Wonders</h3><div class="list">${WONDERS.map((w) => {
        const d = DEFS[w], done = hasWonder(w), st = wonderStarted(w);
        return `<div class="item"><div><b>${d.name}</b><div class="meta">${d.desc}</div></div><span>${done ? '✅' : st ? '🚧' : d.tier > S.tier ? '🔒' : '—'}</span></div>`;
      }).join('')}</div></div>`;
  });
}

// ---------------- requests, royals, explorers, history ----------------
function requestsSection() {
  const rq = S.requests || [];
  if (!rq.length) return '';
  return `<div class="section"><h3>📌 Requests from your folk</h3><div class="list">${rq.map((q, k) => {
    const t = townById(q.town);
    const btn = q.kind === 'lost' ? `<button class="btn small" data-act="golost" data-arg="${q.id}">Show me</button>`
      : q.kind === 'gift' ? `<button class="btn small primary ${S.res[q.res] >= q.amt ? '' : 'disabled'}" data-act="givereq" data-arg="${q.id}">Give ${q.amt} ${RES_NAMES[q.res].toLowerCase()}</button>`
      : `<span class="meta">Build it in ${t ? esc(t.name) : 'town'}</span>`;
    return `<div class="item"><div><b>${esc(q.who)}</b><div class="meta">${esc(q.text)}</div></div>${btn}</div>`;
  }).join('')}</div><div class="note">Each kindness earns a little gold and cheers the town. Unanswered requests simply pass.</div></div>`;
}
function royalSection() {
  ST.ensureRoyals();
  const ms = S.royal.members.filter((m) => m.role !== 'gone');
  return `<div class="section"><h3>👑 The royal family</h3><div class="list">${ms.map((m) =>
    `<div class="item" style="justify-content:flex-start;gap:12px">${ST.portrait(m, 46)}<div><b>${esc(ST.titleOf(m))} ${esc(m.n)}</b><div class="meta">${m.role === 'ruler' ? 'Rules the realm' : m.role === 'consort' ? 'Royal consort' : m.role === 'heir' ? 'Heir' : 'Enjoying a quiet retirement'} · ${ST.rAge(m)} years old</div></div></div>`).join('')}</div>
    ${(S.royal.log || []).length ? `<div class="note">${S.royal.log.slice(0, 3).map((e) => `• ${esc(e.s)}`).join('<br>')}</div>` : ''}</div>`;
}
function exploreSection() {
  const ex = S.expeditions || [], jr = S.journal || [];
  return `<div class="section"><h3>🧭 Explorers</h3>
    ${ex.length ? `<div class="list">${ex.map((e) => { const u = Math.min(1, (S.day - e.start) / e.days); return `<div class="item"><div><b>${esc(e.leader)}</b><div class="meta">${u < 0.5 ? 'Travelling to' : 'Returning from'} ${XP.LANDMARKS[e.lm][0]} · ${Math.round(u * 100)}%</div></div><span>${e.horse ? '🐎' : '🚶'}</span></div>`; }).join('')}</div>` : ''}
    ${S.tier < XP.EXPLORE_TIER ? '<div class="note">Expeditions begin when your realm becomes a Village.</div>' : '<div class="row"><button class="btn small primary" data-act="explore">Plan an expedition</button>' + (jr.length ? `<button class="btn small" data-act="journal">📖 Journal (${jr.length})</button>` : '') + '</div>'}</div>`;
}
function showExplore() {
  openSheet('explore', () => {
    const opts = XP.LANDMARKS.map((l, k) => [k, XP.expeditionPlan(k)]).filter(([k, pl]) => pl && !(S.explored || []).includes(k)).sort((a, b) => a[1].d - b[1].d);
    return head('Plan an expedition', `Supplies: 40 food, 30 gold · ${(S.expeditions || []).length}/${XP.MAX_EXPEDITIONS} parties out`)
      + `<div class="note">Explorers ride out to a natural wonder of the world and come back with stories for your journal and a gift of gold. Stables make them faster. Distant continents need a Harbour.</div>
      <div class="list">${opts.slice(0, 14).map(([k, pl]) => { const c = XP.canExplore(k); return `<div class="item"><div><b>${XP.LANDMARKS[k][3]} ${XP.LANDMARKS[k][0]}</b><div class="meta">${pl.days} days there and back from ${esc(pl.town.name)}${pl.overseas ? ' · overseas' : ''}${c.ok ? '' : ` · ${esc(c.reason)}`}</div></div><button class="btn small primary ${c.ok ? '' : 'disabled'}" data-act="sendexp" data-arg="${k}">Send</button></div>`; }).join('')}</div>`;
  });
}
function showJournal() {
  openSheet('journal', () => head('📖 Explorers’ journal', `${(S.journal || []).length} of ${XP.LANDMARKS.length} wonders recorded`)
    + `<div class="list">${(S.journal || []).map((j) => `<div class="item"><div><b>${XP.LANDMARKS[j.lm][3]} ${XP.LANDMARKS[j.lm][0]}</b><div class="meta">“${esc(j.text)}”<br>Recorded by ${esc(j.who)}, Year ${Math.floor(j.d / 48) + 1}</div></div></div>`).join('')}</div>`);
}
function showHistory() {
  openSheet('history', () => {
    const h = S.hist || [];
    const ser = (k) => h.map((r) => [r[0], r[k]]);
    const res = [['Food', 2, '#b08a2a'], ['Wood', 3, '#8a5a3c'], ['Stone', 4, '#6e6860'], ['Gold', 5, '#a87a1a']];
    return head('📈 Realm history', `${esc(S.name)} · ${h.length ? `since Year ${Math.floor(h[0][0] / 48) + 1}` : 'just founded'}`)
      + `<div class="section"><h3>Villagers</h3>${RC.lineChart(ser(1), { label: 'Villagers over time', color: '#c0603e' })}</div>
      <div class="section"><h3>Stores</h3><div class="note">Each chart has its own scale.</div>${res.map(([n, k, c]) => `<div class="note" style="margin:6px 0 0"><b>${n}</b></div>${RC.lineChart(ser(k), { label: `${n} over time`, color: c, h: 90 })}`).join('')}</div>
      <div class="section"><h3>Milestones</h3>${(S.miles || []).length ? `<div class="list">${S.miles.slice().reverse().map((m) => `<div class="item" style="justify-content:flex-start;gap:10px"><span style="font-size:20px">${m.icon}</span><div><b>${esc(m.s)}</b><div class="meta">Year ${Math.floor(m.d / 48) + 1}</div></div></div>`).join('')}</div>` : '<div class="note">Milestones will appear as your realm grows.</div>'}</div>`;
  });
  RC.wireCharts($('#sheetbody'));
}
function festivalSection(t) {
  const f = ST.festivalNow(t), c = ST.canFestival(t), on = t.fest && S.day < t.fest.until;
  const cur = on ? ST.ALL_FESTS().find((x) => x.key === t.fest.key) : null;
  const specials = on ? '' : `<div class="list">${ST.SPECIALS.map((sp) => { const cs = ST.canSpecial(t, sp.key); return `<div class="item"><div><b>${sp.icon} ${sp.name}</b><div class="meta">${sp.desc}${cs.ok ? '' : ` <i>${esc(cs.reason)}</i>`}</div><div class="cost" style="margin-top:4px">${costChips(sp.cost)}</div></div><button class="btn small leaf ${cs.ok ? '' : 'disabled'}" data-act="special" data-arg="${t.id}:${sp.key}">Hold</button></div>`; }).join('')}</div>`;
  return `<div class="section"><h3>${f.icon} Festivals</h3><div class="note">${on ? `<b>${cur ? cur.name : 'A celebration'}</b> is on now! The whole town is out celebrating.` : `This season's festival is <b>${f.name}</b>: ${f.desc} The town is happier during it, and for a season afterwards, and neighbours come to visit.`}</div>
    ${on ? '' : `<div class="row"><button class="btn small leaf ${c.ok ? '' : 'disabled'}" data-act="festival" data-arg="${t.id}">Hold ${f.name}</button><div class="cost">${costChips(ST.FESTIVAL_COST)}</div></div>${c.ok ? '' : `<div class="note">${esc(c.reason)}</div>`}`}${specials}${t.royalVisit && S.day < t.royalVisit.until ? `<div class="note">👑 ${esc(t.royalVisit.name)} of ${esc(t.royalVisit.village)} is visiting!</div>` : ''}</div>`;
}
function showBackup() {
  openSheet('backup', () => head('Back up this realm', esc(S.name))
    + `<div class="note">Keep a copy of your realm somewhere safe, so a new phone or a reinstall never loses it. Restore it from the main menu (Load Realm).</div>
    <div class="list"><button class="item" data-act="bkfile"><div><b>💾 Save a backup file</b><div class="meta">Share it to Drive, email or your files</div></div><span>➜</span></button>
    <button class="item" data-act="bkcode"><div><b>📋 Copy a backup code</b><div class="meta">A long text code you can paste anywhere</div></div><span>➜</span></button></div>
    <textarea id="bkout" class="text hidden" rows="4" readonly style="font-size:11px"></textarea>`);
}

// ---------------- settings (shared by the in-game menu and the main menu) ----------------
function settingsHTML(attr) {
  return VOLUMES.map(([k, label]) => `<label class="slider"><span>${label}<b data-volv="${k}">${Math.round(vol(k) * 100)}%</b></span><input type="range" min="0" max="100" step="5" value="${Math.round(vol(k) * 100)}" data-vol="${k}"></label>`).join('')
    + [['haptics', 'Vibration'], ['nonight', 'Always daytime (no night)'], ['noweather', 'Always fair weather (no rain, snow, storms or fog)'], ['gentle', 'Gentle visuals (fewer effects, saves battery)']].map(([k, label]) => `<div class="toggle"><span>${label}</span><button class="switch ${S.settings[k] ? 'on' : ''}" ${attr}="${k}" aria-label="${label}" aria-pressed="${!!S.settings[k]}"></button></div>`).join('');
}
// Volume sliders update live without redrawing the panel (so the thumb never jumps out from under the finger).
document.addEventListener('input', (e) => {
  const k = e.target && e.target.dataset && e.target.dataset.vol; if (!k) return;
  const v = +e.target.value / 100;
  S.settings.vol = { ...(S.settings.vol || {}), [k]: v };
  const out = document.querySelector(`[data-volv="${k}"]`); if (out) out.textContent = Math.round(v * 100) + '%';
  initAudio(); applySettings();
});
document.addEventListener('change', (e) => { if (e.target && e.target.dataset && e.target.dataset.vol) { saveSettings(); if (e.target.dataset.vol === 'sfx') sfx('tap'); } });
// Flip a switch on screen straight away, whatever else is redrawing.
export function applyVisuals() { setNightOff(S.settings.nonight); }
function flipSwitch(btn, on) { if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); } }

// ---------------- menu ----------------
function showMenu() {
  openSheet('menu', () => head('Menu', 'Hearthlands')
    + settingsHTML('data-act="set" data-arg')
    + `<div class="section"><h3>How to play</h3><div class="note">
      • <b>Zones</b>: paint Housing for homes, Farmland and Pastures for food, Woodlots for timber, Parks for happier towns, and Workshops and Shops for gold. Villagers build them over time. <b>Road</b> paints free roads, and <b>Erase</b> clears zones and roads.<br>
      • <b>Build</b>: place Lumber Camps by woods, Quarries and Mines by hills, Docks on the shore.<br>
      • Your border grows as your town grows. Watchtowers push it further.<br>
      • Trade with nearby villages and send gifts. Close friends may join your kingdom.<br>
      • Nothing can go wrong. Pause whenever you like, and the realm waits for you.<br>
      • <b>S Pen</b>: hover to see what's there. In Zones, the pen paints and fingers move the map. Hold the pen's side button to erase.</div></div>
      <div class="section"><h3>Map data</h3><div class="note">Earth outlines from Natural Earth (public domain) via world-atlas.</div></div>
      <div class="row"><button class="btn small" data-act="savenow">Save now</button>${document.body.classList.contains('native') || !document.documentElement.requestFullscreen ? '' : '<button class="btn small" data-act="fullscreen">Full screen</button>'}<button class="btn small" data-act="backup">Back up realm</button><button class="btn small primary" data-act="mainmenu">Main menu</button></div>`);
}

// ---------------- tile info ----------------
export function showInfo(x, y) {
  { const a = anchorOf(idxOf(wrapX(x), y)); if (a !== idxOf(wrapX(x), y)) { x = a % W; y = Math.floor(a / W); } }
  M.selected = { x, y }; markDirty();
  openSheet('info', () => {
    const i = idxOf(x, y), info = describeTile(x, y);
    const b = S.buildings.get(i), z = S.zones.get(i), nb = S.nbIndex.get(i) || nbExtra.get(i);
    const town = ownerOf(x, y);
    let sub = `${info.biome} · ${esc(info.place)} · ${info.coord}`;
    if (nb) return neighborInfo(nb, sub);
    if (b) {
      const d = DEFS[b.t], t = townById(b.town);
      if (b.t === 'townhall' && t) return townInfo(t, sub);
      let body = '';
      if (b.p < 1) body += `<div class="note">Under construction</div><div class="meter"><div style="width:${b.p * 100}%"></div></div>`;
      body += '<div class="kv">';
      if (t) body += `<span>Settlement</span><span>${esc(t.name)}</span>`;
      const sf = b.t === 'farm' ? farmSeason(S.day, tileLat(y)) : 1;
      if (d.prod) body += `<span>Produces</span><span>${Object.entries(d.prod).map(([k, v]) => `${(v * (b.m || 1) * PACE.prod * sf).toFixed(2)} ${RES_NAMES[k].toLowerCase()}/day`).join(', ')}</span>`;
      if (b.t === 'farm' && Math.abs(sf - 1) > 0.01) body += `<span>Season</span><span>${sf < 1 ? 'Resting for winter' : 'Harvest time'} (${Math.round(sf * 100)}%)</span>`;
      if (d.cap) body += `<span>Houses</span><span>${d.cap} villagers</span>`;
      if (d.jobs) body += `<span>Workers</span><span>${d.jobs}</span>`;
      if (b.m && b.m !== 1 && d.prod) body += `<span>Land bonus</span><span>${Math.round(b.m * 100)}%</span>`;
      if (d.radius) body += `<span>Border</span><span>+${d.radius}</span>`;
      if (d.wonder) body += `<span>Wonder</span><span>${d.desc}</span>`;
      body += '</div>';
      if (UPKEEP[b.t]) {
        const up = Object.entries(UPKEEP[b.t]).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ');
        body += b.idle ? `<div class="warn">💤 Resting: it needs ${up} a day to run. It wakes by itself once your stores can cover it.</div>`
          : `<div class="note">Upkeep: ${up} a day.</div>`;
      }
      if (d.civic) body += `<div class="note">A civic improvement of ${t ? esc(t.name) : 'your town'}, loved by everyone who lives there.</div>`;
      else body += `<div class="row"><button class="btn small" data-act="demolish">${b.p < 1 ? 'Cancel construction' : 'Demolish'}</button>${b.p >= 1 && !d.civic ? '<button class="btn small" data-act="movebld">↔ Move</button><button class="btn small" data-act="turnbld">⟲ Turn</button>' : ''}</div>`;
      if (b.t === 'house' && t) {
        const lv = b.lv || 1;
        body = body.replace('<span>Houses</span><span>6 villagers</span>', `<span>Houses</span><span>${Math.round(6 * HOUSE_CAP_MULT[lv - 1])} villagers</span>`);
        return head(HOUSE_LEVELS[lv - 1], sub) + `<div class="note">${STYLES[townStyle(t)].name} homes of ${esc(t.name)}.${lv < 3 ? ` Families improve their homes by themselves as the town grows${lv === 1 ? ' past 40 folk' : ' past 150 folk at City size'}.` : ''}</div>` + body;
      }
      return head(d.name, sub) + body;
    }
    if (z) {
      return head(`${ZONES[z].name} zone`, sub) + `<div class="note">Waiting for villagers to build ${DEFS[ZONES[z].builds].name.toLowerCase()} here (${Object.entries(DEFS[ZONES[z].builds].cost).map(([k, v]) => `${v} ${k}`).join(', ')}).</div>
        <div class="row"><button class="btn small" data-act="unzone">Remove zone</button></div>`;
    }
    const bm = world.biome[i];
    const tips = {
      [B.FOREST]: 'Good for a Lumber Camp.', [B.TAIGA]: 'Good for a Lumber Camp.', [B.JUNGLE]: 'Good for a Lumber Camp.',
      [B.HILLS]: 'Good for a Quarry or Iron Mine.', [B.MOUNTAIN]: 'Too steep to build on. Mines and quarries work well beside it.',
      [B.GRASS]: 'Rich soil, ideal for farmland.', [B.SHALLOW]: 'Docks on the shore can fish here.', [B.SNOW]: 'Too cold to build on.',
      [B.DESERT]: 'Poor farmland, but stone can be quarried.', [B.STEPPE]: 'Decent farmland.', [B.SAVANNA]: 'Decent farmland.', [B.TUNDRA]: 'Hardy land, with poor farming.',
    };
    return head(info.biome, `${esc(info.place)} · ${info.coord}`)
      + `<div class="note">${town ? `Inside the borders of <b>${esc(town.name)}</b>.` : 'Wild land beyond your borders.'} ${tips[bm] || ''}</div>`
      + (town && !BIOMES[bm].water ? `<div class="row"><button class="btn small primary" data-act="openbuild">Build here…</button><button class="btn small" data-act="quickzone" data-arg="housing">Zone housing</button><button class="btn small" data-act="quickzone" data-arg="farmland">Zone farmland</button></div>` : '');
  });
}
function specSection(t) {
  if (S.tier < SPEC_TIER) return `<div class="section"><h3>Speciality</h3><div class="note">From Village tier, each town can master one trade.</div></div>`;
  const cur = t.spec ? SPECS[t.spec] : null;
  return `<div class="section"><h3>Speciality</h3>
    <div class="note">${cur ? `${esc(t.name)} masters <b>${cur.icon} ${cur.name}</b>: +30% to it, -10% to its other work.` : `Choose one trade for ${esc(t.name)} to master: +30% to it, -10% to the town's other work.`}${t.spec ? ` Changing costs ${SPEC_CHANGE_COST.gold} gold.` : ' The first choice is free.'}</div>
    <div class="list">${Object.entries(SPECS).map(([k, sp]) => `<button class="item ${t.spec === k ? '' : (t.spec && !affordable(SPEC_CHANGE_COST) ? 'disabled' : '')}" data-act="spec" data-arg="${t.id}:${k}" ${t.spec === k ? 'style="border-color:var(--leaf);background:#eef5e2"' : ''}>
      <div><b>${sp.icon} ${sp.name}</b><div class="meta">${sp.desc}</div></div><span>${t.spec === k ? '✓' : ''}</span></button>`).join('')}</div></div>`;
}
function moodSection(t) {
  const m = moodOf(t), M2 = MOODS[m.level];
  return `<div class="section"><h3>Mood</h3><div class="moodline"><span class="face">${M2.face}</span><span>${M2.name}${m.level < 2 ? `<div class="meta" style="font-weight:500;color:var(--ink-soft);font-size:12px">${m.level === 0 ? 'Happier towns attract families faster.' : 'A little more and they will be joyful.'}</div>` : '<div class="meta" style="font-weight:500;color:var(--ink-soft);font-size:12px">Families flock here.</div>'}</span></div>
    <div class="chips2">${m.parts.map(([l]) => `<span>✓ ${esc(l)}</span>`).join('')}${m.missing.slice(0, 4).map((l) => `<span class="want">+ ${esc(l)}</span>`).join('')}</div></div>`;
}
function folkSection(t) {
  const f = t.folk || [];
  if (!f.length) return '';
  const kids = f.filter((p) => ageOf(p) < 16).length, elders = f.filter((p) => ageOf(p) >= 65).length;
  const couples = f.filter((p) => p.p && p.i < p.p).length;
  const masters = f.filter((p) => p.j && p.k >= 80).slice(0, 3);
  const oldest = f.reduce((a, b) => (ageOf(b) > ageOf(a) ? b : a), f[0]);
  const youngest = f.reduce((a, b) => (b.b > a.b ? b : a), f[0]);
  const notable = [...masters.map((p) => [p, `Master ${JOBS[p.j].toLowerCase()}`]), [oldest, `Eldest, ${ageOf(oldest)}`], [youngest, ageOf(youngest) < 1 ? 'Newest baby' : `Youngest, ${ageOf(youngest)}`]];
  const seen = new Set();
  return `<div class="section"><h3>The folk of ${esc(t.name)}</h3>
    <div class="note">${f.length} villagers: ${f.length - kids - elders} adults, ${kids} children and ${elders} elders, with ${couples} couples.</div>
    <div class="list">${notable.filter(([p]) => !seen.has(p.i) && seen.add(p.i)).map(([p, why]) =>
      `<button class="item" data-act="person" data-arg="${t.id}:${p.i}"><div><b>${esc(fullName(p))}</b><div class="meta">${why}${p.j ? ` · ${JOBS[p.j]}` : ''}</div></div><span>➜</span></button>`).join('')}</div>
    ${(t.chron || []).length ? `<div class="section"><h3>Town chronicle</h3><div class="note">${t.chron.slice(0, 8).map((e) => `• ${esc(e.s)} <span style="opacity:.6">(Year ${Math.floor(e.d / 48) + 1})</span>`).join('<br>')}</div></div>` : ''}
    <div class="note">Tip: tap anyone walking about to meet them.</div></div>`;
}
function caravanSection() {
  if (S.towns.length < 2) return '';
  const pairs = caravanPairs().slice(0, 6), room = S.caravans.length < maxCaravans();
  return `<div class="section"><h3>🐴 Caravans</h3><div class="note">Wagon trains between your own towns: each one earns gold and cheers up both towns. ${S.caravans.length} of ${maxCaravans()} in use.</div>
    ${S.caravans.length ? `<div class="list">${S.caravans.map(([a, b], k) => `<div class="item"><div><b>${esc((townById(a) || {}).name || '?')} ⇄ ${esc((townById(b) || {}).name || '?')}</b><div class="meta">+0.3 gold a day</div></div><button class="btn small" data-act="stopcar" data-arg="${k}">Stop</button></div>`).join('')}</div>` : ''}
    ${room && pairs.length ? `<div class="list">${pairs.map(([a, b]) => `<div class="item"><div><b>${esc(a.name)} ⇄ ${esc(b.name)}</b><div class="cost" style="margin-top:4px">${costChips(CARAVAN_COST)}</div></div><button class="btn small leaf ${affordable(CARAVAN_COST) ? '' : 'disabled'}" data-act="startcar" data-arg="${a.id}:${b.id}">Start</button></div>`).join('')}</div>` : ''}</div>`;
}
// Town figures: homes, jobs and what the town makes each day.
function statsSection(t) {
  const kinds = {}; let homes = 0;
  for (const b of S.buildings.values()) if (b.town === t.id && b.p >= 1) { if (b.t === 'house') homes++; else kinds[b.t] = (kinds[b.t] || 0) + 1; }
  const workers = Math.min(Math.floor(t.pop * 0.6), t.jobs || 0);
  const prod = Object.entries(t.prod || {}).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]);
  const top = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n} ${DEFS[k] ? DEFS[k].name.toLowerCase() : k}`).join(', ');
  return `<div class="section"><h3>📊 Town figures</h3><div class="kv">
    <span>Homes</span><span>${homes} (room for ${t.cap})</span>
    <span>Jobs</span><span>${t.jobs || 0} · about ${workers} filled</span>
    <span>Growth</span><span>${t.pop >= t.cap - 0.5 ? 'Full, zone more homes' : S.fed ? `${Math.ceil(t.cap - t.pop)} more can move in` : 'Paused until there is food'}</span>
    <span>Makes each day</span><span>${prod.length ? prod.map(([r, v]) => `${ICON[r] ? ICON[r].replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"') : ''} ${v >= 10 ? Math.round(v) : v.toFixed(1)}`).join(' &nbsp;') : 'Nothing yet'}</span>
    </div>${top ? `<div class="note">Here: ${top}.</div>` : ''}${t.districts && t.districts.length ? `<div class="note">Quarters: ${t.districts.map((d) => esc(d.name)).join(' · ')}</div>` : ''}</div>`;
}
function townInfo(t, sub) {
  const next = TIERS[S.tier + 1];
  return head(`${esc(t.name)}${t.capital ? ' 👑' : ''}`, sub)
    + `<div class="kv"><span>Villagers</span><span>${Math.floor(t.pop)} / ${t.cap}</span><span>Buildings</span><span>${t.n}</span>
      <span>Builders</span><span>${crewsBusy(t)} of ${crewsOf(t)} crews at work${zonesWaiting(t) ? ` · ${zonesWaiting(t)} zoned tiles waiting` : ''}${yardsIn(t) ? '' : ' (a Builder\'s Yard adds 2)'}</span>
      <span>Border</span><span>${t.radius.toFixed(1)} tiles</span><span>Founded</span><span>Year ${Math.floor(t.founded / 48) + 1}</span></div>
      <div class="note">${t.pop >= t.cap - 0.5 ? 'Every home is full. Zone more housing to grow.' : S.fed ? 'Families are moving in.' : 'Growth has paused until there is more food.'}</div>
      ${t.capital && next ? `<div class="note">The keep grows grander as your realm reaches ${next.name}.</div>` : ''}
      <div class="kv"><span>Continent</span><span>${continentAt(t.x, t.y)}</span><span>Harbour</span><span>${harbourTowns().includes(t) ? 'Yes ⚓' : 'None yet'}</span><span>Charm</span><span>${'✿'.repeat(charm(t)) || '—'} ${charm(t)}/5</span></div>
      ${statsSection(t)}${specSection(t)}${moodSection(t)}${festivalSection(t)}${folkSection(t)}
      <div class="section"><h3>Make ${esc(t.name)} lovelier</h3>${S.tier < IMPROVE_TIER ? `<div class="note">Civic improvements unlock when your realm becomes a ${TIERS[IMPROVE_TIER].name}.</div>` : `<div class="note">Each improvement changes how the town looks and makes room for 4% more villagers.</div>
        <div class="list">${Object.entries(IMPROVEMENTS).map(([k, d]) => {
          const done = t.imp && t.imp[k];
          return `<div class="item"><div><b>${d.name}</b><div class="meta">${d.desc}</div>${done ? '' : `<div class="cost" style="margin-top:4px">${costChips(d.cost)}</div>`}</div>
            ${done ? '<span>✅</span>' : `<button class="btn small leaf ${affordable(d.cost) ? '' : 'disabled'}" data-act="improve" data-arg="${t.id}:${k}">Add</button>`}</div>`;
        }).join('')}</div>`}</div>`;
}
function neighborInfo(n, sub) {
  const contact = inContact(n), inv = canInvite(n);
  const offers = tradeOffers(n);
  const tr = TRAITS[n.trait] || TRAITS.cheerful;
  const req = n.req;
  return head(esc(n.name), `Neighbouring village · ${Math.floor(n.pop)} folk`)
    + `<div class="note">${sub}</div>
    <div class="note">Led by <b>${esc(n.leader || 'their elder')}</b> · ${tr.label}: ${tr.blurb}</div>
    ${n.realm ? `<div class="note">🏰 Part of the <b>${esc(n.realm)}</b>, a peaceful neighbouring realm.</div>` : ''}
    ${req ? `<div class="section"><h3>✉ A request</h3><div class="note">“${esc(req.text)}”</div>
      <div class="row"><button class="btn small primary ${contact && S.res[req.res] >= req.amt ? '' : 'disabled'}" data-act="fulfil">Send ${req.amt} ${RES_NAMES[req.res].toLowerCase()}</button>
      <div class="note" style="margin:0">They'll send ${Object.entries(req.reward).map(([k, v]) => `${v} ${k}`).join(', ')} in thanks</div></div>
      <div class="note">No hurry, and no harm if you can't. The need passes in ${Math.max(1, Math.ceil(req.until - S.day))} days.</div></div>` : ''}
    <div class="kv"><span>Has plenty of</span><span>${ICON[n.surplus].replace('<svg', '<svg width="16" height="16"')} ${RES_NAMES[n.surplus]}</span><span>Would love</span><span>${ICON[n.want].replace('<svg', '<svg width="16" height="16"')} ${RES_NAMES[n.want]}</span></div>
    <div class="note">Friendship ${Math.floor(n.friend)}/100</div><div class="meter"><div style="width:${n.friend}%"></div></div>
    ${contact ? `<div class="section"><h3>Trade</h3><div class="note">${priceNote()}${S.res.spices > 0.5 ? ' Your spices sweeten every deal.' : ''}</div><div class="list">${offers.map((o, k) =>
      `<button class="item ${affordable(o.give) ? '' : 'disabled'}" data-act="trade" data-arg="${k}" ${affordable(o.give) ? '' : 'style="opacity:.5"'}><div class="cost">Give ${costChips(o.give)}</div><span>→</span><div class="cost">Get ${costChips(o.get, false)}</div></button>`).join('')}</div></div>
      <div class="section"><h3>Send a gift (${GIFT_AMOUNT})</h3><div class="row">${RES.map((r) =>
        `<button class="btn small ${S.res[r] < GIFT_AMOUNT ? 'disabled' : ''}" data-act="gift" data-arg="${r}">${ICON[r].replace('<svg', '<svg width="18" height="18" style="vertical-align:-4px"')}${r === n.want ? ' 💛' : ''}</button>`).join('')}</div>
        <div class="note">Gifts of what they want count for nearly double.</div></div>
      ${n.log && n.log.length ? `<div class="section"><h3>Lately in ${esc(n.name)}</h3><div class="note">${n.log.map((e) => `• ${esc(e.text)} <span style="opacity:.6">(Year ${Math.floor(e.day / 48) + 1})</span>`).join('<br>')}</div></div>` : ''}
      <div class="section"><button class="btn primary ${inv.ok ? '' : 'disabled'}" data-act="invite">Invite to join your kingdom</button>${inv.ok ? '' : `<div class="note">${inv.reason}</div>`}</div>`
    : `<div class="note">Too far for traders. Villages within ${CONTACT_RANGE} tiles of one of your settlements can trade. Found a settlement nearer to them.</div>`}`;
}

const nbAt = (t) => t && (S.nbIndex.get(idxOf(t.x, t.y)) || nbExtra.get(idxOf(t.x, t.y)));

// ---------------- actions ----------------
let CURSLOT = () => CUR;
const await_slot = () => ({ currentSlot: CURSLOT() });
function act(name, arg, el) {
  const sel = M.selected;
  switch (name) {
    case 'close': closeSheet(); break;
    case 'btab': buildTab = arg; refreshSheet(true); break;
    case 'pick': {
      const d = DEFS[arg];
      if (d.tier > S.tier) { toast(`${d.name} unlocks at ${TIERS[d.tier].name}.`); sfx('error'); return; }
      if (d.wonder && wonderStarted(arg)) { toast('That wonder is already built.'); return; }
      closeSheet(); setMode({ kind: 'build', type: arg });
      if (cam.tw < TILE_MODE_TW) { const c = S.towns.find((t) => t.capital) || S.towns[0]; flyTo(c.x, c.y, 48); }
      break;
    }
    case 'zone': setMode({ kind: 'zone', zone: arg }); break;
    case 'undo': if (undoStroke()) { sfx('tap'); setMode(M.mode); } break;
    case 'cancelmode': setMode(null); setHover(null); break;
    case 'goto': { const t = townById(+arg); if (t) { closeSheet(); flyTo(t.x, t.y, 56); } break; }
    case 'gonb': { const n = S.neighbors[+arg] && S.neighbors.find((q) => q.id === +arg); if (n) { flyAbove(n.x, n.y, 48); showInfo(n.x, n.y); } break; }
    case 'found': closeSheet(); setMode({ kind: 'found' }); toast('Pick open land anywhere for your settlers.'); if (cam.tw > 30) flyTo(null, null, 10, 0.8, true); break;
    case 'set': S.settings[arg] = !S.settings[arg]; flipSwitch(el, S.settings[arg]); saveSettings(); applySettings(); applyVisuals(); touchingUI = false; refreshSheet(); if (arg === 'haptics' && S.settings.haptics) haptic(); break;
    case 'savenow': save(); toast('Your realm is saved.'); break;
    case 'fullscreen': if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); break;
    case 'mainmenu': backToMenu(); break;
    case 'history': showHistory(); break;
    case 'explore': showExplore(); break;
    case 'journal': showJournal(); break;
    case 'sendexp': { const r = XP.sendExpedition(+arg); if (r.ok) { sfx('quest'); haptic('medium'); closeSheet(); } else { sfx('error'); toast(r.reason); } break; }
    case 'festival': { const t = townById(+arg); if (t && ST.holdFestival(t)) { sfx('tier'); haptic('medium'); refreshSheet(); } else sfx('error'); break; }
    case 'givereq': { const q = (S.requests || []).find((r) => r.id === +arg); if (q && ST.giveFor(q)) { sfx('quest'); refreshSheet(); } else sfx('error'); break; }
    case 'golost': { const q = (S.requests || []).find((r) => r.id === +arg); if (q) { closeSheet(); flyTo(q.x, q.y, 60); toast(`Look for the ${q.animal} with a ? and tap it.`); } break; }
    case 'backup': save(); showBackup(); break;
    case 'bkfile': { save(); const { currentSlot } = await_slot(); RC.saveBackupFile(currentSlot).then((r) => toast(r === 'shared' || r === 'downloaded' ? 'Backup saved.' : r === 'cancel' ? 'Backup cancelled.' : 'Could not save a file here. Try the backup code instead.')); break; }
    case 'bkcode': { save(); const { currentSlot } = await_slot(); const code = RC.exportCode(currentSlot); const ta = $('#bkout'); ta.value = code || ''; ta.classList.remove('hidden'); ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Backup code copied.')).catch(() => toast('Select the code above and copy it.')); break; }
    case 'restart':
      if (el.dataset.confirm) { resetSave(); location.reload(); }
      else { el.dataset.confirm = '1'; el.textContent = 'Tap again to abandon this realm'; el.classList.add('primary'); }
      break;
    case 'startcar': { const [a, b] = arg.split(':').map(Number); if (startCaravan(a, b)) { sfx('coin'); toast('A caravan sets out!'); refreshSheet(); } break; }
    case 'stopcar': stopCaravan(+arg); refreshSheet(); break;
    case 'follow': { const [tid, pid] = arg.split(':').map(Number); const t = townById(tid), p = t && personById(t, pid); if (!p) break;
      M.follow = { town: tid, pid }; closeSheet(); if (cam.tw < 60) flyTo(t.x, t.y, 64, 0.8); toast(`Following ${p.f}. Touch the map to stop.`); break; }
    case 'tree': { const [tid, pid] = arg.split(':').map(Number); const t = townById(tid); if (t) openSheet('person', () => treeCard(t, personById(t, pid))); break; }
    case 'rename': case 'renamepet': { const [, pid] = arg.split(':').map(Number); renaming = { pid, pet: name === 'renamepet' }; refreshSheet(); setTimeout(() => { const i = $('#rnin'); if (i) { i.focus(); i.select(); } }, 50); break; }
    case 'rnsave': document.activeElement && document.activeElement.blur && document.activeElement.blur(); { const [tid, pid] = arg.split(':').map(Number); const t = townById(tid), p = t && personById(t, pid), v = ($('#rnin') || {}).value; if (p && v && v.trim()) { const nm = v.trim().slice(0, 16); if (renaming && renaming.pet) { const pet = petOf(t, p); if (pet) pet.n = nm; } else p.f = nm; sfx('quest'); } renaming = null; refreshSheet(); break; }
    case 'special': { const [tid, key] = arg.split(':'); const t = townById(+tid); if (t && ST.holdSpecial(t, key)) { sfx('quest'); haptic('medium'); refreshSheet(); } break; }
    case 'movebld': if (sel) { const i = idxOf(sel.x, sel.y), b = S.buildings.get(i); if (b) { closeSheet(); setMode({ kind: 'move', from: i, type: b.t }); toast(`Tap where the ${DEFS[b.t].name} should go.`); } } break;
    case 'turnbld': if (sel && turnBuilding(idxOf(sel.x, sel.y))) { sfx('tap'); markDirty(); } break;
    case 'flip': if (M.mode) { M.mode.flip = !M.mode.flip; setMode(M.mode); markDirty(); } break;
    case 'demolish': if (sel && demolish(sel.x, sel.y)) { sfx('place'); toast('Cleared.'); closeSheet(); } break;
    case 'unzone': if (sel) { setZone('erase', sel.x, sel.y); closeSheet(); } break;
    case 'openbuild': showBuild(); break;
    case 'quickzone': if (sel && setZone(arg, sel.x, sel.y)) { sfx('place'); haptic(); toast(`${ZONES[arg].name} zoned. Villagers will build here soon.`); refreshSheet(); } break;
    case 'trade': { const n = sel && nbAt(sel); if (n && doTrade(n, +arg)) { sfx('coin'); haptic(); toast(`Traded with ${n.name}.`); refreshSheet(); } else sfx('error'); break; }
    case 'gift': { const n = sel && nbAt(sel); if (n && gift(n, arg)) { sfx('coin'); haptic(); toast(`${n.name} is delighted by your gift!`); refreshSheet(); } break; }
    case 'improve': { const [tid, key] = arg.split(':'); const t = townById(+tid); if (t && improve(t, key)) { sfx('built'); haptic('medium'); toast(`${IMPROVEMENTS[key].name} added to ${t.name}.`); refreshSheet(); } else sfx('error'); break; }
    case 'route': { const o = routeOptions()[+arg]; if (o && openRoute(o[0], o[1])) { sfx('quest'); haptic('medium'); refreshSheet(); } else sfx('error'); break; }
    case 'spec': { const [tid, key] = arg.split(':'); const t = townById(+tid); if (t && setSpec(t, key)) { sfx('quest'); haptic('medium'); refreshSheet(); } else sfx('error'); break; }
    case 'person': { const [tid, pid] = arg.split(':'); showPerson(+tid, +pid); break; }
    case 'fulfil': { const n = nbAt(sel); if (n && fulfil(n)) { sfx('quest'); haptic('medium'); refreshSheet(); } else sfx('error'); break; }
    case 'invite': { const n = sel && nbAt(sel); if (n && invite(n)) { closeSheet(); } break; }
  }
}
function bindActions(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el || !root.contains(el)) return;
    if (el.classList.contains('disabled')) { sfx('error'); return; }
    if (el.dataset.act !== 'close') sfx('tap');
    act(el.dataset.act, el.dataset.arg, el);
  });
}

// ---------------- map taps ----------------
let lastBirds = -1e9;
export function handleTap(px, py) {
  resumeAudio();
  const tile = pickTile(px, py);
  if (!tile) return;
  const mode = M.mode;
  if (!mode && ST.tapLost(tile.x, tile.y)) { sfx('quest'); haptic('medium'); return; }
  if (!mode && cam.tw >= TILE_MODE_TW) { const bt = world.biome[tile.y * W + tile.x]; if (!S.buildings.has(tile.y * W + tile.x) && (bt === B.FOREST || bt === B.JUNGLE || bt === B.TAIGA) && Math.random() < 0.2 && performance.now() - lastBirds > 30000) { lastBirds = performance.now(); scatterBirds(px, py); } }
  if (!mode && cam.tw >= TILE_MODE_TW) { const w = walkerAt(px, py); if (w && w.pid) { sfx('tap'); showPerson(w.town, w.pid); return; } }
  if (mode && mode.kind === 'start') return startTap(tile);
  if (mode && mode.kind === 'move') {
    const r = moveBuilding(mode.from, tile.x, tile.y);
    if (r.ok) { sfx('place'); haptic('medium'); setMode(null); toast('Moved.'); } else { sfx('error'); toast(r.reason); }
    return;
  }
  if (mode && mode.kind === 'build') {
    const r = placeBuilding(mode.type, tile.x, tile.y, !!mode.flip);
    if (r.ok) { sfx('place'); haptic('medium'); if (DEFS[mode.type].wonder) { setMode(null); toast(`Work begins on the ${DEFS[mode.type].name}!`, true); } }
    else { sfx('error'); toast(r.reason); }
    return;
  }
  if (mode && mode.kind === 'zone') { paintAt(tile); return; }
  if (mode && mode.kind === 'found') {
    if (cam.tw < TILE_MODE_TW) { // zoom in first so the exact tile can be chosen
      M.selected = tile; flyTo(tile.x, tile.y, 40, 0.9); return;
    }
    const r = foundTown(tile.x, tile.y);
    if (r.ok) { sfx('tier'); haptic('medium'); setMode(null); flyTo(tile.x, tile.y, 56); }
    else { sfx('error'); toast(r.reason); }
    return;
  }
  // Normal: select. In overview, snap to nearby markers.
  if (cam.tw < TILE_MODE_TW) {
    let best = null, bd = 16 * 16;
    const cand = [...S.towns.map((t) => ({ x: t.x, y: t.y })), ...S.neighbors.filter((n) => !n.joined).map((n) => ({ x: n.x, y: n.y }))];
    for (const c of cand) { const dx = sx(tileWX(c.x, c.y)) - px, dy = sy(tileWY(c.y)) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; } }
    if (best) { showInfo(best.x, best.y); flyAbove(best.x, best.y, Math.max(cam.tw, 36)); return; }
  }
  if (M.selected && M.selected.x === tile.x && M.selected.y === tile.y && sheetKind === 'info') { closeSheet(); return; }
  sfx('tap');
  showInfo(tile.x, tile.y);
  // Keep the chosen tile visible beside a side sheet (landscape phones).
  const { cw, ch } = screenSize();
  if (cw > ch && ch <= 520) {
    const sheetW = Math.min(380, cw * 0.48), free = cw - sheetW - 12;
    const tx = sx(tileWX(tile.x, tile.y));
    if (tx > free - 30) panBy(tx - free / 2, 0);
  }
}
let lastPaint = null, lastRoad = null;
export function paintAt(tile, erase = false) {
  if (!M.mode || M.mode.kind !== 'zone' || !tile) return;
  const zone = erase ? 'erase' : M.mode.zone;
  const key = tile.x + ',' + tile.y + zone; if (key === lastPaint) return; lastPaint = key;
  // Roads: tiles that only touch at a corner get a joining tile, so a painted road is always one connected line.
  if ((zone === 'road' || zone === 'canal') && lastRoad && !(lastRoad.x === tile.x && lastRoad.y === tile.y)) {
    const nb = (t) => [0, 1, 2, 3].map((d) => stepTile(t.x, t.y, d)).map(([x, y]) => ((x % W) + W) % W + ',' + y);
    const a = nb(lastRoad), b = new Set(nb(tile)), me = tile.x + ',' + tile.y;
    if (!a.includes(me)) { const j = a.find((k) => b.has(k)); if (j) { const [jx, jy] = j.split(',').map(Number); remember(jx, jy); setZone(zone, jx, jy); } }
  }
  remember(tile.x, tile.y);
  const ok = setZone(zone, tile.x, tile.y);
  if (zone === 'road' || zone === 'canal') lastRoad = ok || (zone === 'road' ? S.proads : S.canals).has(idxOf(wrapX(tile.x), tile.y)) ? { x: tile.x, y: tile.y } : null;
  if (ok) { sfx(zone === 'erase' ? 'tap' : 'place'); haptic(); }
}
// Android back gesture: close whatever is open; returns false when nothing was.
window.hlBack = () => {
  if (M.mode && M.mode.kind !== 'start') { setMode(null); setHover(null); return true; }
  if (sheetKind) { closeSheet(); return true; }
  return false;
};
export const endPaint = () => {
  lastPaint = null; lastRoad = null;
  if (stroke && stroke.length) { (S.undo ||= []).push(stroke); if (S.undo.length > 15) S.undo.shift(); if (M.mode && M.mode.kind === 'zone') setMode(M.mode, true); }
  stroke = null;
};
// Undo: each finger stroke remembers what its tiles held before, so it can be put back.
let stroke = null;
function remember(x, y) {
  const i = idxOf(((x % W) + W) % W, y);
  stroke ||= [];
  if (stroke.some((s) => s.i === i)) return;
  stroke.push({ i, z: S.zones.get(i) || null, r: S.proads.has(i), c: S.canals.has(i) });
}
function undoStroke() {
  const st = S.undo && S.undo.pop(); if (!st) return false;
  for (const { i, z, r, c } of st.reverse()) {
    if (S.buildings.has(i)) continue; // already built: leave it be
    if (z) S.zones.set(i, z); else S.zones.delete(i);
    if (r) S.proads.add(i); else S.proads.delete(i);
    if (c) S.canals.add(i); else S.canals.delete(i);
  }
  emit('change'); return true;
}

// ---------------- title & start ----------------
const tierNames = ['Hamlet', 'Village', 'Town', 'City', 'Kingdom'];
function ago(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}
export function showTitle() {
  $('#loading').classList.add('hidden');
  $('#title').classList.remove('hidden');
  centerOn(1000, 1400, Math.max(1.4, screenSize().ch / 700)); // gentle drifting view of Earth behind
  menuPage('main');
}
const mhead = (title) => `<div class="mpanel-head"><button class="mback" data-m="main" aria-label="Back">←</button><h2>${title}</h2></div>`;
function menuPage(page) {
  const box = $('#titlebtns');
  const slots = slotInfo(), saved = slots.filter(Boolean);
  const latest = saved.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  const freeSlot = slots.findIndex((d) => !d) + 1;
  let html = '';
  if (page === 'main') {
    html = `<div class="mlist">
      ${latest ? `<button class="mbtn primary" data-m="continue"><span class="mi">▶</span><div>Continue<small>${esc(latest.name)} · ${tierNames[latest.tier] || ''}${latest.place ? ` · ${esc(latest.place)}` : ''}</small></div></button>` : ''}
      <button class="mbtn ${latest ? '' : 'primary'}" data-m="new"><span class="mi">🌍</span><div>New Realm<small>Choose your homeland anywhere on Earth</small></div></button>
      ${saved.length ? `<button class="mbtn" data-m="load"><span class="mi">📜</span><div>Load Realm<small>${saved.length} saved realm${saved.length > 1 ? 's' : ''}</small></div></button>` : ''}
      <button class="mbtn" data-m="settings"><span class="mi">⚙️</span><div>Settings<small>Music, sounds and vibration</small></div></button>
      <button class="mbtn" data-m="trophies"><span class="mi">🏆</span><div>Trophies<small>${Object.keys(RC.trophies()).length} of ${RC.TROPHIES.length} earned</small></div></button>
      <button class="mbtn" data-m="help"><span class="mi">❓</span><div>How to Play</div></button>
      <button class="mbtn" data-m="credits"><span class="mi">✨</span><div>Credits</div></button></div>`;
  } else if (page === 'load') {
    html = mhead('Load Realm') + `<div class="slots">${slots.map((d, k) => d
      ? `<div class="slot"><button class="si" data-slot="${k + 1}" style="text-align:left"><b>${esc(d.name)}</b><small>${tierNames[d.tier] || ''}${d.pop != null ? ` · ${d.pop} folk` : ''}${d.place ? ` · ${esc(d.place)}` : ''}<br>Year ${Math.floor((d.day || 0) / 48) + 1} · played ${ago(d.savedAt)}</small></button><button class="del" data-del="${k + 1}" aria-label="Delete realm">🗑</button></div>`
      : `<button class="slot empty" data-new="${k + 1}">＋ Empty slot: begin a new realm</button>`).join('')}</div>
      <button class="mbtn" data-m="restore" style="margin-top:10px"><span class="mi">♻️</span><div>Restore from backup<small>From a backup file or code</small></div></button>`;
  } else if (page === 'restore') {
    html = mhead('Restore a realm') + `<div class="note" style="text-align:left">Choose a backup file, or paste a backup code. It goes into ${freeSlot ? `empty slot ${freeSlot}` : 'slot 1 (replacing what is there)'}.</div>
      <input type="file" id="rsfile" accept=".json,application/json,text/plain" class="text" style="font-size:14px">
      <textarea id="rscode" class="text" rows="4" placeholder="…or paste a HEARTH1: backup code here" style="font-size:12px"></textarea>
      <button class="mbtn primary" id="rsgo"><span class="mi">♻️</span><div>Restore realm</div></button>`;
  } else if (page === 'trophies') {
    const got = RC.trophies();
    html = mhead('Trophies') + `<div class="note" style="text-align:left">Earned across all your realms: ${Object.keys(got).length} of ${RC.TROPHIES.length}.</div><div class="list">${RC.TROPHIES.map(([id, ic, name, desc]) => `<div class="item" style="justify-content:flex-start;gap:12px;${got[id] ? '' : 'opacity:.5'}"><span style="font-size:24px;${got[id] ? '' : 'filter:grayscale(1)'}">${ic}</span><div style="text-align:left"><b>${name}</b><div class="meta">${desc}${got[id] ? ` · ${esc(got[id].realm || '')}` : ''}</div></div><span style="margin-left:auto">${got[id] ? '🏆' : '🔒'}</span></div>`).join('')}</div>`;
  } else if (page === 'new') {
    html = mhead('New Realm') + (freeSlot ? `<label class="note" for="rname" style="display:block;text-align:left">Name your realm</label>
      <input id="rname" class="text" maxlength="24" value="Hearthlands" autocomplete="off">
      <button class="mbtn primary" id="tgo"><span class="mi">🧭</span><div>Choose your homeland<small>Saved in slot ${freeSlot} of ${SLOT_COUNT}</small></div></button>`
      : `<div class="note">All ${SLOT_COUNT} save slots are in use. Open <b>Load Realm</b> and delete one to make room.</div><button class="mbtn" data-m="load"><span class="mi">📜</span><div>Load Realm</div></button>`);
  } else if (page === 'settings') {
    html = mhead('Settings') + settingsHTML('data-set');
  } else if (page === 'help') {
    html = mhead('How to Play') + `<div class="helptext">
      <p>Pick any spot on Earth and grow a hamlet into a kingdom. There is no way to lose, so take your time.</p>
      <h3>🌾 Zones</h3>Paint <b>Housing</b>, <b>Farmland</b>, <b>Pasture</b>, <b>Woodlot</b>, <b>Park</b>, <b>Workshops</b> and <b>Shops</b>. Your builders put them up one by one. A Builder's Yard adds more crews. The <b>Road</b> tool lays roads for free wherever you like.
      <h3>🔨 Build</h3>Place key buildings yourself: lumber camps by woods, quarries and mines by hills, docks on shores and rivers. Everyday buildings like wells, taverns and schools make towns happier.
      <h3>😊 Mood</h3>Happy towns attract families faster. Tap a town hall to see what would help.
      <h3>🏡 Folk</h3>Everyone has a name, a family, a trade and sometimes a pet. Tap anyone walking about to meet them.
      <h3>🤝 Neighbours</h3>Trade, send gifts and answer letters. Close friends may join your realm.
      <h3>🛤 Getting about</h3>Paint roads and canals, build stone bridges and mountain tunnels, and send caravans between your towns from the Realm panel.
      <h3>👪 Villagers</h3>Tap someone to rename them, see their family tree or follow them around town.
      <h3>⛵ Later on</h3>Choose a speciality for each town, build harbours, chart sea routes and raise wonders. Past Kingdom lies the Empire.
      <h3>✋ Controls</h3>Drag to move, pinch to zoom, tap to inspect. With an S Pen, the pen paints zones and a finger moves the map.</div>`;
  } else if (page === 'credits') {
    html = mhead('Credits') + `<div class="helptext">
      <p><b>Hearthlands</b>: a cosy kingdom builder on a real Earth of 8 million tiles.</p>
      <p>Map outlines: Natural Earth (public domain), via world-atlas.<br>Rivers traced by hand along their real courses.</p>
      <p>All art, music and sounds are made in code.</p>
      <p>Made with Claude Code.</p></div>`;
  }
  box.innerHTML = html;
  box.parentElement.scrollTop = 0;
  if (page === 'new' && freeSlot) {
    const inp = $('#rname'); inp.focus(); inp.select();
    const go = () => { sfx('tap'); setSlot(freeSlot); startPicking(inp.value.trim() || 'Hearthlands'); };
    $('#tgo').onclick = go; inp.onkeydown = (ev) => { if (ev.key === 'Enter') go(); };
  }
  if (page === 'restore') {
    const dest = freeSlot || 1;
    const finish = (raw) => { const ok = raw && RC.importInto(dest, raw); sfx(ok ? 'quest' : 'error'); toast(ok ? 'Realm restored!' : 'That backup could not be read.'); if (ok) menuPage('load'); };
    $('#rsgo').onclick = () => {
      const f = $('#rsfile').files && $('#rsfile').files[0];
      if (f) { f.text().then((txt) => finish(RC.parseBackup(txt))); return; }
      finish(RC.parseBackup($('#rscode').value));
    };
  }
  box.onclick = (e) => {
    initAudio();
    const m = e.target.closest('[data-m]'), play = e.target.closest('[data-slot]'), nw = e.target.closest('[data-new]'), del = e.target.closest('[data-del]'), set = e.target.closest('[data-set]');
    if (m) { sfx('tap'); if (m.dataset.m === 'continue') { if (load(latest.slot)) enterGame(); } else menuPage(m.dataset.m); return; }
    if (play) { sfx('tap'); if (load(+play.dataset.slot)) enterGame(); return; }
    if (nw) { sfx('tap'); menuPage('new'); return; }
    if (set) { const k = set.dataset.set; S.settings[k] = !S.settings[k]; flipSwitch(set, S.settings[k]); saveSettings(); applySettings(); applyVisuals(); sfx('tap'); if (k === 'haptics' && S.settings.haptics) haptic(); return; }
    if (del) {
      sfx('tap');
      if (!del.dataset.confirm) { del.dataset.confirm = 1; del.textContent = 'Sure?'; del.style.width = 'auto'; del.style.padding = '0 10px'; del.style.borderRadius = '16px'; return; }
      deleteSlot(+del.dataset.del); menuPage(slotInfo().some(Boolean) ? 'load' : 'main');
    }
  };
}
// Back to the main menu from a game in progress (saves first, no reload).
export function backToMenu() {
  save();
  closeSheet(); setMode(null);
  $('#hud').classList.add('hidden');
  S.started = false;
  // clear the realm from the map behind the menu (it is safely saved)
  S.towns = []; S.buildings = new Map(); S.zones = new Map(); S.proads = new Set(); S.occupied = new Map(); S.neighbors = []; S.nbIndex.clear(); S.routes = [];
  $('#toasts').innerHTML = '';
  clearTransient();
  emit('change');
  showTitle();
}

const REGIONS = [['Europe', 10, 50], ['Africa', 20, 5], ['Asia', 95, 35], ['N. America', -100, 42], ['S. America', -60, -15], ['Oceania', 140, -25]];
let pendingName = 'Hearthlands', startPick = null;
function lonLatToTile(lon, lat) { return { x: Math.round(((lon + 180) / 360) * 2000), y: Math.round(((90 - lat) / 180) * 4000) }; }
function startPicking(name) {
  pendingName = name;
  $('#title').classList.add('hidden');
  setMode({ kind: 'start' });
  const t = lonLatToTile(15, 25); flyTo(t.x, t.y, Math.max(screenSize().ch / 800, 1.2), 1.2);
  renderStartbar();
}
function renderStartbar() {
  const bar = $('#startbar'); bar.classList.remove('hidden');
  if (!startPick) {
    bar.innerHTML = `<h2>Choose your homeland</h2><div class="note">Pan and zoom the world, then tap any spot on land.</div>
      <div class="chips">${REGIONS.map(([n], k) => `<button data-reg="${k}">${n}</button>`).join('')}</div>`;
  } else {
    const { x, y } = startPick, info = describeTile(x, y), ok = canStart(x, y), sv = surveyStart(x, y);
    const stars = (v, max) => { const n = Math.max(0, Math.min(3, Math.round((v / max) * 3))); return '★'.repeat(n) + '☆'.repeat(3 - n); };
    bar.innerHTML = `<h2>${esc(info.place)}</h2><div class="note">${info.biome} · ${info.coord}</div>`
      + (ok.ok ? `<div class="kv" style="margin:4px auto"><span>Woodland</span><span class="stars">${stars(sv.wood, 60)}</span><span>Hills & stone</span><span class="stars">${stars(sv.hills, 25)}</span><span>Farmland</span><span class="stars">${stars(sv.farm, 120)}</span><span>Coast</span><span class="stars">${stars(sv.water, 20)}</span></div>`
        : `<div class="warn">${ok.reason}</div>`)
      + `<div class="row" style="justify-content:center"><button class="btn small" data-reg="back">Look elsewhere</button>${ok.ok ? '<button class="btn primary" data-reg="go">Settle here</button>' : ''}</div>`;
  }
  bar.onclick = (e) => {
    const b = e.target.closest('[data-reg]'); if (!b) return;
    sfx('tap');
    const r = b.dataset.reg;
    if (r === 'back') { startPick = null; M.selected = null; markDirty(); renderStartbar(); return; }
    if (r === 'go') { beginRealm(); return; }
    const [, lon, lat] = REGIONS[+r]; const t = lonLatToTile(lon, lat); flyTo(t.x, t.y, 6, 1.1);
  };
}
function startTap(tile) {
  sfx('tap');
  startPick = tile; M.selected = tile; markDirty();
  if (cam.tw < 6) flyTo(tile.x, tile.y, 10, 0.9);
  renderStartbar();
}
function beginRealm() {
  const { x, y } = startPick;
  newGame(pendingName, x, y);
  startPick = null; M.selected = null;
  $('#startbar').classList.add('hidden');
  setMode(null);
  enterGame(true);
  sfx('tier'); haptic('medium');
}
export function enterGame(fresh) {
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  requestAnimationFrame(() => window.measureHUD && window.measureHUD());
  questSig = '';
  updateHUD();
  const c = S.towns.find((t) => t.capital) || S.towns[0];
  if (fresh) { flyTo(c.x, c.y, 64, 2.2); setTimeout(() => toast(`Welcome to ${S.name}!`, true), 900);  }
  else { if (S.cam.tw < 2) centerOn(c.x, c.y, 56); clampCam(); toast(`Welcome back to ${S.name}.`); }
  markDirty();
}

// ---------------- wiring ----------------
export function initUI() {
  buildHUD();
  // Keep goals and notifications just below the top bar, however tall it gets
  // (system font size and display zoom on Samsung phones can make it wrap taller).
  const measure = () => {
    const r = $('#topbar').getBoundingClientRect();
    if (r.height) document.documentElement.style.setProperty('--hud-bottom', `${Math.round(r.bottom)}px`);
  };
  if (window.ResizeObserver) new ResizeObserver(measure).observe($('#topbar'));
  window.addEventListener('resize', measure);
  window.measureHUD = measure;
  for (const el of [$('#sheet'), $('#modebar')]) {
    el.addEventListener('pointerdown', () => { touchingUI = true; });
    const release = () => { setTimeout(() => { touchingUI = false; }, 60); };
    el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release); el.addEventListener('pointerleave', release);
  }
  bindActions($('#sheetbody'));
  bindActions($('#modebar'));
  let pending = false;
  const refresh = () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; updateHUD(); if (sheetKind && sheetKind !== 'menu') refreshSheet(); if (M.mode && M.mode.kind === 'build') setMode(M.mode, true); markDirty(); });
  };
  on('tick', refresh); on('change', refresh);
  on('built', ({ b }) => { if (DEFS[b.t].wonder) { toast(`The ${DEFS[b.t].name} is complete!`, true); sfx('tier'); } else sfx('built'); markDirty(); });
  on('tier', (t) => { toast(`Your realm is now ${/^[AEIOU]/.test(TIERS[t].name) ? 'an' : 'a'} ${TIERS[t].name}!`, true); sfx('tier'); haptic('medium'); });
  on('golden', () => toast('🌟 A golden age begins! Everything your realm makes is 10% richer.', true));
  on('quest', (q) => { setTimeout(() => { toast(`Goal complete: ${q.text}`); sfx('quest'); }, 300); questSig = ''; });
  on('toast', (m) => toast(m));
  on('season', ({ index, lat }) => {
    const cold = Math.abs(lat) > 30;
    const msg = [
      'Spring arrives. The fields wake and blossom opens.',
      cold ? 'Summer is here: long days and growing crops.' : 'Summer is here.',
      cold ? 'Autumn: harvest time, and the woods turn gold.' : 'Autumn: harvest time.',
      cold ? 'Winter settles in. The fields rest until spring.' : 'Winter comes, mild and gentle here.',
    ][index];
    toast(`${SEASON_ICONS[index]} ${msg}`);
  });
  on('joined', () => sfx('tier'));
  on('request', (n) => { toast(`✉ A letter from ${n.leader} of ${n.name}`); sfx('coin'); });
  on('story', ({ text }) => toast(text));
  on('folk', (text) => toast(`🏡 ${text}`));
  on('trophy', (t) => { toast(`🏆 Achievement: ${t[1]} ${t[2]}`, true); sfx('tier'); });
  on('request2', (q) => toast(`📌 ${q.who} has a small request.`));
  on('tier', (t) => { if (t === 1) hint('explore', 'New things to do: send <b>explorers</b> to wonders of the world, hold a <b>festival</b> each season, and help villagers with small <b>requests</b>. Find them in the Realm panel and town halls.', '#bottombar [data-tab=realm]'); });
  on('marketday', ({ t, visitors }) => { if (visitors.length) toast(`🛒 Market day in ${t.name}! Wagons from ${visitors.map((n) => n.name).join(', ')}.`); });
  on('tier', (t) => {
    if (t === 1) {
      hint('spec', 'Towns can now choose a <b>speciality</b>: Farming, Crafts, Trade, Industry or Learning. Open a town hall to pick one. Bigger buildings also have a little <b>upkeep</b>; if it can\'t be paid they simply rest (💤) until it can.', null);
      hint('everyday', 'Your realm is a Village! New <b>Everyday</b> buildings (well, chapel, tavern…) make towns happier, and happy towns grow faster. You can now make <b>goods</b> too, and build your region\'s <b>specialty</b>.', '#bottombar [data-tab=build]');
    }
    if (t === 3) hint('wonders2', 'Four new regional wonders await: a Cliff Monastery, a Great Bridge, an Observatory and a Botanical Dome. Look under Build → Wonders.', '#bottombar [data-tab=build]');
  });
  on('stepped', () => {
    if (S.towns.some((t) => (t.folk || []).length >= 12)) hint('folk', 'Everyone in your realm has a name, a family and a trade now. <b>Tap anyone walking about</b> to meet them!', null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { if (M.mode && M.mode.kind !== 'start') setMode(null); else closeSheet(); }
    if (e.key === ' ' && S.started) { S.speed = S.speed ? 0 : 1; updateHUD(); e.preventDefault(); }
  });
}
export const sheetOpen = () => !!sheetKind;
