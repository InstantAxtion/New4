// Which building style a place uses, from where it sits on Earth.
import { B, world, tileLat, tileLon, wrapX } from './world.js';

const cache = new Map();
export function styleAt(x, y) {
  const key = (y >> 4) * 4096 + (wrapX(x) >> 3); // nearby places share a style
  if (cache.has(key)) return cache.get(key);
  const lat = tileLat(y), lon = tileLon(wrapX(x), y), alat = Math.abs(lat);
  const b = world.biome[y * 2000 + wrapX(x)];
  let st = 'temperate';
  if (lon > 95 && lon < 150 && lat > 18 && lat < 50) st = 'eastasian';
  else if (lon > 67 && lon < 92 && lat > 6 && lat < 31) st = 'indian';
  else if (lon > -81 && lon < -64 && lat > -32 && lat < 6 && b !== B.JUNGLE) st = 'andean';
  else if ((lat > 14 && lat < 38 && lon > 32 && lon < 63) || (lat > 28 && lat < 37.5 && lon > -10 && lon < 32 && b !== B.DESERT)) st = 'arabic';
  else if (lon > 22 && lon < 62 && lat > 45 && lat < 60) st = 'slavic';
  else if (b === B.DESERT || (alat > 12 && alat < 36 && lon > -20 && lon < 75 && (b === B.STEPPE || b === B.SAVANNA))) st = 'desert';
  else if (alat < 23 && (b === B.JUNGLE || b === B.SAVANNA || b === B.GRASS || b === B.FOREST)) st = 'tropical';
  else if (alat >= 55 || b === B.TAIGA || b === B.TUNDRA) st = 'nordic';
  else if ((lat > 30 && lat < 45 && lon > -10 && lon < 42) || (lat > 32 && lat < 42 && lon > -125 && lon < -114)
    || (lat < -28 && lat > -42 && ((lon > -76 && lon < -68) || (lon > 15 && lon < 30) || (lon > 112 && lon < 155)))) st = 'mediterranean';
  cache.set(key, st);
  return st;
}
