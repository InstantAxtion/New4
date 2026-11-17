// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { ALL_WONDERS, CHAPTERS, DEFS, RESEARCH, S, TIERS, ZONES, currentChapter, hasWonder, maxTowns, prestige, prestigeRank, talentsFree, totalPop } from '../game.js';
import { openSheet } from '../ui.js';
import { bIcon, esc, head, zIcon } from './common.js';
import * as RC from '../records.js';

// ---------------- progress page, year report and tier celebration ----------------
export function showProgress() {
  openSheet('progress', () => {
    const p = totalPop(), next = TIERS[S.tier + 1], prog = next ? Math.min(1, (p - TIERS[S.tier].pop) / (next.pop - TIERS[S.tier].pop)) : 1;
    const ch = currentChapter(), chDone = CHAPTERS.filter((c) => S.questsDone.has(c.id)).length;
    const rDone = S.research ? S.research.done.length : 0, tro = RC.trophies(), troN = Object.keys(tro).length;
    const pr = prestige(), wonders = ALL_WONDERS.filter(hasWonder).length, famous = S.towns.filter((t) => t.fame);
    const bar = (label, v, sub) => `<div class="pbar"><div class="skrow"><b>${label}</b><span>${sub}</span></div><div class="meter"><div style="width:${Math.min(100, v * 100)}%"></div></div></div>`;
    return head('Progress', esc(S.name))
      + `<div class="section">${bar(`🏰 ${TIERS[S.tier].name}`, prog, next ? `${Math.floor(p)} / ${next.pop} to ${next.name}` : 'The highest tier')}
        ${bar('📜 Chapters', chDone / CHAPTERS.length, ch ? `Now: ${ch.icon} ${ch.name}` : 'All complete')}
        ${bar('📚 Research', rDone / RESEARCH.length, `${rDone} of ${RESEARCH.length} ideas`)}
        ${bar('🏆 Trophies', troN / RC.TROPHIES.length, `${troN} of ${RC.TROPHIES.length}`)}
        ${bar('🏛️ Wonders', wonders / ALL_WONDERS.length, `${wonders} of ${ALL_WONDERS.length}`)}</div>
      <div class="kv"><span>Prestige</span><span>⭐ ${pr.toLocaleString()} · ${prestigeRank(pr)}</span><span>Talents</span><span>${(S.talents || []).length} taken${talentsFree() > 0 ? ` · ${talentsFree()} to spend` : ''}</span>
        <span>Settlements</span><span>${S.towns.length} of ${maxTowns()}</span><span>Famous towns</span><span>${famous.length ? famous.map((t) => `${esc(t.name)} (${esc(t.fame.title)})`).join(', ') : 'None yet'}</span></div>
      <div class="row"><button class="btn small" data-act="history">📈 Realm history</button>${S.lastReport ? '<button class="btn small" data-act="yearrep">📖 Last year</button>' : ''}</div>`;
  });
}

export function showYear(r) {
  openSheet('year', () => head(`📖 The year ${r.year} in review`, esc(S.name))
    + `<div class="yearcard">
      <div class="ystat"><b>${r.pop[1]}</b><small>villagers${r.pop[1] - r.pop[0] ? ` (${r.pop[1] - r.pop[0] > 0 ? '+' : ''}${r.pop[1] - r.pop[0]})` : ''}</small></div>
      <div class="ystat"><b>${r.births}</b><small>babies born</small></div>
      <div class="ystat"><b>${r.weddings}</b><small>weddings</small></div>
      <div class="ystat"><b>${r.built}</b><small>buildings raised</small></div>
      <div class="ystat"><b>${r.research}</b><small>ideas learned</small></div>
      <div class="ystat"><b>${r.gold >= 0 ? '+' : ''}${r.gold}</b><small>gold</small></div></div>
      ${r.best ? `<div class="note">🌟 Best-growing town: <b>${esc(r.best[0])}</b>, with ${r.best[1]} new villagers.</div>` : ''}
      ${r.mile.length ? `<div class="section"><h3>Highlights</h3><div class="note">${r.mile.map(esc).join('<br>')}</div></div>` : ''}
      <div class="note">Here's to another gentle year in your ${r.tier.toLowerCase()}.</div>`);
}

export function tierCard(t) {
  const T = TIERS[t];
  const builds = Object.entries(DEFS).filter(([k, d]) => d.tier === t && !d.hidden && !d.civic).map(([k]) => k);
  const zones = Object.entries(ZONES).filter(([, z]) => DEFS[z.builds].tier === t);
  openSheet('tierup', () => `<div class="tierhero"><div class="tierburst">✨</div><h2>Your realm is now ${/^[AEIOU]/.test(T.name) ? 'an' : 'a'} ${T.name}!</h2><div class="sub">${Math.floor(totalPop())} villagers call it home.</div></div>
    <div class="section"><h3>Now unlocked</h3><div class="unlocks">
      ${zones.map(([, z]) => `<div class="ul"><img src="${zIcon(z.builds)}" alt=""><span>${z.name} zone</span></div>`).join('')}
      ${builds.map((k) => `<div class="ul"><img src="${bIcon(k)}" alt=""><span>${DEFS[k].name}</span></div>`).join('')}</div>
      <div class="note">You can now hold up to ${maxTowns()} settlements, and each town's border can grow to ${T.radiusCap} tiles.</div></div>
    <div class="row"><button class="btn primary" data-act="close" style="flex:1">Wonderful!</button></div>`);
}
