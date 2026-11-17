// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { GENERAL_SKILL, JOBS, SKILLS, SKILL_HELP, ageOf, fullName, personById, petOf, thought } from '../folk.js';
import { DEFS, townById } from '../game.js';
import { openSheet, renaming } from '../ui.js';
import { esc, head } from './common.js';

// ---------------- people ----------------
export const AVATAR_BG = ['#f2d6c0', '#d8e8c8', '#cfe0f0', '#f0e0b0', '#e8d0e8', '#d8d8d0'];

export function personCard(t, p) {
  if (!p) return head('Moved on', esc(t.name)) + '<div class="note">This villager has moved on. Tap someone else walking about.</div>';
  const age = ageOf(p), partner = p.p ? personById(t, p.p) : null;
  const kids = (t.folk || []).filter((c) => c.par && c.par.includes(p.i));
  const parents = (p.par || []).map((id) => personById(t, id)).filter(Boolean);
  const stage = age < 3 ? '👶' : age < 16 ? '🧒' : age >= 65 ? '🧓' : '🧑';
  const job = p.j ? JOBS[p.j] : age < 16 ? (age < 6 ? 'Little one' : 'Schoolchild') : age >= 65 ? 'Retired' : 'Helping the builders';
  const stars = p.j ? '★'.repeat(1 + Math.floor(p.k / 25)) + '☆'.repeat(4 - Math.floor(p.k / 25)) : '';
  const link = (q) => `<button class="btn small" data-act="person" data-arg="${t.id}:${q.i}">${esc(q.f)}</button>`;
  return head(esc(fullName(p)), `${esc(t.name)} · ${age} year${age === 1 ? '' : 's'} old`)
    + `<div class="person"><div class="avatar" style="background:${AVATAR_BG[p.i % AVATAR_BG.length]}">${stage}</div>
      <div><b>${job}</b>${p.k >= 80 && p.j ? ' · Master' : ''}<div class="stars">${stars}</div></div></div>
      <div class="note" style="font-style:italic">“${esc(thought(t, p))}”</div>
      ${skillBlock(p)}
      <div class="kv">${partner ? `<span>Partner</span><span>${link(partner)}</span>` : ''}
      ${parents.length ? `<span>Parents</span><span>${parents.map(link).join(' ')}</span>` : ''}
      ${kids.length ? `<span>Children</span><span>${kids.map(link).join(' ')}</span>` : ''}
      <span>Family</span><span>The ${esc(p.l)} family</span>
      ${petOf(t, p) ? `<span>Pet</span><span>${petOf(t, p).k === 'dog' ? '🐕' : '🐈'} ${esc(petOf(t, p).n)}, a ${petOf(t, p).k}</span>` : ''}</div>
      ${renaming && renaming.pid === p.i ? `<div class="row"><input id="rnin" class="text" maxlength="16" value="${esc(renaming.pet ? petOf(t, p).n : p.f)}" style="flex:1;margin:0"><button class="btn small primary" data-act="rnsave" data-arg="${t.id}:${p.i}">Save</button></div>` : ''}
      <div class="row"><button class="btn small" data-act="follow" data-arg="${t.id}:${p.i}">👁 Follow</button><button class="btn small" data-act="tree" data-arg="${t.id}:${p.i}">🌳 Family tree</button>
      <button class="btn small" data-act="rename" data-arg="${t.id}:${p.i}">✏️ Rename</button>${petOf(t, p) ? `<button class="btn small" data-act="renamepet" data-arg="${t.id}:${p.i}">✏️ Rename ${petOf(t, p).k}</button>` : ''}</div>`;
}

// Skills: the trade's own skill, general Know-how, and what they learned in earlier jobs.
export const skillRank = (v) => (v >= 80 ? 'Master' : v >= 55 ? 'Expert' : v >= 30 ? 'Skilled' : v >= 10 ? 'Apprentice' : 'Novice');

export function skillBar(label, v, sub) {
  return `<div class="skill"><div class="skrow"><b>${label}</b><span>${skillRank(v)} · ${Math.floor(v)}</span></div><div class="meter"><div style="width:${Math.min(100, v)}%"></div></div>${sub ? `<div class="sksub">${sub}</div>` : ''}</div>`;
}

export function skillBlock(p) {
  if (ageOf(p) < 16) return '';
  const past = Object.entries(p.xp || {}).filter(([j, v]) => j !== p.j && v >= 5 && SKILLS[j]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `<div class="section"><h3>🛠 Skills</h3>
    ${p.j && SKILLS[p.j] ? skillBar(SKILLS[p.j], p.k, `Grows every day as a ${JOBS[p.j].toLowerCase()}: ${SKILL_HELP[p.j] || 'more ' + (Object.keys(DEFS[p.j].prod || {})[0] || 'work') + ' from this trade'}.`) : ''}
    ${skillBar(GENERAL_SKILL, p.g || 0, 'Grows in any job. Helps a little with everything, and new trades come quicker.')}
    ${past.length ? `<div class="sksub">Earlier trades: ${past.map(([j, v]) => `${SKILLS[j]} (${skillRank(v)})`).join(' · ')}</div>` : ''}</div>`;
}

// Family tree: grandparents down to grandchildren, as far as this town remembers.
export function treeCard(t, p) {
  if (!p) return head('Family tree', esc(t.name)) + '<div class="note">This villager has moved on.</div>';
  const get = (id) => personById(t, id), kidsOf = (q) => (t.folk || []).filter((c) => c.par && c.par.includes(q.i));
  const parents = (p.par || []).map(get).filter(Boolean), grand = parents.flatMap((q) => (q.par || []).map(get).filter(Boolean));
  const partner = p.p ? get(p.p) : null, kids = kidsOf(p), grandkids = kids.flatMap(kidsOf);
  const sibs = parents.length ? kidsOf(parents[0]).filter((q) => q.i !== p.i) : [];
  const chip = (q, me) => `<button class="tchip ${me ? 'me' : ''}" data-act="person" data-arg="${t.id}:${q.i}"><b>${esc(q.f)}</b><small>${ageOf(q)} · ${q.j ? JOBS[q.j] : ageOf(q) < 16 ? 'child' : ageOf(q) >= 65 ? 'retired' : '—'}</small></button>`;
  const gen = (label, list) => list.length ? `<div class="tgen"><div class="tlabel">${label}</div><div class="trow">${list.map((q) => chip(q)).join('')}</div></div>` : '';
  return head(`The ${esc(p.l)} family`, `${esc(t.name)}`)
    + `<div class="tree">${gen('Grandparents', grand)}${gen('Parents', parents)}
      <div class="tgen"><div class="tlabel">${partner ? 'Couple' : 'Here'}</div><div class="trow">${chip(p, true)}${partner ? '<span class="tlink">♥</span>' + chip(partner) : ''}</div></div>
      ${gen('Brothers & sisters', sibs)}${gen('Children', kids)}${gen('Grandchildren', grandkids)}</div>
      ${!grand.length && !parents.length && !kids.length ? '<div class="note">A family just starting out. Weddings and babies will fill this tree.</div>' : ''}`;
}

export function showPerson(townId, pid) {
  const t = townById(townId); if (!t) return;
  openSheet('person', () => personCard(t, personById(t, pid)));
}
