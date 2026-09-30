// Move one Blue ship to the position that maximises firing opportunities,
// tiebroken by proximity to the nearest Red ship.
function doBlueMove() {
  const unmovedBlue = ships.filter(s => s.player === 2 && !s.sunk && !s.moved);
  if (!unmovedBlue.length) { checkMoveDone(); return; }

  const ship = unmovedBlue.sort((a, b) => b.cannons - a.cannons)[0];
  const validMoves = calcValidMoves(ship);
  const enemies = ships.filter(s => s.player === 1 && !s.sunk);

  let bestDest = null, bestScore = -Infinity;
  validMoves.forEach(dest => {
    // Temporarily place ship at destination to evaluate firing options
    const [oc, or_, of_] = [ship.col, ship.row, ship.facing];
    ship.col = dest.col; ship.row = dest.row; ship.facing = dest.facing;
    const { validTargets } = calcAllTargets(ship);
    let minDist = Infinity;
    for (const e of enemies) {
      for (const eh of shipHexes(e)) {
        const dc = hexCenter(dest.col, dest.row), ec = hexCenter(eh.col, eh.row);
        minDist = Math.min(minDist, Math.hypot(dc.x - ec.x, dc.y - ec.y));
      }
    }
    ship.col = oc; ship.row = or_; ship.facing = of_;
    const score = validTargets.size * 1000 - minDist;
    if (score > bestScore) { bestScore = score; bestDest = dest; }
  });

  if (bestDest) { ship.col = bestDest.col; ship.row = bestDest.row; ship.facing = bestDest.facing; }
  ship.moved = true;
  updateProgress(); updateSidebar();
  G.shotAnim = { main: `Blue ${DEFS[ship.type].label} moves`, sub: `Facing ${FACING[ship.facing]}`, until: G.t + 1.4 };
  G.afterAnim = checkMoveDone;
}

// Fire one Blue ship — picks the target that maximises expected hits
function doBlueShoot() {
  const unfiredBlue = ships.filter(s => s.player === 2 && !s.sunk && !s.fired);
  if (!unfiredBlue.length) { checkShootDone(); return; }

  const ship = unfiredBlue.sort((a, b) => b.cannons - a.cannons)[0];
  const { validTargets } = calcAllTargets(ship);
  let best = null, bestScore = -Infinity;
  for (const [, info] of validTargets) {
    const sc = info.dice * 10 - info.dist;
    if (sc > bestScore) { bestScore = sc; best = info; }
  }

  const result = best ? fireCannons(ship, best) : null;
  ship.fired = true;
  updateProgress(); updateSidebar();
  G.shotAnim = result
    ? { main: `Blue fires! ${result.main}`, sub: result.sub, until: G.t + 2.2 }
    : { main: `Blue ${DEFS[ship.type].label} holds fire`, sub: 'No targets in range', until: G.t + 1.2 };
  G.afterAnim = checkShootDone;
}

// After a ship moves, decide what happens next
function checkMoveDone() {
  const unmovedRed  = ships.filter(s => s.player === 1 && !s.sunk && !s.moved);
  const unmovedBlue = ships.filter(s => s.player === 2 && !s.sunk && !s.moved);
  if (!unmovedRed.length && !unmovedBlue.length) { startShootPhase(); return; }
  if (unmovedRed.length) startMoveRed();
  else doBlueMove();
}

// After a ship fires, decide what happens next
function checkShootDone() {
  const unfiredRed  = ships.filter(s => s.player === 1 && !s.sunk && !s.fired);
  const unfiredBlue = ships.filter(s => s.player === 2 && !s.sunk && !s.fired);
  if (!unfiredRed.length && !unfiredBlue.length) { resolvePhase(); return; }
  if (unfiredRed.length) startShootRed();
  else doBlueShoot();
}
