// Procedurally drawn isometric sprites. Base tile is 64x32; sprites are rendered at 2x for crispness.
import { B, BIOMES } from './world.js';
import { mulberry32 } from './noise.js';

export const TB = 64;          // base tile width
const R = 3;                   // render resolution multiplier (crisp at 3x pixel density)
export const SPR = { ground: [], decor: [], build: {}, misc: {} };

function make(w, h, ax, ay, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
  const g = c.getContext('2d');
  g.scale(R, R); g.translate(ax, ay);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { c, w, h, ax, ay };
}
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function diamond(g, hw = 32, hh = 16, cx = 0, cy = 0) {
  g.beginPath(); g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath();
}
function poly(g, pts, fill, stroke) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.6; g.stroke(); }
}
// Isometric projection of footprint coords (u,v in tile units, 0..1 covers the tile) and height z (px).
const P = (u, v, z = 0) => [(u - v) * 32, (u + v - 1) * 16 - z];

// Box from (u0,v0) to (u1,v1), height h, optionally raised by z0.
function box(g, u0, v0, u1, v1, h, wall, z0 = 0, top = null) {
  const L = hex(wall);
  poly(g, [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z0 + h), P(u0, v1, z0 + h)], rgb(L, 1.0), rgb(L, 0.7)); // front-left face
  poly(g, [P(u1, v1, z0), P(u1, v0, z0), P(u1, v0, z0 + h), P(u1, v1, z0 + h)], rgb(L, 0.78), rgb(L, 0.6)); // front-right face
  poly(g, [P(u0, v0, z0 + h), P(u1, v0, z0 + h), P(u1, v1, z0 + h), P(u0, v1, z0 + h)], top || rgb(L, 1.12), rgb(L, 0.75));
}
// Gable roof over box footprint, ridge running along u.
function gable(g, u0, v0, u1, v1, h, rh, roof, over = 0.05) {
  const C = hex(roof), vm = (v0 + v1) / 2;
  u0 -= over; v0 -= over; u1 += over; v1 += over;
  poly(g, [P(u0, v0, h), P(u1, v0, h), P(u1, vm, h + rh), P(u0, vm, h + rh)], rgb(C, 0.82), rgb(C, 0.6)); // back slope
  poly(g, [P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rh)], rgb(C, 0.7), rgb(C, 0.55));                    // gable end
  poly(g, [P(u0, vm, h + rh), P(u1, vm, h + rh), P(u1, v1, h), P(u0, v1, h)], rgb(C, 1.05), rgb(C, 0.65)); // front slope
}
function cone(g, u, v, z, r, h, col) {
  const [x, y] = P(u, v, z), C = hex(col);
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - h); g.lineTo(x + r, y); g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.closePath();
  const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, rgb(C, 1.12)); gr.addColorStop(1, rgb(C, 0.72));
  g.fillStyle = gr; g.fill();
}
function cyl(g, u, v, z, r, h, col) {
  const [x, y] = P(u, v, z), C = hex(col);
  const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, rgb(C, 1.1)); gr.addColorStop(1, rgb(C, 0.7));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r, y - h); g.ellipse(x, y - h, r, r / 2, 0, Math.PI, 0); g.lineTo(x + r, y);
  g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.fill();
  g.fillStyle = rgb(C, 1.2); g.beginPath(); g.ellipse(x, y - h, r, r / 2, 0, 0, Math.PI * 2); g.fill();
}
function flag(g, x, y, h, col) {
  g.strokeStyle = '#5a4030'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h); g.quadraticCurveTo(x + 5, y - h + 1, x + 9, y - h + 3); g.lineTo(x, y - h + 6); g.fill();
}
function shadow(g, rx = 22, ry = 10, cy = 2) {
  g.fillStyle = 'rgba(30,40,20,0.18)'; g.beginPath(); g.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}
function windows(g, u0, u1, v, z, n, col = '#3c3a40') {
  g.fillStyle = col;
  for (let k = 0; k < n; k++) {
    const u = u0 + ((k + 0.5) / n) * (u1 - u0);
    const [x, y] = P(u, v, z); g.fillRect(x - 1.2, y - 2.5, 2.4, 3);
  }
}
function crenels(g, u0, v0, u1, v1, h, col) {
  const n = 4;
  for (let k = 0; k < n; k++) {
    const a = u0 + (k / n) * (u1 - u0), b = a + (u1 - u0) / (n * 1.8);
    box(g, a, v1 - 0.06, b, v1, 3, col, h);
    const c = v0 + (k / n) * (v1 - v0), d = c + (v1 - v0) / (n * 1.8);
    box(g, u1 - 0.06, c, u1, d, 3, col, h);
  }
}

// ---------------- ground tiles ----------------
function groundTile(b, variant) {
  const col = BIOMES[b].color, rnd = mulberry32(b * 101 + variant * 7 + 3);
  return make(66, 34, 33, 17, (g) => {
    diamond(g, 32.6, 16.4);
    const k = 0.97 + variant * 0.02;
    g.fillStyle = rgb(col, k); g.fill();
    g.save(); diamond(g, 32, 16); g.clip();
    // soft lower-edge shading for a gentle board-game feel
    const gr = g.createLinearGradient(0, -16, 0, 16); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.07)');
    g.fillStyle = gr; g.fillRect(-33, -17, 66, 34);
    const dots = b === B.SNOW || b === B.SEAICE ? 10 : 22;
    for (let i = 0; i < dots; i++) {
      const x = (rnd() - 0.5) * 56, y = (rnd() - 0.5) * 26;
      g.fillStyle = rgb(col, rnd() < 0.5 ? 0.88 : 1.1, 0.7);
      g.fillRect(x, y, 1.5 + rnd() * 1.5, 1 + rnd());
    }
    if (b === B.GRASS || b === B.STEPPE || b === B.SAVANNA) {
      g.strokeStyle = rgb(col, 0.8, 0.8); g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const x = (rnd() - 0.5) * 44, y = (rnd() - 0.5) * 18;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - 3); g.moveTo(x, y); g.lineTo(x + 1.2, y - 3); g.stroke();
      }
      if (b === B.GRASS && rnd() < 0.6) {
        for (let i = 0; i < 3; i++) { g.fillStyle = ['#f4e9a8', '#f2b6c6', '#ffffff'][i]; g.fillRect((rnd() - 0.5) * 40, (rnd() - 0.5) * 16, 1.6, 1.6); }
      }
    }
    if (b === B.DESERT) {
      g.strokeStyle = rgb(col, 0.86); g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const y = -8 + i * 7 + rnd() * 3, x = (rnd() - 0.5) * 20; g.beginPath(); g.moveTo(x - 14, y + 2); g.quadraticCurveTo(x, y - 3, x + 14, y + 2); g.stroke(); }
    }
    if (b === B.SHALLOW) {
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.9;
      for (let i = 0; i < 2; i++) { const x = (rnd() - 0.5) * 30, y = (rnd() - 0.5) * 14; g.beginPath(); g.moveTo(x - 4, y); g.quadraticCurveTo(x, y - 2, x + 4, y); g.stroke(); }
    }
    if (b === B.OCEAN) {
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.8;
      const x = (rnd() - 0.5) * 30, y = (rnd() - 0.5) * 14; g.beginPath(); g.moveTo(x - 4, y); g.quadraticCurveTo(x, y - 2, x + 4, y); g.stroke();
    }
    g.restore();
  });
}

// ---------------- decorations ----------------
function tree(g, x, y, s, kind, rnd) {
  g.fillStyle = 'rgba(30,40,20,0.2)'; g.beginPath(); g.ellipse(x + 1, y + 1, 5 * s, 2.4 * s, 0, 0, Math.PI * 2); g.fill();
  if (kind === 'pine') {
    g.fillStyle = '#6b4a32'; g.fillRect(x - 0.8 * s, y - 3 * s, 1.6 * s, 3 * s);
    const c = [[54, 92, 66], [44, 80, 58]][rnd() < 0.5 ? 0 : 1];
    for (let k = 0; k < 3; k++) {
      const yy = y - 3 * s - k * 4.5 * s, w = (6 - k * 1.4) * s;
      g.fillStyle = rgb(c, 1 + k * 0.08); g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 7 * s); g.lineTo(x + w, yy); g.closePath(); g.fill();
      g.fillStyle = rgb(c, 0.75); g.beginPath(); g.moveTo(x, yy - 7 * s); g.lineTo(x + w, yy); g.lineTo(x + w * 0.2, yy); g.closePath(); g.fill();
    }
    return;
  }
  if (kind === 'snowpine') {
    g.fillStyle = '#6b4a32'; g.fillRect(x - 0.8 * s, y - 3 * s, 1.6 * s, 3 * s);
    for (let k = 0; k < 3; k++) {
      const yy = y - 3 * s - k * 4.5 * s, w = (6 - k * 1.4) * s;
      g.fillStyle = '#4a6a5a'; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 7 * s); g.lineTo(x + w, yy); g.closePath(); g.fill();
      g.fillStyle = '#eef3f6'; g.beginPath(); g.moveTo(x - w * 0.5, yy - 3.5 * s); g.lineTo(x, yy - 7 * s); g.lineTo(x + w * 0.4, yy - 3.8 * s); g.closePath(); g.fill();
    }
    return;
  }
  if (kind === 'acacia') {
    g.strokeStyle = '#6b4a32'; g.lineWidth = 1.2 * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 7 * s); g.lineTo(x - 3 * s, y - 10 * s); g.moveTo(x, y - 7 * s); g.lineTo(x + 3 * s, y - 10 * s); g.stroke();
    g.fillStyle = '#7f9a4a'; g.beginPath(); g.ellipse(x, y - 11 * s, 8 * s, 2.6 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#93ad58'; g.beginPath(); g.ellipse(x - 1, y - 12 * s, 6 * s, 1.6 * s, 0, 0, Math.PI * 2); g.fill();
    return;
  }
  if (kind === 'palm') {
    g.fillStyle = '#5c4630'; g.fillRect(x - 0.9 * s, y - 6 * s, 1.8 * s, 6 * s);
    const c = [[46, 102, 52], [58, 120, 60], [38, 90, 48]];
    for (let k = 0; k < 3; k++) {
      g.fillStyle = rgb(c[k]); g.beginPath();
      g.arc(x + (k - 1) * 3.5 * s, y - 9 * s - (k === 1 ? 2.5 * s : 0), 5 * s, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - 2 * s, y - 13 * s, 2.5 * s, 0, Math.PI * 2); g.fill();
    return;
  }
  if (kind === 'cactus') {
    g.strokeStyle = '#5f8a4a'; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 9 * s); g.moveTo(x, y - 4 * s); g.lineTo(x - 3 * s, y - 5 * s); g.lineTo(x - 3 * s, y - 7 * s);
    g.moveTo(x, y - 5 * s); g.lineTo(x + 3 * s, y - 6 * s); g.lineTo(x + 3 * s, y - 8 * s); g.stroke();
    return;
  }
  // round deciduous tree
  g.fillStyle = '#6b4a32'; g.fillRect(x - 0.9 * s, y - 4 * s, 1.8 * s, 4 * s);
  const base = [[96, 148, 72], [84, 136, 64], [110, 156, 76], [168, 150, 70]][Math.floor(rnd() * (rnd() < 0.08 ? 4 : 3))];
  g.fillStyle = rgb(base, 0.85); g.beginPath(); g.arc(x, y - 8 * s, 5.6 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgb(base, 1); g.beginPath(); g.arc(x - 1.2 * s, y - 9 * s, 4.4 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgb(base, 1.18); g.beginPath(); g.arc(x - 2 * s, y - 10.5 * s, 2 * s, 0, Math.PI * 2); g.fill();
}

const SPOTS = [[-12, -2], [11, -3], [0, 5], [-2, -8], [16, 3], [-17, 3], [6, -9], [-7, 7], [8, 8]];
function treeCluster(kind, variant, n) {
  const rnd = mulberry32(variant * 31 + kind.length * 7);
  return make(70, 64, 35, 46, (g) => {
    const spots = SPOTS.slice().sort(() => rnd() - 0.5).slice(0, n).sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) tree(g, x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 2, 0.8 + rnd() * 0.35, kind, rnd);
  });
}
function mountain(variant, snowy) {
  const rnd = mulberry32(variant * 13 + (snowy ? 99 : 0));
  return make(76, 76, 38, 56, (g) => {
    const peaks = [[-9 + rnd() * 4, 30 + rnd() * 8, 20], [7 + rnd() * 5, 22 + rnd() * 8, 17]].sort((a, b) => b[1] - a[1]);
    for (const [px, h, w] of peaks) {
      const top = [px, 6 - h], l = [px - w, 8], r = [px + w, 8];
      poly(g, [l, top, [px + 2, 8]], snowy ? '#b8bcc6' : '#9a9088');
      poly(g, [[px + 2, 8], top, r], snowy ? '#8c92a0' : '#766d66');
      // snow cap
      const sh = h * (snowy ? 0.55 : 0.32);
      const k = sh / h;
      poly(g, [[top[0] - w * k, top[1] + sh], top, [top[0] + w * k, top[1] + sh], [top[0] + w * k * 0.3, top[1] + sh * 0.75], [top[0] - w * k * 0.2, top[1] + sh * 0.9]], '#f4f6f8');
      poly(g, [[top[0], top[1]], [top[0] + w * k, top[1] + sh], [top[0] + w * k * 0.3, top[1] + sh * 0.75]], '#d6dce4');
    }
  });
}
function hills(variant) {
  const rnd = mulberry32(variant * 17 + 5);
  return make(70, 50, 35, 34, (g) => {
    const hs = [[-10 + rnd() * 6, -2, 13], [9 + rnd() * 4, 3, 11]];
    for (const [x, y, r] of hs) {
      const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, '#b0ad74'); gr.addColorStop(1, '#7f7c52');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.45, r * 0.35, r * 0.18, 0, 0, Math.PI * 2); g.fill();
    }
    if (rnd() < 0.5) tree(g, 2, 9, 0.7, 'round', rnd);
  });
}
function rocks(variant, snowy) {
  const rnd = mulberry32(variant * 23 + 1);
  return make(64, 40, 32, 24, (g) => {
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * 30, y = (rnd() - 0.5) * 12, r = 2 + rnd() * 2.5;
      g.fillStyle = snowy ? '#c8ccd2' : '#8c877c'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0); g.fill();
      g.fillStyle = snowy ? '#f2f4f6' : '#a8a296'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.4, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    }
  });
}

// ---------------- buildings ----------------
const ROOFS = ['#c0603e', '#c9a35a', '#7a6b8f', '#b5543c', '#6d7b8a'];
function cottage(g, du, dv, s, roof, rnd) {
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
function field(g, rnd) {
  g.save(); diamond(g, 29, 14.5); g.clip();
  const crops = [['#d9b44a', '#c79a36'], ['#9bbd5a', '#7fa046'], ['#c8c060', '#a8a048']][Math.floor(rnd() * 3)];
  g.fillStyle = '#8a6a44'; g.fillRect(-32, -16, 64, 32);
  for (let k = -8; k < 8; k++) {
    g.strokeStyle = crops[k & 1 ? 0 : 1]; g.lineWidth = 2.6;
    const [ax, ay] = P(0, k / 8 + 0.5 / 8), [bx, by] = P(1, k / 8 + 0.5 / 8);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  g.restore();
  diamond(g, 29, 14.5); g.strokeStyle = 'rgba(110,80,50,0.6)'; g.lineWidth = 1; g.stroke();
}

function buildingSprites() {
  const S = SPR.build, frame = (draw, w = 72, h = 84, ax = 36, ay = 62) => make(w, h, ax, ay, draw);
  S.house = [0, 1, 2, 3].map((v) => frame((g) => {
    const rnd = mulberry32(v * 77 + 3);
    shadow(g, 20, 9);
    if (v % 2) { cottage(g, -0.17, -0.12, 0.36, ROOFS[v], rnd); cottage(g, 0.16, 0.2, 0.34, ROOFS[(v + 2) % 5], rnd); }
    else { cottage(g, 0, 0, 0.5, ROOFS[v], rnd); g.fillStyle = '#7aa04a'; g.beginPath(); g.arc(18, 4, 3, 0, 7); g.fill(); }
  }));
  S.farm = [0, 1, 2].map((v) => frame((g) => {
    const rnd = mulberry32(v * 5 + 11);
    field(g, rnd);
    // haystack
    const [x, y] = P(0.82, 0.25, 0); g.fillStyle = '#e0bf5a'; g.beginPath(); g.ellipse(x, y, 4, 4, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#c9a344'; g.fillRect(x - 4, y - 0.5, 8, 1.5);
  }));
  S.workshop = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.25, 0.25, 0.75, 0.7, 10, '#c8b498');
    windows(g, 0.25, 0.75, 0.7, 7, 2, '#f5d78a');
    gable(g, 0.25, 0.25, 0.75, 0.7, 10, 7, '#6d7b8a');
    box(g, 0.32, 0.3, 0.4, 0.38, 10, '#8c6e5a', 14);
    const [x, y] = P(0.85, 0.85, 0); g.fillStyle = '#5a5a62'; g.fillRect(x - 3, y - 3, 6, 3); g.fillRect(x - 1, y - 5, 2, 2);
    g.fillStyle = '#9a7a56'; g.fillRect(x - 10, y - 4, 4, 4);
  })];
  S.lumber = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.2, 0.2, 0.55, 0.5, 8, '#b08a62');
    gable(g, 0.2, 0.2, 0.55, 0.5, 8, 6, '#8a5a3c');
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) {
      const [x, y] = P(0.62 + j * 0.1 + k * 0.05, 0.72, k * 3.4);
      g.fillStyle = '#8a5f3c'; g.beginPath(); g.arc(x, y - 2, 2, 0, 7); g.fill();
      g.fillStyle = '#d8b07a'; g.beginPath(); g.arc(x, y - 2, 1.2, 0, 7); g.fill();
    }
    const [sx, sy] = P(0.3, 0.85, 0); g.fillStyle = '#9a7048'; g.beginPath(); g.ellipse(sx, sy, 2.5, 1.3, 0, 0, 7); g.fill();
  })];
  S.dock = [frame((g) => {
    g.fillStyle = '#9a7048'; poly(g, [P(0.1, 0.35), P(0.9, 0.35), P(0.9, 0.65), P(0.1, 0.65)], '#a57a4e', '#7a5634');
    for (let k = 0; k < 5; k++) { g.strokeStyle = '#7a5634'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(...P(0.1 + k * 0.18, 0.35)); g.lineTo(...P(0.1 + k * 0.18, 0.65)); g.stroke(); }
    box(g, 0.15, 0.12, 0.42, 0.34, 7, '#c8b498'); gable(g, 0.15, 0.12, 0.42, 0.34, 7, 5, '#5f7a8a');
    const [x, y] = P(0.75, 0.85, 0);
    g.fillStyle = '#8a5a3c'; g.beginPath(); g.moveTo(x - 8, y - 2); g.lineTo(x + 8, y - 2); g.lineTo(x + 5, y + 2); g.lineTo(x - 5, y + 2); g.fill();
    g.strokeStyle = '#5a4030'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x, y - 14); g.stroke();
    g.fillStyle = '#f1ead8'; g.beginPath(); g.moveTo(x + 0.5, y - 13); g.lineTo(x + 7, y - 4); g.lineTo(x + 0.5, y - 4); g.fill();
  })];
  S.quarry = [frame((g) => {
    diamond(g, 24, 12); g.fillStyle = '#9c968c'; g.fill();
    diamond(g, 15, 7.5, 0, 2); g.fillStyle = '#76716a'; g.fill();
    for (let k = 0; k < 4; k++) { const [x, y] = P(0.25 + k * 0.15, 0.82 - (k % 2) * 0.1, 0); g.fillStyle = '#c8c2b6'; g.fillRect(x - 3, y - 3, 6, 3.5); g.fillStyle = '#a49e92'; g.fillRect(x - 3, y, 6, 1); }
    g.strokeStyle = '#7a5634'; g.lineWidth = 1.2; const [cx, cy] = P(0.2, 0.3, 0);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 2, cy - 18); g.lineTo(cx + 14, cy - 14); g.stroke();
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx + 14, cy - 14); g.lineTo(cx + 14, cy - 5); g.stroke();
  })];
  S.mine = [frame((g) => {
    g.fillStyle = '#8f8a6e'; g.beginPath(); g.ellipse(0, 4, 26, 18, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#76715a'; g.beginPath(); g.ellipse(8, 4, 16, 12, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#2c2622'; g.beginPath(); g.ellipse(-2, 4, 6, 8, 0, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = '#8a5f3c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-8, 4); g.lineTo(-8, -5); g.lineTo(4, -5); g.lineTo(4, 4); g.stroke();
    g.fillStyle = '#5a5a62'; g.fillRect(9, 4, 8, 4); g.fillStyle = '#7a8088'; g.beginPath(); g.arc(11, 4, 2, 0, 7); g.arc(15, 4, 2, 0, 7); g.fill();
  })];
  S.tower = [frame((g) => {
    shadow(g, 12, 6);
    box(g, 0.36, 0.36, 0.64, 0.64, 32, '#b4aca0');
    crenels(g, 0.36, 0.36, 0.64, 0.64, 32, '#b4aca0');
    windows(g, 0.45, 0.55, 0.64, 22, 1); windows(g, 0.45, 0.55, 0.64, 12, 1);
    const [x, y] = P(0.5, 0.5, 35); flag(g, x, y, 12, '#c0503e');
  }, 72, 100, 36, 78)];
  S.market = [frame((g) => {
    diamond(g, 26, 13); g.fillStyle = '#c9b48e'; g.fill();
    const stall = (u, v, c1) => {
      box(g, u, v, u + 0.28, v + 0.22, 6, '#a57a4e');
      const C = hex(c1);
      for (let k = 0; k < 4; k++) {
        const a = u + (k / 4) * 0.28, b = a + 0.07;
        poly(g, [P(a, v - 0.03, 11), P(b, v - 0.03, 11), P(b, v + 0.27, 7), P(a, v + 0.27, 7)], k % 2 ? '#f4eee0' : rgb(C));
      }
      const [x, y] = P(u + 0.14, v + 0.24, 6); g.fillStyle = '#e8a040'; g.beginPath(); g.arc(x - 2, y - 1, 1.3, 0, 7); g.fill(); g.fillStyle = '#9bbd5a'; g.beginPath(); g.arc(x + 2, y - 1, 1.3, 0, 7); g.fill();
    };
    stall(0.15, 0.18, '#c0503e'); stall(0.55, 0.22, '#4a78a8'); stall(0.3, 0.58, '#5a9a5a');
  })];
  S.townhall = [frame((g) => {
    shadow(g, 24, 11);
    box(g, 0.18, 0.22, 0.82, 0.78, 13, '#ead9b6');
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 0.9;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(...P(0.18 + k * 0.16, 0.78, 0)); g.lineTo(...P(0.18 + k * 0.16, 0.78, 13)); g.stroke(); }
    windows(g, 0.2, 0.8, 0.78, 9, 3, '#f5d78a');
    gable(g, 0.18, 0.22, 0.82, 0.78, 13, 11, '#b5543c');
    const [x, y] = P(0.5, 0.5, 24); flag(g, x, y, 14, '#d9a440');
  }, 80, 96, 40, 70)];
  // Capital keep grows with the realm's tier.
  S.castle = [0, 1, 2, 3, 4].map((t) => frame((g) => {
    shadow(g, 28, 13);
    const stone = '#bdb4a6';
    if (t >= 2) { // curtain wall
      box(g, 0.08, 0.08, 0.92, 0.18, 9, stone); box(g, 0.82, 0.08, 0.92, 0.92, 9, stone);
    }
    const kh = 18 + t * 5;
    box(g, 0.28, 0.28, 0.72, 0.72, kh, stone);
    crenels(g, 0.28, 0.28, 0.72, 0.72, kh, stone);
    windows(g, 0.32, 0.68, 0.72, kh - 7, 2); windows(g, 0.72, 0.72, 0.5, kh - 7, 1);
    const [dx, dy] = P(0.5, 0.72, 0); g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(dx, dy - 4, 2.6, 4, 0, Math.PI, 0); g.lineTo(dx + 2.6, dy); g.lineTo(dx - 2.6, dy); g.fill();
    if (t >= 1) { cyl(g, 0.2, 0.8, 0, 4.5, kh - 4, stone); cone(g, 0.2, 0.8, kh - 4, 5.5, 9, '#4a5f8a'); }
    if (t >= 2) { cyl(g, 0.82, 0.82, 0, 4.5, kh - 4, stone); cone(g, 0.82, 0.82, kh - 4, 5.5, 9, '#4a5f8a'); }
    if (t >= 3) { cyl(g, 0.82, 0.18, 0, 4, kh, stone); cone(g, 0.82, 0.18, kh, 5, 10, '#4a5f8a'); }
    if (t >= 4) { box(g, 0.08, 0.82, 0.92, 0.92, 9, stone); cyl(g, 0.12, 0.12, 0, 4, kh, stone); cone(g, 0.12, 0.12, kh, 5, 10, '#4a5f8a'); }
    const [x, y] = P(0.5, 0.5, kh + 3); flag(g, x, y, 14, '#c0503e');
  }, 88, 116, 44, 86));
  S.scaffold = [frame((g) => {
    diamond(g, 24, 12); g.fillStyle = 'rgba(160,130,90,0.55)'; g.fill();
    g.strokeStyle = '#9a7048'; g.lineWidth = 1.3;
    const pts = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]];
    for (const [u, v] of pts) { g.beginPath(); g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 16)); g.stroke(); }
    g.beginPath(); for (let z of [8, 16]) { g.moveTo(...P(0.25, 0.75, z)); g.lineTo(...P(0.75, 0.75, z)); g.lineTo(...P(0.75, 0.25, z)); } g.stroke();
    g.beginPath(); g.moveTo(...P(0.25, 0.75, 0)); g.lineTo(...P(0.75, 0.75, 16)); g.stroke();
    g.fillStyle = '#c8c2b6'; const [x, y] = P(0.4, 0.55, 0); g.fillRect(x - 4, y - 3, 8, 3);
  })];
  S.village = [0, 1, 2].map((v) => frame((g) => {
    const rnd = mulberry32(v * 9 + 4);
    shadow(g, 24, 11);
    const hut = (u, vv, r) => {
      const [x, y] = P(u, vv, 0);
      g.fillStyle = '#c9b08a'; g.beginPath(); g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.lineTo(x - r, y - 5); g.lineTo(x + r, y - 5); g.closePath();
      g.fillRect(x - r, y - 5, r * 2, 5);
      cone(g, u, vv, 5, r + 1.5, 8, '#b89a52');
    };
    hut(0.3, 0.35, 5); hut(0.68, 0.38, 4.5); hut(0.45, 0.7, 5.5);
    if (rnd() < 0.7) tree(g, 20, 4, 0.7, 'round', rnd);
  }));
  const W = (draw) => make(110, 130, 55, 100, draw);
  S.library = [W((g) => {
    shadow(g, 30, 14);
    box(g, 0.1, 0.15, 0.9, 0.85, 4, '#d8d0c0');
    box(g, 0.18, 0.22, 0.82, 0.78, 20, '#ece4d4', 4);
    for (let k = 0; k < 6; k++) cyl(g, 0.2 + k * 0.12, 0.84, 4, 1.6, 18, '#f6f0e4');
    const [x, y] = P(0.5, 0.5, 24);
    g.fillStyle = '#7d9cb4'; g.beginPath(); g.ellipse(x, y, 14, 7, 0, Math.PI, 0); g.ellipse(x, y, 14, 7, 0, 0, Math.PI); g.fill();
    const gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, '#a8c4d8'); gr.addColorStop(1, '#5f7f96');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, Math.PI, 0); g.ellipse(x, y, 14, 7, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#d9a440'; g.fillRect(x - 1, y - 20, 2, 6);
  })];
  S.gardens = [W((g) => {
    diamond(g, 30, 15); g.fillStyle = '#8cc06a'; g.fill();
    g.strokeStyle = '#3f7a42'; g.lineWidth = 3;
    diamond(g, 22, 11); g.stroke(); diamond(g, 12, 6); g.stroke();
    g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-30, 0); g.lineTo(30, 0); g.moveTo(0, -15); g.lineTo(0, 15); g.stroke();
    const flowers = ['#f2b6c6', '#f4e9a8', '#e8705a', '#ffffff'];
    const rnd = mulberry32(42);
    for (let i = 0; i < 26; i++) { g.fillStyle = flowers[i % 4]; const a = rnd() * 6.28, r = 6 + rnd() * 18; g.fillRect(Math.cos(a) * r, Math.sin(a) * r * 0.5, 1.8, 1.8); }
    cyl(g, 0.5, 0.5, 0, 6, 3, '#d8d0c0'); g.fillStyle = '#7ab8d8'; g.beginPath(); g.ellipse(0, -3, 5, 2.5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,230,255,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(0, -14, 3, -6); g.moveTo(0, -3); g.quadraticCurveTo(0, -14, -3, -6); g.stroke();
    for (const [x, y] of [[-24, -2], [24, -2], [0, -13], [0, 12]]) tree(g, x, y, 0.8, 'round', rnd);
  })];
  S.lighthouse = [W((g) => {
    shadow(g, 18, 8);
    box(g, 0.25, 0.25, 0.75, 0.75, 6, '#a8a296');
    const levels = 6;
    for (let k = 0; k < levels; k++) cyl(g, 0.5, 0.5, 6 + k * 9, 8 - k * 0.6, 9, k % 2 ? '#c0503e' : '#f2ece0');
    cyl(g, 0.5, 0.5, 6 + levels * 9, 5, 7, '#3c3a40');
    const [x, y] = P(0.5, 0.5, 6 + levels * 9 + 4);
    const gl = g.createRadialGradient(x, y, 1, x, y, 16); gl.addColorStop(0, 'rgba(255,240,170,0.95)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
    cone(g, 0.5, 0.5, 6 + levels * 9 + 7, 6, 6, '#c0503e');
  })];
  S.greatcastle = [W((g) => {
    shadow(g, 34, 16);
    const st = '#c4bbae';
    box(g, 0.05, 0.05, 0.95, 0.15, 14, st); box(g, 0.85, 0.05, 0.95, 0.95, 14, st);
    box(g, 0.25, 0.25, 0.75, 0.75, 40, st); crenels(g, 0.25, 0.25, 0.75, 0.75, 40, st);
    windows(g, 0.3, 0.7, 0.75, 32, 3); windows(g, 0.3, 0.7, 0.75, 20, 3);
    box(g, 0.05, 0.85, 0.95, 0.95, 14, st);
    for (const [u, v] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) { cyl(g, u, v, 0, 6, 26, st); cone(g, u, v, 26, 7.5, 14, '#3f5a8a'); }
    const [x, y] = P(0.5, 0.5, 44); flag(g, x, y, 18, '#c0503e');
  })];
  S.cathedral = [W((g) => {
    shadow(g, 28, 13);
    const st = '#d8cfbf';
    box(g, 0.15, 0.3, 0.85, 0.7, 26, st);
    gable(g, 0.15, 0.3, 0.85, 0.7, 26, 16, '#5f6e80', 0.02);
    windows(g, 0.2, 0.8, 0.7, 18, 4, '#7ab0d8');
    box(g, 0.68, 0.38, 0.9, 0.62, 44, st);
    const [x, y] = P(0.79, 0.5, 44); g.fillStyle = '#5f6e80'; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x, y - 30); g.lineTo(x + 8, y); g.fill();
    g.fillStyle = '#48566a'; g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x, y - 30); g.lineTo(x + 8, y); g.fill();
    g.fillStyle = '#d9a440'; g.fillRect(x - 0.6, y - 36, 1.2, 6); g.fillRect(x - 2.5, y - 34, 5, 1.2);
    const [rx, ry] = P(0.9, 0.5, 34); g.fillStyle = '#c0503e'; g.beginPath(); g.arc(rx - 3, ry, 3, 0, 7); g.fill();
  })];
}

// ---------------- zone markers ----------------
function zoneMarker(color) {
  return make(66, 34, 33, 17, (g) => {
    diamond(g, 28, 14); g.fillStyle = color + '40'; g.fill();
    g.setLineDash([3, 2.5]); g.strokeStyle = color; g.lineWidth = 1.4; g.stroke();
  });
}

export function buildSprites() {
  for (let b = 0; b < BIOMES.length; b++) SPR.ground[b] = [0, 1, 2, 3].map((v) => groundTile(b, v));
  const D = SPR.decor;
  D[B.FOREST] = [0, 1, 2, 3, 4, 5].map((v) => treeCluster('round', v, 4 + (v % 3)));
  D[B.TAIGA] = [0, 1, 2, 3, 4, 5].map((v) => treeCluster('pine', v, 4 + (v % 3)));
  D[B.JUNGLE] = [0, 1, 2, 3, 4, 5].map((v) => treeCluster('palm', v, 6 + (v % 3)));
  D[B.SAVANNA] = [0, 1, 2].map((v) => treeCluster('acacia', v, 1 + (v % 2)));
  D[B.GRASS] = [0, 1, 2].map((v) => treeCluster('round', v + 10, 1 + (v % 2)));
  D[B.STEPPE] = [0, 1].map((v) => rocks(v, false));
  D[B.DESERT] = [0, 1].map((v) => treeCluster('cactus', v, 1));
  D[B.TUNDRA] = [0, 1, 2].map((v) => (v === 2 ? treeCluster('snowpine', v, 2) : rocks(v, false)));
  D[B.SNOW] = [0, 1].map((v) => rocks(v, true));
  D[B.HILLS] = [0, 1, 2, 3].map((v) => hills(v));
  D[B.MOUNTAIN] = [0, 1, 2, 3].map((v) => mountain(v, false));
  SPR.misc.snowpeak = [0, 1, 2].map((v) => mountain(v, true));
  buildingSprites();
  SPR.misc.zone = {};
  SPR.misc.zone.housing = zoneMarker('#e8a25a');
  SPR.misc.zone.farmland = zoneMarker('#d6c75a');
  SPR.misc.zone.workshop = zoneMarker('#8f8ad8');
}
// How often each biome shows decoration (0..1)
export const DECOR_DENSITY = { [B.FOREST]: 0.92, [B.TAIGA]: 0.9, [B.JUNGLE]: 0.97, [B.SAVANNA]: 0.22, [B.GRASS]: 0.1, [B.STEPPE]: 0.08, [B.DESERT]: 0.04, [B.TUNDRA]: 0.15, [B.SNOW]: 0.06, [B.HILLS]: 0.85, [B.MOUNTAIN]: 1 };

// Small icon images for UI (data URLs) of buildings.
export function spriteIcon(spr, size = 56) {
  const c = document.createElement('canvas'); c.width = c.height = size * 2;
  const g = c.getContext('2d');
  const s = Math.min((size * 2) / spr.c.width, (size * 2) / spr.c.height) * 0.95;
  g.drawImage(spr.c, (size * 2 - spr.c.width * s) / 2, (size * 2 - spr.c.height * s) / 2, spr.c.width * s, spr.c.height * s);
  return c.toDataURL();
}
