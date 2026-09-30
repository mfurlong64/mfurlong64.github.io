// Pixel center of a hex at grid position (col, row)
function hexCenter(col, row) {
  return {
    x: OX + 1.5 * S * col + S,
    y: OY + SQ3 * S * row + (col & 1 ? SQ3 * S * .5 : 0) + SQ3 * S * .5,
  };
}

// Trace a regular hexagon path on the canvas (flat-top orientation)
function hexPath(cx, cy, r = S) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * Math.PI / 180;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

// Axial neighbor in one of 6 directions (0=N, 1=NE, 2=SE, 3=S, 4=SW, 5=NW)
function neighbor(col, row, dir) {
  const even = !(col & 1);
  const D = even
    ? [[0,-1],[1,-1],[1,0],[0,1],[-1,0],[-1,-1]]
    : [[0,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
  return { col: col + D[dir][0], row: row + D[dir][1] };
}

// Oval playable zone in pixel-proportional space — true circle on screen, no cornered ships
function isPlayable(c, r) {
  const px = 1.5 * c + 1,   py = SQ3 * r + SQ3 * 0.5;
  const cx = 1.5 * (COLS - 1) / 2 + 1, cy = SQ3 * (ROWS - 1) / 2 + SQ3 * 0.5;
  const rx = 1.5 * (COLS - 1) / 2,     ry = SQ3 * (ROWS - 1) / 2;
  return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= MAP_CONFIG.ovalThreshold;
}

function onGrid(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && isPlayable(c, r);
}

// Return the playable hex closest to a pixel coordinate
function nearestHex(px, py) {
  let best = Infinity, bc = 0, br = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isPlayable(c, r)) continue;
      const h = hexCenter(c, r), d = (px - h.x) ** 2 + (py - h.y) ** 2;
      if (d < best) { best = d; bc = c; br = r; }
    }
  }
  return { col: bc, row: br };
}
