// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { VOLUMES, vol } from '../audio.js';
import { S } from '../game.js';
import { setNightOff } from '../seasons.js';
import { openSheet } from '../ui.js';
import { head } from './common.js';

// ---------------- settings (shared by the in-game menu and the main menu) ----------------
export function settingsHTML(attr) {
  return VOLUMES.map(([k, label]) => `<label class="slider"><span>${label}<b data-volv="${k}">${Math.round(vol(k) * 100)}%</b></span><input type="range" min="0" max="100" step="5" value="${Math.round(vol(k) * 100)}" data-vol="${k}"></label>`).join('')
    + [['haptics', 'Vibration'], ['nonight', 'Always daytime (no night)'], ['noweather', 'Always fair weather (no rain, snow, storms or fog)'], ['gentle', 'Gentle visuals (fewer effects, saves battery)']].map(([k, label]) => `<div class="toggle"><span>${label}</span><button class="switch ${S.settings[k] ? 'on' : ''}" ${attr}="${k}" aria-label="${label}" aria-pressed="${!!S.settings[k]}"></button></div>`).join('');
}

// Flip a switch on screen straight away, whatever else is redrawing.
export function applyVisuals() { setNightOff(S.settings.nonight); }

export function flipSwitch(btn, on) { if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); } }


// ---------------- menu ----------------
export function showMenu() {
  openSheet('menu', () => head('Menu', 'Hearthlands')
    + settingsHTML('data-act="set" data-arg')
    + `<div class="section"><h3>How to play</h3><div class="note">
      • <b>Zones</b>: paint Housing for homes, Farmland for food and Workshops for gold. Villagers build them over time. <b>Road</b> paints free roads, and <b>Erase</b> clears zones and roads.<br>
      • <b>Build</b>: place Lumber Camps by woods, Quarries and Mines by hills, Docks on the shore.<br>
      • Your border grows as your town grows. Watchtowers push it further.<br>
      • Trade with nearby villages and send gifts. Close friends may join your kingdom.<br>
      • Pause whenever you like, and the realm waits for you. From Village tier, keep an eye out for raiders (Army tab).<br>
      • <b>S Pen</b>: hover to see what's there. In Zones, the pen paints and fingers move the map. Hold the pen's side button to erase.</div></div>
      <div class="section"><h3>Map data</h3><div class="note">Earth outlines from Natural Earth (public domain) via world-atlas.</div></div>
      <div class="row"><button class="btn small" data-act="savenow">Save now</button>${document.body.classList.contains('native') || !document.documentElement.requestFullscreen ? '' : '<button class="btn small" data-act="fullscreen">Full screen</button>'}<button class="btn small" data-act="backup">Back up realm</button><button class="btn small primary" data-act="mainmenu">Main menu</button></div>`);
}
