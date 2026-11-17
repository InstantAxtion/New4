// Realm backups, lifetime achievements, and the realm's history (charts + milestones).
import { S, on, emit, totalPop, count, hasWonder, WONDERS, ALL_WONDERS, realmContinents, routesDone, TIERS } from './game.js';
import { YEAR } from './seasons.js';
import { isSave } from './core/migrations.js';

// ---------------- backups ----------------
const slotKey = (n) => `hearthlands-slot-${n}`;
export function exportCode(n) {
  const raw = localStorage.getItem(slotKey(n)); if (!raw) return null;
  return 'HEARTH1:' + btoa(unescape(encodeURIComponent(raw)));
}
export function parseBackup(text) {
  text = (text || '').trim();
  let raw = text;
  if (text.startsWith('HEARTH1:')) { try { raw = decodeURIComponent(escape(atob(text.slice(8).replace(/\s+/g, '')))); } catch (e) { return null; } }
  try { const d = JSON.parse(raw); return isSave(d) ? raw : null; } catch (e) { return null; }
}
export function importInto(n, raw) { try { localStorage.setItem(slotKey(n), raw); return true; } catch (e) { return false; } }
export async function saveBackupFile(n) {
  const raw = localStorage.getItem(slotKey(n)); if (!raw) return 'none';
  const d = JSON.parse(raw), name = `${(d.name || 'realm').replace(/[^\w-]+/g, '_')}.hearthlands.json`;
  const file = typeof File !== 'undefined' ? new File([raw], name, { type: 'application/json' }) : null;
  try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Hearthlands: ${d.name}` }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  try {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); return 'downloaded';
  } catch (e) { return 'failed'; }
}

// ---------------- achievements (lifetime, across every realm) ----------------
const TKEY = 'hearthlands-trophies';
export const TROPHIES = [
  ['first-farm', '🌾', 'First Furrow', 'Plant your first field', () => count('farm') >= 1],
  ['village', '🏘', 'Village Life', 'Grow a realm to a Village', () => S.tier >= 1],
  ['town', '🏰', 'Market Town', 'Grow a realm to a Town', () => S.tier >= 2],
  ['city', '🌆', 'City Lights', 'Grow a realm to a City', () => S.tier >= 3],
  ['kingdom', '👑', 'Kingdom Come', 'Grow a realm to a Kingdom', () => S.tier >= 4],
  ['empire', '🌟', 'Golden Age', 'Grow a realm to an Empire', () => S.tier >= 5],
  ['five-towns', '🗺', 'Spreading Roots', 'Hold five settlements at once', () => S.towns.length >= 5],
  ['three-cont', '🌍', 'Across the World', 'Settle on three continents', () => realmContinents().length >= 3],
  ['wonder', '🏛', 'Wonder Builder', 'Complete a wonder', () => ALL_WONDERS.some(hasWonder)],
  ['all-wonders', '✨', 'Age of Wonders', 'Complete the five classic wonders', () => WONDERS.every(hasWonder)],
  ['sea-route', '⛵', 'Sea Lanes', 'Open a sea route', () => routesDone() >= 1],
  ['explorer', '🧭', 'Explorer', 'Record a landmark in your journal', () => (S.explored || []).length >= 1],
  ['explorer10', '📖', 'Well Travelled', 'Record ten landmarks', () => (S.explored || []).length >= 10],
  ['gems', '💎', 'Lucky Strike', 'Find gems in a mine', () => !!(S.treasures && S.treasures.gems)],
  ['festival', '🎉', 'Let’s Celebrate', 'Hold a festival', () => !!S.festsHeld && Object.keys(S.festsHeld).length >= 1],
  ['all-festivals', '🏮', 'All Year Round', 'Hold all four seasonal festivals', () => !!S.festsHeld && ['blossom', 'midsummer', 'harvest', 'lights'].every((k) => S.festsHeld[k])],
  ['helper', '💛', 'Good Neighbour', 'Help five villagers with their requests', () => (S.stats.helpedFolk || 0) >= 5],
  ['coronation', '🫅', 'Long Live the Crown', 'See an heir crowned', () => (S.stats.coronations || 0) >= 1],
  ['joyful', '😄', 'Joy Abounds', 'Make a town Joyful', () => S.towns.some((t) => t.mood && t.mood.level >= 2)],
  ['weddings', '💍', 'Wedding Bells', 'Celebrate 25 weddings in one realm', () => (S.stats.weddings || 0) >= 25],
  ['master', '⭐', 'Master of the Craft', 'Raise a master craftsperson', () => (S.stats.masters || 0) >= 1],
  ['joined', '🤝', 'Open Arms', 'Welcome a neighbouring village into your realm', () => (S.stats.joins || 0) >= 1],
  ['defender', '🛡️', 'Stout Walls', 'Drive off a raid', () => (S.stats.raidsRepelled || 0) >= 1],
  ['conqueror', '⚔️', 'Banners Afield', 'Win a village with your army', () => (S.stats.battlesWon || 0) >= 1],
  ['thousand', '👥', 'A Thousand Souls', 'Reach 1,000 villagers in one realm', () => totalPop() >= 1000],
];
export function trophies() { try { return JSON.parse(localStorage.getItem(TKEY)) || {}; } catch (e) { return {}; } }
function award(id) {
  const got = trophies(); if (got[id]) return;
  got[id] = { at: Date.now(), realm: S.name };
  try { localStorage.setItem(TKEY, JSON.stringify(got)); } catch (e) { /* ignore */ }
  const t = TROPHIES.find((x) => x[0] === id);
  emit('trophy', t);
}
function checkTrophies() { const got = trophies(); for (const [id, , , , test] of TROPHIES) if (!got[id]) { try { if (test()) award(id); } catch (e) { /* ignore */ } } }

// ---------------- history ----------------
export function milestone(icon, text) { (S.miles ||= []).push({ d: Math.floor(S.day), icon, s: text }); if (S.miles.length > 80) S.miles.shift(); }
function sample() {
  S.hist ||= [];
  S.hist.push([Math.floor(S.day), Math.round(totalPop()), Math.round(S.res.food), Math.round(S.res.wood), Math.round(S.res.stone), Math.round(S.res.gold), S.towns.length]);
  if (S.hist.length > 240) S.hist = S.hist.filter((_, k) => k % 2 === 0 || k === S.hist.length - 1); // thin out old points
}
on('tier', (t) => milestone('⬆️', `Became a ${TIERS[t].name}`));
on('founded', (t) => milestone('🏘', `Founded ${t.name}`));
on('joined', (t) => milestone('🤝', `${t.name} joined the realm`));
on('built', ({ b }) => { if (ALL_WONDERS.includes(b.t)) milestone('🏛', `Completed a wonder`); });
on('route', ({ a, b }) => milestone('⛵', `Sea route ${a ? a.name : ''} – ${b ? b.name : ''}`));
on('discovered', (e) => milestone('🧭', `Explorers reached a landmark`));
on('festival', ({ t, f }) => milestone(f.icon, `${f.name} in ${t.name}`));
on('find', ({ kind }) => milestone('💎', `Found ${kind} in a mine`));
let hT = 0, tT = 0;
on('stepped', (dd) => {
  if (!S.started) return;
  if ((hT += dd) >= 12 || !(S.hist && S.hist.length)) { hT = 0; sample(); }
  if ((tT += dd) >= 2) { tT = 0; checkTrophies(); }
});

// A small line chart as inline SVG (one series, light grid, value at the end, hover readout).
const compact = (v) => (v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v));
export function lineChart(points, { w = 320, h = 120, color = '#c0603e', label = '', fmt = compact } = {}) {
  if (points.length < 2) return '<div class="note">The story is just beginning. Check back after a season or two.</div>';
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(1, ...ys) * 1.1;
  const pad = { l: 34, r: 10, t: 10, b: 20 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const X = (x) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * iw, Y = (y) => pad.t + ih - (y / y1) * ih;
  const d = points.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const grid = [0, 0.5, 1].map((f) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(y1 * f / 1.1)}" y2="${Y(y1 * f / 1.1)}" stroke="var(--line)" stroke-width="1"/><text x="${pad.l - 4}" y="${Y(y1 * f / 1.1) + 3}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${fmt(Math.round(y1 * f / 1.1))}</text>`).join('');
  const yr = (dd) => `Year ${Math.floor(dd / YEAR) + 1}`;
  const last = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${label}" data-pts='${JSON.stringify(points)}' data-x0="${x0}" data-x1="${x1}" data-y1="${y1}" data-pad="${pad.l},${pad.r},${pad.t},${pad.b}">
    ${grid}<text x="${pad.l}" y="${h - 4}" font-size="10" fill="var(--ink-soft)">${yr(x0)}</text><text x="${w - pad.r}" y="${h - 4}" font-size="10" text-anchor="end" fill="var(--ink-soft)">${yr(x1)}</text>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" fill="${color}" stroke="var(--paper-solid)" stroke-width="2"/>
    <line class="xh" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--ink-soft)" stroke-width="1" opacity="0"/>
    <text class="tip" x="0" y="${pad.t + 10}" font-size="11" font-weight="700" fill="var(--ink)" opacity="0"></text></svg>`;
}
// Crosshair + readout for every chart inside an element.
export function wireCharts(root, fmtName = {}) {
  root.querySelectorAll('svg.chart').forEach((svg) => {
    const pts = JSON.parse(svg.dataset.pts), x0 = +svg.dataset.x0, x1 = +svg.dataset.x1;
    const [pl, pr] = svg.dataset.pad.split(',').map(Number), vb = svg.viewBox.baseVal;
    const xh = svg.querySelector('.xh'), tip = svg.querySelector('.tip');
    const move = (e) => {
      const r = svg.getBoundingClientRect(), fx = ((e.clientX - r.left) / r.width) * vb.width;
      const day = x0 + ((fx - pl) / (vb.width - pl - pr)) * (x1 - x0);
      let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - day) < Math.abs(best[0] - day)) best = p;
      const X = pl + ((best[0] - x0) / Math.max(1, x1 - x0)) * (vb.width - pl - pr);
      xh.setAttribute('x1', X); xh.setAttribute('x2', X); xh.setAttribute('opacity', 0.5);
      tip.textContent = `Year ${Math.floor(best[0] / YEAR) + 1}: ${best[1].toLocaleString()}`; tip.setAttribute('x', Math.min(X + 4, vb.width - 110)); tip.setAttribute('opacity', 1);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { xh.setAttribute('opacity', 0); tip.setAttribute('opacity', 0); });
  });
}
