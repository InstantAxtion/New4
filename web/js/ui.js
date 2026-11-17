// HUD, menus, sheets and interaction modes.
import { world, B, idxOf, wrapX, tileWX, tileWY, tileLat, W } from './world.js';
import { S, M, RES, RES_NAMES, TIERS, DEFS, ZONES, FOUND_COST, on, emit, totalPop, totalCap, townById, wonderStarted, count, placeBuilding, setZone, demolish, foundTown, doTrade, gift, invite, activeQuests, caps, CHAPTERS, currentChapter, acceptContract, declineContract, sendContract, RESEARCH, hasTech, pickResearch, talentsFree, takeTalent, startCaravan, stopCaravan, moveBuilding, turnBuilding, currentSlot as CUR, setSpec, GOODS, IMPROVEMENTS, improve, routeOptions, openRoute, fulfil, nbExtra, save, resetSave, saveSettings } from './game.js';
import { panBy, cam, markDirty, flyTo, screenSize, TILE_MODE_TW, sx, sy, pickTile, setHover, celebrate, onFirework } from './render.js';
import { initAudio, sfx, haptic, applySettings, resumeAudio } from './audio.js';
import { tutorialActive, hint } from './tutorial.js';
import { personById, petOf } from './folk.js';
import { walkerAt } from './render.js';
import { scatterBirds } from './alive.js';
import { stepTile, moonIcon } from './life.js';
import * as XP from './explore.js';
import * as ST from './stories.js';
import * as RC from './records.js';
import * as WAR from './war.js';
import { seasonIndex, SEASONS, SEASON_ICONS, nightAt } from './seasons.js';

import { showArmy } from './ui/army.js';
import { showBuild } from './ui/build.js';
import { $, ICON, bIcon, costChips, esc, fmt, setHTML, zIcon, zoneInfo } from './ui/common.js';
import { showPerson, treeCard } from './ui/people.js';
import { showProgress, showYear, tierCard } from './ui/progress.js';
import { showBackup, showExplore, showHistory, showJournal, showRealm } from './ui/realm.js';
import { showResearch } from './ui/research.js';
import { applyVisuals, flipSwitch, showMenu } from './ui/settings.js';
import { backToMenu, startTap } from './ui/title.js';
import { showInfo } from './ui/town.js';
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
  if (pendingSheet) { const f = pendingSheet; pendingSheet = null; setTimeout(() => { if (!sheetKind) f(); }, 400); }
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
// ---------------- modes ----------------
export function setMode(mode, background = false) {
  M.mode = mode;
  const bar = $('#modebar');
  document.body.classList.toggle('moding', !!mode && mode.kind !== 'start');
  if (!mode || mode.kind === 'start') { bar.classList.add('hidden'); markDirty(); highlightBottom(); return; }
  let html = '';
  if (mode.kind === 'build' || mode.kind === 'move') {
    const d = DEFS[mode.type];
    html = `<div class="minfo"><span class="mimg"><img src="${bIcon(mode.type)}" alt="" style="${mode.flip ? 'transform:scaleX(-1)' : ''}"></span>
      <div class="mtext"><b>${mode.kind === 'move' ? 'Move: ' : ''}${d.name}</b><small>${mode.kind === 'move' ? 'Tap a green spot to move it there. Free of charge.' : esc((d.desc || 'Tap a green spot on the map to place it.').split('. ')[0].replace(/\.$/, '')) + '.'}</small>${mode.kind === 'build' ? `<div class="cost">${costChips(d.cost)}</div>` : ''}</div></div>
      <div class="mact">${mode.kind === 'build' ? `<button class="pill" data-act="flip">⟲ Turn</button>` : ''}<button class="pill done" data-act="cancelmode">✓ Done</button></div>`;
    bar.className = 'buildbar';
  } else if (mode.kind === 'zone') {
    const tile = (k, name, img, extra = '') => `<button class="ztile ${mode.zone === k ? 'on' : ''} ${extra}" data-act="zone" data-arg="${k}"><span class="zimg">${img}</span><span class="zname">${name}</span></button>`;
    const zt = (k) => { const z = ZONES[k], locked = DEFS[z.builds].tier > S.tier; return tile(k, z.name, `<img src="${zIcon(z.builds)}" alt="">${locked ? '<i class="zlock">🔒</i>' : ''}<i class="zdot" style="background:${z.color}"></i>`, locked ? 'locked' : ''); };
    const group = (label, items) => `<div class="zgroup"><div class="zglabel">${label}</div><div class="zgitems">${items}</div></div>`;
    html = `<div class="zinfo">${zoneInfo(mode.zone)}</div>
      <div class="zrow"><div class="zscroll">
        ${group('Zones', zt('housing') + zt('farmland') + zt('workshop'))}
        ${group('Paths', tile('road', 'Road', '<span class="zsw road"></span>') + tile('canal', 'Canal', '<span class="zsw canal"></span>'))}
        ${group('Tidy', tile('erase', 'Erase', '<span class="zsw erase"></span>'))}
      </div>
      <div class="zact"><button class="pill ${S.undo && S.undo.length ? '' : 'disabled'}" data-act="undo" aria-label="Undo">↶ Undo</button><button class="pill done" data-act="cancelmode">✓ Done</button></div></div>`;
    bar.className = 'zones';
    if (!S.settings.zoneHint && !tutorialActive()) { S.settings.zoneHint = true; saveSettings(); toast('Paint with your finger or S Pen. Two fingers move the map (with the S Pen, one finger does).'); }
  } else if (mode.kind === 'found') {
    html = `<div class="minfo"><span class="mimg">🧭</span><div class="mtext"><b>Found a settlement</b><small>Tap any open land on Earth for your settlers.</small><div class="cost">${costChips(FOUND_COST)}</div></div></div><div class="mact"><button class="pill done" data-act="cancelmode">✕ Cancel</button></div>`;
    bar.className = 'buildbar';
  }
  const sc = bar.querySelector('.zscroll'), keepX = sc ? sc.scrollLeft : 0, keepY = sc ? sc.scrollTop : 0;
  if (!(background && touchingUI)) setHTML(bar, html); // a background refresh never redraws under a finger
  { const sc2 = bar.querySelector('.zscroll'); if (sc2) { sc2.scrollLeft = keepX; sc2.scrollTop = keepY; } }
  bar.classList.remove('hidden');
  markDirty(); highlightBottom();
}

// ---------------- HUD ----------------
function buildHUD() {
  $('#resbar').innerHTML = RES.map((r) => `<div class="res" id="res-${r}" title="${RES_NAMES[r]}">${ICON[r]}<div class="rv"><span class="v">0</span><small class="flat">+0</small></div></div>`).join('')
    + `<div class="res" id="res-pop" title="Villagers">${ICON.pop}<div class="rv"><span class="v">0</span><small class="flat">/0</small></div></div>`;
  $('#goodsbar').innerHTML = GOODS.map((r) => `<div class="res" id="res-${r}" title="${RES_NAMES[r]}">${ICON[r]}<div class="rv"><span class="v">0</span><small class="flat">+0</small></div></div>`).join('');
  $('#speed').innerHTML = [[0, '❚❚', 'Pause'], [1, '▶', 'Play'], [2, '▶▶', 'Double speed']].map(([v, l, a]) => `<button data-speed="${v}" aria-label="${a}">${l}</button>`).join('');
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.speed = +b.dataset.speed; sfx('tap'); updateHUD();
  });
  $('#bottombar').innerHTML = [
    ['build', '🔨', 'Build'], ['zones', '🌾', 'Zones'], ['research', '📚', 'Research'], ['army', '⚔️', 'Army'], ['realm', '🏰', 'Realm'], ['menu', '☰', 'Menu'],
  ].map(([k, ic, l]) => `<button data-tab="${k}"><span class="ic">${ic}</span>${l}</button>`).join('');
  $('#bottombar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx('tap');
    const tab = b.dataset.tab;
    if (sheetKind === tab) { closeSheet(); return; }
    if (tab === 'zones') { closeSheet(); setMode(M.mode && M.mode.kind === 'zone' ? null : { kind: 'zone', zone: 'housing' }); return; }
    setMode(null);
    ({ build: showBuild, realm: showRealm, menu: showMenu, research: showResearch, army: showArmy })[tab]();
  });
  $('#pring').addEventListener('click', () => { sfx('tap'); if (sheetKind === 'progress') closeSheet(); else { setMode(null); showProgress(); } });
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
const lastRes = {}; let lastDot = 0;
const LATE_GOODS = { pottery: 'potter', glass: 'glassworks', spices: 'spicehouse', books: 'scriptorium', flour: 'gristmill', wool: 'pasture' };
export function updateHUD() {
  if (!S.started) return;
  $('#realmname').textContent = S.name;
  $('#tierbadge').textContent = TIERS[S.tier].name;
  { const p = totalPop(), next = TIERS[S.tier + 1], f = next ? Math.max(0, Math.min(1, (p - TIERS[S.tier].pop) / (next.pop - TIERS[S.tier].pop))) : 1, ring = $('#pring');
    if (ring) { ring.style.setProperty('--p', f); ring.title = next ? `${Math.floor(p)} / ${next.pop} villagers to ${next.name}` : 'Highest tier'; } }
  if (performance.now() - lastDot > 3000) { lastDot = performance.now(); const rb = $('#bottombar [data-tab=research]'); if (rb) rb.classList.toggle('dot', !(S.research && S.research.cur) || talentsFree() > 0); const ab = $('#bottombar [data-tab=army]'); if (ab) ab.classList.toggle('dot', !!(S.raids && S.raids.length)); }
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
    { const cap = caps()[r]; const full = cap !== Infinity && S.res[r] >= cap * 0.97; el.classList.toggle('full', full); if (full) { sm.textContent = 'full'; } el.title = `${RES_NAMES[r]}${cap !== Infinity ? ` · holds ${cap}` : ''}`; }
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
export function resetQuests() { questSig = ''; }
function renderQuests(force) {
  const qs = activeQuests();
  const done = S.questsDone.size;
  if (seenGoals < 0) seenGoals = done;
  const fresh = done - seenGoals;
  const sig = qs.map((q) => q.id).join(',') + '|' + fresh + '|' + done;
  if (sig === questSig && !force) return;
  questSig = sig;
  const open = $('#quests').classList.contains('open');
  $('#quests').innerHTML = `<button class="qbtn" aria-label="Goals">📜<span class="qbadge ${fresh > 0 && !open ? 'on' : ''}">${fresh > 0 ? fresh : ''}</span></button>
    <div class="qpanel">${(() => { const c = currentChapter(); if (!c) return '<h3>Every chapter complete</h3>'; const n = c.goals.filter((g) => S.questsDone.has(g)).length;
      return `<h3>${c.icon} Chapter ${CHAPTERS.indexOf(c) + 1}: ${c.name} <span>${n}/${c.goals.length}</span></h3><div class="meter" style="margin:4px 0"><div style="width:${(n / c.goals.length) * 100}%"></div></div><div class="reward">Chapter reward: ${Object.entries(c.reward).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ')}</div>`; })()}
    <ul>${qs.map((q) =>
    `<li><div>${esc(q.text)}<span class="reward">Reward: ${Object.entries(q.reward).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ')}</span></div></li>`).join('') || '<li>Every goal complete. Your realm is a wonder.</li>'}</ul></div>`;
}

// ---------------- build menu ----------------
export let buildTab = 'buildings';
export let renaming = null;
let pendingSheet = null, lastBuiltSfx = 0;
function showWhenFree(fn) { if (!sheetKind && !(M.mode && M.mode.kind !== 'start') && !tutorialActive()) fn(); else pendingSheet = fn; }
// ---------------- research & talents ----------------
export let progTab = 'research';
// Volume sliders update live without redrawing the panel (so the thumb never jumps out from under the finger).
document.addEventListener('input', (e) => {
  const k = e.target && e.target.dataset && e.target.dataset.vol; if (!k) return;
  const v = +e.target.value / 100;
  S.settings.vol = { ...(S.settings.vol || {}), [k]: v };
  const out = document.querySelector(`[data-volv="${k}"]`); if (out) out.textContent = Math.round(v * 100) + '%';
  initAudio(); applySettings();
});
document.addEventListener('change', (e) => { if (e.target && e.target.dataset && e.target.dataset.vol) { saveSettings(); if (e.target.dataset.vol === 'sfx') sfx('tap'); } });
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
    case 'ptab': progTab = arg; refreshSheet(true); break;
    case 'research': { const r = RESEARCH.find((q) => q.id === arg); if (r && hasTech(r.id)) toast(`${r.name}: ${r.desc}`); else if (pickResearch(arg)) { sfx('tap'); refreshSheet(true); } else if (r) { sfx('error'); toast('Learn what it needs first.'); } break; }
    case 'talent': if (takeTalent(arg)) { sfx('quest'); haptic('medium'); refreshSheet(true); } else sfx('error'); break;
    case 'trait': if (ST.chooseTrait(arg)) { sfx('quest'); haptic('medium'); refreshSheet(true); } break;
    case 'caccept': if (acceptContract(+arg)) { sfx('quest'); refreshSheet(true); } break;
    case 'cdecline': declineContract(+arg); refreshSheet(true); break;
    case 'csend': if (sendContract(+arg)) { sfx('coin'); haptic(); refreshSheet(true); } else sfx('error'); break;
    case 'progress': showProgress(); break;
    case 'yearrep': if (S.lastReport) showYear(S.lastReport); break;
    case 'muster': if (WAR.muster(+arg)) { sfx('place'); refreshSheet(true); } else sfx('error'); break;
    case 'disband': WAR.disband(); refreshSheet(true); break;
    case 'adefend': if (WAR.marchDefend(+arg)) { sfx('tap'); toast('Your army marches out.'); refreshSheet(true); } else sfx('error'); break;
    case 'aattack': if (WAR.marchAttack(+arg)) { sfx('fanfare'); toast('⚔️ Your army marches to battle!'); refreshSheet(true); } else { sfx('error'); toast('Gather an army first (Army tab).'); } break;
    case 'tribute': if (WAR.payTribute(+arg)) { sfx('coin'); refreshSheet(true); } else sfx('error'); break;
    case 'goarmy': showArmy(); break;
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
  on('tier', (t) => { toast(`Your realm is now ${/^[AEIOU]/.test(TIERS[t].name) ? 'an' : 'a'} ${TIERS[t].name}!`, true); sfx('fanfare'); haptic('heavy'); celebrate(); showWhenFree(() => tierCard(t)); });
  on('built', ({ x, y }) => { const px = sx(tileWX(x, y)), py = sy(tileWY(y)), { cw, ch } = screenSize(); if (cam.tw >= 14 && px > 0 && px < cw && py > 0 && py < ch && performance.now() - lastBuiltSfx > 600) { lastBuiltSfx = performance.now(); sfx('built'); } });
  onFirework(() => sfx('pop'));
  on('chapter', (c) => { toast(`${c.icon} Chapter complete: ${c.name}! Reward: ${Object.entries(c.reward).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ')}`, true); sfx('quest'); haptic('medium'); renderQuests(true); });
  on('fame', (t) => toast(`★ ${t.name} is now known far and wide as a ${t.fame.title}! (+10% ${RES_NAMES[t.fame.r].toLowerCase()} there)`, true));
  on('yearreport', (r) => showWhenFree(() => showYear(r)));
  on('researched', (r) => { toast(`${r.icon} Your scholars have learned ${r.name}! ${r.desc}`, true); sfx('quest'); });
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
      hint('everyday', 'Your realm is a Village! New <b>Everyday</b> buildings: wells, chapels and parks make homes roomier, and a tavern helps families settle. You can now make <b>goods</b> too, and build your region\'s <b>specialty</b>.', '#bottombar [data-tab=build]');
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
// Public interface: everything the panels export is also available from ui.js.
export * from './ui/army.js';
export * from './ui/build.js';
export * from './ui/common.js';
export * from './ui/people.js';
export * from './ui/progress.js';
export * from './ui/realm.js';
export * from './ui/research.js';
export * from './ui/settings.js';
export * from './ui/title.js';
export * from './ui/town.js';
