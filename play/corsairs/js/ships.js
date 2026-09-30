function isIsland(c, r) {
  return islands.some(i => i.col === c && i.row === r);
}

// The stern occupies the hex directly behind the bow
function sternHex(ship) {
  return neighbor(ship.col, ship.row, (ship.facing + 3) % 6);
}

// All hexes a ship occupies (1 for sloop, 2 for brig/frigate)
function shipHexes(ship) {
  const bow = { col: ship.col, row: ship.row };
  return DEFS[ship.type].twoHex ? [bow, sternHex(ship)] : [bow];
}

// Visual center — midpoint between bow and stern for 2-hex ships
function shipOrigin(ship) {
  if (!DEFS[ship.type].twoHex) return hexCenter(ship.col, ship.row);
  const b = hexCenter(ship.col, ship.row);
  const s = hexCenter(sternHex(ship).col, sternHex(ship).row);
  return { x: (b.x + s.x) / 2, y: (b.y + s.y) / 2 };
}

// Half-length of the hull sprite
function shipL(type) {
  return DEFS[type].twoHex ? SQ3 * S * .78 : S * .62;
}

// True if a ship's bow cannot enter (col, row)
function isBlockedForBow(col, row, movingShip) {
  if (!onGrid(col, row) || isIsland(col, row)) return true;
  return ships.some(s => s.id !== movingShip.id && !s.sunk &&
    shipHexes(s).some(h => h.col === col && h.row === row));
}

// BFS returning all reachable {col, row, facing} destinations for a ship
function calcValidMoves(ship) {
  const result = new Map(), visited = new Set();
  const queue = [{ col: ship.col, row: ship.row, facing: ship.facing, ml: ship.move, turned: false }];

  while (queue.length) {
    const s = queue.shift();
    const key = `${s.col},${s.row},${s.facing},${s.ml},${s.turned}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (s.col !== ship.col || s.row !== ship.row || s.facing !== ship.facing) {
      const rk = `${s.col},${s.row}`;
      if (!result.has(rk)) result.set(rk, s);
    }

    if (s.ml === 0) {
      // Straight-line bonus: one free forward move if the ship hasn't turned
      if (!s.turned) {
        const fwd = neighbor(s.col, s.row, s.facing);
        if (!isBlockedForBow(fwd.col, fwd.row, ship)) {
          const bk = `${fwd.col},${fwd.row}`;
          if (!result.has(bk)) result.set(bk, { col: fwd.col, row: fwd.row, facing: s.facing, turned: false });
        }
      }
      continue;
    }

    // Allow turning in place so ships at the oval edge are never truly stuck
    if (!s.turned) {
      for (const nf of [(s.facing + 1) % 6, (s.facing - 1 + 6) % 6]) {
        queue.push({ col: s.col, row: s.row, facing: nf, ml: s.ml - 1, turned: true });
      }
    }

    // Move forward, or turn-then-move
    for (const { f, t } of [
      { f: s.facing,            t: s.turned },
      { f: (s.facing + 1) % 6, t: true },
      { f: (s.facing - 1 + 6) % 6, t: true },
    ]) {
      const dest = neighbor(s.col, s.row, f);
      if (!isBlockedForBow(dest.col, dest.row, ship))
        queue.push({ col: dest.col, row: dest.row, facing: f, ml: s.ml - 1, turned: t });
    }
  }

  // Keep "turn in place" as a valid destination only when facing changed
  // (used as a fallback when all forward exits are blocked)
  const startKey = `${ship.col},${ship.row}`;
  const startEntry = result.get(startKey);
  if (!startEntry || startEntry.facing === ship.facing) result.delete(startKey);

  return result;
}
