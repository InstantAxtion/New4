// HUD, menus, sheets and interaction modes.
import { world, BIOMES, B, describeTile, idxOf, wrapX, tileWX, tileWY, W } from './world.js';
import {
  S, M, RES, RES_NAMES, TIERS, DEFS, MANUAL, WONDERS, ZONES, FOUND_COST, GIFT_AMOUNT, CONTACT_RANGE,
  on, emit, totalPop, totalCap, townById, hasWonder, wonderStarted, count, ownerOf, canPlace, placeBuilding, setZone,
  demolish, canFound, foundTown, inContact, tradeOffers, doTrade, gift, canInvite, invite, activeQuests, QUESTS,
  newGame, save, hasSave, load, resetSave, saveSettings, surveyStart, canStart, affordable, groundDist2, DAY_SECONDS,
} from './game.js';
import { SPR, spriteIcon } from './sprites.js';
import { panBy, cam, markDirty, flyTo, centerOn, clampCam, screenSize, TILE_MODE_TW, sx, sy, pickTile, setHover } from './render.js';
import { initAudio, sfx, haptic, applySettings, resumeAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ICON = {
  food: '<svg viewBox="0 0 24 24"><path d="M12 22V8" stroke="#9a7a3a" stroke-width="1.8" fill="none"/><g fill="#e0b84a" stroke="#b08a2a" stroke-width=".8"><ellipse cx="9.5" cy="9" rx="2" ry="3.2" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3.2" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2" ry="3.2" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2" ry="3.2" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="5" rx="1.8" ry="3"/></g></svg>',
  wood: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="17" height="9" rx="3" fill="#a06a3e" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="3.5" ry="4.5" fill="#e3c08a" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="1.5" ry="2" fill="none" stroke="#b08050" stroke-width=".8"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M3 17 6 9l6-3 6 2 3 8-4 3H7Z" fill="#a8a29a" stroke="#6e6860" stroke-width="1"/><path d="M6 9l5 3 7-4M11 12l-1 7" stroke="#857e76" stroke-width=".9" fill="none"/></svg>',
  gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8b84a" stroke="#a87a1a" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#c8962a" stroke-width="1"/><path d="M12 8v8M10 10h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3" stroke="#a87a1a" stroke-width="1.1" fill="none"/></svg>',
  iron: '<svg viewBox="0 0 24 24"><path d="M3 16 6 9h12l3 7Z" fill="#8a96a6" stroke="#4e5a6a" stroke-width="1"/><path d="M6 9h12l-2 3H8Z" fill="#b4c0ce"/></svg>',
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
export function setMode(mode) {
  M.mode = mode;
  const bar = $('#modebar');
  document.body.classList.toggle('moding', !!mode && mode.kind !== 'start');
  if (!mode || mode.kind === 'start') { bar.classList.add('hidden'); markDirty(); highlightBottom(); return; }
  let html = '';
  if (mode.kind === 'build') {
    const d = DEFS[mode.type];
    html = `<div class="mlabel"><img src="${bIcon(mode.type)}" alt=""><span>${d.name}</span></div><div class="cost">${costChips(d.cost)}</div>`;
  } else if (mode.kind === 'zone') {
    html = Object.entries(ZONES).map(([k, z]) =>
      `<button class="tool ${mode.zone === k ? 'on' : ''} ${DEFS[z.builds].tier > S.tier ? 'disabled' : ''}" data-act="zone" data-arg="${k}"><span class="sw" style="background:${z.color}"></span>${z.name}</button>`).join('')
      + `<button class="tool ${mode.zone === 'erase' ? 'on' : ''}" data-act="zone" data-arg="erase"><span class="sw erase"></span>Erase</button>`;
    if (!S.settings.zoneHint) { S.settings.zoneHint = true; saveSettings(); toast('Paint with your finger or S Pen. Two fingers move the map (with the S Pen, one finger does).'); }
  } else if (mode.kind === 'found') {
    html = `<div class="mlabel"><span>Pick land for settlers</span></div><div class="cost">${costChips(FOUND_COST)}</div>`;
  }
  html += `<button class="tool done" data-act="cancelmode"><span class="ic">✓</span>Done</button>`;
  if (!touchingUI) setHTML(bar, html);
  bar.classList.remove('hidden');
  markDirty(); highlightBottom();
}

// ---------------- HUD ----------------
function buildHUD() {
  $('#resbar').innerHTML = RES.map((r) => `<div class="res" id="res-${r}" title="${RES_NAMES[r]}">${ICON[r]}<div class="rv"><span class="v">0</span><small class="flat">+0</small></div></div>`).join('')
    + `<div class="res" id="res-pop" title="Villagers">${ICON.pop}<div class="rv"><span class="v">0</span><small class="flat">/0</small></div></div>`;
  $('#speed').innerHTML = [[0, '❚❚'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, l]) => `<button data-speed="${v}" aria-label="Speed ${l}">${l}</button>`).join('');
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
  let qOpen = false;
  try { qOpen = localStorage.getItem('hearthlands-quests-open') === '1'; } catch (e) { /* ignore */ }
  $('#quests').classList.toggle('collapsed', !qOpen);
  $('#quests').addEventListener('click', () => {
    const open = $('#quests').classList.toggle('collapsed') === false;
    try { localStorage.setItem('hearthlands-quests-open', open ? '1' : '0'); } catch (e) { /* ignore */ }
  });
}
function highlightBottom() {
  document.querySelectorAll('#bottombar button').forEach((b) => {
    const t = b.dataset.tab;
    b.classList.toggle('on', sheetKind === t || (t === 'zones' && M.mode && M.mode.kind === 'zone'));
  });
}
const lastRes = {};
export function updateHUD() {
  if (!S.started) return;
  $('#realmname').textContent = S.name;
  $('#tierbadge').textContent = TIERS[S.tier].name;
  for (const r of RES) {
    const el = $('#res-' + r); if (!el) continue;
    const v = Math.floor(S.res[r]);
    el.querySelector('.v').textContent = fmt(v);
    const rate = S.rates[r];
    const sm = el.querySelector('small');
    sm.textContent = (rate >= 0 ? '+' : '') + rate.toFixed(1);
    sm.className = rate > 0.05 ? 'up' : rate < -0.05 ? 'down' : 'flat';
    if (lastRes[r] !== undefined && v - lastRes[r] >= 10) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    lastRes[r] = v;
  }
  const pe = $('#res-pop');
  pe.querySelector('.v').textContent = Math.floor(totalPop());
  const ps = pe.querySelector('small'); ps.textContent = '/' + totalCap(); ps.className = S.fed ? 'flat' : 'down';
  const y = Math.floor(S.day / 48) + 1, season = ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor((S.day % 48) / 12)];
  $('#date').textContent = `Year ${y} · ${season} ${Math.floor(S.day % 12) + 1}`;
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed));
  renderQuests();
}
let questSig = '';
function renderQuests() {
  const qs = activeQuests();
  const sig = qs.map((q) => q.id).join(',');
  if (sig === questSig) return;
  questSig = sig;
  const done = S.questsDone.size;
  $('#quests').innerHTML = `<h3><span class="qic">📜</span><span class="qtop">${qs[0] ? esc(qs[0].text) : 'All goals complete'}</span><span class="qtitle">Gentle goals</span><span class="qcount">${done}/${QUESTS.length}</span></h3><ul>${qs.map((q) =>
    `<li><div>${esc(q.text)}<span class="reward">Reward: ${Object.entries(q.reward).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ')}</span></div></li>`).join('') || '<li>Every goal complete. Your realm is a wonder.</li>'}</ul>`;
}

// ---------------- build menu ----------------
let buildTab = 'buildings';
function showBuild() {
  openSheet('build', () => {
    const list = buildTab === 'buildings' ? MANUAL : WONDERS;
    const cards = list.map((t) => {
      const d = DEFS[t], locked = d.tier > S.tier, built = d.wonder && wonderStarted(t);
      return `<button class="card ${locked || built ? 'locked' : ''}" data-act="pick" data-arg="${t}">
        ${locked ? `<span class="lock">${TIERS[d.tier].name}</span>` : built ? '<span class="lock">Built</span>' : ''}
        <img src="${bIcon(t)}" alt=""><b>${d.name}</b><div class="cost">${costChips(d.cost)}</div>
        <p>${d.desc || ''}${d.prod ? ` Makes ${Object.entries(d.prod).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.jobs ? ` Needs ${d.jobs} workers.` : ''}</p></button>`;
    }).join('');
    return head('Build', 'Key buildings you place yourself. Homes, fields and workshops are painted with Zones.')
      + `<div class="tabs"><button data-act="btab" data-arg="buildings" class="${buildTab === 'buildings' ? 'on' : ''}">Buildings</button><button data-act="btab" data-arg="wonders" class="${buildTab === 'wonders' ? 'on' : ''}">Wonders</button></div>
      <div class="grid">${cards}</div>`;
  });
}

// ---------------- realm ----------------
function showRealm() {
  openSheet('realm', () => {
    const p = totalPop(), next = TIERS[S.tier + 1];
    const prog = next ? Math.min(1, (p - TIERS[S.tier].pop) / (next.pop - TIERS[S.tier].pop)) : 1;
    const f = canFound(0, 0);
    const foundLocked = S.tier < 1 || S.towns.length >= TIERS[S.tier].maxTowns;
    const contacts = S.neighbors.filter((n) => !n.joined && inContact(n)).sort((a, b) => b.friend - a.friend);
    return head(esc(S.name), `${TIERS[S.tier].name} · ${Math.floor(p)} villagers · ${S.towns.length} settlement${S.towns.length > 1 ? 's' : ''}`)
      + (next ? `<div class="note">Growing toward <b>${next.name}</b> at ${next.pop} villagers</div><div class="meter"><div style="width:${prog * 100}%"></div></div>` : '<div class="note">Your realm has become a true Kingdom.</div>')
      + (S.fed ? '' : '<div class="warn">The granaries are empty, so growth has paused. Zone more farmland or build a fishing dock.</div>')
      + `<div class="section"><h3>Settlements</h3><div class="list">${S.towns.map((t) =>
        `<button class="item" data-act="goto" data-arg="${t.id}"><div><b>${esc(t.name)}</b>${t.capital ? ' 👑' : ''}<div class="meta">${Math.floor(t.pop)}/${t.cap} folk · border ${t.radius.toFixed(1)}</div></div><span>➜</span></button>`).join('')}</div>
        <div class="row"><button class="btn leaf ${foundLocked ? 'disabled' : ''}" data-act="found">Found a new settlement</button><div class="cost">${costChips(FOUND_COST)}</div></div>
        ${foundLocked ? `<div class="note">${S.tier < 1 ? 'Unlocks when your realm becomes a Village.' : `A ${TIERS[S.tier].name} can hold ${TIERS[S.tier].maxTowns} settlements.`}</div>` : '<div class="note">Settlers can travel anywhere on Earth. Settle near neighbours to befriend them.</div>'}</div>
      <div class="section"><h3>Neighbours in reach</h3>${contacts.length ? `<div class="list">${contacts.slice(0, 12).map((n) =>
        `<button class="item" data-act="gonb" data-arg="${n.id}"><div><b>${esc(n.name)}</b><div class="meta">${Math.floor(n.pop)} folk · has ${n.surplus} · wants ${n.want}</div></div><span>${n.friend >= 100 ? '💛' : '🤝 ' + Math.floor(n.friend)}</span></button>`).join('')}</div>`
        : `<div class="note">No villages within ${CONTACT_RANGE} tiles yet. Explore the map or found settlements near others.</div>`}</div>
      <div class="section"><h3>Wonders</h3><div class="list">${WONDERS.map((w) => {
        const d = DEFS[w], done = hasWonder(w), st = wonderStarted(w);
        return `<div class="item"><div><b>${d.name}</b><div class="meta">${d.desc}</div></div><span>${done ? '✅' : st ? '🚧' : d.tier > S.tier ? '🔒' : '—'}</span></div>`;
      }).join('')}</div></div>`;
  });
}

// ---------------- menu ----------------
function showMenu() {
  openSheet('menu', () => head('Menu', 'Hearthlands')
    + ['music', 'sfx', 'haptics'].map((k) => `<div class="toggle"><span>${{ music: 'Music & nature sounds', sfx: 'Sound effects', haptics: 'Vibration' }[k]}</span><button class="switch ${S.settings[k] ? 'on' : ''}" data-act="set" data-arg="${k}" aria-label="${k}"></button></div>`).join('')
    + `<div class="section"><h3>How to play</h3><div class="note">
      • <b>Zones</b>: paint Housing for homes, Farmland for food and Workshops for gold. Villagers build them over time.<br>
      • <b>Build</b>: place Lumber Camps by woods, Quarries and Mines by hills, Docks on the shore.<br>
      • Your border grows as your town grows. Watchtowers push it further.<br>
      • Trade with nearby villages and send gifts. Close friends may join your kingdom.<br>
      • Nothing can go wrong. Pause whenever you like, and the realm waits for you.<br>
      • <b>S Pen</b>: hover to see what's there. In Zones, the pen paints and fingers move the map. Hold the pen's side button to erase.</div></div>
      <div class="section"><h3>Map data</h3><div class="note">Earth outlines from Natural Earth (public domain) via world-atlas.</div></div>
      <div class="row"><button class="btn small" data-act="savenow">Save now</button>${document.body.classList.contains('native') || !document.documentElement.requestFullscreen ? '' : '<button class="btn small" data-act="fullscreen">Full screen</button>'}<button class="btn small" data-act="restart">Start a new realm…</button></div>`);
}

// ---------------- tile info ----------------
export function showInfo(x, y) {
  M.selected = { x, y }; markDirty();
  openSheet('info', () => {
    const i = idxOf(x, y), info = describeTile(x, y);
    const b = S.buildings.get(i), z = S.zones.get(i), nb = S.nbIndex.get(i);
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
      if (d.prod) body += `<span>Produces</span><span>${Object.entries(d.prod).map(([k, v]) => `${(v * (b.m || 1)).toFixed(1)} ${RES_NAMES[k].toLowerCase()}/day`).join(', ')}</span>`;
      if (d.cap) body += `<span>Houses</span><span>${d.cap} villagers</span>`;
      if (d.jobs) body += `<span>Workers</span><span>${d.jobs}</span>`;
      if (b.m && b.m !== 1 && d.prod) body += `<span>Land bonus</span><span>${Math.round(b.m * 100)}%</span>`;
      if (d.radius) body += `<span>Border</span><span>+${d.radius}</span>`;
      if (d.wonder) body += `<span>Wonder</span><span>${d.desc}</span>`;
      body += '</div>';
      body += `<div class="row"><button class="btn small" data-act="demolish">${b.p < 1 ? 'Cancel construction' : 'Demolish'}</button></div>`;
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
function townInfo(t, sub) {
  const next = TIERS[S.tier + 1];
  return head(`${esc(t.name)}${t.capital ? ' 👑' : ''}`, sub)
    + `<div class="kv"><span>Villagers</span><span>${Math.floor(t.pop)} / ${t.cap}</span><span>Buildings</span><span>${t.n}</span>
      <span>Border</span><span>${t.radius.toFixed(1)} tiles</span><span>Founded</span><span>Year ${Math.floor(t.founded / 48) + 1}</span></div>
      <div class="note">${t.pop >= t.cap - 0.5 ? 'Every home is full. Zone more housing to grow.' : S.fed ? 'Families are moving in.' : 'Growth has paused until there is more food.'}</div>
      ${t.capital && next ? `<div class="note">The keep grows grander as your realm reaches ${next.name}.</div>` : ''}`;
}
function neighborInfo(n, sub) {
  const contact = inContact(n), inv = canInvite(n);
  const offers = tradeOffers(n);
  return head(esc(n.name), `Neighbouring village · ${Math.floor(n.pop)} folk`)
    + `<div class="note">${sub}</div>
    <div class="kv"><span>Has plenty of</span><span>${ICON[n.surplus].replace('<svg', '<svg width="16" height="16"')} ${RES_NAMES[n.surplus]}</span><span>Would love</span><span>${ICON[n.want].replace('<svg', '<svg width="16" height="16"')} ${RES_NAMES[n.want]}</span></div>
    <div class="note">Friendship ${Math.floor(n.friend)}/100</div><div class="meter"><div style="width:${n.friend}%"></div></div>
    ${contact ? `<div class="section"><h3>Trade</h3><div class="list">${offers.map((o, k) =>
      `<button class="item ${affordable(o.give) ? '' : 'disabled'}" data-act="trade" data-arg="${k}" ${affordable(o.give) ? '' : 'style="opacity:.5"'}><div class="cost">Give ${costChips(o.give)}</div><span>→</span><div class="cost">Get ${costChips(o.get, false)}</div></button>`).join('')}</div></div>
      <div class="section"><h3>Send a gift (${GIFT_AMOUNT})</h3><div class="row">${RES.map((r) =>
        `<button class="btn small ${S.res[r] < GIFT_AMOUNT ? 'disabled' : ''}" data-act="gift" data-arg="${r}">${ICON[r].replace('<svg', '<svg width="18" height="18" style="vertical-align:-4px"')}${r === n.want ? ' 💛' : ''}</button>`).join('')}</div>
        <div class="note">Gifts of what they want count for nearly double.</div></div>
      <div class="section"><button class="btn primary ${inv.ok ? '' : 'disabled'}" data-act="invite">Invite to join your kingdom</button>${inv.ok ? '' : `<div class="note">${inv.reason}</div>`}</div>`
    : `<div class="note">Too far for traders. Villages within ${CONTACT_RANGE} tiles of one of your settlements can trade. Found a settlement nearer to them.</div>`}`;
}

// ---------------- actions ----------------
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
    case 'cancelmode': setMode(null); setHover(null); break;
    case 'goto': { const t = townById(+arg); if (t) { closeSheet(); flyTo(t.x, t.y, 56); } break; }
    case 'gonb': { const n = S.neighbors[+arg] && S.neighbors.find((q) => q.id === +arg); if (n) { flyAbove(n.x, n.y, 48); showInfo(n.x, n.y); } break; }
    case 'found': closeSheet(); setMode({ kind: 'found' }); toast('Pick open land anywhere for your settlers.'); if (cam.tw > 30) flyTo(null, null, 10, 0.8, true); break;
    case 'set': S.settings[arg] = !S.settings[arg]; saveSettings(); applySettings(); refreshSheet(); if (arg === 'haptics' && S.settings.haptics) haptic(); break;
    case 'savenow': save(); toast('Your realm is saved.'); break;
    case 'fullscreen': if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); break;
    case 'restart':
      if (el.dataset.confirm) { resetSave(); location.reload(); }
      else { el.dataset.confirm = '1'; el.textContent = 'Tap again to abandon this realm'; el.classList.add('primary'); }
      break;
    case 'demolish': if (sel && demolish(sel.x, sel.y)) { sfx('place'); toast('Cleared.'); closeSheet(); } break;
    case 'unzone': if (sel) { setZone('erase', sel.x, sel.y); closeSheet(); } break;
    case 'openbuild': showBuild(); break;
    case 'quickzone': if (sel && setZone(arg, sel.x, sel.y)) { sfx('place'); haptic(); toast(`${ZONES[arg].name} zoned. Villagers will build here soon.`); refreshSheet(); } break;
    case 'trade': { const n = sel && S.nbIndex.get(idxOf(sel.x, sel.y)); if (n && doTrade(n, +arg)) { sfx('coin'); haptic(); toast(`Traded with ${n.name}.`); refreshSheet(); } else sfx('error'); break; }
    case 'gift': { const n = sel && S.nbIndex.get(idxOf(sel.x, sel.y)); if (n && gift(n, arg)) { sfx('coin'); haptic(); toast(`${n.name} is delighted by your gift!`); refreshSheet(); } break; }
    case 'invite': { const n = sel && S.nbIndex.get(idxOf(sel.x, sel.y)); if (n && invite(n)) { closeSheet(); } break; }
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
export function handleTap(px, py) {
  resumeAudio();
  const tile = pickTile(px, py);
  if (!tile) return;
  const mode = M.mode;
  if (mode && mode.kind === 'start') return startTap(tile);
  if (mode && mode.kind === 'build') {
    const r = placeBuilding(mode.type, tile.x, tile.y);
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
let lastPaint = null;
export function paintAt(tile, erase = false) {
  if (!M.mode || M.mode.kind !== 'zone' || !tile) return;
  const zone = erase ? 'erase' : M.mode.zone;
  const key = tile.x + ',' + tile.y + zone; if (key === lastPaint) return; lastPaint = key;
  if (setZone(zone, tile.x, tile.y)) { sfx(zone === 'erase' ? 'tap' : 'place'); haptic(); }
}
// Android back gesture: close whatever is open; returns false when nothing was.
window.hlBack = () => {
  if (M.mode && M.mode.kind !== 'start') { setMode(null); setHover(null); return true; }
  if (sheetKind) { closeSheet(); return true; }
  return false;
};
export const endPaint = () => { lastPaint = null; };

// ---------------- title & start ----------------
export function showTitle() {
  $('#loading').classList.add('hidden');
  $('#title').classList.remove('hidden');
  const btns = $('#titlebtns');
  btns.innerHTML = (hasSave() ? '<button class="btn primary" id="tcont">Continue your realm</button>' : '')
    + `<button class="btn ${hasSave() ? '' : 'primary'}" id="tnew">Begin a new realm</button>`;
  // Gentle drifting background view of Earth
  centerOn(1000, 1400, Math.max(1.4, screenSize().ch / 700));
  if ($('#tcont')) $('#tcont').onclick = () => { initAudio(); sfx('tap'); if (load()) enterGame(); };
  $('#tnew').onclick = () => {
    initAudio(); sfx('tap');
    if (hasSave() && !$('#tnew').dataset.confirm) { $('#tnew').dataset.confirm = 1; $('#tnew').textContent = 'Tap again: this replaces your saved realm'; return; }
    btns.innerHTML = `<label class="note" for="rname" style="display:block;text-align:left">Name your realm</label>
      <input id="rname" class="text" maxlength="24" value="Hearthlands" autocomplete="off">
      <button class="btn primary" id="tgo">Choose your homeland</button>`;
    const inp = $('#rname'); inp.focus(); inp.select();
    const go = () => { sfx('tap'); startPicking(inp.value.trim() || 'Hearthlands'); };
    $('#tgo').onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  };
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
  questSig = '';
  updateHUD();
  const c = S.towns.find((t) => t.capital) || S.towns[0];
  if (fresh) { flyTo(c.x, c.y, 64, 2.2); setTimeout(() => toast(`Welcome to ${S.name}!`, true), 900); setTimeout(() => toast('Tap Zones and paint Farmland near your hall to begin.'), 3200); }
  else { if (S.cam.tw < 2) centerOn(c.x, c.y, 56); clampCam(); toast(`Welcome back to ${S.name}.`); }
  markDirty();
}

// ---------------- wiring ----------------
export function initUI() {
  buildHUD();
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
    requestAnimationFrame(() => { pending = false; updateHUD(); if (sheetKind && sheetKind !== 'menu') refreshSheet(); if (M.mode && M.mode.kind === 'build') setMode(M.mode); markDirty(); });
  };
  on('tick', refresh); on('change', refresh);
  on('built', ({ b }) => { if (DEFS[b.t].wonder) { toast(`The ${DEFS[b.t].name} is complete!`, true); sfx('tier'); } else sfx('built'); markDirty(); });
  on('tier', (t) => { toast(`Your realm is now a ${TIERS[t].name}!`, true); sfx('tier'); haptic('medium'); });
  on('quest', (q) => { setTimeout(() => { toast(`Goal complete: ${q.text}`); sfx('quest'); }, 300); questSig = ''; });
  on('toast', (m) => toast(m));
  on('joined', () => sfx('tier'));
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { if (M.mode && M.mode.kind !== 'start') setMode(null); else closeSheet(); }
    if (e.key === ' ' && S.started) { S.speed = S.speed ? 0 : 1; updateHUD(); e.preventDefault(); }
  });
}
export const sheetOpen = () => !!sheetKind;
