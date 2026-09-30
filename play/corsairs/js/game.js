// Game state
let G = {
  phase: 'setup', selected: null, validMoves: null,
  movePreview: null, fireArc: null,
  pending: [],
  shotAnim: null, afterAnim: null,
  hovered: null, t: 0,
};

// ── Sidebar helpers ────────────────────────────────────────────────────────────

function pipRow(h, mh) {
  const p = h / mh, cls = p > .6 ? 'hp' : p > .3 ? 'hp w' : 'hp c';
  return Array.from({ length: mh }, (_, i) =>
    `<div class="pip${i < h ? ' ' + cls : ''}"></div>`).join('');
}

function cardHTML(s) {
  const isPrev = G.movePreview?.shipId === s.id;
  const sel = G.selected === s.id, pc = s.player === 1 ? 'p1' : 'p2', nc = s.player === 1 ? 'sc-p1' : 'sc-p2';
  const who = s.player === 1 ? 'Red' : 'Blue', def = DEFS[s.type];
  const stCls = s.sunk ? 'sunk' : isPrev ? 'preview sel' : s.fired ? 'fired' : s.moved ? 'moved' : sel ? 'sel' : '';
  return `<div class="ship-card ${pc} ${stCls}" onclick="selectShip(${s.id})">
    <div class="sc-row"><div class="sc-name ${nc}">${who} ${def.label}</div>${sel || isPrev ? `<div class="sc-facing">▶${FACING[s.facing]}</div>` : ''}</div>
    <div class="sc-class">${def.label}${def.twoHex ? ' · 2-hex' : ''}${s.sunk ? ' · ☠' : ''}</div>
    <div class="sc-stats"><div>MV<span>${s.move}</span></div><div>⚫<span>${s.cannons}</span></div><div>HP<span>${s.health}/${s.maxHealth}</span></div></div>
    <div class="pip-row">${pipRow(s.health, s.maxHealth)}</div>
  </div>`;
}

function updateSidebar() {
  document.getElementById('p1f').innerHTML = ships.filter(s => s.player === 1).map(cardHTML).join('');
  document.getElementById('p2f').innerHTML = ships.filter(s => s.player === 2).map(cardHTML).join('');
}

function updateProgress() {
  const ph = G.phase;
  const isMove = ph === 'move_red' || ph === 'move_blue';
  const isShoot = ph === 'shoot_red' || ph === 'shoot_blue';
  const vis = isMove || isShoot;
  document.getElementById('progress').style.display = vis ? 'flex' : 'none';
  if (!vis) return;
  const r1 = ships.filter(s => s.player === 1 && !s.sunk), b1 = ships.filter(s => s.player === 2 && !s.sunk);
  const rDone = isMove ? r1.filter(s => s.moved).length : r1.filter(s => s.fired).length;
  const bDone = isMove ? b1.filter(s => s.moved).length : b1.filter(s => s.fired).length;
  const rT = r1.length, bT = b1.length;
  document.getElementById('progRed').style.width = rT ? `${rDone / rT * 100}%` : '0%';
  document.getElementById('progBlue').style.width = bT ? `${bDone / bT * 100}%` : '0%';
  document.getElementById('progRedTxt').textContent = `${rDone}/${rT}`;
  document.getElementById('progBlueTxt').textContent = `${bDone}/${bT}`;
}

function setPhase(t, cls = '') {
  const p = document.getElementById('phasePill');
  p.textContent = t; p.className = 'phase-pill' + (cls ? ' ' + cls : '');
}
function setInfo(h) { document.getElementById('infoBox').innerHTML = h; }
function showBtn(show, txt) { const b = document.getElementById('actionBtn'); b.style.display = show ? 'block' : 'none'; if (txt) b.textContent = txt; }
function showMoveConfirm(show) { document.getElementById('moveConfirm').style.display = show ? 'flex' : 'none'; }
function showSubBtns(hold, pass) {
  document.getElementById('subBtns').style.display = (hold || pass) ? 'flex' : 'none';
  document.getElementById('holdBtn').style.display = hold ? 'block' : 'none';
  document.getElementById('passBtn').style.display = pass ? 'block' : 'none';
}

// ── Phases ─────────────────────────────────────────────────────────────────────

function startPhase1() {
  G.phase = 'setup'; G.selected = null; G.validMoves = null; G.movePreview = null; G.fireArc = null; G.pending = [];
  setPhase('Setup'); showBtn(true, 'Start Game →'); showMoveConfirm(false); showSubBtns(false, false);
  document.getElementById('progress').style.display = 'none';
  setInfo('Click a ship · <span class="kb">R</span> rotate · <span class="kb">ESC</span> deselect');
  updateSidebar();
}

function startMovePhase() {
  ships.filter(s => !s.sunk).forEach(s => s.moved = false);
  startMoveRed();
}

function startMoveRed() {
  G.phase = 'move_red'; G.selected = null; G.validMoves = null; G.movePreview = null;
  showMoveConfirm(false); showSubBtns(false, false);
  setPhase('Movement · Red', 'red'); showBtn(true, 'End Red Moves →');
  updateProgress();
  const unmoved = ships.filter(s => s.player === 1 && !s.sunk && !s.moved);
  setInfo(unmoved.length ? 'Select a Red ship to move<br><span class="kb">R</span> rotate · <span class="kb">ESC</span> deselect' : 'All Red ships moved');
  updateSidebar();
}

function startShootPhase() {
  ships.filter(s => !s.sunk).forEach(s => s.fired = false);
  G.pending = [];
  startShootRed();
}

function startShootRed() {
  G.phase = 'shoot_red'; G.selected = null; G.fireArc = null;
  showMoveConfirm(false); showSubBtns(false, false);
  setPhase('Shooting · Red', 'red'); showBtn(true, 'End Red Shooting →');
  updateProgress();
  const unfired = ships.filter(s => s.player === 1 && !s.sunk && !s.fired);
  setInfo(unfired.length ? 'Select a Red ship to fire<br><span class="kb">ESC</span> deselect' : 'All Red ships have fired');
  updateSidebar();
}

function setGameOver(winner) {
  G.phase = 'gameover'; G.selected = null; G.fireArc = null;
  G.winner = winner; G.overAt = G.t;   // for the game-over splash (see drawGameOver)
  setPhase('Game Over'); showBtn(true, '⚓ Play Again'); showMoveConfirm(false); showSubBtns(false, false);
  document.getElementById('progress').style.display = 'none';
  setInfo(`<strong>${winner} wins!</strong><br>All enemy ships sunk!`);
  updateSidebar();
}

function resetGame() {
  ships = INIT.map(d => ({ ...d, moved: false, fired: false, sunk: false }));
  G = { phase: 'setup', selected: null, validMoves: null, movePreview: null, fireArc: null,
        pending: [], shotAnim: null, afterAnim: null, hovered: null, t: G.t };
  startPhase1();
}

function onActionBtn() {
  if (G.movePreview) confirmMove();
  if (G.phase === 'setup')     { startMovePhase(); return; }
  if (G.phase === 'move_red')  {
    ships.filter(s => s.player === 1 && !s.sunk).forEach(s => s.moved = true);
    G.selected = null; G.validMoves = null; G.movePreview = null;
    showMoveConfirm(false); showSubBtns(false, false);
    updateProgress(); updateSidebar();
    doBlueMove(); return;
  }
  if (G.phase === 'shoot_red') {
    ships.filter(s => s.player === 1 && !s.sunk).forEach(s => s.fired = true);
    G.selected = null; G.fireArc = null; showSubBtns(false, false);
    updateProgress(); updateSidebar();
    doBlueShoot(); return;
  }
  if (G.phase === 'gameover') { resetGame(); return; }
}

// ── Move preview ───────────────────────────────────────────────────────────────

function confirmMove() {
  if (!G.movePreview) return;
  const ship = ships.find(s => s.id === G.movePreview.shipId);
  ship.moved = true; G.movePreview = null; G.selected = null;
  showMoveConfirm(false); showSubBtns(false, false);
  updateProgress(); updateSidebar();
  doBlueMove();
}

function undoMove() {
  if (!G.movePreview) return;
  const ship = ships.find(s => s.id === G.movePreview.shipId);
  ship.col = G.movePreview.fromCol; ship.row = G.movePreview.fromRow; ship.facing = G.movePreview.fromFacing;
  G.validMoves = calcValidMoves(ship); G.movePreview = null;
  showMoveConfirm(false);
  const def = DEFS[ship.type], who = ship.player === 1 ? 'Red' : 'Blue';
  setInfo(`<strong>${who} ${def.label}</strong><br>Move undone · ${G.validMoves.size} options<br><span class="kb">R</span> rotate · <span class="kb">ESC</span> deselect`);
  showSubBtns(true, false);
  updateSidebar();
}

function holdPosition() {
  const ship = ships.find(s => s.id === G.selected);
  if (ship) ship.moved = true;
  G.selected = null; G.validMoves = null; showSubBtns(false, false);
  updateProgress(); updateSidebar();
  doBlueMove();
}

function passShot() {
  const ship = ships.find(s => s.id === G.selected);
  if (ship) ship.fired = true;
  G.selected = null; G.fireArc = null; showSubBtns(false, false);
  updateProgress(); updateSidebar();
  doBlueShoot();
}

// ── Selection ──────────────────────────────────────────────────────────────────

const LOCKED_PHASES = ['move_blue', 'shoot_blue', 'resolve', 'gameover'];

function selectShip(id) {
  if (LOCKED_PHASES.includes(G.phase)) return;
  if (G.movePreview) return;
  const ship = ships.find(s => s.id === id);
  if (!ship || ship.sunk) return;
  if (G.phase === 'move_red'  && (ship.player !== 1 || ship.moved)) return;
  if (G.phase === 'shoot_red' && (ship.player !== 1 || ship.fired)) return;

  if (G.selected === id && G.phase !== 'shoot_red') {
    G.selected = null; G.validMoves = null; G.fireArc = null; showSubBtns(false, false);
    setInfo(G.phase === 'move_red' ? 'Select a Red ship to move' : 'Select a Red ship to fire');
    updateSidebar(); return;
  }

  G.selected = id; G.fireArc = null;
  G.validMoves = (G.phase === 'move_red' || G.phase === 'setup') ? calcValidMoves(ship) : null;

  const def = DEFS[ship.type], who = ship.player === 1 ? 'Red' : 'Blue';
  if (G.phase === 'shoot_red') {
    G.fireArc = calcAllTargets(ship);
    G.fireArc.boardingTargets = calcBoardingTargets(ship);
    const n = G.fireArc.validTargets.size, b = G.fireArc.boardingTargets.size;
    showSubBtns(false, true);
    const parts = [];
    if (n > 0) parts.push(`${n} cannon target${n > 1 ? 's' : ''}`);
    if (b > 0) parts.push(`${b} boarding target${b > 1 ? 's' : ''} (purple)`);
    setInfo(`<strong>${who} ${def.label}</strong><br>${parts.length ? parts.join(' · ') : 'No targets in range'}`);
  } else if (G.phase === 'move_red') {
    const mv = G.validMoves ? G.validMoves.size : 0;
    showSubBtns(true, false);
    setInfo(`<strong>${who} ${def.label}</strong><br>Facing ${FACING[ship.facing]} · ${mv} destinations<br><span class="kb">R</span> rotate · <span class="kb">ESC</span> deselect`);
  } else {
    const mv = G.validMoves ? G.validMoves.size : 0;
    showSubBtns(false, false);
    setInfo(`<strong>${who} ${def.label}</strong><br>Facing ${FACING[ship.facing]} · Move ${ship.move}<br>${mv} reachable hexes<br><span class="kb">R</span> rotate · <span class="kb">ESC</span> deselect`);
  }
  updateSidebar();
}

// ── Event listeners ────────────────────────────────────────────────────────────

canvas.addEventListener('click', e => {
  if (G.phase === 'gameover') { resetGame(); return; }   // click splash to play again
  if (LOCKED_PHASES.includes(G.phase) || G.movePreview) return;
  const rect = canvas.getBoundingClientRect();
  const { col, row } = nearestHex(e.clientX - rect.left, e.clientY - rect.top);
  if (!isPlayable(col, row)) return;

  if (G.phase === 'shoot_red' && G.fireArc) {
    const attacker = ships.find(s => s.id === G.selected);
    // Boarding click (purple — adjacent enemy ship hexes)
    if (attacker && G.fireArc.boardingTargets) {
      for (const [, { ship: defender }] of G.fireArc.boardingTargets) {
        if (shipHexes(defender).some(h => h.col === col && h.row === row)) {
          const res = doBoarding(attacker, defender);
          attacker.fired = true; G.selected = null; G.fireArc = null; showSubBtns(false, false);
          updateProgress(); updateSidebar();
          G.shotAnim = { main: res.main, sub: res.sub, until: G.t + 2.8 };
          G.afterAnim = doBlueShoot;
          return;
        }
      }
    }
    // Cannon fire (orange hexes)
    const k = `${col},${row}`;
    if (G.fireArc.arcHexes.get(k)?.kind === 'target') {
      const info = [...G.fireArc.validTargets.values()].find(t => t.col === col && t.row === row);
      if (attacker && info) {
        const res = fireCannons(attacker, info);
        attacker.fired = true; G.selected = null; G.fireArc = null; showSubBtns(false, false);
        updateProgress(); updateSidebar();
        G.shotAnim = { main: res.main, sub: res.sub, until: G.t + 2.5 };
        G.afterAnim = doBlueShoot;
      }
      return;
    }
  }

  if (G.validMoves && G.validMoves.has(`${col},${row}`)) {
    const ship = ships.find(s => s.id === G.selected);
    const dest = G.validMoves.get(`${col},${row}`);
    G.movePreview = { shipId: ship.id, fromCol: ship.col, fromRow: ship.row, fromFacing: ship.facing };
    ship.col = dest.col; ship.row = dest.row; ship.facing = dest.facing;
    G.validMoves = null; showSubBtns(false, false); showMoveConfirm(true);
    setInfo(`<strong>Confirm move?</strong><br>Now facing ${FACING[dest.facing]}<br><span class="kb">Enter</span> confirm · <span class="kb">ESC</span> undo`);
    updateSidebar(); return;
  }

  const ship = ships.find(s => !s.sunk && shipHexes(s).some(h => h.col === col && h.row === row));
  if (ship) { selectShip(ship.id); }
  else {
    G.selected = null; G.validMoves = null; G.fireArc = null; showSubBtns(false, false);
    setInfo(G.phase === 'move_red' ? 'Select a Red ship to move' : G.phase === 'shoot_red' ? 'Select a Red ship to fire' : 'Click a ship to select');
    updateSidebar();
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  G.hovered = nearestHex(e.clientX - rect.left, e.clientY - rect.top);
  const ship = ships.find(s => !s.sunk && shipHexes(s).some(h => h.col === G.hovered.col && h.row === G.hovered.row));
  const onMove   = G.validMoves && G.validMoves.has(`${G.hovered.col},${G.hovered.row}`);
  const onTarget = G.fireArc && G.fireArc.arcHexes.get(`${G.hovered.col},${G.hovered.row}`)?.kind === 'target';
  const onBoard  = G.fireArc?.boardingTargets &&
    [...G.fireArc.boardingTargets.values()].some(({ ship: s }) =>
      shipHexes(s).some(h => h.col === G.hovered.col && h.row === G.hovered.row));
  canvas.style.cursor = (ship || onMove || onTarget || onBoard) ? 'pointer' : 'default';
});

canvas.addEventListener('mouseleave', () => { G.hovered = null; });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (G.movePreview) { undoMove(); return; }
    G.selected = null; G.validMoves = null; G.fireArc = null; showSubBtns(false, false);
    setInfo(G.phase === 'move_red' ? 'Select a Red ship to move' : G.phase === 'shoot_red' ? 'Select a Red ship to fire' : 'Click a ship to select');
    updateSidebar();
  }
  if ((e.key === 'r' || e.key === 'R') && G.selected !== null && !G.movePreview) {
    const ship = ships.find(s => s.id === G.selected);
    if (ship && !ship.moved && (G.phase === 'setup' || G.phase === 'move_red')) {
      ship.facing = (ship.facing + 1) % 6;
      if (G.validMoves) G.validMoves = calcValidMoves(ship);
      selectShip(ship.id);
    }
  }
  if (e.key === 'Enter' || e.key === ' ') {
    if (G.phase === 'gameover') { resetGame(); return; }   // Enter/Space to play again
    if (G.movePreview) confirmMove();
    else if (G.phase === 'setup') onActionBtn();
  }
});

window.addEventListener('resize', resize);
resize();
startPhase1();
requestAnimationFrame(loop);
