// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { JOBS, SKILLS, ageOf, fullName } from '../folk.js';
import { CONTACT_RANGE, DEFS, GIFT_AMOUNT, HOUSE_CAP_MULT, HOUSE_LEVELS, IMPROVEMENTS, IMPROVE_TIER, M, MOODS, PACE, RES, RES_NAMES, S, SPECS, SPEC_CHANGE_COST, SPEC_TIER, TIERS, TRAITS, UPKEEP, ZONES, affordable, anchorOf, canInvite, charm, continentAt, crewsBusy, crewsOf, harbourTowns, inContact, moodOf, nbExtra, ownerOf, priceNote, townById, tradeOffers, yardsIn, zonesWaiting } from '../game.js';
import { markDirty, townStyle } from '../render.js';
import { farmSeason } from '../seasons.js';
import { STYLES } from '../sprites.js';
import { openSheet } from '../ui.js';
import { B, BIOMES, W, describeTile, idxOf, tileLat, world, wrapX } from '../world.js';
import { ICON, costChips, esc, head } from './common.js';
import * as ST from '../stories.js';
import * as WAR from '../war.js';

export function festivalSection(t) {
  const f = ST.festivalNow(t), c = ST.canFestival(t), on = t.fest && S.day < t.fest.until;
  const cur = on ? ST.ALL_FESTS().find((x) => x.key === t.fest.key) : null;
  const specials = on ? '' : `<div class="list">${ST.SPECIALS.map((sp) => { const cs = ST.canSpecial(t, sp.key); return `<div class="item"><div><b>${sp.icon} ${sp.name}</b><div class="meta">${sp.desc}${cs.ok ? '' : ` <i>${esc(cs.reason)}</i>`}</div><div class="cost" style="margin-top:4px">${costChips(sp.cost)}</div></div><button class="btn small leaf ${cs.ok ? '' : 'disabled'}" data-act="special" data-arg="${t.id}:${sp.key}">Hold</button></div>`; }).join('')}</div>`;
  return `<div class="section"><h3>${f.icon} Festivals</h3><div class="note">${on ? `<b>${cur ? cur.name : 'A celebration'}</b> is on now! The whole town is out celebrating.` : `This season's festival is <b>${f.name}</b>: ${f.desc} The town is happier during it, and for a season afterwards, and neighbours come to visit.`}</div>
    ${on ? '' : `<div class="row"><button class="btn small leaf ${c.ok ? '' : 'disabled'}" data-act="festival" data-arg="${t.id}">Hold ${f.name}</button><div class="cost">${costChips(ST.FESTIVAL_COST)}</div></div>${c.ok ? '' : `<div class="note">${esc(c.reason)}</div>`}`}${specials}${t.royalVisit && S.day < t.royalVisit.until ? `<div class="note">👑 ${esc(t.royalVisit.name)} of ${esc(t.royalVisit.village)} is visiting!</div>` : ''}</div>`;
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

export function specSection(t) {
  if (S.tier < SPEC_TIER) return `<div class="section"><h3>Speciality</h3><div class="note">From Village tier, each town can master one trade.</div></div>`;
  const cur = t.spec ? SPECS[t.spec] : null;
  return `<div class="section"><h3>Speciality</h3>
    <div class="note">${cur ? `${esc(t.name)} masters <b>${cur.icon} ${cur.name}</b>: +30% to it, -10% to its other work.` : `Choose one trade for ${esc(t.name)} to master: +30% to it, -10% to the town's other work.`}${t.spec ? ` Changing costs ${SPEC_CHANGE_COST.gold} gold.` : ' The first choice is free.'}</div>
    <div class="list">${Object.entries(SPECS).map(([k, sp]) => `<button class="item ${t.spec === k ? '' : (t.spec && !affordable(SPEC_CHANGE_COST) ? 'disabled' : '')}" data-act="spec" data-arg="${t.id}:${k}" ${t.spec === k ? 'style="border-color:var(--leaf);background:#eef5e2"' : ''}>
      <div><b>${sp.icon} ${sp.name}</b><div class="meta">${sp.desc}</div></div><span>${t.spec === k ? '✓' : ''}</span></button>`).join('')}</div></div>`;
}

export function moodSection(t) {
  const m = moodOf(t), M2 = MOODS[m.level];
  return `<div class="section"><h3>Mood</h3><div class="moodline"><span class="face">${M2.face}</span><span>${M2.name}${m.level < 2 ? `<div class="meta" style="font-weight:500;color:var(--ink-soft);font-size:12px">${m.level === 0 ? 'Happier towns attract families faster.' : 'A little more and they will be joyful.'}</div>` : '<div class="meta" style="font-weight:500;color:var(--ink-soft);font-size:12px">Families flock here.</div>'}</span></div>
    <div class="chips2">${m.parts.map(([l]) => `<span>✓ ${esc(l)}</span>`).join('')}${m.missing.slice(0, 4).map((l) => `<span class="want">+ ${esc(l)}</span>`).join('')}</div></div>`;
}

export function folkSection(t) {
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

// Town figures: homes, jobs and what the town makes each day.
export function statsSection(t) {
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
    </div>${top ? `<div class="note">Here: ${top}.</div>` : ''}${t.jobSkill && Object.keys(t.jobSkill).length ? `<div class="note">Best skills: ${Object.entries(t.jobSkill).filter(([j]) => SKILLS[j]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([j, v]) => `${SKILLS[j]} ${Math.round(v)} (+${Math.round((0.9 + v / 250 - 1) * 100)}%)`).join(' · ')}</div>` : ''}${t.districts && t.districts.length ? `<div class="note">Quarters: ${t.districts.map((d) => esc(d.name)).join(' · ')}</div>` : ''}</div>`;
}

export function townInfo(t, sub) {
  const next = TIERS[S.tier + 1];
  return head(`${esc(t.name)}${t.capital ? ' 👑' : ''}`, (t.fame ? `<b style="color:var(--accent-dark)">★ ${esc(t.fame.title)}</b> (+10% ${RES_NAMES[t.fame.r].toLowerCase()}) · ` : '') + sub)
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

export function neighborInfo(n, sub) {
  const contact = inContact(n), inv = canInvite(n);
  const offers = tradeOffers(n);
  const tr = TRAITS[n.trait] || TRAITS.cheerful;
  const req = n.req;
  return head(esc(n.name), `Neighbouring village · ${Math.floor(n.pop)} folk`)
    + `<div class="note">${sub}</div>
    <div class="note">Led by <b>${esc(n.leader || 'their elder')}</b> · ${tr.label}: ${tr.blurb}</div>
    ${n.realm ? `<div class="note">🏰 Part of the <b>${esc(n.realm)}</b> · defence ${WAR.villageDefence(n)}${WAR.attackable(n) ? ' <button class="btn small" data-act="goarmy">⚔️ Army</button>' : ''}</div>` : ''}
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
