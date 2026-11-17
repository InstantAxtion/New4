// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { ERAS, RESEARCH, S, TALENTS, canResearch, hasTalent, hasTech, knowledgeRate, prestige, talentsFree } from '../game.js';
import { openSheet, progTab } from '../ui.js';
import { bIcon, head } from './common.js';

export function showResearch() {
  openSheet('research', () => {
    const tab = (k, l) => `<button data-act="ptab" data-arg="${k}" class="${progTab === k ? 'on' : ''}">${l}</button>`;
    const free = talentsFree();
    return head('Research', progTab === 'research' ? 'Scholars study new ideas, one at a time. Schools, scriptoria and the library speed it up.' : 'Spend talent points to shape your realm. You earn them as the realm grows and becomes famous.')
      + `<div class="tabs">${tab('research', '📚 Research')}${tab('talents', `⭐ Talents${free > 0 ? ` <span class="badge">${free}</span>` : ''}`)}</div>`
      + (progTab === 'research' ? researchTree() : talentTree());
  });
}

export function researchTree() {
  const R = S.research || { cur: null, prog: 0, done: [], bank: 0 }, cur = RESEARCH.find((r) => r.id === R.cur), rate = knowledgeRate() * 0.6;
  const top = cur ? `<div class="rcur"><span class="ric">${cur.icon}</span><div style="flex:1"><b>Studying ${cur.name}</b><div class="meter"><div style="width:${Math.min(100, (R.prog / cur.cost) * 100)}%"></div></div><small>${Math.floor(R.prog)} / ${cur.cost} knowledge · about ${Math.max(1, Math.ceil((cur.cost - R.prog) / Math.max(0.05, rate)))} days</small></div></div>`
    : `<div class="rcur idle"><span class="ric">💡</span><div><b>Pick something to study</b><small>Knowledge is saved up meanwhile${R.bank >= 1 ? ` (${Math.floor(R.bank)} banked)` : ''}.</small></div></div>`;
  const eras = ERAS.map((name, e) => {
    const nodes = RESEARCH.filter((r) => r.era === e); if (!nodes.length) return '';
    return `<div class="era"><div class="eralabel">${name}</div>${nodes.map((r) => {
      const done = hasTech(r.id), avail = canResearch(r), on = R.cur === r.id;
      const st = done ? 'done' : on ? 'cur' : avail ? 'avail' : 'locked';
      const needs = r.req.filter((q) => !hasTech(q)).map((q) => RESEARCH.find((x) => x.id === q).name);
      return `<button class="rnode ${st}" data-act="research" data-arg="${r.id}"><div class="rhead"><span class="ric">${r.icon}</span><b>${r.name}</b></div><small>${r.desc}</small>${r.unlocks ? `<div class="runl">${r.unlocks.map((u) => `<img src="${bIcon(u)}" alt="">`).join('')}</div>` : ''}
        <div class="rfoot">${done ? '✓ Learned' : on ? `Studying · ${Math.floor((R.prog / r.cost) * 100)}%` : avail ? `📚 ${r.cost}` : `🔒 Needs ${needs.join(', ')}`}</div></button>`;
    }).join('')}</div>`;
  }).join('<div class="erarrow">›</div>');
  return top + `<div class="note">📚 Knowledge: +${rate.toFixed(1)} a day · ${(S.research ? S.research.done.length : 0)} of ${RESEARCH.length} learned</div><div class="rtree">${eras}</div>`;
}

export function talentTree() {
  const free = talentsFree();
  return `<div class="rcur ${free > 0 ? '' : 'idle'}"><span class="ric">⭐</span><div><b>${free > 0 ? `${free} talent point${free > 1 ? 's' : ''} to spend` : 'No points to spend just now'}</b><small>A point for each new tier, each wonder, and every 2,500 prestige (now ${prestige().toLocaleString()}).</small></div></div>
    <div class="ttree">${TALENTS.map((br) => `<div class="tbranch"><div class="eralabel">${br.icon} ${br.branch}</div>${br.nodes.map(([id, name, desc], k) => {
      const got = hasTalent(id), prevOk = k === 0 || hasTalent(br.nodes[k - 1][0]), can = !got && prevOk && free > 0;
      return `${k ? `<div class="tlinkv ${got ? 'on' : ''}"></div>` : ''}<button class="tnode ${got ? 'done' : can ? 'avail' : 'locked'}" data-act="talent" data-arg="${id}"><b>${name}</b><small>${desc}</small><div class="rfoot">${got ? '✓ Yours' : can ? 'Take · ⭐ 1' : prevOk ? 'Needs a point' : '🔒 Earlier talent first'}</div></button>`;
    }).join('')}</div>`).join('')}</div>`;
}
