// Save-file versions and migrations.
//
// Every save records the format version it was written with (`v`). When the save format changes:
//   1. bump SAVE_VERSION,
//   2. add a function to MIGRATIONS that upgrades a save from the previous version,
// and old saves (and backup files) are upgraded step by step when they are loaded.
// Never edit an old migration once it has shipped; add a new one instead.
export const SAVE_VERSION = 2;

const MIGRATIONS = {
  // v1 -> v2: fields added over many updates (research, talents, contracts, kingdoms, armies...) are
  // optional, so this step only fills in safe defaults and records the new version.
  1: (d) => ({
    ...d,
    research: d.research || { cur: null, prog: 0, done: [], bank: 0 },
    talents: d.talents || [],
    contracts: d.contracts || [],
    raids: d.raids || [],
    proads: d.proads || [],
    canals: d.canals || [],
    caravans: d.caravans || [],
    v: 2,
  }),
};

export const isSave = (d) => !!d && typeof d.v === 'number' && d.v >= 1 && d.v <= SAVE_VERSION && Array.isArray(d.towns);
export function migrate(d) {
  if (!d || typeof d.v !== 'number') return null;
  if (d.v > SAVE_VERSION) return null; // written by a newer version of the game
  while (d.v < SAVE_VERSION) {
    const step = MIGRATIONS[d.v];
    if (!step) return null;
    d = step(d);
  }
  return d;
}
