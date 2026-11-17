// Shapes of the main game objects, as JSDoc types. Nothing here runs: it documents the data
// for editors (hover, autocomplete) and for anyone adding a feature.

/**
 * @typedef {Object} Building
 * @property {string} t        type key into DEFS (data/buildings.js)
 * @property {number} p        construction progress, 0..1 (1 = finished)
 * @property {number} town     id of the owning town
 * @property {number} [m]      yield multiplier from the site (fertile land, woods nearby...)
 * @property {number} [z]      1 if it grew from a painted zone
 * @property {number} [lv]     level: homes 1..3 (cottage, town house, manor); workplaces 1..3
 * @property {number} [f]      1 if turned (mirrored)
 * @property {number} [d]      day it was finished
 * @property {boolean} [idle]  resting because its upkeep could not be paid
 */

/**
 * @typedef {Object} Person
 * @property {number} i        id
 * @property {string} f        first name
 * @property {string} l        family name
 * @property {number} b        birth day
 * @property {?string} j       job: a building type, or null
 * @property {number} k        skill in the current job, 0..100
 * @property {number} [g]      general Know-how, 0..100
 * @property {Object<string, number>} [xp]  skill earned in each trade
 * @property {number} p        partner id (0 if single)
 * @property {number[]} par    parent ids
 */

/**
 * @typedef {Object} Town
 * @property {number} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {boolean} capital
 * @property {number} pop
 * @property {number} cap      homes available
 * @property {number} radius   border radius in tiles
 * @property {Person[]} [folk]
 * @property {number} [garrison]
 * @property {{r: string, title: string}} [fame]
 */

/**
 * @typedef {Object} Village   a neighbouring village (not part of your realm)
 * @property {number} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} pop
 * @property {number} friend   friendship 0..100
 * @property {boolean} joined  true once it joined your realm
 * @property {?string} [realm] name of the kingdom it belongs to
 */

/**
 * @typedef {Object} GameState  the single source of truth, `S` in game.js; everything in it is saved
 * @property {boolean} started
 * @property {string} name
 * @property {number} day      in-game days since founding (DAY_SECONDS real seconds each)
 * @property {0|1|2} speed     pause, play, double
 * @property {number} tier     index into TIERS
 * @property {Object<string, number>} res
 * @property {Town[]} towns
 * @property {Map<number, Building>} buildings   keyed by tile index (y * W + x)
 * @property {Map<number, string>} zones          painted zones, keyed by tile index
 * @property {Village[]} neighbors
 */

export {};
