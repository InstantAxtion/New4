// Peaceful neighbouring kingdoms that slowly grow across the map, and great seasonal migrations.
import { W, H, tileWX, tileWY } from './world.js';
import { S } from './game.js';
import { YEAR, seasonIndex } from './seasons.js';
import * as L from './life.js';

// ---------------- kingdoms ----------------
const FORMS = [(n) => `Kingdom of ${n}`, (n) => `Duchy of ${n}`, (n) => `Realm of ${n}`, (n) => `${n} March`, (n) => `Principality of ${n}`, (n) => `Free Lands of ${n}`];
const d2 = (a, b) => { let dx = Math.abs(a.x - b.x); if (dx > W / 2) dx = W - dx; const dy = (a.y - b.y) / 2; return dx * dx + dy * dy; };
const order = (n) => ((n.id * 2654435761) >>> 0) / 4294967296;
let cache = [], key = '';
export function kingdoms() {
  const k = S.neighbors.length + ':' + Math.floor(S.day / 4) + ':' + S.towns.length;
  if (k === key) return cache;
  key = k;
  const caps = [];
  for (const n of [...S.neighbors].sort((a, b) => order(a) - order(b))) {
    if (caps.length >= 36) break;
    if (n.joined || n.friend >= 60) continue;
    if (caps.some((c) => d2(c, n) < 75 * 75) || S.towns.some((t) => d2(t, n) < 45 * 45)) continue;
    caps.push(n);
  }
  const R = 16 + Math.min(70, (S.day / YEAR) * 5), R2 = R * R;
  const out = caps.map((c, i) => ({ id: i, cap: c, name: FORMS[c.id % FORMS.length](c.name), hue: c.hue, members: [c] }));
  for (const n of S.neighbors) {
    n.realm = null;
    if (n.joined || n.friend >= 60) continue;
    let best = -1, bd = R2;
    for (let i = 0; i < caps.length; i++) { const d = d2(caps[i], n); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { if (n !== caps[best]) out[best].members.push(n); n.realm = out[best].name; }
  }
  cache = out.filter((kd) => kd.members.length >= 2);
  return cache;
}
// Soft tinted lands around each kingdom's villages, with its name over the capital.
export function drawKingdoms(ctx, v, labels) {
  if (v.tw < 0.6) return;
  for (const kd of kingdoms()) {
    const p = new Path2D(); let any = false;
    const r = Math.max(3, 9 * v.tw);
    for (const n of kd.members) {
      const x = v.sx(tileWX(n.x, n.y)), y = v.sy(tileWY(n.y));
      if (x < -r || x > v.cw + r || y < -r || y > v.ch + r) continue;
      p.moveTo(x + r, y); p.ellipse(x, y, r, r * 0.55, 0, 0, 6.283); any = true;
    }
    if (!any) continue;
    ctx.fillStyle = `hsla(${kd.hue},55%,55%,${v.tw >= 20 ? 0.08 : 0.22})`; ctx.fill(p);
    if (labels && v.tw < 20 && v.tw >= 1.2) {
      const x = v.sx(tileWX(kd.cap.x, kd.cap.y)), y = v.sy(tileWY(kd.cap.y)) - Math.max(10, r * 0.5);
      if (x < -80 || x > v.cw + 80 || y < -20 || y > v.ch + 20) continue;
      ctx.font = `italic 600 ${Math.round(11 + Math.min(4, v.tw * 0.4))}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.strokeText(kd.name, x, y);
      ctx.fillStyle = `hsl(${kd.hue},70%,86%)`; ctx.fillText(kd.name, x, y);
    }
  }
}

// ---------------- migrations ----------------
// [kind, season it travels in (0 spring..3 winter, -1 all year), route as [lon, lat] points]
const MIGRATIONS = [
  ['birds', 2, [[10, 54], [8, 44], [6, 36], [5, 25], [3, 12], [8, 5]]],          // Europe to West Africa in autumn
  ['birds', 0, [[8, 5], [3, 12], [5, 25], [6, 36], [8, 44], [10, 54]]],          // and home in spring
  ['birds', 2, [[-98, 58], [-96, 45], [-92, 32], [-89, 20], [-80, 9]]],          // North American geese head south
  ['birds', 0, [[-80, 9], [-89, 20], [-92, 32], [-96, 45], [-98, 58]]],
  ['birds', 2, [[90, 58], [88, 48], [85, 38], [80, 27], [78, 18]]],              // Siberian cranes to India
  ['birds', 0, [[78, 18], [80, 27], [85, 38], [88, 48], [90, 58]]],
  ['gazelle', -1, [[34.8, -2.3], [35.2, -1.4], [35.0, -0.9], [34.4, -1.6], [34.6, -2.6], [35.3, -3.0], [34.8, -2.3]]], // the great herds of the Serengeti
  ['reindeer', -1, [[-108, 64], [-104, 66], [-100, 67], [-102, 63], [-106, 61], [-108, 64]]],                          // caribou on the tundra
];
const tilePt = ([lon, lat]) => { const y = ((90 - lat) / 180) * H; return [((lon + 180) / 360) * W, y]; };
export function drawMigrations(ctx, v) {
  if (S.settings.gentle) return;
  const t = v.time;
  for (const [kind, season, route] of MIGRATIONS) {
    const lat0 = route[0][1];
    let f;
    if (season >= 0) { if (seasonIndex(S.day, lat0) !== season) continue; f = (S.day % 12) / 12; }
    else f = (S.day % YEAR) / YEAR;
    const segs = route.length - 1, u = f * segs, k = Math.min(segs - 1, Math.floor(u)), r = u - k;
    const [ax, ay] = tilePt(route[k]), [bx, by] = tilePt(route[k + 1]);
    const tx = ax + (bx - ax) * r, ty = ay + (by - ay) * r;
    const X = v.sx(tx + 0.5 + (Math.round(ty) & 1) * 0.5), Y = v.sy(ty * 0.25 + 0.25);
    if (X < -200 || X > v.cw + 200 || Y < -200 || Y > v.ch + 200) continue;
    const face = bx >= ax ? 1 : -1;
    if (kind === 'birds') {
      const sz = Math.max(2.5, Math.min(7, v.tw * 0.18)), sp = Math.max(5, Math.min(16, v.tw * 0.4));
      ctx.strokeStyle = 'rgba(40,40,50,0.8)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2), x = X - face * rank * sp, y = Y + side * rank * sp * 0.5, flap = Math.sin(t * 6 + i) * sz * 0.4;
        ctx.beginPath(); ctx.moveTo(x - sz, y - flap); ctx.quadraticCurveTo(x - sz * 0.4, y - sz * 0.5, x, y); ctx.quadraticCurveTo(x + sz * 0.4, y - sz * 0.5, x + sz, y - flap); ctx.stroke();
      }
    } else if (v.tw >= 20) { // the herd itself, close up
      for (let i = 0; i < 24; i++) {
        const ox = Math.sin(i * 12.9898) * 3.2, oy = Math.cos(i * 78.233) * 1.4, wob = Math.sin(t * 0.6 + i) * 0.15;
        L.drawAnimal(ctx, kind, X + (ox + wob) * v.tw, Y + oy * v.tw * 0.5, v.s * 1.1, face, t * 1.4, i);
      }
    } else { // from afar: a dusty smudge of many animals
      ctx.fillStyle = 'rgba(70,52,34,0.75)';
      for (let i = 0; i < 30; i++) { const ox = Math.sin(i * 12.9898) * 4, oy = Math.cos(i * 78.233) * 2; ctx.fillRect(X + ox * Math.max(1, v.tw) , Y + oy * Math.max(1, v.tw) * 0.5, 1.6, 1.6); }
    }
  }
}
