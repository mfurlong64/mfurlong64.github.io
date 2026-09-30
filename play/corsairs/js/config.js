// ── Derived from data/ — edit data files, not this one ───────────────────────

const COLS = MAP_CONFIG.cols;
const ROWS = MAP_CONFIG.rows;
const SQ3  = Math.sqrt(3);

// Render state — updated by resize()
let S = 40, OX = 0, OY = 0;

// Compass labels indexed by facing (0=N, 1=NE, 2=SE, 3=S, 4=SW, 5=NW)
const FACING = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];

// DEFS: alias for SHIP_TYPES — used throughout logic and render code
const DEFS = SHIP_TYPES;

// Expand fleet init with stats from ship type definitions so each ship object
// is self-contained and runtime code never needs to look up SHIP_TYPES again.
const INIT = FLEET_INIT.map(d => ({
  ...d,
  health:    SHIP_TYPES[d.type].health,
  maxHealth: SHIP_TYPES[d.type].health,
  move:      SHIP_TYPES[d.type].move,
  cannons:   SHIP_TYPES[d.type].cannons,
}));

// islands: alias so logic code keeps a short name
const islands = ISLANDS;

// Live ship state — reset to INIT on new game
let ships = INIT.map(d => ({ ...d, moved: false, fired: false, sunk: false }));
