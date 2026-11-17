// The realm's budget: tax rate, daily income and costs, and what the realm wants built (demand).
import { S, totalPop } from '../game.js';
import { openSheet } from '../ui.js';
import { head } from './common.js';
import * as CITY from '../city.js';

const g = (v) => (v >= 10 ? Math.round(v) : v.toFixed(1));
export function showBudget() {
  openSheet('budget', () => {
    const b = CITY.budget(), rate = Math.round((S.taxRate ?? 0.09) * 100), dm = CITY.demand();
    const income = b.taxes + b.trade, costs = b.upkeep + b.soldiers;
    const dbar = (label, v, col) => `<div class="dline"><span>${label}</span><div class="meter dm"><div style="width:${Math.abs(v) / 2 + 50}%;background:${v > 0 ? col : '#c8bfb0'}"></div></div><b>${v > 0 ? 'Wanted' : 'Not now'}</b></div>`;
    return head('💰 Budget', `${Math.floor(totalPop())} villagers pay taxes`)
      + `<div class="section"><h3>Tax rate</h3><div class="taxrow"><button class="btn small" data-act="taxdn" ${rate <= 0 ? 'disabled' : ''}>−</button><b class="taxv">${rate}%</b><button class="btn small" data-act="taxup" ${rate >= 20 ? 'disabled' : ''}>+</button></div>
        <div class="note">Higher taxes bring in more gold, but fewer families want to move in and workshops grow slower. Low taxes do the opposite. 9% is a fair middle.</div></div>
      <div class="section"><h3>Each day</h3><div class="kv"><span>Taxes</span><span>+${g(b.taxes)} gold</span><span>Trade, markets and workshops</span><span>+${g(b.trade)} gold</span>
        <span>Building upkeep</span><span>−${g(b.upkeep)} gold</span><span>Soldiers’ pay</span><span>−${g(b.soldiers)} gold</span>
        <span><b>Balance</b></span><span><b style="color:${income - costs >= 0 ? '#4e7a34' : '#b04a30'}">${income - costs >= 0 ? '+' : '−'}${g(Math.abs(income - costs))} gold</b></span></div></div>
      <div class="section"><h3>What the realm wants</h3>${dbar('🏠 Homes', dm.housing, '#f07a48')}${dbar('🌾 Farms', dm.farmland, '#d8b830')}${dbar('⚒ Workshops', dm.workshop, '#8a7ef0')}
        <div class="note">Zoned tiles only grow while there is demand. Homes are wanted when there are jobs and food; workshops when villagers need work; farms when food runs short.</div></div>`;
  });
}
