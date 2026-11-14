// Real-Earth world generation.
// The world is a staggered isometric grid: W columns x H rows (odd rows shifted half a tile right).
// 2000 x 4000 = 8,000,000 tiles, mapped equirectangularly onto Earth.
import { fbm, hash2 } from './noise.js';

export const W = 2000, H = 4000;

export const B = {
  OCEAN: 0, SHALLOW: 1, SEAICE: 2, GRASS: 3, FOREST: 4, JUNGLE: 5, DESERT: 6,
  SAVANNA: 7, TUNDRA: 8, TAIGA: 9, SNOW: 10, HILLS: 11, MOUNTAIN: 12, STEPPE: 13,
};

export const BIOMES = [
  { name: 'Open Ocean', color: [46, 98, 140], water: true },
  { name: 'Coastal Waters', color: [78, 142, 172], water: true },
  { name: 'Sea Ice', color: [214, 228, 236], water: true },
  { name: 'Meadow', color: [134, 176, 92] },
  { name: 'Woodland', color: [86, 138, 70] },
  { name: 'Jungle', color: [52, 112, 58] },
  { name: 'Desert', color: [226, 196, 136] },
  { name: 'Savanna', color: [196, 182, 102] },
  { name: 'Tundra', color: [160, 166, 132] },
  { name: 'Taiga', color: [82, 116, 88] },
  { name: 'Snowfield', color: [236, 240, 244] },
  { name: 'Hills', color: [150, 150, 98] },
  { name: 'Mountains', color: [132, 124, 116] },
  { name: 'Steppe', color: [176, 178, 108] },
];

export const world = {
  biome: null,    // Uint8Array(W*H)
  country: null,  // Uint8Array(W*H), 0 = none, else index+1
  countryNames: [],
  overview: null, // canvas W x (H/2)
  ready: false,
};

export const wrapX = (x) => ((x % W) + W) % W;
export const idxOf = (x, y) => y * W + wrapX(x);
export const tileLon = (x, y) => ((x + 0.5 + (y & 1) * 0.5) / W) * 360 - 180;
export const tileLat = (y) => 90 - ((y + 0.5) / H) * 180;
// World-space (tile-width units) position of a tile centre.
export const tileWX = (x, y) => x + 0.5 + (y & 1) * 0.5;
export const tileWY = (y) => y * 0.25 + 0.25;

export function biomeAt(x, y) {
  if (y < 0 || y >= H) return B.OCEAN;
  return world.biome[y * W + wrapX(x)];
}
export const isWater = (b) => b <= 2;

// 8 neighbours on the staggered grid: 4 edge-sharing diagonals + 4 corner-touching.
export function neighbors(x, y) {
  const o = y & 1;
  return [
    [x - 1 + o, y - 1], [x + o, y - 1], [x - 1 + o, y + 1], [x + o, y + 1],
    [x - 1, y], [x + 1, y], [x, y - 2], [x, y + 2],
  ];
}

// ---------- TopoJSON decoding ----------
function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
}
function ringPoints(ring, arcs) {
  const pts = [];
  for (const ai of ring) {
    let a = ai >= 0 ? arcs[ai] : arcs[~ai].slice().reverse();
    for (let i = pts.length ? 1 : 0; i < a.length; i++) pts.push(a[i]);
  }
  return pts;
}

// ---------- Hand-placed real-world features (lon, lat) ----------
// [points, width in degrees, strength]
const RANGES = [
  [[[73, 35], [77, 33], [81, 30], [85, 28], [88, 27.8], [92, 28], [95, 29]], 2.4, 1],      // Himalaya
  [[[80, 34], [88, 33], [96, 33]], 6, 0.7], [[[82, 31], [94, 31]], 4, 0.7],                // Tibet
  [[[66, 35], [70, 36.5], [74, 37], [77, 35.5]], 2, 0.95],                                 // Hindu Kush / Pamir
  [[[70, 42], [76, 42], [80, 42.5], [86, 43], [90, 43.5]], 2, 0.85],                      // Tian Shan
  [[[84, 50], [88, 49], [92, 48], [98, 47]], 2, 0.8],                                     // Altai
  [[[76, 36], [84, 36], [92, 35.8], [98, 35]], 1.5, 0.85],                                // Kunlun
  [[[98, 33], [99, 28], [100, 25]], 2, 0.8],                                              // Hengduan
  [[[-75, 10], [-77, 5], [-78, 0], [-79, -4], [-77, -10], [-74, -14], [-70, -17], [-68, -21], [-68, -25],
    [-70, -30], [-70, -35], [-71, -40], [-72, -45], [-73, -50], [-72, -54]], 2.2, 1],      // Andes
  [[[-70, -15], [-67, -20]], 4, 0.72],                                                   // Altiplano
  [[[-150, 61], [-140, 60], [-130, 58], [-124, 54], [-118, 51], [-114, 48], [-112, 45], [-109, 42],
    [-106, 39], [-106, 35], [-107, 32]], 3, 0.85],                                       // Rockies
  [[[-121.5, 49], [-121.7, 45], [-122, 41], [-119, 37.5], [-118, 35.5]], 1.3, 0.78],     // Cascades / Sierra
  [[[-155, 60], [-150, 63], [-142, 62]], 2, 0.85], [[[-162, 68], [-150, 68], [-142, 69]], 1.5, 0.7],
  [[[-108, 30], [-105, 25], [-103, 21], [-99, 19], [-96, 17]], 2, 0.72], [[[-101, 26], [-99, 22]], 1.5, 0.65],
  [[[-85, 34], [-82, 36], [-79, 38.5], [-76, 41], [-73, 43], [-70, 45], [-67, 47]], 2, 0.6], // Appalachians
  [[[6, 44], [7, 46], [10, 46.5], [13, 47], [15.5, 47.3]], 1.3, 0.95],                      // Alps
  [[[-1.5, 43], [3, 42.5]], 0.8, 0.8],                                                   // Pyrenees
  [[[17.5, 49], [21, 49.3], [24, 48], [26, 46], [23, 45.3]], 1.2, 0.65],                  // Carpathians
  [[[15, 45], [18, 43], [20, 42], [22, 41], [25, 42.7]], 1.4, 0.62],                      // Balkans
  [[[9, 44.3], [12, 43], [14, 41.5], [16, 40], [16.2, 38.5]], 0.9, 0.6],                  // Apennines
  [[[6, 59], [8, 62], [12, 64], [15, 67], [18, 69], [22, 70]], 2, 0.7],                    // Scandinavia
  [[[59, 51], [59, 55], [59.5, 60], [60, 64], [62, 67]], 1.5, 0.6],                       // Urals
  [[[38, 44], [42, 43], [46, 42], [49, 41]], 1.2, 0.9],                                   // Caucasus
  [[[45, 36], [48, 33], [51, 30], [54, 28], [57, 27]], 2, 0.75], [[[49, 37], [53, 36], [57, 37], [61, 36]], 1, 0.7],
  [[[28, 37.5], [33, 37], [37, 38], [41, 39.5], [44, 39.5]], 2, 0.65],                    // Anatolia
  [[[-9, 30.5], [-6, 32], [-2, 33], [3, 35.5], [8, 36]], 1.5, 0.75],                      // Atlas
  [[[37, 8], [38.5, 10], [39, 13]], 4, 0.75],                                             // Ethiopia
  [[[36, 0], [35, -3], [34, -8], [35, -11]], 2, 0.6],                                     // East Africa
  [[[27, -32], [29, -29.5], [31, -27]], 1.5, 0.65],                                       // Drakensberg
  [[[145, -15], [146.5, -20], [149, -25], [151, -29], [149.5, -34], [147, -37]], 2, 0.56],
  [[[167.5, -46], [170, -43.5], [173, -41.5]], 1.2, 0.85],                                // NZ Alps
  [[[131, 32], [134, 34.5], [137, 36], [139.5, 37.5], [140.5, 40], [141, 42], [143, 43.5]], 1, 0.66],
  [[[96, 4], [100, 0], [103, -3], [107, -7], [112, -7.8], [115, -8.3]], 1, 0.56],
  [[[135, -4], [140, -4.5], [145, -6], [147, -7]], 1.5, 0.8],                             // New Guinea
  [[[73.5, 18], [75, 13], [77, 9]], 1, 0.52],                                             // Western Ghats
  [[[128, 64], [134, 67], [140, 68]], 2, 0.6], [[[142, 64], [150, 66], [155, 67]], 2, 0.6],
  [[[157, 52], [159, 55], [161, 58]], 1.2, 0.7],                                          // Kamchatka
  [[[-63, 5], [-60, 5.5]], 2, 0.55], [[[-48, -20], [-43, -21], [-46, -15]], 3, 0.5],
  [[[-7, 62], [-5, 58], [-4, 57]], 1, 0.5],                                               // Scottish highlands
];
// [lon, lat, rx, ry, strength]
const DESERTS = [
  [3, 23, 18, 7, 1], [20, 22, 12, 6, 1], [-8, 22, 8, 6, 1], [28, 24, 6, 6, 1], [46, 22, 8, 6, 1],
  [40, 32, 5, 3, 0.7], [56, 32, 6, 3, 0.8], [71, 27, 3.5, 3, 0.8], [62, 41, 7, 3.5, 0.8],
  [83, 39, 6, 2, 1], [104, 42, 10, 3.5, 0.9], [130, -25, 12, 7, 0.9], [122, -22, 5, 4, 0.8],
  [21, -24, 5, 5, 0.7], [15, -23, 2, 5, 0.9], [-70, -23, 1.5, 6, 1], [-68, -44, 4, 6, 0.55],
  [-115, 35, 5, 5, 0.75], [-112, 31, 4, 3, 0.8], [-117, 40, 4, 3, 0.55], [46, 8, 5, 4, 0.6],
];
const RAIN = [
  [-62, -4, 13, 8, 1], [20, 0, 10, 5, 1], [-5, 6, 9, 3, 0.7], [110, 0, 15, 7, 1], [100, 15, 6, 6, 0.6],
  [142, -5, 8, 3, 1], [-85, 12, 6, 6, 0.7], [-43, -18, 3, 6, 0.6], [90, 24, 4, 3, 0.6], [48.5, -17, 1.5, 5, 0.7],
  [145, -16, 2, 3, 0.5], [5, 50, 12, 8, 0.15], [-82, 38, 10, 8, 0.35], [115, 30, 10, 8, 0.4],
  [-125, 48, 4, 6, 0.5], [140, 37, 6, 6, 0.4], [30, 58, 25, 8, 0.25], [-75, 50, 20, 8, 0.25],
];

// ---------- Low resolution helper maps (0.5 degree / px) ----------
const LW = 720, LH = 360;
function boxBlur(src, w, h, r, passes = 3) {
  let a = src, b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {          // horizontal (wrapping)
      let s = 0; const row = y * w;
      for (let i = -r; i <= r; i++) s += a[row + ((i + w) % w)];
      for (let x = 0; x < w; x++) {
        b[row + x] = s / (2 * r + 1);
        s += a[row + ((x + r + 1) % w)] - a[row + ((x - r + w) % w)];
      }
    }
    for (let x = 0; x < w; x++) {          // vertical (clamped)
      let s = 0;
      for (let i = -r; i <= r; i++) s += b[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s / (2 * r + 1);
        s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}
function lowresCanvas(draw) {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, LW, LH);
  draw(g);
  const d = g.getImageData(0, 0, LW, LH).data, out = new Float32Array(LW * LH);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}
const lx = (lon) => ((lon + 180) / 360) * LW, ly = (lat) => ((90 - lat) / 180) * LH;
function sample(map, lon, lat) {
  const u = lx(lon) - 0.5, v = Math.min(LH - 1.001, Math.max(0, ly(lat) - 0.5));
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const xa = (x0 + LW) % LW, xb = (x0 + 1 + LW) % LW, yb = Math.min(LH - 1, y0 + 1);
  const a = map[y0 * LW + xa], b = map[y0 * LW + xb], c = map[yb * LW + xa], d = map[yb * LW + xb];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function ellipses(list, blur) {
  return boxBlur(lowresCanvas((g) => {
    for (const [lon, lat, rx, ry, s] of list) {
      g.fillStyle = `rgba(255,255,255,${s})`;
      g.beginPath(); g.ellipse(lx(lon), ly(lat), rx * 2, ry * 2, 0, 0, Math.PI * 2); g.fill();
    }
  }), LW, LH, blur);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function generateWorld(onProgress = () => {}) {
  onProgress(0.02, 'Unrolling the map of Earth…');
  const topo = await (await fetch('data/countries-50m.json')).json();
  const arcs = decodeArcs(topo);
  const geoms = topo.objects.countries.geometries;
  world.countryNames = geoms.map((g) => (g.properties && g.properties.name) || 'Unknown lands');

  // Rasterise countries at full tile resolution; R channel = country index + 1.
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const rg = rc.getContext('2d', { willReadFrequently: true });
  let un_prev = 0;
  const px = (lon) => ((lon + 180) / 360) * W, py = (lat) => ((90 - lat) / 180) * H;
  geoms.forEach((g, i) => {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    rg.fillStyle = `rgb(${i + 1},0,0)`;
    rg.beginPath();
    for (const poly of polys) for (const ring of poly) {
      const pts = ringPoints(ring, arcs);
      // Unwrap rings that cross the antimeridian, then draw shifted copies.
      let off = 0, minL = 999, maxL = -999;
      const un = pts.map(([lon, lat], k) => {
        if (k) { const d = lon + off - un_prev; if (d > 180) off -= 360; else if (d < -180) off += 360; }
        un_prev = lon + off; minL = Math.min(minL, un_prev); maxL = Math.max(maxL, un_prev);
        return [un_prev, lat];
      });
      const shifts = [0]; if (minL < -180) shifts.push(360); if (maxL > 180) shifts.push(-360);
      for (const sh of shifts) {
        un.forEach(([lon, lat], k) => (k ? rg.lineTo(px(lon + sh), py(lat)) : rg.moveTo(px(lon + sh), py(lat))));
        rg.closePath();
      }
    }
    rg.fill('evenodd');
  });
  await tick();
  onProgress(0.12, 'Raising mountains…');

  const mount = boxBlur(lowresCanvas((g) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [pts, w, s] of RANGES) {
      g.strokeStyle = `rgba(255,255,255,${s})`; g.lineWidth = w * 2;
      g.beginPath(); pts.forEach(([lo, la], k) => (k ? g.lineTo(lx(lo), ly(la)) : g.moveTo(lx(lo), ly(la)))); g.stroke();
    }
  }), LW, LH, 1, 2);
  const desert = ellipses(DESERTS, 4);
  const rain = ellipses(RAIN, 4);
  // Continentality: blurred low-res land mask.
  const lc = document.createElement('canvas'); lc.width = LW; lc.height = LH;
  const lg = lc.getContext('2d', { willReadFrequently: true });
  lg.drawImage(rc, 0, 0, LW, LH);
  const ld = lg.getImageData(0, 0, LW, LH).data, landLow = new Float32Array(LW * LH);
  for (let i = 0; i < landLow.length; i++) landLow[i] = ld[i * 4 + 3] / 255;
  const cont = boxBlur(landLow, LW, LH, 10, 3);
  await tick();

  onProgress(0.2, 'Painting the lands…');
  const data = rg.getImageData(0, 0, W, H).data;
  rc.width = rc.height = 1; // free
  const biome = new Uint8Array(W * H), country = new Uint8Array(W * H);
  const greenland = world.countryNames.indexOf('Greenland') + 1;
  const antarctica = world.countryNames.indexOf('Antarctica') + 1;

  for (let y = 0; y < H; y++) {
    const lat = tileLat(y), alat = Math.abs(lat);
    const baseT = 1 - Math.pow(alat / 90, 1.15);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4;
      if (data[p + 3] < 128) { biome[i] = B.OCEAN; continue; }
      const c = data[p]; country[i] = c;
      const lon = tileLon(x, y);
      if (c === antarctica && lat < -60) { biome[i] = alat < 66 && hash2(x, y, 5) < 0.3 ? B.TUNDRA : B.SNOW; continue; }
      const m = sample(mount, lon, lat);
      const n1 = fbm(lon / 3, lat / 3, 3, 11) - 0.5;
      const n2 = fbm(lon / 1.2, lat / 1.2, 3, 23) - 0.5;
      let elev = m * (0.92 + 0.9 * n1) + 0.16 + 0.55 * n2 * (0.4 + m);
      elev += Math.max(0, fbm(lon / 0.8, lat / 0.8, 2, 51) - 0.64) * 3.2; // scattered hill country
      if (m < 0.2) elev = Math.min(elev, 0.74);
      const ct = sample(cont, lon, lat);
      let t = baseT - elev * 0.28 - (alat > 40 ? (ct - 0.5) * 0.12 : 0) + n1 * 0.05;
      let moist = 0.52 + (fbm(lon / 4, lat / 4, 3, 37) - 0.5) * 0.55
        - sample(desert, lon, lat) * 0.9 + sample(rain, lon, lat) * 0.55 - Math.max(0, ct - 0.6) * 0.5
        + (fbm(lon / 0.6, lat / 0.6, 2, 61) - 0.5) * 0.4; // local copses and clearings
      // Subtropical dry belt
      moist -= Math.max(0, 1 - Math.abs(alat - 25) / 10) * 0.08;

      let b;
      if (c === greenland && lat > 59 && lon > -75 && lon < -10 && ct > 0.45) b = B.SNOW;
      else if (elev > 0.78) b = (t < 0.35 || elev > 0.95) ? B.SNOW : B.MOUNTAIN;
      else if (elev > 0.56 && t > 0.12) b = B.HILLS;
      else if (t < 0.13) b = B.SNOW;
      else if (t < 0.24) b = B.TUNDRA;
      else if (t < 0.36) b = moist > 0.3 ? B.TAIGA : B.TUNDRA;
      else if (moist < 0.2 && t > 0.42) b = B.DESERT;
      else if (moist < 0.36) b = t > 0.66 ? B.SAVANNA : B.STEPPE;
      else if (moist > 0.72 && t > 0.68) b = B.JUNGLE;
      else if (moist > 0.6) b = t < 0.4 ? B.TAIGA : B.FOREST;
      else b = t > 0.72 && moist < 0.48 ? B.SAVANNA : B.GRASS;
      biome[i] = b;
    }
    if ((y & 127) === 0) { onProgress(0.2 + (y / H) * 0.6, 'Painting the lands…'); await tick(); }
  }

  onProgress(0.82, 'Filling the seas…');
  // Coastal waters: ocean within ~2 rings of land.
  for (let pass = 0; pass < 2; pass++) {
    const mark = [];
    for (let y = 2; y < H - 2; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (biome[i] !== B.OCEAN) continue;
        const l = y * W + (x ? x - 1 : W - 1), r = y * W + (x < W - 1 ? x + 1 : 0);
        const ok = (j) => pass === 0 ? biome[j] > 2 : biome[j] !== B.OCEAN;
        if (ok(l) || ok(r) || ok(i - W) || ok(i + W) || ok(i - 2 * W) || ok(i + 2 * W)) mark.push(i);
      }
    }
    for (const i of mark) biome[i] = B.SHALLOW;
    await tick();
  }
  for (let y = 0; y < H; y++) {
    const alat = Math.abs(tileLat(y));
    if (alat < 66) continue;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (biome[i] <= 1 && (alat > 78 || (alat > 70 && fbm(x / 40, y / 80, 3, 3) > 0.6 - (alat - 70) / 40))) biome[i] = B.SEAICE;
    }
  }

  onProgress(0.9, 'Drawing the atlas…');
  world.biome = biome; world.country = country;
  world.overview = buildOverview(biome);
  world.ready = true;
  onProgress(1, 'Ready');
}

function buildOverview(biome) {
  const OH = H / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = OH;
  const g = c.getContext('2d');
  const img = g.createImageData(W, OH), d = img.data;
  for (let y = 0; y < OH; y++) {
    for (let x = 0; x < W; x++) {
      const b = biome[(y * 2) * W + x];
      const col = BIOMES[b].color;
      let k = 0.94 + hash2(x, y, 9) * 0.1;
      if (b === B.MOUNTAIN || b === B.HILLS) {
        // Simple hillshade from neighbour to the north-west
        const nb = biome[Math.max(0, y * 2 - 2) * W + (x ? x - 1 : 0)];
        k *= nb === b ? 1 : 1.12;
      }
      if (b === B.OCEAN) k = 0.97 + hash2(x >> 2, y >> 2, 4) * 0.04;
      const o = (y * W + x) * 4;
      d[o] = Math.min(255, col[0] * k); d[o + 1] = Math.min(255, col[1] * k); d[o + 2] = Math.min(255, col[2] * k); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function describeTile(x, y) {
  const i = idxOf(x, y), c = world.country[i];
  const lat = tileLat(y), lon = tileLon(wrapX(x), y);
  const coord = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  return { biome: BIOMES[world.biome[i]].name, place: c ? world.countryNames[c - 1] : 'Open sea', coord };
}
