// ── Ship Type Definitions ──────────────────────────────────────────────────────
// Each type defines the base stats for all ships of that class.
// wFrac controls hull width relative to hex size (visual only).
// twoHex: true means the ship occupies bow + stern hexes.

const SHIP_TYPES = {
  sloop: {
    label:    'Sloop',
    twoHex:   false,
    wFrac:    0.30,
    move:     6,
    cannons:  2,
    health:   3,
  },
  brig: {
    label:    'Brig',
    twoHex:   true,
    wFrac:    0.38,
    move:     5,
    cannons:  3,
    health:   5,
  },
  frigate: {
    label:    'Frigate',
    twoHex:   true,
    wFrac:    0.44,
    move:     4,
    cannons:  4,
    health:   7,
  },
};

// ── Fleet Starting Positions ───────────────────────────────────────────────────
// Only positional/identity data here — health, move, cannons are derived
// automatically from SHIP_TYPES when the game initialises.
// facing: 0=N, 1=NE, 2=SE, 3=S, 4=SW, 5=NW

const FLEET_INIT = [
  // Red fleet (player 1) — southern edge, facing north
  { id: 0, player: 1, type: 'sloop', col:  7, row: 12, facing: 0 },
  { id: 1, player: 1, type: 'sloop', col: 15, row: 12, facing: 0 },
  { id: 2, player: 1, type: 'brig',  col: 11, row: 12, facing: 0 },

  // Blue fleet (player 2) — northern edge, facing south
  { id: 3, player: 2, type: 'sloop', col: 15, row:  2, facing: 3 },
  { id: 4, player: 2, type: 'sloop', col:  7, row:  2, facing: 3 },
  { id: 5, player: 2, type: 'brig',  col: 11, row:  2, facing: 3 },
];
