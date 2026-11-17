// Moved out of sprites.js to keep modules small. See ARCHITECTURE.md.
import { mulberry32 } from '../noise.js';
import { SPR } from '../sprites.js';
import { P, box, cone, cyl, diamond, flag, gable, hex, hip, make, poly, rgb, shadow, windows } from './kit.js';
import { tree } from './terrain.js';

// ---------------- town life buildings (everyday, goods, specialties, regional wonders) ----------------
export function lifeSprites() {
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
export function zoneMarker(color, icon) {
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
