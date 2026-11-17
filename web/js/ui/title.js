// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { applySettings, haptic, initAudio, sfx } from '../audio.js';
import { M, S, SLOT_COUNT, canStart, deleteSlot, emit, load, newGame, save, saveSettings, setSlot, slotInfo, surveyStart } from '../game.js';
import { cam, centerOn, clampCam, clearTransient, flyTo, markDirty, screenSize } from '../render.js';
import { closeSheet, resetQuests, setMode, toast, updateHUD } from '../ui.js';
import { describeTile } from '../world.js';
import { $, esc } from './common.js';
import { applyVisuals, flipSwitch, settingsHTML } from './settings.js';
import * as RC from '../records.js';

// ---------------- title & start ----------------
export const tierNames = ['Hamlet', 'Village', 'Town', 'City', 'Kingdom'];

export function ago(ts) {
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

export const mhead = (title) => `<div class="mpanel-head"><button class="mback" data-m="main" aria-label="Back">←</button><h2>${title}</h2></div>`;

export function menuPage(page) {
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
      <p>Pick any spot on Earth and grow a hamlet into a kingdom at your own pace. Your capital can never be lost, but neighbouring kingdoms may raid your other towns, so keep a garrison.</p>
      <h3>🌾 Zones</h3>Paint <b>Housing</b>, <b>Farmland</b>, <b>Pasture</b>, <b>Woodlot</b>, <b>Park</b>, <b>Workshops</b> and <b>Shops</b>. Your builders put them up one by one. A Builder's Yard adds more crews. The <b>Road</b> tool lays roads for free wherever you like.
      <h3>🔨 Build</h3>Place key buildings yourself: lumber camps by woods, quarries and mines by hills, docks on shores and rivers. Everyday buildings like wells, taverns and schools make towns happier.
      <h3>😊 Mood</h3>Happy towns attract families faster. Tap a town hall to see what would help.
      <h3>🏡 Folk</h3>Everyone has a name, a family, a trade and sometimes a pet. Tap anyone walking about to meet them.
      <h3>🤝 Neighbours</h3>Trade, send gifts and answer letters. Close friends may join your realm.
      <h3>🛤 Getting about</h3>Paint roads and canals, build stone bridges and mountain tunnels, and send caravans between your towns from the Realm panel.
      <h3>👪 Villagers</h3>Tap someone to rename them, see their skills and family tree, or follow them around town. Workers get better the longer they do the same job.
      <h3>📚 Research</h3>Pick an idea to study and spend talent points as your realm grows.
      <h3>⚔️ Army</h3>From Village tier, neighbouring kingdoms may send raiders. Build Barracks, Watchtowers and Forts, raise a field army to defend or attack, or pay tribute for peace.
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


export const REGIONS = [['Europe', 10, 50], ['Africa', 20, 5], ['Asia', 95, 35], ['N. America', -100, 42], ['S. America', -60, -15], ['Oceania', 140, -25]];

export let pendingName = 'Hearthlands', startPick = null;

export function lonLatToTile(lon, lat) { return { x: Math.round(((lon + 180) / 360) * 2000), y: Math.round(((90 - lat) / 180) * 4000) }; }

export function startPicking(name) {
  pendingName = name;
  $('#title').classList.add('hidden');
  setMode({ kind: 'start' });
  const t = lonLatToTile(15, 25); flyTo(t.x, t.y, Math.max(screenSize().ch / 800, 1.2), 1.2);
  renderStartbar();
}

export function renderStartbar() {
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

export function startTap(tile) {
  sfx('tap');
  startPick = tile; M.selected = tile; markDirty();
  if (cam.tw < 6) flyTo(tile.x, tile.y, 10, 0.9);
  renderStartbar();
}

export function beginRealm() {
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
  resetQuests();
  updateHUD();
  const c = S.towns.find((t) => t.capital) || S.towns[0];
  if (fresh) { flyTo(c.x, c.y, 64, 2.2); setTimeout(() => toast(`Welcome to ${S.name}!`, true), 900);  }
  else { if (S.cam.tw < 2) centerOn(c.x, c.y, 56); clampCam(); toast(`Welcome back to ${S.name}.`); }
  markDirty();
}
