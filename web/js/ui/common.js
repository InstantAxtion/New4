// Moved out of ui.js to keep modules small. See ARCHITECTURE.md.
import { DEFS, S, TIERS, ZONES } from '../game.js';
import { townStyle } from '../render.js';
import { SPR, homeArt, spriteIcon } from '../sprites.js';

export const $ = (s) => document.querySelector(s);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


export const ICON = {
  food: '<svg viewBox="0 0 24 24"><path d="M12 22V8" stroke="#9a7a3a" stroke-width="1.8" fill="none"/><g fill="#e0b84a" stroke="#b08a2a" stroke-width=".8"><ellipse cx="9.5" cy="9" rx="2" ry="3.2" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3.2" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2" ry="3.2" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2" ry="3.2" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="5" rx="1.8" ry="3"/></g></svg>',
  wood: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="17" height="9" rx="3" fill="#a06a3e" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="3.5" ry="4.5" fill="#e3c08a" stroke="#6e4426" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="1.5" ry="2" fill="none" stroke="#b08050" stroke-width=".8"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M3 17 6 9l6-3 6 2 3 8-4 3H7Z" fill="#a8a29a" stroke="#6e6860" stroke-width="1"/><path d="M6 9l5 3 7-4M11 12l-1 7" stroke="#857e76" stroke-width=".9" fill="none"/></svg>',
  gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8b84a" stroke="#a87a1a" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#c8962a" stroke-width="1"/><path d="M12 8v8M10 10h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3" stroke="#a87a1a" stroke-width="1.1" fill="none"/></svg>',
  iron: '<svg viewBox="0 0 24 24"><path d="M3 16 6 9h12l3 7Z" fill="#8a96a6" stroke="#4e5a6a" stroke-width="1"/><path d="M6 9h12l-2 3H8Z" fill="#b4c0ce"/></svg>',
  bread: '<svg viewBox="0 0 24 24"><path d="M3 14c0-4 4-7 9-7s9 3 9 7v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="#d8a05a" stroke="#9a6a30" stroke-width="1"/><path d="M8 9.5l1.5 3M12 8.5v3.5M16 9.5l-1.5 3" stroke="#f2d6a0" stroke-width="1.3" stroke-linecap="round"/></svg>',
  tools: '<svg viewBox="0 0 24 24"><path d="M5 19 14 10" stroke="#8a5a3c" stroke-width="2.6" stroke-linecap="round"/><path d="M11 6l5-2 4 4-2 5-3-1Z" fill="#8a96a6" stroke="#4e5a6a" stroke-width="1"/></svg>',
  cloth: '<svg viewBox="0 0 24 24"><path d="M4 7h14l2 3-2 3H4Z" fill="#c0503e" stroke="#7a2a20" stroke-width="1"/><path d="M4 13h14l2 3-2 3H4Z" fill="#4a78a8" stroke="#2a4a70" stroke-width="1"/><path d="M7 7v6M11 7v6M15 7v6" stroke="#e8a080" stroke-width="0.8"/></svg>',
  ale: '<svg viewBox="0 0 24 24"><rect x="5" y="7" width="11" height="13" rx="2" fill="#d8a040" stroke="#8a5a20" stroke-width="1"/><path d="M5 9c0-3 11-3 11 0Z" fill="#fbf4e4"/><path d="M16 10h2.5a2 2 0 0 1 0 6H16" fill="none" stroke="#8a5a20" stroke-width="1.6"/></svg>',
  pottery: '<svg viewBox="0 0 24 24"><path d="M8 5h8l-1 3c3 1 4 4 4 7 0 3-3 5-7 5s-7-2-7-5c0-3 1-6 4-7Z" fill="#c87a50" stroke="#8a4a2a" stroke-width="1"/><path d="M6 14h12" stroke="#f0c8a0" stroke-width="1.2"/></svg>',
  glass: '<svg viewBox="0 0 24 24"><path d="M7 3h10l-1 17H8Z" fill="#a8dcef" fill-opacity=".8" stroke="#4a8aa8" stroke-width="1"/><path d="M9 6l1 11" stroke="#fff" stroke-width="1.2" opacity=".8"/></svg>',
  spices: '<svg viewBox="0 0 24 24"><path d="M4 14c0 4 4 6 8 6s8-2 8-6Z" fill="#8a5a3c" stroke="#5a3a20" stroke-width="1"/><path d="M5 14c1-4 4-6 7-6s6 2 7 6Z" fill="#d8742a"/><circle cx="10" cy="11" r="1" fill="#f0b030"/><circle cx="14" cy="10.5" r="1" fill="#a83a1a"/></svg>',
  books: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="5" height="15" fill="#a03030" stroke="#601818"/><rect x="9.5" y="7" width="5" height="13" fill="#305a90" stroke="#183060"/><rect x="15" y="4" width="5" height="16" fill="#3a7a3a" stroke="#1a4a1a" transform="rotate(8 17 12)"/></svg>',
  flour: '<svg viewBox="0 0 24 24"><path d="M6 8c0-2 2-3 6-3s6 1 6 3l1 10c0 2-3 3-7 3s-7-1-7-3Z" fill="#f2ead8" stroke="#b8a888" stroke-width="1"/><path d="M8 6.5h8" stroke="#b8a888" stroke-width="1.2"/><path d="M10 13h4M12 11v4" stroke="#d8b860" stroke-width="1.2"/></svg>',
  wool: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="#f4f0e6" stroke="#b8b0a0" stroke-width="1"/><path d="M6 11c3 2 9 2 12 0M6.5 15c3 2 8 2 11 0M9 7c2 3 2 9 0 12" stroke="#c8c0b0" stroke-width=".9" fill="none"/></svg>',
  pop: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" fill="#e0b088"/><path d="M3 19c0-4 2-6 5-6s5 2 5 6Z" fill="#4a78a8"/><circle cx="16" cy="9" r="2.6" fill="#e0b088"/><path d="M12 19c.5-3.5 2-5 4-5s4 1.5 4.5 5Z" fill="#c0503e"/></svg>',
};

export const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString());

export const costChips = (cost, check = true) => Object.entries(cost || {}).map(([k, v]) =>
  `<span class="chip ${check && S.res[k] < v ? 'short' : ''}">${ICON[k]}${v}</span>`).join('');

export const iconCache = {};

export function bIcon(type) {
  if (!iconCache[type]) {
    const spr = type === 'castle' ? SPR.build.castle[2] : (SPR.build[type] || SPR.build.scaffold)[0];
    iconCache[type] = spriteIcon(spr, 40);
  }
  return iconCache[type];
}


// Zone palette: a picture of what each zone grows into, and a plain-words description.
export function zIcon(type) {
  if (type === 'house') { if (!iconCache._house) iconCache._house = spriteIcon(homeArt(S.towns[0] ? townStyle(S.towns[0]) : 'temperate', 1)[0], 40); return iconCache._house; }
  return bIcon(type);
}

export const ZONE_TEXT = {
  housing: 'Cottages for families. More homes, more villagers.',
  farmland: 'Fields that grow food. They rest in winter and give extra at harvest.',
  pasture: 'Fenced meadows with sheep and cows. Food and a little wool.',
  woodlot: 'Neat rows of planted trees. Steady wood, even far from forests.',
  workshop: 'Craftsfolk who earn gold.',
  mining: 'Pits for stone and a little iron. Only on rocky ground: hills, desert, or beside mountains.',
  shops: 'Shopfronts with awnings that earn gold.',
  park: 'Lawns, a duck pond and benches. Makes the town happier.',
  road: 'Free roads. Villagers walk faster on them, and they join up with your streets.',
  canal: 'Stone-lined water channels. Boats sail them, and docks and farms count them as a river.',
  erase: 'Clear painted zones, roads and canals. Buildings already built stay.',
};

export function zoneInfo(k) {
  const z = ZONES[k], d = z && DEFS[z.builds], locked = d && d.tier > S.tier;
  const img = z ? `<img src="${zIcon(z.builds)}" alt="">` : `<span class="zsw big ${k}"></span>`;
  const name = z ? z.name : { road: 'Road', canal: 'Canal', erase: 'Erase' }[k];
  const facts = [];
  if (d) {
    if (d.cap) facts.push(`🏠 Homes for ${d.cap}`);
    if (d.prod) facts.push(Object.entries(d.prod).map(([r, v]) => `${ICON[r].replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} +${v}/day`).join(' '));
    if (d.homes) facts.push(`🏠 Homes +${Math.round(d.homes * 100)}%`);
    if (d.jobs) facts.push(`👷 ${d.jobs} jobs`);
  } else if (k === 'road' || k === 'canal') facts.push('Free');
  return `<span class="mimg">${img}</span><div class="mtext"><b>${name}${locked ? ` <em class="lockt">🔒 ${TIERS[d.tier].name}</em>` : ''}</b><small>${ZONE_TEXT[k] || ''}</small>
    <div class="zfacts">${facts.map((f) => `<span>${f}</span>`).join('')}${d ? `<span class="cost">${costChips(d.cost)}<em> each</em></span>` : ''}</div></div>`;
}

export function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }

export const head = (title, sub) => `<div class="sh-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="close" data-act="close" aria-label="Close">✕</button></div>`;
