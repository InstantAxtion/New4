// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { ALL_WONDERS, DEFS, EVERYDAY, GOODS_BUILDINGS, MANUAL, RESEARCH, RES_NAMES, S, SPECIALTIES, TIERS, UPKEEP, hasTech, townStyleOf, wonderStarted } from '../game.js';
import { buildTab, openSheet } from '../ui.js';
import { bIcon, costChips, head } from './common.js';

export function showBuild() {
  openSheet('build', () => {
    const styles = new Set(S.towns.map(townStyleOf));
    const list = buildTab === 'buildings' ? [...MANUAL, ...GOODS_BUILDINGS, ...SPECIALTIES.filter((k) => styles.has(DEFS[k].style))]
      : buildTab === 'everyday' ? EVERYDAY : ALL_WONDERS;
    const cards = list.map((t) => {
      const d = DEFS[t], needR = d.research && !hasTech(d.research), locked = d.tier > S.tier || needR, built = d.wonder && wonderStarted(t);
      return `<button class="card ${locked || built ? 'locked' : ''}" data-act="pick" data-arg="${t}">
        ${d.style ? '<span class="spec">Specialty</span>' : ''}
        ${d.tier > S.tier ? `<span class="lock">${TIERS[d.tier].name}</span>` : needR ? `<span class="lock">🔬 ${(RESEARCH.find((r) => r.id === d.research) || {}).name}</span>` : built ? '<span class="lock">Built</span>' : ''}
        <img src="${bIcon(t)}" alt=""><b>${d.name}</b><div class="cost">${costChips(d.cost)}</div>
        <p>${d.desc || ''}${d.use ? ` Uses ${Object.entries(d.use).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.prod ? ` Makes ${Object.entries(d.prod).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.homes ? ` Homes hold ${Math.round(d.homes * 100)}% more people.` : ''}${UPKEEP[t] ? ` Upkeep ${Object.entries(UPKEEP[t]).map(([k, v]) => `${v}/day ${RES_NAMES[k].toLowerCase()}`).join(', ')}.` : ''}${d.jobs ? ` Needs ${d.jobs} worker${d.jobs > 1 ? 's' : ''}.` : ''}</p></button>`;
    }).join('');
    const tab = (k, l) => `<button data-act="btab" data-arg="${k}" class="${buildTab === k ? 'on' : ''}">${l}</button>`;
    return head('Build', buildTab === 'everyday' ? 'Everyday buildings: storage, builders, horses, schools, and places that make homes roomier.' : 'Buildings you place yourself. Homes, fields and workshops are painted with Zones.')
      + `<div class="tabs">${tab('buildings', 'Buildings')}${tab('everyday', 'Everyday')}${tab('wonders', 'Wonders')}</div>
      <div class="grid">${cards}</div>`;
  });
}
