// Moved out of sprites.js to keep modules small. See ARCHITECTURE.md.
import { mulberry32 } from '../noise.js';
import { SPR } from '../sprites.js';
import { ROOFS, cottage } from './homes.js';
import { P, box, cone, crenels, cyl, diamond, flag, gable, hex, make, poly, rgb, shadow, windows } from './kit.js';
import { tree } from './terrain.js';

export function field(g, rnd, snowy = false) {
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


export function buildingSprites() {
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
