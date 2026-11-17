// Moved out of sprites.js to keep modules small. See ARCHITECTURE.md.
import { mulberry32 } from '../noise.js';
import { P, box, cyl, gable, hex, hip, make, rgb, shadow, windows } from './kit.js';
import { tree } from './terrain.js';

// ---------------- buildings ----------------
export const ROOFS = ['#c0603e', '#c9a35a', '#7a6b8f', '#b5543c', '#6d7b8a'];

export function cottage(g, du, dv, s, roof, rnd) {
  const u0 = 0.5 - s / 2 + du, v0 = 0.5 - s / 2 + dv, u1 = u0 + s, v1 = v0 + s * 0.8;
  box(g, u0, v0, u1, v1, 8, '#e8d8b8');
  // timber trim
  g.strokeStyle = '#8a5a3c'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(...P(u0, v1, 4)); g.lineTo(...P(u1, v1, 4)); g.moveTo(...P(u1, v1, 4)); g.lineTo(...P(u1, v0, 4)); g.stroke();
  const [dx, dy] = P((u0 + u1) / 2, v1, 0); g.fillStyle = '#7a4e34'; g.fillRect(dx - 1.5, dy - 5, 3, 5);
  windows(g, u1, u1, (v0 + v1) / 2, 6.5, 1, '#f5d78a');
  gable(g, u0, v0, u1, v1, 8, 7, roof);
  if (rnd() < 0.6) { const [cx, cy] = P(u0 + s * 0.25, (v0 + v1) / 2, 13); g.fillStyle = '#8c6e5a'; g.fillRect(cx - 1.2, cy - 4, 2.4, 4); }
}

// ---------------- regional homes ----------------
// Each style: walls, trim, roof colours and roof shape. Original designs inspired by broad regional building traditions.
export const STYLES = {
  temperate: { name: 'Timber-framed', wall: '#e8d8b8', trim: '#8a5a3c', roofs: ['#c0603e', '#c9a35a', '#7a6b8f', '#b5543c'], roof: 'gable', rh: 7, chimney: true },
  nordic: { name: 'Nordic', wall: '#7a5236', trim: '#5a3a24', roofs: ['#56704a', '#44505a', '#62744e'], roof: 'gable', rh: 11, chimney: true, door: '#c8a060' },
  mediterranean: { name: 'Mediterranean', wall: '#f4eee2', roofs: ['#c8643c', '#d07448', '#b85a36'], roof: 'hip', rh: 4, shutters: ['#4a7aa8', '#5a9a7a', '#c0703e'] },
  desert: { name: 'Adobe', wall: '#d9b47c', roofs: ['#c9a06a'], roof: 'flat', dome: '#efe2c8' },
  tropical: { name: 'Stilt house', wall: '#c9a36a', trim: '#8a6a3a', roofs: ['#b8984a', '#a88a40', '#c4a458'], roof: 'gable', rh: 10, stilts: true, over: 0.13 },
  eastasian: { name: 'Curved-eave', wall: '#efe6d6', trim: '#5a3a2a', roofs: ['#4a5a6a', '#3c6a50', '#6a4a3a'], roof: 'curved', rh: 6 },
  slavic: { name: 'Log house', wall: '#9a6a42', roofs: ['#5f7a4e', '#8a5a3a', '#55667a', '#7a3a32'], roof: 'gable', rh: 10, chimney: true, logs: true, shutters: ['#e8dcc0', '#c0503e', '#4a7aa8'], door: '#5a3a24' },
  indian: { name: 'Haveli', wall: '#e8b878', walls: ['#e8b878', '#e89a7a', '#f0d6a8', '#a8c8d8', '#d8a8c0'], roofs: ['#d8b890'], roof: 'flat', chhatri: true, arches: true, trim: '#b8503a' },
  andean: { name: 'Andean stone', wall: '#a89a88', roofs: ['#c8a050', '#b89040', '#d0ac5c'], roof: 'hip', rh: 9, stone: true, door: '#6a4a2a' },
  arabic: { name: 'Domed', wall: '#f4efe6', roofs: ['#e8e0d0'], roof: 'flat', dome: '#f8f4ec', domeCols: ['#f8f4ec', '#4a8ab8', '#3a9a8a', '#e8c070'], arches: true, alwaysDome: true },
};

export function home(g, st, du, dv, sz, h, roofCol, rnd, opts = {}) {
  const u0 = 0.5 - sz / 2 + du, v0 = 0.5 - sz / 2 + dv, u1 = u0 + sz, v1 = v0 + sz * (opts.deep || 0.8);
  const z0 = st.stilts ? 4 : 0;
  if (st.stilts) {
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.2;
    for (const [u, v] of [[u0 + 0.03, v1 - 0.03], [u1 - 0.03, v1 - 0.03], [u1 - 0.03, v0 + 0.03]]) { g.beginPath(); g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, z0)); g.stroke(); }
  }
  box(g, u0, v0, u1, v1, h, opts.wall || st.wall, z0);
  if (st.logs || st.stone) { // log courses, or fitted stone blocks
    g.strokeStyle = st.logs ? 'rgba(60,36,20,0.5)' : 'rgba(70,62,52,0.45)'; g.lineWidth = st.logs ? 0.7 : 0.5; g.beginPath();
    for (let z = z0 + 2; z < z0 + h; z += st.logs ? 2 : 2.6) { g.moveTo(...P(u0, v1, z)); g.lineTo(...P(u1, v1, z)); g.lineTo(...P(u1, v0, z)); }
    if (st.stone) for (let k = 1; k < 5; k++) { const f = u0 + (u1 - u0) * k / 5; for (let z = z0 + (k & 1 ? 0 : 1.3); z < z0 + h - 1; z += 2.6) { g.moveTo(...P(f, v1, z)); g.lineTo(...P(f, v1, z + 1.3)); } }
    g.stroke();
  }
  if (st.trim) {
    g.strokeStyle = st.trim; g.lineWidth = 0.8; g.beginPath();
    for (const z of h > 11 ? [z0 + h / 2] : [z0 + h * 0.5]) { g.moveTo(...P(u0, v1, z)); g.lineTo(...P(u1, v1, z)); g.lineTo(...P(u1, v0, z)); }
    g.moveTo(...P(u1, v1, z0)); g.lineTo(...P(u1, v1, z0 + h)); g.stroke();
  }
  // door and windows
  const [dx, dy] = P((u0 + u1) / 2, v1, z0); g.fillStyle = st.door || '#7a4e34'; g.fillRect(dx - 1.5, dy - 5, 3, 5);
  const floors = h > 11 ? 2 : 1;
  for (let f = 0; f < floors; f++) {
    const z = z0 + 6.5 + f * 6.5;
    windows(g, u1, u1, (v0 + v1) / 2, z, 1, '#f5d78a');
    if (f > 0 || sz > 0.45) windows(g, u0 + 0.04, u1 - 0.04, v1, z, f > 0 ? 2 : 1, '#f5d78a');
    if (st.arches) { // pointed or rounded arches over the windows
      g.fillStyle = 'rgba(70,50,40,0.55)';
      for (const [u, v] of [[u1, (v0 + v1) / 2], [(u0 + u1) / 2, v1]]) { const [ax, ay] = P(u, v, z + 0.5); g.beginPath(); g.ellipse(ax, ay - 1.2, 1.6, 1.8, 0, Math.PI, 0); g.fill(); }
    }
    if (st.shutters) {
      g.fillStyle = st.shutters[(rnd() * st.shutters.length) | 0];
      const [wx, wy] = P(u1, (v0 + v1) / 2, z); g.fillRect(wx - 2.4, wy - 2.5, 0.9, 3); g.fillRect(wx + 1.5, wy - 2.5, 0.9, 3);
    }
  }
  const top = z0 + h;
  if (st.roof === 'gable') gable(g, u0, v0, u1, v1, top, st.rh * (sz / 0.5), roofCol, st.over || 0.05);
  else if (st.roof === 'hip') hip(g, u0, v0, u1, v1, top, st.rh * (sz / 0.5) + 1, roofCol);
  else if (st.roof === 'curved') {
    gable(g, u0, v0, u1, v1, top, st.rh * (sz / 0.5), roofCol, 0.1);
    // upturned eave tips
    g.strokeStyle = rgb(hex(roofCol), 0.6); g.lineWidth = 1.6;
    for (const [u, v] of [[u0 - 0.1, v1 + 0.1], [u1 + 0.1, v1 + 0.1], [u1 + 0.1, v0 - 0.1]]) {
      const [x, y] = P(u, v, top); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (u > 0.5 ? 2 : -2), y, x + (u > 0.5 ? 3 : -3), y - 3); g.stroke();
    }
    const [rx, ry] = P(u1 + 0.1, (v0 + v1) / 2, top + st.rh * (sz / 0.5)); g.fillStyle = rgb(hex(roofCol), 0.6); g.beginPath(); g.arc(rx, ry, 1.2, 0, 7); g.fill();
  } else if (st.roof === 'flat') {
    box(g, u0, v1 - 0.04, u1, v1, 2, opts.wall || st.wall, top); box(g, u1 - 0.04, v0, u1, v1, 2, opts.wall || st.wall, top);
    if (opts.dome || (st.alwaysDome && rnd() < 0.8)) {
      const [cx, cy] = P((u0 + u1) / 2, (v0 + v1) / 2, top); const r = sz * 14;
      const dc = st.domeCols ? st.domeCols[(rnd() * st.domeCols.length) | 0] : '#fbf2dc';
      const gr = g.createLinearGradient(cx - r, 0, cx + r, 0); gr.addColorStop(0, rgb(hex(dc), 1.08)); gr.addColorStop(1, rgb(hex(dc), 0.75));
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r, r * 0.9, 0, Math.PI, 0); g.closePath(); g.fill();
      if (st.domeCols) { g.fillStyle = '#e8c040'; g.fillRect(cx - 0.4, cy - r * 0.9 - 2.5, 0.8, 2.5); }
    }
    if (st.chhatri) { // a little domed pavilion on the roof terrace
      const [cx, cy] = P(u1 - sz * 0.22, v0 + sz * 0.2, top);
      g.strokeStyle = rgb(hex(opts.wall || st.wall), 0.7); g.lineWidth = 0.8; g.beginPath(); for (const dx of [-2.6, 2.6]) { g.moveTo(cx + dx, cy); g.lineTo(cx + dx, cy - 4.5); } g.stroke();
      g.fillStyle = rgb(hex(opts.wall || st.wall), 1.05); g.beginPath(); g.ellipse(cx, cy - 4.5, 3.6, 3.2, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = '#c0503e'; g.fillRect(cx - 0.4, cy - 8.6, 0.8, 1.6);
    }
  }
  if (st.chimney && rnd() < 0.7) { const [cx, cy] = P(u0 + sz * 0.25, (v0 + v1) / 2, top + st.rh * 0.8); g.fillStyle = '#8c6e5a'; g.fillRect(cx - 1.2, cy - 4, 2.4, 4); }
}

export function hedge(g, u0, v0, u1, v1) {
  g.strokeStyle = '#4f7f3e'; g.lineWidth = 2.4; g.beginPath();
  g.moveTo(...P(u0, v1)); g.lineTo(...P(u1, v1)); g.lineTo(...P(u1, v0)); g.stroke();
}

// Little touches around a home, so no two houses look quite alike.
export function yardProp(g, kind, u, v, rnd) {
  const [x, y] = P(u, v);
  if (kind === 'woodpile') { for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) { g.fillStyle = '#8a5f3c'; g.beginPath(); g.arc(x + j * 2.6 + k * 1.3 - 3, y - 1.2 - k * 2.2, 1.3, 0, 7); g.fill(); g.fillStyle = '#d8b07a'; g.beginPath(); g.arc(x + j * 2.6 + k * 1.3 - 3, y - 1.2 - k * 2.2, 0.7, 0, 7); g.fill(); } }
  else if (kind === 'barrels') { cyl(g, u, v, 0, 1.8, 3.2, '#8a5f3c'); cyl(g, u + 0.08, v + 0.03, 0, 1.8, 3.2, '#9a6a44'); }
  else if (kind === 'washing') {
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 7, y - 8); g.moveTo(x + 7, y + 2); g.lineTo(x + 7, y - 6); g.stroke();
    g.strokeStyle = 'rgba(80,70,60,0.6)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x - 7, y - 7.5); g.lineTo(x + 7, y - 5.5); g.stroke();
    const cols = ['#f4f0e6', '#c0503e', '#4a78a8', '#e8c040']; for (let k = 0; k < 3; k++) { g.fillStyle = cols[(k + ((rnd() * 4) | 0)) % 4]; g.fillRect(x - 5 + k * 4, y - 7.2 + k * 0.6, 2.6, 3); }
  } else if (kind === 'fence') {
    g.strokeStyle = '#a07a50'; g.lineWidth = 0.8; g.beginPath();
    const [ax, ay] = P(0.06, 0.95), [bx, by] = P(0.94, 0.95); g.moveTo(ax, ay - 2); g.lineTo(bx, by - 2);
    for (let k = 0; k <= 6; k++) { const px = ax + (bx - ax) * k / 6, py = ay + (by - ay) * k / 6; g.moveTo(px, py); g.lineTo(px, py - 3); } g.stroke();
  } else if (kind === 'flowers') { for (let k = 0; k < 7; k++) { g.fillStyle = ['#f2b6c6', '#f4e9a8', '#e8705a', '#c8a0f0', '#ffffff'][k % 5]; g.fillRect(x - 6 + rnd() * 12, y - 2 + rnd() * 3, 1.6, 1.6); } g.fillStyle = '#6a9a4a'; g.fillRect(x - 6, y + 1, 12, 1); }
  else if (kind === 'tree') tree(g, x, y + 2, 0.75, rnd() < 0.5 ? 'round' : 'pine', rnd);
  else if (kind === 'bush') { g.fillStyle = '#6a9a4a'; g.beginPath(); g.arc(x, y - 2, 3, 0, 7); g.arc(x + 3, y - 1.4, 2.4, 0, 7); g.fill(); }
}

export const tintHex = (hexCol, k) => { const c = hex(hexCol); return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join(''); };

export const PROPS = ['woodpile', 'barrels', 'washing', 'fence', 'flowers', 'tree', 'bush'];

export const HOME_VARIANTS = 6;

export function homeSprite(styleKey, lv, v) {
  const st = STYLES[styleKey], rnd = mulberry32(v * 131 + lv * 17 + styleKey.length * 7 + 5);
  const roof = () => st.roofs[(rnd() * st.roofs.length) | 0];
  const wall = tintHex(st.walls ? st.walls[(rnd() * st.walls.length) | 0] : st.wall, 0.9 + rnd() * 0.18); // each house painted a slightly different shade
  const props = PROPS.slice().sort(() => rnd() - 0.5).slice(0, 1 + (v % 2));
  return make(72, 92, 36, 68, (g) => {
    shadow(g, 21, 9.5);
    if (props.includes('fence')) yardProp(g, 'fence', 0, 0, rnd);
    const behind = props.filter((p) => p === 'tree' || p === 'washing');
    for (const p of behind) yardProp(g, p, 0.82, 0.22, rnd);
    const o = { wall };
    if (lv === 1) {
      const layout = v % 4;
      if (layout === 0) home(g, st, 0, 0, 0.5, 8, roof(), rnd, { ...o, dome: st.dome && rnd() < 0.5 });
      else if (layout === 1) { home(g, st, -0.17, -0.12, 0.36, 8, roof(), rnd, o); home(g, st, 0.16, 0.2, 0.34, 8, roof(), rnd, { ...o, dome: st.dome && rnd() < 0.5 }); }
      else if (layout === 2) { home(g, st, -0.1, -0.02, 0.44, 8, roof(), rnd, o); home(g, st, 0.22, 0.08, 0.24, 6, roof(), rnd, { ...o, deep: 1.1 }); } // with a side extension
      else { home(g, st, 0.04, 0.04, 0.42, 9, roof(), rnd, { ...o, deep: 1 }); box(g, 0.28, 0.72, 0.62, 0.84, 5, '#a07a50'); } // lean-to porch
    } else if (lv === 2) {
      const layout = v % 3;
      if (layout === 0) home(g, st, 0, 0.02, 0.56, 14, roof(), rnd, { ...o, deep: 0.75, dome: st.dome && rnd() < 0.5 });
      else if (layout === 1) { home(g, st, -0.06, -0.02, 0.46, 15, roof(), rnd, { ...o, deep: 0.85 }); home(g, st, 0.26, 0.16, 0.26, 8, roof(), rnd, { ...o, deep: 0.9 }); }
      else { home(g, st, 0.04, 0, 0.6, 13, roof(), rnd, { ...o, deep: 0.62 }); }
    } else {
      // manor: main hall, a side wing and a little garden, laid out differently each time
      hedge(g, 0.04, 0.05, 0.96, 0.96);
      if (v % 2) { home(g, st, 0.16, -0.14, 0.4, 9, roof(), rnd, { ...o, deep: 0.8 }); home(g, st, -0.06, 0.1, 0.58, 15, roof(), rnd, { ...o, deep: 0.72, dome: !!st.dome }); }
      else { home(g, st, -0.14, -0.12, 0.42, 9, roof(), rnd, { ...o, deep: 0.8 }); home(g, st, 0.08, 0.08, 0.6, 15, roof(), rnd, { ...o, deep: 0.72, dome: !!st.dome }); }
      g.fillStyle = '#f2b6c6'; for (const [u, v2] of [[0.85, 0.9], [0.9, 0.6], [0.2, 0.92]]) { const [x, y] = P(u, v2); g.beginPath(); g.arc(x, y - 1, 1.3, 0, 7); g.fill(); }
    }
    for (const p of props.filter((q) => !behind.includes(q) && q !== 'fence')) yardProp(g, p, v % 2 ? 0.2 : 0.86, v % 2 ? 0.86 : 0.78, rnd);
  });
}

// Homes are drawn on first use per style and level, keeping memory low.
export function homeArt(style, lv) {
  const k = style + lv;
  if (!homeCache[k]) homeCache[k] = Array.from({ length: HOME_VARIANTS }, (_, v) => homeSprite(style, lv, v));
  return homeCache[k];
}

export const homeCache = {};
