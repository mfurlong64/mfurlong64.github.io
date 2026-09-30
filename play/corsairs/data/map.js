// ── Grid Configuration ─────────────────────────────────────────────────────────
// cols / rows: hex grid dimensions (flat-top, odd-q offset layout).
// ovalThreshold: how far from grid centre a hex can be and still be playable.
//   Expressed as a normalised ellipse radius in pixel-proportional space.
//   Lower = smaller oval; 0.86 fills the grid comfortably without corner traps.
// ovalVignetteStart: hexes beyond this distance get a darkening overlay,
//   creating a visual fade toward the playable boundary.
// maxHexSize: caps S (hex radius in px) so hexes don't become enormous on
//   large monitors. Increase if you want bigger ships on a big screen.

const MAP_CONFIG = {
  cols:               23,
  rows:               15,
  ovalThreshold:      0.86,
  ovalVignetteStart:  0.60,
  maxHexSize:         50,
};

// ── Island Positions ───────────────────────────────────────────────────────────
// Islands block movement and line-of-sight.
// The default layout creates three tactical lanes (left, centre, right)
// with flanking chokepoints. Add or remove entries freely.

const ISLANDS = [
  { col:  5, row: 6 },   // outer left flank
  { col: 17, row: 6 },   // outer right flank
  { col:  9, row: 5 },   // upper-left gate
  { col: 13, row: 5 },   // upper-right gate
  { col: 11, row: 7 },   // central rock
  { col:  9, row: 9 },   // lower-left gate
  { col: 13, row: 9 },   // lower-right gate
  { col:  5, row: 8 },   // lower-left flank
  { col: 17, row: 8 },   // lower-right flank
];
