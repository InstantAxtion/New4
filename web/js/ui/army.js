// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { S, townById } from '../game.js';
import { openSheet } from '../ui.js';
import { esc, head } from './common.js';
import * as WAR from '../war.js';

// ---------------- army ----------------
export function showArmy() {
  openSheet('army', () => {
    const pow = WAR.soldierPow(), a = S.army, raids = S.raids || [];
    const head2 = head('Army', S.tier < 1 ? 'Raids begin once your realm becomes a Village. A Barracks trains soldiers for its town.' : `${Math.round(WAR.soldiers())} soldiers · each fights at ${pow.toFixed(2)}×`);
    const raidHTML = raids.length ? `<div class="section warn-sec"><h3>🔥 Raiders on the march</h3><div class="list">${raids.map((r) => { const t = townById(r.to), left = Math.max(0, Math.ceil(r.start + r.days - S.day)), def = t ? WAR.defenceOf(t) : 0;
      return `<div class="item"><div><b>${esc(r.name)} → ${t ? esc(t.name) : '?'}</b><div class="meta">Arrive in ${left} day${left === 1 ? '' : 's'} · their strength <b>${r.str}</b> vs your defence <b style="color:${def >= r.str ? '#4e7a34' : '#b04a30'}">${def}</b></div></div>${a && !a.march && t && a.at !== t.id ? `<button class="btn small primary" data-act="adefend" data-arg="${t.id}">Defend</button>` : ''}</div>`; }).join('')}</div></div>` : '';
    const towns = `<div class="section"><h3>🏘️ Town defences</h3><div class="list">${S.towns.map((t) => `<div class="item"><div><b>${esc(t.name)}${t.capital ? ' 👑' : ''}</b><div class="meta">Garrison ${Math.floor(t.garrison || 0)} / ${WAR.garrisonCap(t)}${WAR.garrisonCap(t) ? '' : ' (build a Barracks)'}</div></div><span class="defv">🛡️ ${WAR.defenceOf(t)}</span></div>`).join('')}</div>
      <div class="note">Barracks train soldiers for their town. Watchtowers and Stone Forts make a town stronger. Soldiers eat a little food and are paid a little gold.</div></div>`;
    const field = `<div class="section"><h3>🚩 Field army</h3>${a ? `<div class="note">${a.n} soldiers · strength ${Math.round(WAR.armyPow())} · ${a.march ? `marching to ${a.march.kind === 'attack' ? 'attack' : 'defend'} (${Math.max(0, Math.ceil(a.march.start + a.march.days - S.day))} days)` : `stationed at ${esc((townById(a.at) || {}).name || 'the capital')}`}</div>` : '<div class="note">Gather soldiers from your garrisons into an army that can march to defend a town or take an enemy village.</div>'}
      <div class="row">${[5, 10, 25].map((k) => `<button class="btn small ${WAR.soldiers() - (a ? a.n : 0) >= 1 && !(a && a.march) ? '' : 'disabled'}" data-act="muster" data-arg="${k}">+${k} soldiers</button>`).join('')}${a && !a.march ? '<button class="btn small" data-act="disband">Send home</button>' : ''}</div>
      ${a && !a.march ? `<div class="tlabel" style="margin-top:6px">Defend a town</div><div class="row">${S.towns.filter((t) => t.id !== a.at).map((t) => `<button class="btn small" data-act="adefend" data-arg="${t.id}">${esc(t.name)}</button>`).join('') || '<span class="note">Only one town.</span>'}</div>` : ''}
      ${a && !a.march ? (() => { const ts = WAR.targets().slice(0, 8); return `<div class="tlabel" style="margin-top:6px">Attack an enemy village</div>${ts.length ? `<div class="list">${ts.map((n) => { const d = WAR.villageDefence(n), win = WAR.armyPow() >= d; return `<div class="item"><div><b>${esc(n.name)}</b><div class="meta">${esc(n.realm)} · defence ${d} · ${win ? 'you should win' : 'too strong for now'}</div></div><button class="btn small ${win ? 'leaf' : ''}" data-act="aattack" data-arg="${n.id}">Attack</button></div>`; }).join('')}</div>` : '<div class="note">No enemy villages within reach.</div>'}`; })() : ''}</div>`;
    const realms = WAR.realmList();
    const realmHTML = `<div class="section"><h3>🏰 Kingdoms nearby</h3>${realms.length ? `<div class="list">${realms.map((k) => `<div class="item"><div><b style="color:hsl(${k.hue},45%,38%)">${esc(k.name)}</b><div class="meta">${k.members.length} villages · strength ${Math.round(k.r.str)}${k.r.tribute > S.day ? ` · at peace for ${Math.ceil(k.r.tribute - S.day)} days` : ''}</div></div>${k.r.tribute > S.day ? '<span>🕊️</span>' : `<button class="btn small ${S.res.gold >= WAR.tributeCost(k.r) ? '' : 'disabled'}" data-act="tribute" data-arg="${k.r.id}">Tribute ${WAR.tributeCost(k.r)}g</button>`}</div>`).join('')}</div><div class="note">Paying tribute keeps a kingdom's raiders away for a year.</div>` : '<div class="note">No kingdoms close by. Lucky you.</div>'}</div>`;
    return head2 + raidHTML + towns + field + realmHTML;
  });
}
