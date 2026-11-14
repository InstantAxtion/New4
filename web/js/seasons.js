// Seasons (per hemisphere) and the gentle day/night cycle. Pure functions of the game day.
export const YEAR = 48;              // in-game days per year (12 per season)
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SEASON_ICONS = ['🌸', '☀️', '🍂', '❄️'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };

// Hemisphere-local position in the year, 0..1 with 0 = first day of spring.
export function yearT(day, lat) {
  let t = (((day % YEAR) + YEAR) % YEAR) / YEAR;
  if (lat < 0) t = (t + 0.5) % 1; // southern hemisphere is half a year apart
  return t;
}
export const seasonIndex = (day, lat) => Math.floor(yearT(day, lat) * 4) % 4;

// How harsh winter gets at a latitude (0 in the warm belt, 1 far north/south).
export const coldness = (lat) => clamp01((Math.abs(lat) - 32) / 22);

// Snow spreads through early winter and melts in early spring.
export function snowLevel(t) {
  if (t >= 0.75) return smooth((t - 0.75) / 0.12);
  if (t < 0.1) return 1 - smooth(t / 0.1);
  return 0;
}
// Autumn colours come in during autumn and fade as leaves fall.
export function autumnLevel(t) {
  if (t < 0.5 || t >= 0.78) return 0;
  return smooth((t - 0.5) / 0.1) * (1 - smooth((t - 0.7) / 0.08));
}
// Bare deciduous trees from late autumn until early spring.
export function bareLevel(t) {
  if (t >= 0.72) return smooth((t - 0.72) / 0.06);
  if (t < 0.08) return 1 - smooth(t / 0.08);
  return 0;
}
// Spring blossom peaks mid-spring.
export const blossomLevel = (t) => (t >= 0.04 && t < 0.24 ? Math.sin(((t - 0.04) / 0.2) * Math.PI) : 0);

// Farms rest in winter and give a harvest boost in late summer and autumn, more so far from the equator.
export function farmSeason(day, lat) {
  const c = clamp01((Math.abs(lat) - 23) / 30), s = seasonIndex(day, lat);
  return s === 3 ? 1 - 0.6 * c : s === 1 ? 1 + 0.15 * c : s === 2 ? 1 + 0.1 * c : 1;
}

// Day and night: one gentle cycle every CYCLE in-game days (about 5 minutes of play).
// Returns darkness n (0..1) and warmth w (0..1) for sunrise/sunset colour.
export const CYCLE = 12;
export function nightAt(day) {
  const f = (((day / CYCLE) % 1) + 1) % 1;
  let n = 0;
  if (f >= 0.68 && f < 0.78) n = smooth((f - 0.68) / 0.1);
  else if (f >= 0.78 && f < 0.9) n = 1;
  else if (f >= 0.9) n = 1 - smooth((f - 0.9) / 0.1);
  let w = 0;
  if (f >= 0.62 && f < 0.8) w = Math.sin(((f - 0.62) / 0.18) * Math.PI);
  else if (f >= 0.88) w = Math.sin(((f - 0.88) / 0.12) * Math.PI) * 0.8;
  return { n, w };
}
