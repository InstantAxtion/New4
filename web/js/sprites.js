// Procedurally drawn isometric sprites. Base tile is 64x32; sprites are rendered at 2x for crispness.
import { B, BIOMES } from './world.js';
import { mulberry32 } from './noise.js';

import { buildingSprites } from './sprites/buildings.js';
import { lifeSprites, zoneMarker } from './sprites/creatures.js';
import { groundTile, hills, mountain, rocks, treeCluster } from './sprites/terrain.js';
export const TB = 64;          // base tile width
export const SPR = { ground: [], decor: [], build: {}, misc: {} };

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

// Public interface: everything the art modules export is also available from sprites.js.
export * from './sprites/kit.js';
export * from './sprites/terrain.js';
export * from './sprites/homes.js';
export * from './sprites/buildings.js';
export * from './sprites/creatures.js';
