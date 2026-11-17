// Moved out of sprites.js to keep modules small. See ARCHITECTURE.md.


export const R = 3;                   // render resolution multiplier (crisp at 3x pixel density)

export function make(w, h, ax, ay, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
  const g = c.getContext('2d');
  g.scale(R, R); g.translate(ax, ay);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { c, w, h, ax, ay };
}

export const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function diamond(g, hw = 32, hh = 16, cx = 0, cy = 0) {
  g.beginPath(); g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath();
}

export function poly(g, pts, fill, stroke) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.6; g.stroke(); }
}

// Isometric projection of footprint coords (u,v in tile units, 0..1 covers the tile) and height z (px).
export const P = (u, v, z = 0) => [(u - v) * 32, (u + v - 1) * 16 - z];


// Box from (u0,v0) to (u1,v1), height h, optionally raised by z0.
export function box(g, u0, v0, u1, v1, h, wall, z0 = 0, top = null) {
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
export function gable(g, u0, v0, u1, v1, h, rh, roof, over = 0.05) {
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

export function cone(g, u, v, z, r, h, col) {
  const [x, y] = P(u, v, z), C = hex(col);
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - h); g.lineTo(x + r, y); g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.closePath();
  const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, rgb(C, 1.12)); gr.addColorStop(1, rgb(C, 0.72));
  g.fillStyle = gr; g.fill();
}

export function cyl(g, u, v, z, r, h, col) {
  const [x, y] = P(u, v, z), C = hex(col);
  const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, rgb(C, 1.1)); gr.addColorStop(1, rgb(C, 0.7));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r, y - h); g.ellipse(x, y - h, r, r / 2, 0, Math.PI, 0); g.lineTo(x + r, y);
  g.ellipse(x, y, r, r / 2, 0, 0, Math.PI); g.fill();
  g.fillStyle = rgb(C, 1.2); g.beginPath(); g.ellipse(x, y - h, r, r / 2, 0, 0, Math.PI * 2); g.fill();
}

export function flag(g, x, y, h, col) {
  g.strokeStyle = '#5a4030'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h); g.quadraticCurveTo(x + 5, y - h + 1, x + 9, y - h + 3); g.lineTo(x, y - h + 6); g.fill();
}

export function shadow(g, rx = 22, ry = 10, cy = 2) {
  g.fillStyle = 'rgba(30,40,20,0.18)'; g.beginPath(); g.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

export function windows(g, u0, u1, v, z, n, col = '#3c3a40') {
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

export function crenels(g, u0, v0, u1, v1, h, col) {
  const n = 4;
  for (let k = 0; k < n; k++) {
    const a = u0 + (k / n) * (u1 - u0), b = a + (u1 - u0) / (n * 1.8);
    box(g, a, v1 - 0.06, b, v1, 3, col, h);
    const c = v0 + (k / n) * (v1 - v0), d = c + (v1 - v0) / (n * 1.8);
    box(g, u1 - 0.06, c, u1, d, 3, col, h);
  }
}


export function hip(g, u0, v0, u1, v1, z, rh, roof, over = 0.05) {
  const C = hex(roof), vm = (v0 + v1) / 2, inset = (u1 - u0) * 0.28;
  u0 -= over; v0 -= over; u1 += over; v1 += over;
  const ru0 = u0 + inset, ru1 = u1 - inset;
  poly(g, [P(u0, v0, z), P(u1, v0, z), P(ru1, vm, z + rh), P(ru0, vm, z + rh)], rgb(C, 0.82), rgb(C, 0.6));
  poly(g, [P(u1, v0, z), P(u1, v1, z), P(ru1, vm, z + rh)], rgb(C, 0.72), rgb(C, 0.55));
  poly(g, [P(ru0, vm, z + rh), P(ru1, vm, z + rh), P(u1, v1, z), P(u0, v1, z)], rgb(C, 1.05), rgb(C, 0.65));
}
