// Both broadsides combined into one fire arc
function calcAllTargets(attacker) {
  const arcHexes = new Map(), validTargets = new Map();
  const dirs = [
    (attacker.facing + 4) % 6, (attacker.facing + 5) % 6,  // port
    (attacker.facing + 1) % 6, (attacker.facing + 2) % 6,  // starboard
  ];

  for (const origin of shipHexes(attacker)) {
    for (const dir of dirs) {
      let h = { col: origin.col, row: origin.row };
      for (let dist = 1; dist <= COMBAT_RULES.maxRange; dist++) {
        h = neighbor(h.col, h.row, dir);
        if (!onGrid(h.col, h.row)) break;
        const key = `${h.col},${h.row}`;
        if (isIsland(h.col, h.row)) { arcHexes.set(key, { dist, kind: 'blocked' }); break; }
        const occ = ships.find(s => !s.sunk && s.id !== attacker.id &&
          shipHexes(s).some(q => q.col === h.col && q.row === h.row));
        if (occ) {
          if (occ.player !== attacker.player) {
            const dice = dist <= COMBAT_RULES.fullRangeMax
              ? attacker.cannons
              : Math.ceil(attacker.cannons / 2);
            if (!arcHexes.has(key)) arcHexes.set(key, { dist, kind: 'target' });
            const tk = `${occ.id}`;
            if (!validTargets.has(tk) || validTargets.get(tk).dist > dist)
              validTargets.set(tk, { ship: occ, dist, dice, col: h.col, row: h.row });
          } else {
            if (!arcHexes.has(key)) arcHexes.set(key, { dist, kind: 'friendly' });
          }
          break;
        }
        if (!arcHexes.has(key)) arcHexes.set(key, { dist, kind: 'open' });
      }
    }
  }
  return { arcHexes, validTargets };
}

function rollDice(n) {
  return Array.from({ length: n }, () => Math.ceil(Math.random() * 6));
}

// Queue cannon damage — not applied until resolvePhase()
function fireCannons(attacker, info) {
  const { ship, dist, dice } = info;
  const rolls = rollDice(dice);
  const hits = rolls.filter(r => r >= COMBAT_RULES.hitMin).length;
  G.pending.push({ shipId: ship.id, dmg: hits });
  const who = ship.player === 1 ? 'Red' : 'Blue';
  const diceStr = rolls.map(r => r >= COMBAT_RULES.hitMin ? `${r}✓` : `${r}✗`).join(' ');
  return {
    hits,
    main: hits > 0
      ? `${hits} Hit${hits > 1 ? 's' : ''}! ${who} ${DEFS[ship.type].label}`
      : `Miss! ${who} ${DEFS[ship.type].label}`,
    sub: `Range ${dist} · ${dice} dice: ${diceStr} · damage pending`,
  };
}

// Boarding: any attacker hex directly adjacent to any defender hex
function calcBoardingTargets(attacker) {
  const targets = new Map();
  for (const s of ships) {
    if (s.sunk || s.player === attacker.player) continue;
    let adj = false;
    outer: for (const ah of shipHexes(attacker)) {
      for (let d = 0; d < 6; d++) {
        const n = neighbor(ah.col, ah.row, d);
        if (shipHexes(s).some(dh => dh.col === n.col && dh.row === n.row)) { adj = true; break outer; }
      }
    }
    if (adj) targets.set(`${s.id}`, { ship: s });
  }
  return targets;
}

// Resolve boarding combat — both sides roll crew dice (using cannon count)
// Winner: more hits. Attacker win = defender sunk. Defender win = attacker takes excess.
function doBoarding(attacker, defender) {
  const aRolls = rollDice(attacker.cannons), dRolls = rollDice(defender.cannons);
  const aHits = aRolls.filter(r => r >= COMBAT_RULES.hitMin).length;
  const dHits = dRolls.filter(r => r >= COMBAT_RULES.hitMin).length;
  const defWho  = defender.player === 1 ? 'Red' : 'Blue';
  const attWho  = attacker.player === 1 ? 'Red' : 'Blue';
  const defName = `${defWho} ${DEFS[defender.type].label}`;
  const attName = `${attWho} ${DEFS[attacker.type].label}`;

  let main;
  if (aHits > dHits) {
    const dmg = COMBAT_RULES.boardingLethal ? defender.health : dHits - aHits;
    G.pending.push({ shipId: defender.id, dmg });
    main = `BOARDED! ${defName} overrun!`;
  } else if (dHits > aHits) {
    G.pending.push({ shipId: attacker.id, dmg: dHits - aHits });
    main = `Repelled! ${attName} driven back`;
  } else {
    if (aHits > 0) {
      G.pending.push({ shipId: attacker.id, dmg: 1 });
      G.pending.push({ shipId: defender.id, dmg: 1 });
    }
    main = aHits ? 'Boarding stalemate — both sides bloodied' : 'No blood spilled';
  }

  const fmt = rolls => rolls.map(r => r >= COMBAT_RULES.hitMin ? `${r}✓` : `${r}✗`).join(' ');
  const sub = `${attName.split(' ').pop()}: ${fmt(aRolls)} (${aHits}) · ${defName.split(' ').pop()}: ${fmt(dRolls)} (${dHits})`;
  return { main, sub };
}

// Apply all queued damage simultaneously at end of shooting phase
function resolvePhase() {
  G.phase = 'resolve';
  const sunk = [], hits = {};
  for (const { shipId, dmg } of G.pending) hits[shipId] = (hits[shipId] || 0) + dmg;
  G.pending = [];

  for (const [id, dmg] of Object.entries(hits)) {
    if (!dmg) continue;
    const ship = ships.find(s => s.id === +id);
    ship.health = Math.max(0, ship.health - dmg);
    if (ship.health === 0 && !ship.sunk) {
      ship.sunk = true;
      sunk.push(`${ship.player === 1 ? 'Red' : 'Blue'} ${DEFS[ship.type].label}`);
    }
  }

  updateSidebar();
  const winner = checkWin();
  const totalHits = Object.values(hits).reduce((a, b) => a + b, 0);
  const sunkMsg = sunk.length ? sunk.join(' & ') + ' SUNK! ' : '';
  const main = sunkMsg || (totalHits ? `${totalHits} total damage dealt` : 'No damage this round');

  G.shotAnim = { main, sub: '— Damage Resolved —', until: G.t + 3 };
  G.afterAnim = () => { if (winner) setGameOver(winner); else startMovePhase(); };
}

function checkWin() {
  if (!ships.filter(s => s.player === 1 && !s.sunk).length) return 'Blue Fleet';
  if (!ships.filter(s => s.player === 2 && !s.sunk).length) return 'Red Fleet';
  return null;
}
