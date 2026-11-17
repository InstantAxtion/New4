// Paintable zones and the building each grows into.
// Pure data: no game state or logic lives here, so new content can be added by editing tables.
export const ZONES = {
  housing: { name: 'Housing', builds: 'house', color: '#f07a48' },
  farmland: { name: 'Farmland', builds: 'farm', color: '#e6cf3a' },
  pasture: { name: 'Pasture', builds: 'pasture', color: '#7cc464' },
  woodlot: { name: 'Woodlot', builds: 'woodlot', color: '#2f8a5a' },
  park: { name: 'Park', builds: 'park', color: '#e88ac0' },
  workshop: { name: 'Workshops', builds: 'workshop', color: '#8a7ef0' },
  mining: { name: 'Mining', builds: 'pit', color: '#a08a70' },
  shops: { name: 'Shops', builds: 'shops', color: '#40a8d8' },
};
