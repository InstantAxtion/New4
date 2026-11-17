// Realm tiers: how many villagers each needs, and what they allow.
// Pure data: no game state or logic lives here, so new content can be added by editing tables.
export const TIERS = [
  { name: 'Hamlet', pop: 0, maxTowns: 1, radiusCap: 6 },
  { name: 'Village', pop: 25, maxTowns: 2, radiusCap: 8 },
  { name: 'Town', pop: 80, maxTowns: 4, radiusCap: 10 },
  { name: 'City', pop: 200, maxTowns: 7, radiusCap: 13 },
  { name: 'Kingdom', pop: 500, maxTowns: 12, radiusCap: 16 },
  { name: 'Empire', pop: 1200, maxTowns: 16, radiusCap: 18 },
];
export const PRESTIGE_RANKS = [[0, 'Humble'], [500, 'Known'], [1500, 'Respected'], [4000, 'Renowned'], [9000, 'Famed'], [18000, 'Legendary']];
