// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { CARAVAN_COST, CONTACT_RANGE, DEFS, FOUND_COST, RES_NAMES, ROUTE_COST, ROUTE_DAYS, S, TIERS, WONDERS, affordable, caravanPairs, harbourTowns, hasWonder, inContact, maxCaravans, maxTowns, prestige, prestigeRank, realmContinents, routeOptions, totalPop, townById, wonderStarted } from '../game.js';
import { openSheet } from '../ui.js';
import { $, costChips, esc, head } from './common.js';
import * as RC from '../records.js';
import * as ST from '../stories.js';
import * as XP from '../explore.js';

// ---------------- realm ----------------
export function showRealm() {
  openSheet('realm', () => {
    const p = totalPop(), next = TIERS[S.tier + 1];
    const prog = next ? Math.min(1, (p - TIERS[S.tier].pop) / (next.pop - TIERS[S.tier].pop)) : 1;
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
      ${contractSection()}${requestsSection()}${royalSection()}${exploreSection()}${caravanSection()}
      <div class="row"><button class="btn small" data-act="progress">🏆 Progress</button>${S.lastReport ? '<button class="btn small" data-act="yearrep">📖 Last year</button>' : ''}</div>
      <div class="row"><button class="btn small" data-act="history">📈 Realm history</button><button class="btn small" data-act="budget">💰 Budget &amp; taxes</button></div>
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
export function requestsSection() {
  const rq = S.requests || [];
  if (!rq.length) return '';
  return `<div class="section"><h3>📌 Requests from your folk</h3><div class="list">${rq.map((q, k) => {
    const t = townById(q.town);
    const btn = q.kind === 'lost' ? `<button class="btn small" data-act="golost" data-arg="${q.id}">Show me</button>`
      : q.kind === 'gift' ? `<button class="btn small primary ${S.res[q.res] >= q.amt ? '' : 'disabled'}" data-act="givereq" data-arg="${q.id}">Give ${q.amt} ${RES_NAMES[q.res].toLowerCase()}</button>`
      : `<span class="meta">Build it in ${t ? esc(t.name) : 'town'}</span>`;
    return `<div class="item"><div><b>${esc(q.who)}</b><div class="meta">${esc(q.text)}</div></div>${btn}</div>`;
  }).join('')}</div><div class="note">Each kindness earns a little gold, and families settle faster for a while. Unanswered requests simply pass.</div></div>`;
}

export function royalSection() {
  ST.ensureRoyals();
  const ms = S.royal.members.filter((m) => m.role !== 'gone');
  return `<div class="section"><h3>👑 The royal family</h3><div class="list">${ms.map((m) =>
    `<div class="item" style="justify-content:flex-start;gap:12px">${ST.portrait(m, 46)}<div><b>${esc(ST.titleOf(m))} ${esc(m.n)}</b><div class="meta">${m.role === 'ruler' ? 'Rules the realm' : m.role === 'consort' ? 'Royal consort' : m.role === 'heir' ? 'Heir' : 'Enjoying a quiet retirement'} · ${ST.rAge(m)} years old</div></div></div>`).join('')}</div>
    ${rulerTraitsHTML()}
    ${(S.royal.log || []).length ? `<div class="note">${S.royal.log.slice(0, 3).map((e) => `• ${esc(e.s)}`).join('<br>')}</div>` : ''}</div>`;
}

export function rulerTraitsHTML() {
  const r = ST.ruler(); if (!r) return '';
  const tr = (k) => { const t = ST.RULER_TRAITS[k]; return `<span class="trait">${t.icon} <b>${t.name}</b> <small>${t.desc}</small></span>`; };
  const heir = S.royal.members.find((m) => m.role === 'heir' && m.traits);
  return `<div class="traits"><div class="tlabel">The ruler's gifts</div>${(r.traits || []).map(tr).join('')}
    ${r.offers ? `<div class="tlabel" style="margin-top:8px">Choose a new gift</div><div class="list">${r.offers.map((k) => { const t = ST.RULER_TRAITS[k]; return `<button class="item" data-act="trait" data-arg="${k}"><div><b>${t.icon} ${t.name}</b><div class="meta">${t.desc}</div></div><span>Choose</span></button>`; }).join('')}</div>`
      : `<div class="note">A new gift comes after ${(r.traits || []).length < 2 ? '4' : (r.traits || []).length < 3 ? '10' : '—'} years of reign${(r.traits || []).length >= 3 ? ' (all gifts chosen)' : ''}.</div>`}
    ${heir ? `<div class="note">Heir ${esc(heir.n)} was born ${ST.RULER_TRAITS[heir.traits[0]].name.toLowerCase()}.</div>` : ''}</div>`;
}

export function contractSection() {
  const cs = S.contracts || []; if (!cs.length) return '';
  return `<div class="section"><h3>📜 Contracts</h3><div class="note">Long deliveries for friendly neighbours. Send a load whenever you can spare it; there's no harm if a contract runs out.</div><div class="list">${cs.map((c) => {
    const left = Math.max(0, Math.ceil(c.until - S.day)), pct = Math.round((c.sent / c.total) * 100);
    if (c.state === 'offer') return `<div class="item"><div><b>${esc(c.name)}: ${c.total} ${RES_NAMES[c.res].toLowerCase()}</b><div class="meta">Over a year · reward ${c.reward.gold} gold and lasting friendship</div></div><div class="row" style="margin:0"><button class="btn small leaf" data-act="caccept" data-arg="${c.id}">Accept</button><button class="btn small" data-act="cdecline" data-arg="${c.id}">✕</button></div></div>`;
    if (c.state === 'done') return `<div class="item"><div><b>✅ ${esc(c.name)}</b><div class="meta">Fulfilled! ${c.reward.gold} gold received.</div></div></div>`;
    return `<div class="item"><div style="flex:1"><b>${esc(c.name)}: ${c.sent}/${c.total} ${RES_NAMES[c.res].toLowerCase()}</b><div class="meter"><div style="width:${pct}%"></div></div><div class="meta">${left} days left · reward ${c.reward.gold} gold</div></div><button class="btn small primary ${S.res[c.res] >= 5 ? '' : 'disabled'}" data-act="csend" data-arg="${c.id}">Send</button></div>`;
  }).join('')}</div></div>`;
}

export function exploreSection() {
  const ex = S.expeditions || [], jr = S.journal || [];
  return `<div class="section"><h3>🧭 Explorers</h3>
    ${ex.length ? `<div class="list">${ex.map((e) => { const u = Math.min(1, (S.day - e.start) / e.days); return `<div class="item"><div><b>${esc(e.leader)}</b><div class="meta">${u < 0.5 ? 'Travelling to' : 'Returning from'} ${XP.LANDMARKS[e.lm][0]} · ${Math.round(u * 100)}%</div></div><span>${e.horse ? '🐎' : '🚶'}</span></div>`; }).join('')}</div>` : ''}
    ${S.tier < XP.EXPLORE_TIER ? '<div class="note">Expeditions begin when your realm becomes a Village.</div>' : '<div class="row"><button class="btn small primary" data-act="explore">Plan an expedition</button>' + (jr.length ? `<button class="btn small" data-act="journal">📖 Journal (${jr.length})</button>` : '') + '</div>'}</div>`;
}

export function showExplore() {
  openSheet('explore', () => {
    const opts = XP.LANDMARKS.map((l, k) => [k, XP.expeditionPlan(k)]).filter(([k, pl]) => pl && !(S.explored || []).includes(k)).sort((a, b) => a[1].d - b[1].d);
    return head('Plan an expedition', `Supplies: 40 food, 30 gold · ${(S.expeditions || []).length}/${XP.MAX_EXPEDITIONS} parties out`)
      + `<div class="note">Explorers ride out to a natural wonder of the world and come back with stories for your journal and a gift of gold. Stables make them faster. Distant continents need a Harbour.</div>
      <div class="list">${opts.slice(0, 14).map(([k, pl]) => { const c = XP.canExplore(k); return `<div class="item"><div><b>${XP.LANDMARKS[k][3]} ${XP.LANDMARKS[k][0]}</b><div class="meta">${pl.days} days there and back from ${esc(pl.town.name)}${pl.overseas ? ' · overseas' : ''}${c.ok ? '' : ` · ${esc(c.reason)}`}</div></div><button class="btn small primary ${c.ok ? '' : 'disabled'}" data-act="sendexp" data-arg="${k}">Send</button></div>`; }).join('')}</div>`;
  });
}

export function showJournal() {
  openSheet('journal', () => head('📖 Explorers’ journal', `${(S.journal || []).length} of ${XP.LANDMARKS.length} wonders recorded`)
    + `<div class="list">${(S.journal || []).map((j) => `<div class="item"><div><b>${XP.LANDMARKS[j.lm][3]} ${XP.LANDMARKS[j.lm][0]}</b><div class="meta">“${esc(j.text)}”<br>Recorded by ${esc(j.who)}, Year ${Math.floor(j.d / 48) + 1}</div></div></div>`).join('')}</div>`);
}

export function showHistory() {
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

export function showBackup() {
  openSheet('backup', () => head('Back up this realm', esc(S.name))
    + `<div class="note">Keep a copy of your realm somewhere safe, so a new phone or a reinstall never loses it. Restore it from the main menu (Load Realm).</div>
    <div class="list"><button class="item" data-act="bkfile"><div><b>💾 Save a backup file</b><div class="meta">Share it to Drive, email or your files</div></div><span>➜</span></button>
    <button class="item" data-act="bkcode"><div><b>📋 Copy a backup code</b><div class="meta">A long text code you can paste anywhere</div></div><span>➜</span></button></div>
    <textarea id="bkout" class="text hidden" rows="4" readonly style="font-size:11px"></textarea>`);
}


export function caravanSection() {
  if (S.towns.length < 2) return '';
  const pairs = caravanPairs().slice(0, 6), room = S.caravans.length < maxCaravans();
  return `<div class="section"><h3>🐴 Caravans</h3><div class="note">Wagon trains between your own towns: each one earns gold. ${S.caravans.length} of ${maxCaravans()} in use.</div>
    ${S.caravans.length ? `<div class="list">${S.caravans.map(([a, b], k) => `<div class="item"><div><b>${esc((townById(a) || {}).name || '?')} ⇄ ${esc((townById(b) || {}).name || '?')}</b><div class="meta">+0.3 gold a day</div></div><button class="btn small" data-act="stopcar" data-arg="${k}">Stop</button></div>`).join('')}</div>` : ''}
    ${room && pairs.length ? `<div class="list">${pairs.map(([a, b]) => `<div class="item"><div><b>${esc(a.name)} ⇄ ${esc(b.name)}</b><div class="cost" style="margin-top:4px">${costChips(CARAVAN_COST)}</div></div><button class="btn small leaf ${affordable(CARAVAN_COST) ? '' : 'disabled'}" data-act="startcar" data-arg="${a.id}:${b.id}">Start</button></div>`).join('')}</div>` : ''}</div>`;
}
