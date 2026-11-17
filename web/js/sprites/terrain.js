// Moved out of sprites.js to keep modules small. See ARCHITECTURE.md.
import { mulberry32 } from '../noise.js';
import { B, BIOMES } from '../world.js';
import { diamond, make, poly, rgb } from './kit.js';

// ---------------- ground tiles ----------------
export function groundTile(b, variant, snowy = false) {
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
export function tree(g, x, y, s, kind, rnd) {
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


export const SPOTS = [[-12, -2], [11, -3], [0, 5], [-2, -8], [16, 3], [-17, 3], [6, -9], [-7, 7], [8, 8]];

export function treeCluster(kind, variant, n) {
  const rnd = mulberry32(variant * 31 + kind.length * 7);
  return make(70, 64, 35, 46, (g) => {
    const spots = SPOTS.slice().sort(() => rnd() - 0.5).slice(0, n).sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) tree(g, x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 2, 0.8 + rnd() * 0.35, kind, rnd);
  });
}

export function mountain(variant, snowy) {
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

export function hills(variant, snowy = false) {
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

export function rocks(variant, snowy) {
  const rnd = mulberry32(variant * 23 + 1);
  return make(64, 40, 32, 24, (g) => {
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * 30, y = (rnd() - 0.5) * 12, r = 2 + rnd() * 2.5;
      g.fillStyle = snowy ? '#c8ccd2' : '#8c877c'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0); g.fill();
      g.fillStyle = snowy ? '#f2f4f6' : '#a8a296'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.4, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    }
  });
}
