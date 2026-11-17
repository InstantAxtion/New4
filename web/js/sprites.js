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
  // walls: lit from the upper left, a touch darker towards the ground, with a crisp corner and a soft base
  const faceGrad = (k, a, b) => { const gr = g.createLinearGradient(0, a, 0, b); gr.addColorStop(0, rgb(L, k * 1.04)); gr.addColorStop(1, rgb(L, k * 0.9)); return gr; };
  const fl = [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z0 + h), P(u0, v1, z0 + h)], fr = [P(u1, v1, z0), P(u1, v0, z0), P(u1, v0, z0 + h), P(u1, v1, z0 + h)];
  poly(g, fl, h > 3 ? faceGrad(1.0, fl[3][1], fl[0][1]) : rgb(L, 1.0), rgb(L, 0.68)); // front-left face
  poly(g, fr, h > 3 ? faceGrad(0.78, fr[3][1], fr[0][1]) : rgb(L, 0.78), rgb(L, 0.58)); // front-right face
  poly(g, [P(u0, v0, z0 + h), P(u1, v0, z0 + h), P(u1, v1, z0 + h), P(u0, v1, z0 + h)], top || rgb(L, 1.12), rgb(L, 0.75));
  if (h > 3) {
    g.strokeStyle = rgb(L, 1.25, 0.7); g.lineWidth = 0.6; g.beginPath(); g.moveTo(...P(u1, v1, z0 + 0.5)); g.lineTo(...P(u1, v1, z0 + h - 0.3)); g.stroke(); // sunlit corner
    g.strokeStyle = 'rgba(40,30,20,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(...P(u0, v1, z0 + 0.4)); g.lineTo(...P(u1, v1, z0 + 0.4)); g.lineTo(...P(u1, v0, z0 + 0.4)); g.stroke(); // plinth
  }
}
// Gable roof over box footprint, ridge running along u.
function gable(g, u0, v0, u1, v1, h, rh, roof, over = 0.05) {
  const C = hex(roof), vm = (v0 + v1) / 2;
  // a soft shadow where the eaves overhang the walls
  g.fillStyle = 'rgba(30,20,10,0.16)'; g.beginPath(); g.moveTo(...P(u0, v1, h)); g.lineTo(...P(u1, v1, h)); g.lineTo(...P(u1, v0, h)); g.lineTo(...P(u1, v0, h - 1.6)); g.lineTo(...P(u1, v1, h - 1.6)); g.lineTo(...P(u0, v1, h - 1.6)); g.closePath(); g.fill();
  u0 -= over; v0 -= over; u1 += over; v1 += over;
  poly(g, [P(u0, v0, h), P(u1, v0, h), P(u1, vm, h + rh), P(u0, vm, h + rh)], rgb(C, 0.82), rgb(C, 0.6)); // back slope
  poly(g, [P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rh)], rgb(C, 0.7), rgb(C, 0.55));                    // gable end
  const front = [P(u0, vm, h + rh), P(u1, vm, h + rh), P(u1, v1, h), P(u0, v1, h)];
  const gr = g.createLinearGradient(0, front[0][1], 0, front[3][1]); gr.addColorStop(0, rgb(C, 1.14)); gr.addColorStop(1, rgb(C, 0.96));
  poly(g, front, gr, rgb(C, 0.62)); // front slope, brighter near the ridge
  // rows of tiles or shingles across the front slope
  g.strokeStyle = rgb(C, 0.72, 0.55); g.lineWidth = 0.5; g.beginPath();
  const rows = Math.max(2, Math.round(rh / 2.2));
  for (let k = 1; k < rows; k++) { const f = k / rows, v = vm + (v1 - vm) * f, z = h + rh * (1 - f); g.moveTo(...P(u0, v, z)); g.lineTo(...P(u1, v, z)); }
  g.stroke();
  g.strokeStyle = rgb(C, 1.3, 0.85); g.lineWidth = 0.9; g.beginPath(); g.moveTo(...P(u0, vm, h + rh)); g.lineTo(...P(u1, vm, h + rh)); g.stroke(); // ridge cap
  g.strokeStyle = rgb(C, 0.55, 0.8); g.lineWidth = 0.7; g.beginPath(); g.moveTo(...P(u0, v1, h)); g.lineTo(...P(u1, v1, h)); g.stroke(); // eave edge
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
  for (let k = 0; k < n; k++) {
    const u = u0 + ((k + 0.5) / n) * (u1 - u0);
    const [x, y] = P(u, v, z);
    g.fillStyle = 'rgba(60,40,28,0.55)'; g.fillRect(x - 1.7, y - 3, 3.4, 4); // frame
    g.fillStyle = col; g.fillRect(x - 1.2, y - 2.5, 2.4, 3);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 1.2, y - 2.5, 1, 1.2); // a glint on the glass
    g.fillStyle = 'rgba(60,40,28,0.5)'; g.fillRect(x - 0.15, y - 2.5, 0.3, 3); // mullion
    g.fillStyle = 'rgba(240,230,210,0.85)'; g.fillRect(x - 1.9, y + 0.6, 3.8, 0.7); // sill
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
function groundTile(b, variant, snowy = false) {
  const col = snowy ? [236, 241, 246] : BIOMES[b].color, under = BIOMES[b].color, rnd = mulberry32(b * 101 + variant * 7 + 3);
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
      g.fillStyle = snowy && rnd() < 0.45 ? rgb(under, 0.95, 0.75) : rgb(col, rnd() < 0.5 ? 0.88 : 1.1, 0.7);
      g.fillRect(x, y, 1.5 + rnd() * 1.5, 1 + rnd());
    }
    if (!snowy && (b === B.GRASS || b === B.STEPPE || b === B.SAVANNA)) {
      g.strokeStyle = rgb(col, 0.8, 0.8); g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const x = (rnd() - 0.5) * 44, y = (rnd() - 0.5) * 18;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - 3); g.moveTo(x, y); g.lineTo(x + 1.2, y - 3); g.stroke();
      }
      if (b === B.GRASS && rnd() < 0.6) {
        for (let i = 0; i < 3; i++) { g.fillStyle = ['#f4e9a8', '#f2b6c6', '#ffffff'][i]; g.fillRect((rnd() - 0.5) * 40, (rnd() - 0.5) * 16, 1.6, 1.6); }
      }
    }
    if (!snowy && b === B.DESERT) {
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
  if (kind === 'bare' || kind === 'baresnow') {
    // winter tree: trunk and branches, with snow resting on top when snowy
    g.strokeStyle = '#6b4a32'; g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 9 * s);
    g.moveTo(x, y - 5 * s); g.lineTo(x - 4 * s, y - 10 * s); g.moveTo(x, y - 6 * s); g.lineTo(x + 4.5 * s, y - 11 * s);
    g.moveTo(x, y - 9 * s); g.lineTo(x - 1.5 * s, y - 13 * s); g.moveTo(x, y - 8 * s); g.lineTo(x + 2 * s, y - 13.5 * s); g.stroke();
    g.lineWidth = 0.7 * s; g.strokeStyle = '#7d5a40';
    g.beginPath(); g.moveTo(x - 3 * s, y - 8.5 * s); g.lineTo(x - 5.5 * s, y - 9 * s); g.moveTo(x + 3.5 * s, y - 9.5 * s); g.lineTo(x + 6 * s, y - 9.5 * s); g.stroke();
    if (kind === 'baresnow') {
      g.fillStyle = '#f4f7fa';
      for (const [dx, dy, r] of [[-4, -10.4, 1.6], [4.5, -11.4, 1.7], [-1.5, -13.4, 1.3], [2, -13.9, 1.3], [0, -9.4, 1.2]]) {
        g.beginPath(); g.ellipse(x + dx * s, y + dy * s, r * s, r * 0.55 * s, 0, Math.PI, 0); g.fill();
      }
    }
    return;
  }
  // round deciduous tree (summer green, autumn colours or spring blossom)
  g.fillStyle = '#6b4a32'; g.fillRect(x - 0.9 * s, y - 4 * s, 1.8 * s, 4 * s);
  const PAL = {
    autumn: [[214, 128, 52], [196, 84, 48], [226, 172, 62], [176, 112, 52]],
    blossom: [[242, 196, 214], [250, 226, 234], [234, 172, 198], [246, 210, 222]],
  };
  const base = PAL[kind] ? PAL[kind][Math.floor(rnd() * 4)]
    : [[96, 148, 72], [84, 136, 64], [110, 156, 76], [168, 150, 70]][Math.floor(rnd() * (rnd() < 0.08 ? 4 : 3))];
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
function hills(variant, snowy = false) {
  const rnd = mulberry32(variant * 17 + 5);
  return make(70, 50, 35, 34, (g) => {
    const hs = [[-10 + rnd() * 6, -2, 13], [9 + rnd() * 4, 3, 11]];
    for (const [x, y, r] of hs) {
      const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, snowy ? '#f2f5f8' : '#b0ad74'); gr.addColorStop(1, snowy ? '#c4ccd6' : '#7f7c52');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.45, r * 0.35, r * 0.18, 0, 0, Math.PI * 2); g.fill();
    }
    if (rnd() < 0.5) tree(g, 2, 9, 0.7, snowy ? 'baresnow' : 'round', rnd);
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
function hip(g, u0, v0, u1, v1, z, rh, roof, over = 0.05) {
  const C = hex(roof), vm = (v0 + v1) / 2, inset = (u1 - u0) * 0.28;
  u0 -= over; v0 -= over; u1 += over; v1 += over;
  const ru0 = u0 + inset, ru1 = u1 - inset;
  poly(g, [P(u0, v0, z), P(u1, v0, z), P(ru1, vm, z + rh), P(ru0, vm, z + rh)], rgb(C, 0.82), rgb(C, 0.6));
  poly(g, [P(u1, v0, z), P(u1, v1, z), P(ru1, vm, z + rh)], rgb(C, 0.72), rgb(C, 0.55));
  poly(g, [P(ru0, vm, z + rh), P(ru1, vm, z + rh), P(u1, v1, z), P(u0, v1, z)], rgb(C, 1.05), rgb(C, 0.65));
}
function home(g, st, du, dv, sz, h, roofCol, rnd, opts = {}) {
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
function hedge(g, u0, v0, u1, v1) {
  g.strokeStyle = '#4f7f3e'; g.lineWidth = 2.4; g.beginPath();
  g.moveTo(...P(u0, v1)); g.lineTo(...P(u1, v1)); g.lineTo(...P(u1, v0)); g.stroke();
}
// Little touches around a home, so no two houses look quite alike.
function yardProp(g, kind, u, v, rnd) {
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
const tintHex = (hexCol, k) => { const c = hex(hexCol); return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join(''); };
const PROPS = ['woodpile', 'barrels', 'washing', 'fence', 'flowers', 'tree', 'bush'];
export const HOME_VARIANTS = 6;
function homeSprite(styleKey, lv, v) {
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
const homeCache = {};

function field(g, rnd, snowy = false) {
  if (snowy) {
    g.save(); diamond(g, 29, 14.5); g.clip();
    g.fillStyle = '#eef2f6'; g.fillRect(-32, -16, 64, 32);
    for (let k = -8; k < 8; k++) { g.strokeStyle = 'rgba(150,130,110,0.35)'; g.lineWidth = 1.2; const [ax, ay] = P(0, k / 8 + 0.5 / 8), [bx, by] = P(1, k / 8 + 0.5 / 8); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.restore(); diamond(g, 29, 14.5); g.strokeStyle = 'rgba(110,80,50,0.45)'; g.lineWidth = 1; g.stroke();
    return;
  }
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
  S.farmSnow = [0, 1].map((v) => frame((g) => field(g, mulberry32(v + 3), true)));
  // Harbour: a long pier, a warehouse, a little crane and a moored ship
  S.harbour = [frame((g) => {
    poly(g, [P(0.05, 0.42), P(1.05, 0.42), P(1.05, 0.66), P(0.05, 0.66)], '#a57a4e', '#7a5634');
    for (let k = 0; k < 7; k++) { g.strokeStyle = '#7a5634'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(...P(0.08 + k * 0.14, 0.42)); g.lineTo(...P(0.08 + k * 0.14, 0.66)); g.stroke(); }
    box(g, 0.08, 0.08, 0.5, 0.38, 12, '#c8b498'); gable(g, 0.08, 0.08, 0.5, 0.38, 12, 7, '#7a5a48');
    for (let k = 0; k < 3; k++) { const [x, y] = P(0.58 + k * 0.08, 0.3, 0); g.fillStyle = '#9a7048'; g.fillRect(x - 2.5, y - 4, 5, 4); g.fillStyle = '#b88a58'; g.fillRect(x - 2.5, y - 4, 5, 1.2); }
    g.strokeStyle = '#5a4030'; g.lineWidth = 1.4; const [cx, cy] = P(0.92, 0.5, 0);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 22); g.lineTo(cx - 12, cy - 18); g.stroke();
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx - 12, cy - 18); g.lineTo(cx - 12, cy - 9); g.stroke(); g.fillStyle = '#9a7048'; g.fillRect(cx - 14, cy - 9, 4, 3);
    const [sx2, sy2] = P(0.62, 0.95, 0);
    g.fillStyle = '#6e4a30'; g.beginPath(); g.moveTo(sx2 - 12, sy2 - 3); g.lineTo(sx2 + 12, sy2 - 3); g.lineTo(sx2 + 9, sy2 + 2); g.lineTo(sx2 - 9, sy2 + 2); g.closePath(); g.fill();
    g.strokeStyle = '#4a3020'; g.lineWidth = 0.9; for (const m of [-4, 4]) { g.beginPath(); g.moveTo(sx2 + m, sy2 - 3); g.lineTo(sx2 + m, sy2 - 20); g.stroke(); }
    g.fillStyle = '#f6f0e2'; for (const m of [-4, 4]) { g.beginPath(); g.moveTo(sx2 + m + 0.6, sy2 - 19); g.quadraticCurveTo(sx2 + m + 7, sy2 - 12, sx2 + m + 0.6, sy2 - 5); g.fill(); }
    g.fillStyle = '#c0503e'; g.fillRect(sx2 + 4, sy2 - 23, 4, 2);
  }, 80, 96, 40, 66)];
  // Town green: lawn, flower beds, two shade trees and a bench
  S.green = [frame((g) => {
    diamond(g, 29, 14.5); g.fillStyle = '#8cc06a'; g.fill();
    g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(0.5, 0.05)); g.lineTo(...P(0.5, 0.95)); g.stroke();
    const rnd = mulberry32(77);
    for (const [u, v] of [[0.25, 0.3], [0.75, 0.7], [0.3, 0.75], [0.72, 0.25]]) {
      const [x, y] = P(u, v); g.fillStyle = '#6a9a4a'; g.beginPath(); g.ellipse(x, y, 5, 2.5, 0, 0, 7); g.fill();
      for (let k = 0; k < 5; k++) { g.fillStyle = ['#f2b6c6', '#f4e9a8', '#e8705a', '#ffffff', '#b8a0e0'][k]; g.fillRect(x - 4 + rnd() * 8, y - 1.5 + rnd() * 3, 1.5, 1.5); }
    }
    const [bx, by] = P(0.6, 0.5); g.fillStyle = '#8a5a3c'; g.fillRect(bx - 4, by - 2.5, 8, 1.5); g.fillRect(bx - 4, by - 4.5, 8, 1);
    tree(g, -14, -2, 0.85, 'round', rnd); tree(g, 13, 4, 0.8, 'round', rnd);
  })];
  // Fountain square: paving and a round basin with a little jet of water
  S.fountain = [frame((g) => {
    diamond(g, 30, 15); g.fillStyle = '#d6cdbd'; g.fill();
    g.strokeStyle = 'rgba(150,140,125,0.6)'; g.lineWidth = 0.6;
    for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(...P(k / 6, 0)); g.lineTo(...P(k / 6, 1)); g.moveTo(...P(0, k / 6)); g.lineTo(...P(1, k / 6)); g.stroke(); }
    cyl(g, 0.5, 0.5, 0, 11, 3, '#c8c0b0'); g.fillStyle = '#7ab8d8'; g.beginPath(); g.ellipse(0, -3, 9, 4.5, 0, 0, 7); g.fill();
    cyl(g, 0.5, 0.5, 3, 2, 7, '#c8c0b0');
    g.strokeStyle = 'rgba(210,235,255,0.95)'; g.lineWidth = 1.1;
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(d * 3, -17, d * 7, -4); g.stroke(); }
    g.fillStyle = 'rgba(210,235,255,0.9)'; g.beginPath(); g.arc(0, -11, 1.4, 0, 7); g.fill();
  })];
  // Regional homes: SPR.homes[style][level-1][variant]

  // a single hut for growing neighbour villages
  S.hut = [0, 1, 2].map((v) => frame((g) => {
    const [x, y] = P(0.5, 0.55, 0), r = 5 + v * 0.6;
    g.fillStyle = 'rgba(30,40,20,0.18)'; g.beginPath(); g.ellipse(x, y + 1, r + 3, (r + 3) / 2, 0, 0, 7); g.fill();
    g.fillStyle = '#c9b08a'; g.fillRect(x - r, y - 5, r * 2, 5); g.beginPath(); g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.fill();
    cone(g, 0.5, 0.55, 5, r + 1.5, 8, v === 1 ? '#a88a48' : '#b89a52');
  }));
  S.farm = [0, 1, 2].map((v) => frame((g) => {
    const rnd = mulberry32(v * 5 + 11);
    field(g, rnd);
    // haystack
    const [x, y] = P(0.82, 0.25, 0); g.fillStyle = '#e0bf5a'; g.beginPath(); g.ellipse(x, y, 4, 4, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#c9a344'; g.fillRect(x - 4, y - 0.5, 8, 1.5);
  }));
  S.workshop = [0, 1].map((v) => frame((g) => {
    shadow(g, 22, 10);
    const wall = v ? '#d8c4a4' : '#e2d2b4';
    box(g, 0.2, 0.25, 0.78, 0.7, 11, wall);
    g.strokeStyle = '#6e4a30'; g.lineWidth = 0.9; g.beginPath();
    for (const u of [0.2, 0.39, 0.59, 0.78]) { g.moveTo(...P(u, 0.7, 0)); g.lineTo(...P(u, 0.7, 11)); }
    g.moveTo(...P(0.2, 0.7, 6)); g.lineTo(...P(0.78, 0.7, 6)); g.lineTo(...P(0.78, 0.25, 6)); g.stroke();
    windows(g, 0.6, 0.78, 0.7, 9, 1, '#f5d78a'); windows(g, 0.78, 0.78, 0.48, 9, 1, '#f5d78a');
    const [dx, dy] = P(0.33, 0.7, 0); g.fillStyle = '#3a2a20'; g.fillRect(dx - 3.5, dy - 7, 7, 7); g.fillStyle = '#c89a5a'; g.fillRect(dx - 2.5, dy - 3, 5, 1); // open door, a bench inside
    gable(g, 0.2, 0.25, 0.78, 0.7, 11, 8, v ? '#6d7b8a' : '#8a5a3c');
    const [cx, cy] = P(0.3, 0.45, 17); g.fillStyle = '#7a6a5a'; g.fillRect(cx - 1.5, cy - 6, 3, 6);
    const [sx, sy] = P(0.52, 0.72, 9); g.strokeStyle = '#3c3a40'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 4, sy); g.stroke(); g.fillStyle = '#c0a060'; g.fillRect(sx + 1.5, sy + 0.5, 4, 3); g.fillStyle = '#5a3a24'; g.fillRect(sx + 2.5, sy + 1.5, 2, 1);
    box(g, 0.82, 0.78, 0.92, 0.88, 3, '#a07a50'); box(g, 0.84, 0.66, 0.92, 0.74, 3, '#8a6a44'); box(g, 0.85, 0.79, 0.91, 0.86, 2.4, '#b08a5a', 3);
    const [wx, wy] = P(0.1, 0.85); g.fillStyle = '#8a5f3c'; g.fillRect(wx - 3, wy - 2.5, 6, 2.5); g.fillStyle = '#9a9488'; g.fillRect(wx - 1, wy - 4, 2, 1.6);
  }));
  // Pasture: a fenced meadow with a water trough (the sheep themselves wander about live)
  S.pasture = [0, 1].map((v) => frame((g) => {
    const rnd = mulberry32(v * 13 + 5);
    diamond(g, 29, 14.5); g.fillStyle = v ? '#94c46c' : '#8cbc66'; g.fill();
    g.save(); diamond(g, 29, 14.5); g.clip();
    for (let k = 0; k < 40; k++) { const [x, y] = P(rnd(), rnd()); g.fillStyle = rnd() < 0.15 ? '#f4f0d0' : 'rgba(70,120,50,0.45)'; g.fillRect(x, y, 1.2, rnd() < 0.15 ? 1.2 : 2); }
    g.restore();
    const post = (u, w) => { const [x, y] = P(u, w); g.fillStyle = '#7a5634'; g.fillRect(x - 0.6, y - 5, 1.2, 5); };
    g.strokeStyle = '#9a7048'; g.lineWidth = 0.9;
    for (const h of [2.2, 4.2]) {
      g.beginPath(); g.moveTo(...P(0.04, 0.96, h)); g.lineTo(...P(0.96, 0.96, h)); g.lineTo(...P(0.96, 0.04, h)); g.stroke();
      g.beginPath(); g.moveTo(...P(0.04, 0.96, h)); g.lineTo(...P(0.04, 0.04, h)); g.lineTo(...P(0.96, 0.04, h)); g.stroke();
    }
    for (let k = 0; k <= 4; k++) { post(0.04 + k * 0.23, 0.96); post(0.96, 0.04 + k * 0.23); post(0.04, 0.04 + k * 0.23); post(0.04 + k * 0.23, 0.04); }
    box(g, 0.66, 0.2, 0.86, 0.3, 2.4, '#8a6040', 0, '#7ab0d0');
  }));
  // Woodlot: neat rows of young trees, a few stumps and a log pile
  S.woodlot = [0, 1].map((v) => frame((g) => {
    const rnd = mulberry32(v * 31 + 7);
    diamond(g, 29, 14.5); g.fillStyle = '#6f8f4c'; g.fill();
    g.save(); diamond(g, 29, 14.5); g.clip();
    for (let k = 0; k < 30; k++) { const [x, y] = P(rnd(), rnd()); g.fillStyle = 'rgba(90,64,40,0.35)'; g.fillRect(x, y, 2, 1); }
    g.restore();
    const spots = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) spots.push([0.2 + a * 0.3, 0.2 + b * 0.3]);
    spots.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
    for (const [u, w] of spots) {
      const [x, y] = P(u, w);
      if (rnd() < 0.18) { g.fillStyle = '#9a7048'; g.beginPath(); g.ellipse(x, y, 2.2, 1.1, 0, 0, 7); g.fill(); g.fillStyle = '#d8b07a'; g.beginPath(); g.ellipse(x, y - 0.4, 1.4, 0.7, 0, 0, 7); g.fill(); continue; }
      tree(g, x, y, 0.62 + rnd() * 0.22, v ? 'pine' : 'round', rnd);
    }
  }));
  // Park: lawn, a winding path, a pond, a bench and flower beds
  S.park = [0, 1].map((v) => frame((g) => {
    const rnd = mulberry32(v * 17 + 3);
    diamond(g, 29, 14.5); g.fillStyle = '#92c870'; g.fill();
    g.strokeStyle = '#e8dcc0'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...P(0.02, 0.5)); g.bezierCurveTo(...P(0.4, 0.2), ...P(0.55, 0.85), ...P(0.98, 0.5)); g.stroke();
    const [px, py] = P(v ? 0.3 : 0.7, v ? 0.72 : 0.28);
    g.fillStyle = '#6aa8d0'; g.beginPath(); g.ellipse(px, py, 6, 3, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(px - 1.5, py - 0.8, 2.5, 0.8, 0, 0, 7); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(px + 2, py - 0.5, 1.2, 0.8, 0, 0, 7); g.fill(); g.fillRect(px + 2.6, py - 2.2, 0.6, 1.8);
    for (const [u, w] of [[0.2, 0.25], [0.8, 0.75], [0.62, 0.15]]) {
      const [x, y] = P(u, w); g.fillStyle = '#6a9a4a'; g.beginPath(); g.ellipse(x, y, 4, 2, 0, 0, 7); g.fill();
      for (let k = 0; k < 5; k++) { g.fillStyle = ['#f2b6c6', '#f4e9a8', '#e8705a', '#ffffff', '#b8a0e0'][(k + v) % 5]; g.fillRect(x - 3 + rnd() * 6, y - 1.2 + rnd() * 2.4, 1.4, 1.4); }
    }
    const [bx, by] = P(0.5, 0.42); g.fillStyle = '#8a5a3c'; g.fillRect(bx - 3.5, by - 2.2, 7, 1.3); g.fillRect(bx - 3.5, by - 4.2, 7, 0.9); g.fillRect(bx - 3, by - 1, 0.8, 1.6); g.fillRect(bx + 2.2, by - 1, 0.8, 1.6);
    const [lx, ly] = P(0.28, 0.42); g.fillStyle = '#3c3a40'; g.fillRect(lx - 0.4, ly - 9, 0.8, 9); g.fillStyle = '#f5d78a'; g.fillRect(lx - 1.2, ly - 10.5, 2.4, 2);
    tree(g, ...P(0.85, 0.3), 0.8, 'round', rnd); tree(g, ...P(0.2, 0.85), 0.75, 'round', rnd);
  }));
  // Shops: two little shopfronts with striped awnings and a stall
  S.shops = [0, 1, 2].map((v) => frame((g) => {
    const aw = [['#c0503e', '#f4ead8'], ['#3f7fb0', '#f4ead8'], ['#4f8f4a', '#f4ead8']][v];
    shadow(g, 22, 10);
    box(g, 0.12, 0.2, 0.47, 0.62, 11, ['#e2cfa8', '#d8c0a0', '#e8dcc4'][v]);
    gable(g, 0.12, 0.2, 0.47, 0.62, 11, 6, ['#8a4a3a', '#5f6f80', '#7a5a3a'][v]);
    box(g, 0.53, 0.2, 0.88, 0.62, 9, ['#d4c4a8', '#e6d6b6', '#cdb894'][v]);
    gable(g, 0.53, 0.2, 0.88, 0.62, 9, 5, ['#6d7b8a', '#9a5a40', '#5a6a50'][v]);
    for (const [u0, u1, h] of [[0.12, 0.47, 6], [0.53, 0.88, 5]]) {
      windows(g, u0 + 0.04, u1 - 0.04, 0.62, 1.5, 2, '#f5d78a');
      const n = 6;
      for (let k = 0; k < n; k++) {
        const a = u0 + (k / n) * (u1 - u0), b = u0 + ((k + 1) / n) * (u1 - u0);
        poly(g, [P(a, 0.62, h), P(b, 0.62, h), P(b, 0.74, h - 2.5), P(a, 0.74, h - 2.5)], aw[k & 1], null);
      }
    }
    const [x, y] = P(0.72, 0.9); g.fillStyle = '#8a5a3c'; g.fillRect(x - 4, y - 3, 8, 3);
    for (let k = 0; k < 4; k++) { g.fillStyle = ['#e8705a', '#f0c040', '#7ab04a', '#c06a9a'][(k + v) % 4]; g.beginPath(); g.arc(x - 3 + k * 2, y - 3.4, 0.9, 0, 7); g.fill(); }
    const [sx, sy] = P(0.3, 0.88); g.fillStyle = '#8a5f3c'; g.beginPath(); g.ellipse(sx, sy - 1.6, 1.6, 2, 0, 0, 7); g.fill();
  }));
  // Stone bridge: a paved deck with parapets and arches over the water
  S.stonebridge = [frame((g) => {
    const stone = '#b8b0a2';
    poly(g, [P(0.08, 0.08, 3), P(0.92, 0.08, 3), P(0.92, 0.92, 3), P(0.08, 0.92, 3)], '#cfc8ba', '#8a857c');
    g.strokeStyle = 'rgba(140,134,124,0.6)'; g.lineWidth = 0.6;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(...P(k / 5, 0.08, 3)); g.lineTo(...P(k / 5, 0.92, 3)); g.stroke(); }
    for (const [u0, v0, u1, v1] of [[0.08, 0.92, 0.92, 0.92], [0.92, 0.08, 0.92, 0.92]]) {
      poly(g, [P(u0, v0, 0), P(u1, v1, 0), P(u1, v1, 3), P(u0, v0, 3)], '#a49c8e', '#7a756c');
      for (let k = 0; k < 2; k++) { const f = 0.3 + k * 0.4, [ax, ay] = P(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f, 0); g.fillStyle = 'rgba(40,50,60,0.55)'; g.beginPath(); g.ellipse(ax, ay, 4, 2.6, 0, Math.PI, 0); g.fill(); }
    }
    for (const [u, v] of [[0.08, 0.08], [0.92, 0.08], [0.92, 0.92], [0.08, 0.92]]) box(g, u - 0.04, v - 0.04, u + 0.04, v + 0.04, 6, stone, 3);
  })];
  // Tunnel: a stone portal cut into the mountainside
  S.tunnel = [frame((g) => {
    const [x, y] = P(0.5, 0.55);
    g.fillStyle = '#8a8478'; g.beginPath(); g.moveTo(x - 24, y + 4); g.quadraticCurveTo(x - 14, y - 26, x + 2, y - 30); g.quadraticCurveTo(x + 18, y - 24, x + 24, y + 4); g.closePath(); g.fill();
    g.fillStyle = '#a49e92'; g.beginPath(); g.moveTo(x - 24, y + 4); g.quadraticCurveTo(x - 14, y - 26, x + 2, y - 30); g.lineTo(x - 2, y + 4); g.closePath(); g.fill();
    g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(x, y - 3, 9, 11, 0, Math.PI, 0); g.lineTo(x + 9, y + 3); g.lineTo(x - 9, y + 3); g.fill();
    g.fillStyle = '#2a2622'; g.beginPath(); g.ellipse(x, y - 2, 6.2, 8, 0, Math.PI, 0); g.lineTo(x + 6.2, y + 3); g.lineTo(x - 6.2, y + 3); g.fill();
    g.strokeStyle = 'rgba(90,84,76,0.7)'; g.lineWidth = 0.7; for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 7; g.beginPath(); g.moveTo(x + Math.cos(a) * 6.4, y - 2 + Math.sin(a) * 8.2); g.lineTo(x + Math.cos(a) * 9, y - 3 + Math.sin(a) * 11); g.stroke(); }
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(x - 5, y - 24); g.lineTo(x + 2, y - 30); g.lineTo(x + 8, y - 25); g.quadraticCurveTo(x + 2, y - 22, x - 5, y - 24); g.fill();
  }, 72, 90, 36, 66)];
  // Mining pit: a stepped hole, a spoil heap, a winch and an ore cart
  S.pit = [0, 1].map((v) => frame((g) => {
    diamond(g, 29, 14.5); g.fillStyle = '#a89478'; g.fill();
    for (let k = 0; k < 3; k++) { g.fillStyle = ['#8a7458', '#6e5a44', '#4e3e30'][k]; g.beginPath(); g.ellipse(-3 + k, 1 + k * 0.8, 15 - k * 4.5, 7.5 - k * 2.3, 0, 0, 7); g.fill(); }
    const [hx, hy] = P(0.82, 0.3); g.fillStyle = '#9a8a74'; g.beginPath(); g.moveTo(hx - 9, hy + 2); g.quadraticCurveTo(hx, hy - 9, hx + 9, hy + 2); g.fill();
    g.fillStyle = 'rgba(80,60,40,0.35)'; for (let k = 0; k < 6; k++) g.fillRect(hx - 6 + k * 2, hy - 2 + (k & 1), 1.5, 1.5);
    const [wx, wy] = P(0.2, 0.4); g.strokeStyle = '#6a4a30'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(wx - 4, wy); g.lineTo(wx, wy - 10); g.lineTo(wx + 4, wy); g.stroke(); g.fillStyle = '#8a6040'; g.fillRect(wx - 2, wy - 11, 4, 2);
    const [cx, cy] = P(0.7, 0.85); g.fillStyle = '#5a4a3c'; g.fillRect(cx - 4, cy - 4, 8, 3.5); g.fillStyle = v ? '#8a96a6' : '#b0a090'; g.beginPath(); g.ellipse(cx, cy - 4, 3.5, 1.4, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(cx - 2.5, cy, 1.1, 0, 7); g.arc(cx + 2.5, cy, 1.1, 0, 7); g.fill();
  }));
  // Barracks: a long hall, a training yard with a dummy and a weapon rack
  S.barracks = [frame((g) => {
    shadow(g, 24, 11);
    box(g, 0.15, 0.18, 0.62, 0.62, 10, '#b8a88c'); gable(g, 0.15, 0.18, 0.62, 0.62, 10, 7, '#7a3a32');
    windows(g, 0.2, 0.58, 0.62, 7, 2, '#f5d78a');
    const [fx, fy] = P(0.39, 0.4, 17); flag(g, fx, fy, 10, '#c0503e');
    g.fillStyle = 'rgba(190,160,110,0.6)'; g.beginPath(); g.ellipse(...P(0.78, 0.7), 10, 5, 0, 0, 7); g.fill(); // yard
    const [dx, dy] = P(0.8, 0.62); g.strokeStyle = '#6e4a30'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx, dy - 9); g.moveTo(dx - 3.5, dy - 6.5); g.lineTo(dx + 3.5, dy - 6.5); g.stroke();
    g.fillStyle = '#d8c090'; g.beginPath(); g.ellipse(dx, dy - 6, 2, 3, 0, 0, 7); g.fill(); g.beginPath(); g.arc(dx, dy - 10, 1.6, 0, 7); g.fill();
    const [rx, ry] = P(0.7, 0.88); g.strokeStyle = '#5a4030'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(rx - 5, ry); g.lineTo(rx + 5, ry); g.stroke();
    for (let k = 0; k < 4; k++) { g.strokeStyle = '#8a8a90'; g.beginPath(); g.moveTo(rx - 4 + k * 2.6, ry); g.lineTo(rx - 4 + k * 2.6, ry - 9); g.stroke(); }
  })];
  // Stone fort: a square keep with corner towers
  S.fort = [frame((g) => {
    shadow(g, 26, 12);
    const stone = '#a8a092';
    box(g, 0.12, 0.12, 0.88, 0.88, 7, stone); crenels(g, 0.12, 0.12, 0.88, 0.88, 7, stone);
    box(g, 0.32, 0.32, 0.68, 0.68, 17, '#b8b0a2'); crenels(g, 0.32, 0.32, 0.68, 0.68, 17, '#b8b0a2');
    windows(g, 0.36, 0.64, 0.68, 12, 2, '#3c3a40');
    for (const [u, v] of [[0.12, 0.88], [0.88, 0.88], [0.88, 0.12]]) { cyl(g, u, v, 0, 4, 11, stone); cone(g, u, v, 11, 5, 7, '#5a4a62'); }
    const [dx, dy] = P(0.5, 0.88, 0); g.fillStyle = '#4a3424'; g.beginPath(); g.ellipse(dx, dy - 3.5, 2.6, 3.5, 0, Math.PI, 0); g.lineTo(dx + 2.6, dy); g.lineTo(dx - 2.6, dy); g.fill();
    const [fx, fy] = P(0.5, 0.5, 21); flag(g, fx, fy, 11, '#c0503e');
  }, 84, 104, 42, 74)];
  // Grist mill: a stone mill house with a big wheel and flour sacks
  S.gristmill = [frame((g) => {
    shadow(g, 22, 10);
    box(g, 0.25, 0.22, 0.75, 0.68, 13, '#c8beac'); gable(g, 0.25, 0.22, 0.75, 0.68, 13, 8, '#7a5a3a');
    windows(g, 0.3, 0.7, 0.68, 9, 2, '#f5d78a');
    const [hx, hy] = P(0.14, 0.45, 7); g.strokeStyle = '#6a4a30'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(hx, hy, 3.6, 8, 0, 0, 7); g.stroke();
    g.lineWidth = 0.7; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 3.6, hy + Math.sin(a) * 8); } g.stroke();
    for (let k = 0; k < 3; k++) { const [x, y] = P(0.55 + k * 0.1, 0.88); g.fillStyle = '#f2ead8'; g.beginPath(); g.ellipse(x, y - 2, 2, 2.4, 0, 0, 7); g.fill(); g.fillStyle = '#d8ccb0'; g.fillRect(x - 1, y - 4.6, 2, 1); }
  })];
  // Granary: a round thatched store on staddle stones
  S.granary = [frame((g) => {
    shadow(g, 18, 8);
    for (const [u, v] of [[0.32, 0.5], [0.68, 0.5], [0.5, 0.32], [0.5, 0.68]]) { const [x, y] = P(u, v); g.fillStyle = '#9a9488'; g.fillRect(x - 1, y - 4, 2, 4); g.beginPath(); g.ellipse(x, y - 4, 2.4, 1, 0, 0, 7); g.fill(); }
    cyl(g, 0.5, 0.5, 4, 11, 10, '#c8a070');
    g.strokeStyle = 'rgba(110,80,50,0.5)'; g.lineWidth = 0.6; g.beginPath(); const [x0, y0] = P(0.5, 0.5, 4); for (let k = -3; k <= 3; k++) { g.moveTo(x0 + k * 3, y0 + 1); g.lineTo(x0 + k * 3, y0 - 9); } g.stroke();
    cone(g, 0.5, 0.5, 14, 13, 12, '#d8b860');
    g.fillStyle = '#6a4a30'; g.fillRect(x0 - 1.6, y0 - 7, 3.2, 5);
    for (let k = 0; k < 2; k++) { const [x, y] = P(0.82 + k * 0.06, 0.82); g.fillStyle = '#e2d0a2'; g.beginPath(); g.ellipse(x, y - 2, 2, 2.4, 0, 0, 7); g.fill(); }
  })];
  // Warehouse: a long timber store with big doors and barrels
  S.warehouse = [frame((g) => {
    shadow(g, 24, 11);
    box(g, 0.12, 0.25, 0.88, 0.7, 11, '#a88a64'); gable(g, 0.12, 0.25, 0.88, 0.7, 11, 9, '#6a5a4a');
    g.strokeStyle = 'rgba(70,50,30,0.5)'; g.lineWidth = 0.6; g.beginPath(); for (let k = 1; k < 8; k++) { g.moveTo(...P(0.12 + k * 0.095, 0.7, 0)); g.lineTo(...P(0.12 + k * 0.095, 0.7, 11)); } g.stroke();
    const [dx, dy] = P(0.5, 0.7, 0); g.fillStyle = '#4a3424'; g.fillRect(dx - 5, dy - 8, 10, 8); g.strokeStyle = '#8a6a44'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(dx - 5, dy - 8); g.lineTo(dx + 5, dy); g.moveTo(dx + 5, dy - 8); g.lineTo(dx - 5, dy); g.stroke();
    windows(g, 0.88, 0.88, 0.48, 8, 1, '#3c3a40');
    cyl(g, 0.92, 0.82, 0, 2, 3.6, '#8a5f3c'); cyl(g, 0.84, 0.88, 0, 2, 3.6, '#9a6a44'); box(g, 0.05, 0.8, 0.14, 0.9, 3, '#a07a50');
  })];
  // Goods workshops added later: potter, glassworks, spice house, scriptorium
  S.potter = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.25, 0.25, 0.7, 0.65, 9, '#d8b890'); gable(g, 0.25, 0.25, 0.7, 0.65, 9, 6, '#a0503a');
    windows(g, 0.3, 0.65, 0.65, 6, 2, '#f5d78a');
    cone(g, 0.82, 0.3, 0, 6, 12, '#b86a4a'); g.fillStyle = '#5a3a2a'; const [kx, ky] = P(0.82, 0.3, 4); g.fillRect(kx - 1.5, ky - 2, 3, 3);
    for (let k = 0; k < 4; k++) { const [x, y] = P(0.38 + k * 0.1, 0.86); g.fillStyle = ['#c87a50', '#a85a3a', '#d89a6a', '#b06a40'][k]; g.beginPath(); g.ellipse(x, y - 2, 1.8, 2.4, 0, 0, 7); g.fill(); g.fillRect(x - 1, y - 5, 2, 1.2); }
  })];
  S.glassworks = [frame((g) => {
    shadow(g, 22, 10);
    box(g, 0.2, 0.25, 0.75, 0.7, 11, '#c4b8a8'); gable(g, 0.2, 0.25, 0.75, 0.7, 11, 6, '#5a6a78');
    windows(g, 0.25, 0.7, 0.7, 7, 3, '#8ad0e8');
    cyl(g, 0.82, 0.25, 0, 3.5, 24, '#9a6a50'); g.fillStyle = 'rgba(255,170,80,0.85)'; const [fx, fy] = P(0.82, 0.25, 24); g.beginPath(); g.ellipse(fx, fy, 2.4, 1.2, 0, 0, 7); g.fill();
    const [x, y] = P(0.4, 0.88); for (let k = 0; k < 3; k++) { g.fillStyle = ['rgba(120,200,230,0.85)', 'rgba(140,220,170,0.85)', 'rgba(230,200,120,0.85)'][k]; g.fillRect(x + k * 3.5 - 4, y - 5, 2.4, 5); }
  })];
  S.spicehouse = [frame((g) => {
    shadow(g, 22, 10);
    box(g, 0.2, 0.2, 0.75, 0.65, 12, '#e6d2a8');
    poly(g, [P(0.15, 0.15, 12), P(0.8, 0.15, 12), P(0.8, 0.7, 12), P(0.15, 0.7, 12)], '#c87a3a', '#8a4a20');
    const [dx, dy] = P(0.47, 0.42, 12); g.fillStyle = '#d8903a'; g.beginPath(); g.ellipse(dx, dy, 7, 3.5, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(dx - 7, dy); g.quadraticCurveTo(dx, dy - 14, dx + 7, dy); g.fill();
    windows(g, 0.25, 0.7, 0.65, 7, 2, '#3c3a40');
    for (let k = 0; k < 4; k++) { const [x, y] = P(0.3 + k * 0.13, 0.86); g.fillStyle = '#8a5a3c'; g.fillRect(x - 2.2, y - 3, 4.4, 3); g.fillStyle = ['#d84a20', '#e8b020', '#8a3a1a', '#5a7a2a'][k]; g.beginPath(); g.ellipse(x, y - 3, 2, 1, 0, 0, 7); g.fill(); }
  })];
  S.scriptorium = [frame((g) => {
    shadow(g, 22, 10);
    box(g, 0.2, 0.22, 0.78, 0.7, 13, '#d4ccbc'); gable(g, 0.2, 0.22, 0.78, 0.7, 13, 8, '#6a4a5a');
    windows(g, 0.24, 0.74, 0.7, 8, 3, '#f5d78a');
    cyl(g, 0.82, 0.78, 0, 3.5, 20, '#c8c0b0'); cone(g, 0.82, 0.78, 20, 4.5, 9, '#6a4a5a');
    const [x, y] = P(0.42, 0.9); g.fillStyle = '#8a5a3c'; g.fillRect(x - 5, y - 2.5, 10, 2.5); for (let k = 0; k < 3; k++) { g.fillStyle = ['#a03030', '#305a90', '#3a7a3a'][k]; g.fillRect(x - 4 + k * 3, y - 6, 2.4, 3.5); }
  })];
  S.lumber = [frame((g) => {
    shadow(g, 22, 10);
    // an open-sided sawing shed
    g.strokeStyle = '#6e4a30'; g.lineWidth = 1.3; g.beginPath();
    for (const [u, v] of [[0.18, 0.62], [0.52, 0.62], [0.52, 0.2]]) { g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 9)); } g.stroke();
    box(g, 0.2, 0.22, 0.5, 0.6, 9, '#a07a50'); // back wall
    gable(g, 0.18, 0.2, 0.52, 0.62, 9, 6, '#7a5a3a');
    const [bx, by] = P(0.35, 0.62, 0); g.fillStyle = '#8a6040'; g.fillRect(bx - 6, by - 4, 12, 1.4); g.fillStyle = '#d8b07a'; g.fillRect(bx - 5, by - 5.2, 10, 1.2); // a log on the saw bench
    // stacked logs, end on
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4 - k; j++) {
      const [x, y] = P(0.66 + j * 0.08 + k * 0.04, 0.76, k * 3.6);
      g.fillStyle = '#7a5434'; g.beginPath(); g.arc(x, y - 2, 2.1, 0, 7); g.fill();
      g.fillStyle = '#e0bc86'; g.beginPath(); g.arc(x, y - 2, 1.4, 0, 7); g.fill(); g.strokeStyle = 'rgba(140,100,60,0.6)'; g.lineWidth = 0.3; g.beginPath(); g.arc(x, y - 2, 0.7, 0, 7); g.stroke();
    }
    // planks drying, a stump with an axe, and fresh sawdust
    for (let k = 0; k < 3; k++) { const [x, y] = P(0.78, 0.3 + k * 0.05, 1 + k * 1.2); g.fillStyle = k % 2 ? '#d8b07a' : '#c89a64'; g.fillRect(x - 6, y - 1, 12, 1.2); }
    const [sx, sy] = P(0.3, 0.88, 0); g.fillStyle = '#8a6040'; g.beginPath(); g.ellipse(sx, sy - 1, 3, 1.5, 0, 0, 7); g.fill(); g.fillRect(sx - 3, sy - 1, 6, 2); g.fillStyle = '#d8b07a'; g.beginPath(); g.ellipse(sx, sy - 1.2, 2.4, 1.1, 0, 0, 7); g.fill();
    g.strokeStyle = '#6e4a30'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(sx + 0.5, sy - 1.5); g.lineTo(sx + 3.5, sy - 6); g.stroke(); g.fillStyle = '#9aa0a8'; g.fillRect(sx - 0.4, sy - 2.6, 2.2, 1.6);
    g.fillStyle = 'rgba(232,206,150,0.7)'; g.beginPath(); g.ellipse(...P(0.35, 0.72), 6, 2, 0, 0, 7); g.fill();
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
    g.strokeStyle = 'rgba(150,130,100,0.45)'; g.lineWidth = 0.5; g.beginPath();
    for (let k = 1; k < 6; k++) { g.moveTo(...P(k / 6, 0.05)); g.lineTo(...P(k / 6, 0.95)); g.moveTo(...P(0.05, k / 6)); g.lineTo(...P(0.95, k / 6)); } g.stroke(); // paving
    stall(0.15, 0.18, '#c0503e'); stall(0.55, 0.22, '#4a78a8');
    cyl(g, 0.72, 0.68, 0, 3.4, 4, '#b8ae9c'); g.fillStyle = '#5a8ab0'; const [wx, wy] = P(0.72, 0.68, 4); g.beginPath(); g.ellipse(wx, wy, 2.6, 1.3, 0, 0, 7); g.fill(); // a well in the square
    g.strokeStyle = '#6e4a30'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(wx - 3, wy); g.lineTo(wx - 3, wy - 6); g.lineTo(wx + 3, wy - 6); g.lineTo(wx + 3, wy); g.stroke();
    stall(0.3, 0.58, '#5a9a5a');
    for (const [u, v2, c] of [[0.12, 0.62, '#a07a50'], [0.18, 0.7, '#8a6a44']]) box(g, u, v2, u + 0.07, v2 + 0.07, 3, c);
  })];
  S.townhall = [frame((g) => {
    shadow(g, 26, 12);
    box(g, 0.14, 0.2, 0.86, 0.8, 3, '#b8ae9c'); // stone plinth
    box(g, 0.18, 0.24, 0.82, 0.76, 12, '#ead9b6', 3);
    g.strokeStyle = '#7a4e30'; g.lineWidth = 0.9; g.beginPath();
    for (let k = 0; k <= 4; k++) { g.moveTo(...P(0.18 + k * 0.16, 0.76, 3)); g.lineTo(...P(0.18 + k * 0.16, 0.76, 15)); }
    g.moveTo(...P(0.18, 0.76, 9)); g.lineTo(...P(0.82, 0.76, 9)); g.lineTo(...P(0.82, 0.24, 9));
    for (let k = 0; k < 4; k++) { g.moveTo(...P(0.18 + k * 0.16, 0.76, 3)); g.lineTo(...P(0.34 + k * 0.16, 0.76, 9)); } // braces
    g.stroke();
    windows(g, 0.2, 0.8, 0.76, 13, 4, '#f5d78a');
    const [dx, dy] = P(0.5, 0.8, 0); g.fillStyle = '#b8ae9c'; g.fillRect(dx - 5, dy - 3, 10, 3); // steps
    g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(dx - 2.6, dy - 3); g.lineTo(dx - 2.6, dy - 8); g.quadraticCurveTo(dx, dy - 10.5, dx + 2.6, dy - 8); g.lineTo(dx + 2.6, dy - 3); g.fill();
    gable(g, 0.18, 0.24, 0.82, 0.76, 15, 11, '#b5543c');
    // clock tower on the ridge
    box(g, 0.43, 0.43, 0.57, 0.57, 9, '#ead9b6', 22); cone(g, 0.5, 0.5, 31, 7, 11, '#8a3e2c');
    const [cx, cy] = P(0.57, 0.5, 27); g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(cx - 2, cy, 2.2, 0, 7); g.fill(); g.strokeStyle = '#3c3a40'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx - 2, cy); g.lineTo(cx - 2, cy - 1.6); g.moveTo(cx - 2, cy); g.lineTo(cx - 0.8, cy); g.stroke();
    const [x, y] = P(0.5, 0.5, 42); flag(g, x, y, 12, '#d9a440');
    const [nx, ny] = P(0.86, 0.95); g.fillStyle = '#7a4e30'; g.fillRect(nx - 0.5, ny - 7, 1, 7); g.fillRect(nx + 4.5, ny - 5, 1, 5); g.fillStyle = '#c8a070'; g.fillRect(nx - 1, ny - 8, 7, 4); g.fillStyle = '#f4ead8'; g.fillRect(nx, ny - 7.4, 2, 2.4); g.fillRect(nx + 2.8, ny - 7.2, 2, 2);
  }, 80, 104, 40, 76)];
  // Capital keep grows with the realm's tier.
  S.castle = [0, 1, 2, 3, 4, 5].map((t) => frame((g) => {
    shadow(g, 28, 13);
    const stone = '#bdb4a6';
    if (t >= 2) { // curtain wall
      box(g, 0.08, 0.08, 0.92, 0.18, 9, stone); box(g, 0.82, 0.08, 0.92, 0.92, 9, stone);
    }
    const kh = 18 + Math.min(t, 4) * 5, roofC = t >= 5 ? '#d8a830' : '#4a5f8a';
    box(g, 0.28, 0.28, 0.72, 0.72, kh, stone);
    crenels(g, 0.28, 0.28, 0.72, 0.72, kh, stone);
    windows(g, 0.32, 0.68, 0.72, kh - 7, 2); windows(g, 0.72, 0.72, 0.5, kh - 7, 1);
    const [dx, dy] = P(0.5, 0.72, 0); g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(dx, dy - 4, 2.6, 4, 0, Math.PI, 0); g.lineTo(dx + 2.6, dy); g.lineTo(dx - 2.6, dy); g.fill();
    if (t >= 1) { cyl(g, 0.2, 0.8, 0, 4.5, kh - 4, stone); cone(g, 0.2, 0.8, kh - 4, 5.5, 9, roofC); }
    if (t >= 2) { cyl(g, 0.82, 0.82, 0, 4.5, kh - 4, stone); cone(g, 0.82, 0.82, kh - 4, 5.5, 9, roofC); }
    if (t >= 3) { cyl(g, 0.82, 0.18, 0, 4, kh, stone); cone(g, 0.82, 0.18, kh, 5, 10, roofC); }
    if (t >= 4) { box(g, 0.08, 0.82, 0.92, 0.92, 9, stone); cyl(g, 0.12, 0.12, 0, 4, kh, stone); cone(g, 0.12, 0.12, kh, 5, 10, roofC); }
    if (t >= 5) { // an imperial dome
      const [x0, y0] = P(0.5, 0.5, kh); g.fillStyle = '#e8c050'; g.beginPath(); g.ellipse(x0, y0, 9, 4.5, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(x0 - 9, 0, x0 + 9, 0); gr.addColorStop(0, '#f6dc80'); gr.addColorStop(1, '#b88a20');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 9, y0); g.quadraticCurveTo(x0 - 9, y0 - 12, x0, y0 - 13); g.quadraticCurveTo(x0 + 9, y0 - 12, x0 + 9, y0); g.fill();
    }
    const [x, y] = P(0.5, 0.5, kh + (t >= 5 ? 14 : 3)); flag(g, x, y, 14, t >= 5 ? '#7a3aa0' : '#c0503e');
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

// ---------------- town life buildings (everyday, goods, specialties, regional wonders) ----------------
function lifeSprites() {
  const S = SPR.build;
  const frame = (draw, w = 72, h = 88, ax = 36, ay = 64) => make(w, h, ax, ay, draw);
  const big = (draw) => make(110, 130, 55, 100, draw);
  const rows = (g, col1, col2, n = 8, lw = 2.4) => { for (let k = 0; k < n; k++) { g.strokeStyle = k % 2 ? col1 : col2; g.lineWidth = lw; const [ax, ay] = P(0.08, (k + 0.5) / n), [bx, by] = P(0.92, (k + 0.5) / n); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); } };
  const ground = (g, col, hw = 28) => { diamond(g, hw, hw / 2); g.fillStyle = col; g.fill(); };
  S.well = [frame((g) => {
    shadow(g, 14, 6); cyl(g, 0.5, 0.55, 0, 8, 6, '#a8a296');
    g.fillStyle = '#4a7aa0'; g.beginPath(); g.ellipse(...P(0.5, 0.55, 6), 6.4, 3.2, 0, 0, 7); g.fill();
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.4; for (const u of [0.32, 0.68]) { g.beginPath(); g.moveTo(...P(u, 0.55, 5)); g.lineTo(...P(u, 0.55, 18)); g.stroke(); }
    poly(g, [P(0.24, 0.55, 17), P(0.76, 0.55, 17), P(0.5, 0.55, 24)], '#b5543c');
    const [bx, by] = P(0.5, 0.55, 11); g.fillStyle = '#8a5a3c'; g.fillRect(bx - 1.6, by - 2, 3.2, 3);
  })];
  S.apiary = [frame((g) => {
    ground(g, '#9cc46e');
    const rnd = mulberry32(5);
    for (let i = 0; i < 14; i++) { g.fillStyle = ['#f4e9a8', '#f2b6c6', '#ffffff', '#c8a0f0'][i % 4]; const [x, y] = P(rnd(), rnd()); g.fillRect(x, y, 1.6, 1.6); }
    for (const [u, v] of [[0.3, 0.35], [0.55, 0.45], [0.4, 0.7]]) { box(g, u, v, u + 0.14, v + 0.12, 7, '#f2e2a0'); box(g, u - 0.01, v - 0.01, u + 0.15, v + 0.13, 1.5, '#c9a35a', 7); }
    g.fillStyle = '#3c3020'; for (let i = 0; i < 5; i++) { const [x, y] = P(0.6 + rnd() * 0.3, 0.2 + rnd() * 0.3, 14 + rnd() * 6); g.fillRect(x, y, 1, 1); }
  })];
  S.windmill = [frame((g) => {
    shadow(g, 14, 6);
    const [x, y] = P(0.5, 0.5, 0);
    g.fillStyle = '#e8dcc4'; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 6, y - 26); g.lineTo(x + 6, y - 26); g.lineTo(x + 9, y); g.closePath(); g.fill();
    g.fillStyle = '#cbbd9e'; g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 2, y - 26); g.lineTo(x + 6, y - 26); g.lineTo(x + 9, y); g.closePath(); g.fill();
    cone(g, 0.5, 0.5, 26, 8, 8, '#8a5a3c');
    g.fillStyle = '#7a4e34'; g.fillRect(x - 2, y - 6, 4, 6); g.fillStyle = '#f5d78a'; g.fillRect(x - 1.2, y - 15, 2.4, 3);
  }, 72, 96, 36, 70)];
  S.chapel = [frame((g) => {
    shadow(g, 18, 8);
    box(g, 0.25, 0.3, 0.75, 0.7, 12, '#efe8da'); gable(g, 0.25, 0.3, 0.75, 0.7, 12, 10, '#5f6e80');
    windows(g, 0.3, 0.7, 0.7, 7, 3, '#8ab8d8');
    box(g, 0.66, 0.42, 0.82, 0.58, 22, '#efe8da'); cone(g, 0.74, 0.5, 22, 7, 12, '#5f6e80');
    const [x, y] = P(0.74, 0.5, 36); g.fillStyle = '#d9a440'; g.fillRect(x - 0.5, y - 4, 1, 4); g.fillRect(x - 1.8, y - 3, 3.6, 0.9);
  }, 72, 100, 36, 72)];
  S.tavern = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.2, 0.25, 0.8, 0.72, 15, '#e0c8a0'); g.strokeStyle = '#7a4e34'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(...P(0.2, 0.72, 7.5)); g.lineTo(...P(0.8, 0.72, 7.5)); g.lineTo(...P(0.8, 0.25, 7.5)); g.stroke();
    windows(g, 0.24, 0.76, 0.72, 5.5, 3, '#f5d78a'); windows(g, 0.24, 0.76, 0.72, 12, 3, '#f5d78a');
    gable(g, 0.2, 0.25, 0.8, 0.72, 15, 9, '#8a4a34');
    const [sx2, sy2] = P(0.86, 0.75, 11); g.strokeStyle = '#3c3a40'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx2 - 5, sy2); g.lineTo(sx2 + 1, sy2); g.stroke();
    g.fillStyle = '#c0703e'; g.fillRect(sx2 - 3, sy2, 4, 3.5);
    for (const u of [0.86, 0.95]) cyl(g, u, 0.9, 0, 2.4, 4, '#8a5f3c');
  })];
  S.school = [frame((g) => {
    shadow(g, 22, 10);
    box(g, 0.15, 0.3, 0.85, 0.66, 11, '#d8c49a'); gable(g, 0.15, 0.3, 0.85, 0.66, 11, 7, '#4a6a8a');
    windows(g, 0.2, 0.8, 0.66, 7, 4, '#f5d78a');
    box(g, 0.47, 0.44, 0.55, 0.52, 5, '#d8c49a', 17); cone(g, 0.51, 0.48, 22, 3.5, 5, '#4a6a8a');
    g.strokeStyle = '#8a6a44'; g.lineWidth = 0.8; g.beginPath(); for (let k = 0; k <= 6; k++) { const [x, y] = P(0.1 + k * 0.13, 0.92, 0); g.moveTo(x, y); g.lineTo(x, y - 3); } g.moveTo(...P(0.1, 0.92, 2)); g.lineTo(...P(0.88, 0.92, 2)); g.stroke();
  })];
  S.yard = [frame((g) => {
    shadow(g, 22, 10);
    ground(g, '#c9b08a', 27);
    // open shed
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.4;
    for (const [u, v] of [[0.12, 0.62], [0.5, 0.62], [0.5, 0.18]]) { g.beginPath(); g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 11)); g.stroke(); }
    hip(g, 0.12, 0.18, 0.5, 0.62, 11, 4, '#8a6a4a');
    // planks and beams
    for (let k = 0; k < 4; k++) box(g, 0.58, 0.2 + k * 0.03, 0.95, 0.24 + k * 0.03, 1.6, k % 2 ? '#d8b07a' : '#c89a64', k * 1.6);
    for (let k = 0; k < 3; k++) { const [x, y] = P(0.62 + k * 0.1, 0.62, 0); g.fillStyle = '#8a5f3c'; g.beginPath(); g.arc(x, y - 2, 2.2, 0, 7); g.fill(); g.fillStyle = '#e3c08a'; g.beginPath(); g.arc(x, y - 2, 1.3, 0, 7); g.fill(); }
    // stone blocks
    for (const [u, v] of [[0.6, 0.85], [0.74, 0.88], [0.67, 0.78]]) box(g, u, v - 0.07, u + 0.08, v, 3.5, '#b4aca0');
    // sawhorse with a plank
    const [sx2, sy2] = P(0.3, 0.86, 0); g.strokeStyle = '#6a4a2a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(sx2 - 5, sy2); g.lineTo(sx2 - 3, sy2 - 5); g.lineTo(sx2 - 1, sy2); g.moveTo(sx2 + 2, sy2); g.lineTo(sx2 + 4, sy2 - 5); g.lineTo(sx2 + 6, sy2); g.stroke();
    g.fillStyle = '#d8b07a'; g.fillRect(sx2 - 7, sy2 - 6.5, 15, 1.6);
    // ladder against the shed
    const [lx2, ly2] = P(0.5, 0.4, 0); g.strokeStyle = '#8a6a44'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(lx2 + 2, ly2); g.lineTo(lx2 + 5, ly2 - 14); g.moveTo(lx2 + 5, ly2); g.lineTo(lx2 + 8, ly2 - 14);
    for (let k = 1; k < 5; k++) { g.moveTo(lx2 + 2 + k * 0.6, ly2 - k * 2.8); g.lineTo(lx2 + 5 + k * 0.6, ly2 - k * 2.8); } g.stroke();
  })];
  S.shipyard = [frame((g) => {
    shadow(g, 22, 10);
    ground(g, '#b8a078', 27);
    // slipway with a ship's hull taking shape on it
    poly(g, [P(0.25, 0.55), P(1.0, 0.55), P(1.0, 0.85), P(0.25, 0.85)], '#9a7a54', '#7a5634');
    const [hx, hy] = P(0.62, 0.7, 2);
    g.fillStyle = '#8a5a3c'; g.beginPath(); g.moveTo(hx - 14, hy - 4); g.quadraticCurveTo(hx, hy + 6, hx + 14, hy - 4); g.lineTo(hx + 11, hy - 8); g.quadraticCurveTo(hx, hy, hx - 11, hy - 8); g.closePath(); g.fill();
    g.strokeStyle = '#c89a64'; g.lineWidth = 1.1;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(hx + k * 3.6, hy - 6 + Math.abs(k) * 0.3); g.quadraticCurveTo(hx + k * 3.9, hy - 14, hx + k * 3.2, hy - 18 + Math.abs(k) * 1.4); g.stroke(); }
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx - 12, hy - 15); g.lineTo(hx + 12, hy - 15); g.stroke();
    // shed and stacked timber
    box(g, 0.05, 0.1, 0.4, 0.45, 10, '#c8b498'); gable(g, 0.05, 0.1, 0.4, 0.45, 10, 7, '#6a5a48');
    for (let k = 0; k < 3; k++) box(g, 0.45, 0.12 + k * 0.03, 0.9, 0.16 + k * 0.03, 1.6, k % 2 ? '#d8b07a' : '#c89a64', k * 1.6);
    g.strokeStyle = '#5a4030'; g.lineWidth = 1.2; const [cx2, cy2] = P(0.95, 0.4, 0);
    g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(cx2, cy2 - 20); g.lineTo(cx2 - 10, cy2 - 16); g.stroke();
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx2 - 10, cy2 - 16); g.lineTo(cx2 - 10, cy2 - 8); g.stroke();
  })];
  S.stable = [frame((g) => {
    shadow(g, 22, 10);
    // paddock fence
    g.strokeStyle = '#8a6a44'; g.lineWidth = 1;
    g.beginPath(); for (const z of [2, 4]) { g.moveTo(...P(0.55, 0.95, z)); g.lineTo(...P(0.98, 0.95, z)); g.lineTo(...P(0.98, 0.5, z)); }
    for (const [u, v] of [[0.55, 0.95], [0.76, 0.95], [0.98, 0.95], [0.98, 0.72], [0.98, 0.5]]) { g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 5)); }
    g.stroke();
    // barn
    box(g, 0.08, 0.15, 0.55, 0.6, 12, '#a0503a');
    g.strokeStyle = '#f2e6d0'; g.lineWidth = 0.9; const [dx, dy] = P(0.31, 0.6, 0);
    g.strokeRect(dx - 4, dy - 9, 8, 9); g.beginPath(); g.moveTo(dx - 4, dy - 9); g.lineTo(dx + 4, dy); g.moveTo(dx + 4, dy - 9); g.lineTo(dx - 4, dy); g.stroke();
    gable(g, 0.08, 0.15, 0.55, 0.6, 12, 9, '#5a4a40');
    const [lx, ly] = P(0.55, 0.38, 15); g.fillStyle = '#e0bf5a'; g.fillRect(lx - 2, ly - 3, 4, 3);
    // a horse in the paddock
    const [hx, hy] = P(0.78, 0.74, 0);
    g.fillStyle = '#8a5a3a'; g.beginPath(); g.ellipse(hx, hy - 4.5, 4, 1.9, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a5a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx + 3, hy - 5); g.lineTo(hx + 4.4, hy - 8); g.stroke();
    g.beginPath(); g.ellipse(hx + 5.1, hy - 8.2, 1.6, 0.9, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a2a20'; g.lineWidth = 0.8; g.beginPath();
    for (const lx2 of [-2.6, -1.4, 1.6, 2.8]) { g.moveTo(hx + lx2, hy - 3); g.lineTo(hx + lx2, hy); }
    g.moveTo(hx - 3.8, hy - 5); g.quadraticCurveTo(hx - 5.4, hy - 4, hx - 5, hy - 2); g.stroke();
  })];
  S.bakery = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.2, 0.25, 0.65, 0.7, 11, '#efe0c4'); gable(g, 0.2, 0.25, 0.65, 0.7, 11, 8, '#b5543c');
    windows(g, 0.25, 0.6, 0.7, 7, 2, '#f5d78a');
    const [ox, oy] = P(0.82, 0.55, 0); g.fillStyle = '#c8a07a'; g.beginPath(); g.ellipse(ox, oy, 8, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#b08460'; g.beginPath(); g.arc(ox, oy - 1, 7, Math.PI, 0); g.fill(); g.fillStyle = '#e8803c'; g.beginPath(); g.arc(ox, oy - 1, 2.5, Math.PI, 0); g.fill();
    box(g, 0.3, 0.42, 0.37, 0.49, 8, '#8c6e5a', 14);
  })];
  S.brewery = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.18, 0.2, 0.62, 0.62, 13, '#cdb08a'); gable(g, 0.18, 0.2, 0.62, 0.62, 13, 8, '#6a5a48');
    windows(g, 0.22, 0.58, 0.62, 8, 2, '#f5d78a');
    for (const [u, v] of [[0.75, 0.55], [0.85, 0.7], [0.72, 0.82]]) { cyl(g, u, v, 0, 3.4, 6, '#8a5f3c'); g.strokeStyle = '#4a3a2c'; g.lineWidth = 0.6; const [x, y] = P(u, v, 3); g.beginPath(); g.ellipse(x, y, 3.4, 1.7, 0, 0, Math.PI); g.stroke(); }
  })];
  S.weaver = [frame((g) => {
    shadow(g, 20, 9);
    box(g, 0.2, 0.25, 0.6, 0.62, 10, '#e8d8b8'); gable(g, 0.2, 0.25, 0.6, 0.62, 10, 7, '#c9a35a');
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 0.9; const [ax, ay] = P(0.66, 0.4, 13), [bx, by] = P(0.95, 0.85, 13);
    g.beginPath(); g.moveTo(ax, ay + 13); g.lineTo(ax, ay); g.lineTo(bx, by); g.lineTo(bx, by + 13); g.stroke();
    const cols = ['#c0503e', '#4a78a8', '#e8c040', '#5a9a5a'];
    for (let k = 0; k < 4; k++) { const f = (k + 0.5) / 4, x = ax + (bx - ax) * f, y = ay + (by - ay) * f; g.fillStyle = cols[k]; g.fillRect(x - 2, y, 4, 6); }
  })];
  S.smithy = [frame((g) => {
    shadow(g, 20, 9);
    ground(g, '#8a8378', 24);
    g.strokeStyle = '#5a4030'; g.lineWidth = 1.5; for (const [u, v] of [[0.25, 0.75], [0.75, 0.75], [0.75, 0.3]]) { g.beginPath(); g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 12)); g.stroke(); }
    hip(g, 0.25, 0.3, 0.75, 0.75, 12, 5, '#6a5a50');
    box(g, 0.3, 0.32, 0.5, 0.5, 6, '#7a706a'); const [fx, fy] = P(0.4, 0.5, 6); const gl = g.createRadialGradient(fx, fy - 2, 0, fx, fy - 2, 7); gl.addColorStop(0, 'rgba(255,170,60,0.95)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gl; g.beginPath(); g.arc(fx, fy - 2, 7, 0, 7); g.fill();
    const [ax2, ay2] = P(0.62, 0.62, 0); g.fillStyle = '#3c3a40'; g.fillRect(ax2 - 3, ay2 - 4, 6, 2); g.fillRect(ax2 - 1, ay2 - 2, 2, 2);
    box(g, 0.33, 0.35, 0.4, 0.42, 10, '#5a5450', 12);
  })];
  S.vineyard = [frame((g) => {
    ground(g, '#a8a060'); rows(g, '#5a8a3a', '#7aa04a', 7, 2.2);
    const rnd = mulberry32(9); g.fillStyle = '#6a3a7a';
    for (let i = 0; i < 18; i++) { const [x, y] = P(0.12 + rnd() * 0.76, (Math.floor(rnd() * 7) + 0.5) / 7); g.beginPath(); g.arc(x, y - 1, 1.1, 0, 7); g.fill(); }
    box(g, 0.75, 0.1, 0.95, 0.28, 6, '#f4eee2'); hip(g, 0.75, 0.1, 0.95, 0.28, 6, 3, '#c8643c');
  })];
  S.riceterrace = [frame((g) => {
    for (let k = 0; k < 4; k++) { const hw = 30 - k * 6; diamond(g, hw, hw / 2, 0, -k * 3); g.fillStyle = k % 2 ? '#8cc06a' : '#7ab0c8'; g.fill(); g.strokeStyle = '#5a7a3a'; g.lineWidth = 1; g.stroke(); }
    const rnd = mulberry32(13); g.fillStyle = '#4f8f3e'; for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, r = 4 + rnd() * 22; g.fillRect(Math.cos(a) * r, Math.sin(a) * r * 0.5 - 4, 1, 2); }
  })];
  S.icehut = [frame((g) => {
    diamond(g, 26, 13); g.fillStyle = '#e4eef4'; g.fill();
    g.fillStyle = '#3a6a8a'; g.beginPath(); g.ellipse(10, 4, 4, 2, 0, 0, 7); g.fill();
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(10, 4); g.lineTo(16, -6); g.stroke();
    box(g, 0.2, 0.25, 0.55, 0.55, 8, '#7a5236'); gable(g, 0.2, 0.25, 0.55, 0.55, 8, 7, '#e8eef2');
    const [x, y] = P(0.2, 0.55, 0); g.fillStyle = '#8a6a4a'; g.fillRect(x + 2, y - 2, 6, 2);
  })];
  S.oasis = [frame((g) => {
    ground(g, '#e2c890');
    g.fillStyle = '#4a9ac0'; g.beginPath(); g.ellipse(0, 3, 14, 6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-4, 2, 5, 1.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#7aa04a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 3, 15, 6.6, 0, 0, 7); g.stroke();
    const rnd = mulberry32(17); for (const [x, y] of [[-16, -2], [16, -1], [-6, -8], [8, 10]]) tree(g, x, y, 0.85, 'palm', rnd);
  })];
  S.cacao = [frame((g) => {
    ground(g, '#7aa04a');
    const rnd = mulberry32(19);
    for (const [x, y] of [[-12, -3], [10, -4], [0, 5], [-2, -9]]) { tree(g, x, y, 0.8, 'round', rnd); g.fillStyle = '#d8823c'; for (let k = 0; k < 3; k++) g.fillRect(x - 3 + k * 2.6, y - 6 - (k % 2) * 2, 1.6, 2.4); }
    g.fillStyle = '#a07040'; g.fillRect(14, 4, 10, 2); g.fillStyle = '#6a3a24'; for (let k = 0; k < 5; k++) g.fillRect(14.5 + k * 1.9, 2.8, 1.4, 1.2);
  })];
  S.orchard = [frame((g) => {
    ground(g, '#94c06a');
    const rnd = mulberry32(23);
    for (const [x, y] of [[-14, -1], [0, -7], [14, -1], [-6, 6], [8, 6]]) { tree(g, x, y, 0.75, 'round', rnd); g.fillStyle = '#d0402c'; for (let k = 0; k < 3; k++) g.fillRect(x - 3 + rnd() * 6, y - 9 + rnd() * 5, 1.4, 1.4); }
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(20, 8); g.lineTo(22, -2); g.moveTo(22, 8); g.lineTo(24, -2); g.stroke();
  })];
  // ---- regional wonders ----
  S.monastery = [big((g) => {
    // a rocky crag with a monastery on top
    g.fillStyle = '#8a8278'; g.beginPath(); g.moveTo(-34, 6); g.lineTo(-20, -24); g.lineTo(-4, -30); g.lineTo(18, -26); g.lineTo(34, 6); g.closePath(); g.fill();
    g.fillStyle = '#6e675e'; g.beginPath(); g.moveTo(6, -28); g.lineTo(18, -26); g.lineTo(34, 6); g.lineTo(10, 6); g.closePath(); g.fill();
    g.save(); g.translate(0, -28);
    box(g, 0.2, 0.25, 0.7, 0.65, 14, '#efe6d2'); gable(g, 0.2, 0.25, 0.7, 0.65, 14, 9, '#a04a34');
    windows(g, 0.25, 0.65, 0.65, 9, 3, '#f5d78a');
    box(g, 0.62, 0.35, 0.82, 0.55, 30, '#efe6d2'); hip(g, 0.62, 0.35, 0.82, 0.55, 30, 6, '#a04a34');
    g.restore();
    g.strokeStyle = '#d8ccb4'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-26, 4); g.lineTo(-18, -6); g.lineTo(-24, -14); g.lineTo(-14, -22); g.stroke();
  })];
  S.bridge = [big((g) => {
    g.fillStyle = 'rgba(90,150,180,0.5)'; g.beginPath(); g.ellipse(0, 6, 40, 12, 0, 0, 7); g.fill();
    const st = '#bdb4a6';
    // a long stone bridge with three arches, running along the u axis
    const L = (u, z) => P(u * 1.6 - 0.3, 0.55, z);
    poly(g, [L(0, 0), L(1, 0), L(1, 16), L(0, 16)], st, rgb(hex(st), 0.7));
    g.fillStyle = 'rgba(70,110,140,0.85)';
    for (const c of [0.2, 0.5, 0.8]) { const [x, y] = L(c, 0); g.beginPath(); g.ellipse(x, y - 1, 8, 9, 0, Math.PI, 0); g.lineTo(x + 8, y); g.lineTo(x - 8, y); g.fill(); }
    poly(g, [L(0, 16), L(1, 16), P(1.3, 0.4, 16), P(-0.3, 0.4, 16)], '#d8d0c2');
    for (const u of [0, 0.5, 1]) { const [x, y] = L(u, 16); g.fillStyle = st; g.fillRect(x - 3, y - 10, 6, 10); g.fillStyle = '#5f6e80'; g.beginPath(); g.moveTo(x - 4, y - 10); g.lineTo(x, y - 16); g.lineTo(x + 4, y - 10); g.fill(); }
    const [fx, fy] = L(0.5, 32); flag(g, fx, fy, 10, '#c0503e');
  })];
  S.observatory = [big((g) => {
    shadow(g, 26, 12);
    box(g, 0.15, 0.2, 0.85, 0.8, 8, '#d8cdb8');
    cyl(g, 0.5, 0.5, 8, 16, 26, '#e8dcc4');
    const [x, y] = P(0.5, 0.5, 34);
    const gr = g.createLinearGradient(x - 16, 0, x + 16, 0); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(1, '#a8b0bc');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 16, Math.PI, 0); g.ellipse(x, y, 16, 8, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#3c4050'; g.beginPath(); g.moveTo(x - 2.5, y - 16); g.lineTo(x + 2.5, y - 16); g.lineTo(x + 3, y); g.lineTo(x - 3, y); g.fill();
    g.strokeStyle = '#5a5a62'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 9, y - 22); g.stroke();
    windows(g, 0.3, 0.7, 0.8, 5, 4, '#f5d78a');
  })];
  S.dome = [big((g) => {
    diamond(g, 32, 16); g.fillStyle = '#9cc46e'; g.fill();
    const [x, y] = P(0.5, 0.5, 0);
    const rnd = mulberry32(31);
    for (const [px, py] of [[-14, -2], [12, 0], [0, -10], [-4, 6]]) tree(g, x + px, y + py, 0.9, rnd() < 0.5 ? 'palm' : 'round', rnd);
    const gr = g.createRadialGradient(x - 8, y - 26, 2, x, y - 10, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(190,230,240,0.35)'); gr.addColorStop(1, 'rgba(140,200,220,0.45)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 28, Math.PI, 0); g.ellipse(x, y, 28, 14, 0, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(80,110,120,0.7)'; g.lineWidth = 0.8;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x, y, Math.abs(k) * 7 + 0.1, 28, 0, Math.PI, 2 * Math.PI); g.stroke(); }
    for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(x, y - k * 7, Math.sqrt(28 * 28 - (k * 7) ** 2), Math.sqrt(28 * 28 - (k * 7) ** 2) / 2, 0, Math.PI, 0); g.stroke(); }
    g.fillStyle = '#d9a440'; g.fillRect(x - 0.8, y - 34, 1.6, 6);
  })];
}

// ---------------- zone markers ----------------
// Zone markers: a clear fill, a dark outline under a coloured dashed edge, and an icon,
// so zones stay readable on any ground (sand, steppe, snow, forest).
function zoneMarker(color, icon) {
  return make(66, 34, 33, 17, (g) => {
    diamond(g, 28, 14); g.fillStyle = color + '8c'; g.fill();
    g.strokeStyle = 'rgba(40,28,18,0.6)'; g.lineWidth = 2.6; g.stroke();
    g.setLineDash([3.2, 2.4]); g.strokeStyle = color; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
    // icon badge
    g.fillStyle = 'rgba(255,250,238,0.95)'; g.strokeStyle = 'rgba(40,28,18,0.55)'; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(0, 0, 6.2, 4.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#3c2e24'; g.strokeStyle = '#3c2e24'; g.lineWidth = 0.9;
    if (icon === 'house') {
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(0, -2.6); g.lineTo(3, 0); g.closePath(); g.fill();
      g.fillRect(-2.2, 0, 4.4, 2.4);
    } else if (icon === 'wheat') {
      g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -2.8); g.stroke();
      for (const [dx, dy] of [[-1, -1.6], [1, -1.6], [-1, 0.2], [1, 0.2]]) { g.beginPath(); g.ellipse(dx, dy, 0.8, 1.3, dx * 0.5, 0, Math.PI * 2); g.fill(); }
    } else if (icon === 'pick') {
      g.lineWidth = 1.1; g.beginPath(); g.moveTo(-2.4, 2.6); g.lineTo(2, -1.8); g.stroke(); g.beginPath(); g.moveTo(-0.6, -3); g.quadraticCurveTo(2.4, -2.6, 3.4, 0.2); g.stroke();
    } else if (icon === 'sheep') {
      g.fillStyle = '#3c2e24'; g.beginPath(); g.ellipse(-0.6, 0, 2.8, 1.9, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(2.4, -0.8, 1.2, 1, 0, 0, 7); g.fill();
      g.fillRect(-2, 1.4, 0.7, 1.4); g.fillRect(0.6, 1.4, 0.7, 1.4);
    } else if (icon === 'tree') {
      g.beginPath(); g.moveTo(0, -3.2); g.lineTo(2.6, 1); g.lineTo(-2.6, 1); g.closePath(); g.fill(); g.fillRect(-0.5, 1, 1, 2);
    } else if (icon === 'flower') {
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(Math.cos(a) * 1.6, Math.sin(a) * 1.6 - 0.3, 1.1, 0, 7); g.fill(); }
      g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(0, -0.3, 0.8, 0, 7); g.fill();
    } else if (icon === 'coin') {
      g.beginPath(); g.moveTo(-3, -1); g.lineTo(3, -1); g.lineTo(2.2, -2.6); g.lineTo(-2.2, -2.6); g.closePath(); g.fill(); g.fillRect(-2.4, -1, 4.8, 3.4);
      g.fillStyle = '#fff6e0'; g.fillRect(-0.8, 0.4, 1.6, 2);
    } else if (icon === 'hammer') {
      g.save(); g.rotate(-0.6); g.fillRect(-0.5, -1, 1, 4.4); g.fillRect(-2.4, -2.6, 4.8, 1.8); g.restore();
    }
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
  // ---- seasonal variants ----
  SPR.groundSnow = [];
  for (const b of [B.GRASS, B.STEPPE, B.FOREST, B.TAIGA, B.HILLS, B.TUNDRA, B.DESERT, B.SAVANNA, B.JUNGLE]) SPR.groundSnow[b] = [0, 1, 2, 3].map((v) => groundTile(b, v, true));
  const seasonal = (kind, base, nFor) => [0, 1, 2, 3, 4, 5].map((v) => treeCluster(kind, v + base, nFor(v)));
  SPR.season = {
    forest: { autumn: seasonal('autumn', 0, (v) => 4 + (v % 3)), blossom: seasonal('blossom', 0, (v) => 4 + (v % 3)), bare: seasonal('bare', 0, (v) => 4 + (v % 3)), snow: seasonal('baresnow', 0, (v) => 4 + (v % 3)) },
    grass: { autumn: seasonal('autumn', 10, (v) => 1 + (v % 2)), blossom: seasonal('blossom', 10, (v) => 1 + (v % 2)), bare: seasonal('bare', 10, (v) => 1 + (v % 2)), snow: seasonal('baresnow', 10, (v) => 1 + (v % 2)) },
    taigaSnow: [0, 1, 2, 3].map((v) => treeCluster('snowpine', v + 20, 4 + (v % 3))),
    hillsSnow: [0, 1, 2, 3].map((v) => hills(v, true)),
    rocksSnow: [0, 1].map((v) => rocks(v, true)),
  };
  // soft clouds and a warm lamplight glow
  SPR.clouds = [0, 1, 2, 3].map((v) => {
    const rnd = mulberry32(v * 13 + 7), c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 50 + rnd() * 156, y = 50 + rnd() * 34, r = 26 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  });
  SPR.glow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(0.25, 'rgba(255,184,96,0.35)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();
  lifeSprites();
  SPR.misc.zone = {};
  SPR.misc.zone.housing = zoneMarker('#f07a48', 'house');
  SPR.misc.zone.farmland = zoneMarker('#e6cf3a', 'wheat');
  SPR.misc.zone.workshop = zoneMarker('#8a7ef0', 'hammer');
  SPR.misc.zone.pasture = zoneMarker('#7cc464', 'sheep');
  SPR.misc.zone.woodlot = zoneMarker('#2f8a5a', 'tree');
  SPR.misc.zone.park = zoneMarker('#e88ac0', 'flower');
  SPR.misc.zone.shops = zoneMarker('#40a8d8', 'coin');
  SPR.misc.zone.mining = zoneMarker('#a08a70', 'pick');
}
// How often each biome shows decoration (0..1)
export const DECOR_DENSITY = { [B.FOREST]: 0.92, [B.TAIGA]: 0.9, [B.JUNGLE]: 0.97, [B.SAVANNA]: 0.22, [B.GRASS]: 0.1, [B.STEPPE]: 0.08, [B.DESERT]: 0.04, [B.TUNDRA]: 0.15, [B.SNOW]: 0.06, [B.HILLS]: 0.85, [B.MOUNTAIN]: 1 };

// Small icon images for UI (data URLs) of buildings.
export function spriteIcon(spr, size = 56) {
  // crop to what is actually drawn, so small buildings fill their icon too
  const w0 = spr.c.width, h0 = spr.c.height, d = spr.c.getContext('2d').getImageData(0, 0, w0, h0).data;
  let x0 = w0, y0 = h0, x1 = 0, y1 = 0;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) if (d[(y * w0 + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = w0 - 1; y1 = h0 - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const c = document.createElement('canvas'); c.width = c.height = size * 2;
  const g = c.getContext('2d');
  const s = Math.min((size * 2) / bw, (size * 2) / bh) * 0.92;
  g.drawImage(spr.c, x0, y0, bw, bh, (size * 2 - bw * s) / 2, (size * 2 - bh * s) / 2, bw * s, bh * s);
  return c.toDataURL();
}
