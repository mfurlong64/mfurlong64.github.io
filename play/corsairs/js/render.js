const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function drawBackground() {
  ctx.fillStyle = '#010710';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const { x, y } = hexCenter(c, r);
      hexPath(x, y);
      if (!isPlayable(c, r)) {
        ctx.fillStyle = '#020a1a'; ctx.fill();
      } else if (!isIsland(c, r)) {
        ctx.fillStyle = (c + r) % 2 === 0 ? '#0d3562' : '#0b2f58'; ctx.fill();
        ctx.strokeStyle = '#041428'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }
}

// Subtle darkening vignette toward the oval boundary
function drawOvalEdge() {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isPlayable(c, r)) continue;
      const px = 1.5 * c + 1, py = SQ3 * r + SQ3 * 0.5;
      const cx = 1.5 * (COLS - 1) / 2 + 1, cy = SQ3 * (ROWS - 1) / 2 + SQ3 * 0.5;
      const rx = 1.5 * (COLS - 1) / 2,     ry = SQ3 * (ROWS - 1) / 2;
      const d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      if (d > MAP_CONFIG.ovalVignetteStart) {
        const { x, y } = hexCenter(c, r);
        hexPath(x, y);
        const span = MAP_CONFIG.ovalThreshold - MAP_CONFIG.ovalVignetteStart;
        const alpha = Math.min((d - MAP_CONFIG.ovalVignetteStart) / span * 0.20, 0.20);
        ctx.fillStyle = `rgba(2,12,40,${alpha})`; ctx.fill();
      }
    }
  }
}

function drawWaves() {
  const left = OX, right = OX + 1.5 * S * (COLS - 1) + 2 * S;
  const top = OY,  bot  = OY + SQ3 * S * (ROWS - 1) + SQ3 * S;
  const off = (G.t * 16) % 11;
  ctx.strokeStyle = 'rgba(140,200,255,0.035)'; ctx.lineWidth = 1;
  for (let wy = top + off; wy < bot + 11; wy += 11) {
    ctx.beginPath(); ctx.moveTo(left, wy);
    ctx.bezierCurveTo(left + (right - left) * .28, wy - 3, left + (right - left) * .72, wy + 3, right, wy);
    ctx.stroke();
  }
}

function drawIslands() {
  islands.forEach(({ col, row }) => {
    if (!isPlayable(col, row)) return;
    const { x, y } = hexCenter(col, row);
    hexPath(x, y); ctx.fillStyle = '#7a6220'; ctx.fill();
    ctx.strokeStyle = '#3e3008'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); hexPath(x, y); ctx.clip();
    ctx.beginPath(); ctx.ellipse(x - 2, y - 2, S * .65, S * .60, -.1, 0, Math.PI * 2);
    ctx.fillStyle = '#2c5020'; ctx.fill();
    [[-8, 2, .27], [7, -4, .21], [1, -9, .17], [-3, 8, .15]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, S * r, 0, Math.PI * 2);
      ctx.fillStyle = '#386028'; ctx.fill();
    });
    ctx.restore();
  });
}

function drawMoveHighlights() {
  if (!G.validMoves) return;
  G.validMoves.forEach(s => {
    const { x, y } = hexCenter(s.col, s.row);
    hexPath(x, y);
    ctx.fillStyle = 'rgba(60,200,180,0.13)'; ctx.fill();
    ctx.strokeStyle = 'rgba(80,220,200,0.38)'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

function drawHoverFacingArrow() {
  if (!G.validMoves || !G.hovered) return;
  const { col, row } = G.hovered;
  const mv = G.validMoves.get(`${col},${row}`); if (!mv) return;
  const { x, y } = hexCenter(col, row);
  const ang = mv.facing * 60 * Math.PI / 180, p = (Math.sin(G.t * 8) + 1) * .5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, S * .12); ctx.lineTo(0, -S * .35);
  ctx.strokeStyle = `rgba(80,220,200,${.55 + p * .25})`; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -S * .52); ctx.lineTo(-8, -S * .3); ctx.lineTo(8, -S * .3);
  ctx.closePath(); ctx.fillStyle = `rgba(80,220,200,${.85 + p * .15})`; ctx.fill();
  ctx.restore();
}

function drawFireArc() {
  if (!G.fireArc) return;
  const pulse = (Math.sin(G.t * 5) + 1) * .5;

  G.fireArc.arcHexes.forEach((info, key) => {
    const [c, r] = key.split(',').map(Number), { x, y } = hexCenter(c, r);
    hexPath(x, y);
    if (info.kind === 'target') {
      ctx.fillStyle = info.dist <= 3
        ? `rgba(220,70,20,${.28 + pulse * .12})`
        : `rgba(180,50,10,${.17 + pulse * .08})`;
      ctx.fill();
      ctx.strokeStyle = info.dist <= 3
        ? `rgba(255,110,40,${.7 + pulse * .3})`
        : 'rgba(210,80,20,0.5)';
      ctx.lineWidth = 2; ctx.stroke();
    } else if (info.kind === 'open') {
      ctx.fillStyle = info.dist <= 3 ? 'rgba(200,100,20,0.07)' : 'rgba(160,70,10,0.04)';
      ctx.fill();
    }
  });

  // Boarding targets in purple
  if (G.fireArc.boardingTargets) {
    G.fireArc.boardingTargets.forEach(({ ship: s }) => {
      shipHexes(s).forEach(h => {
        const { x, y } = hexCenter(h.col, h.row);
        hexPath(x, y);
        ctx.fillStyle = `rgba(160,60,240,${.30 + pulse * .14})`; ctx.fill();
        ctx.strokeStyle = `rgba(200,100,255,${.75 + pulse * .25})`; ctx.lineWidth = 2.5; ctx.stroke();
      });
    });
  }
}

function drawHoverHighlight() {
  if (!G.hovered) return;
  const { col, row } = G.hovered;
  if (isIsland(col, row) || !isPlayable(col, row)) return;
  const { x, y } = hexCenter(col, row);

  if (G.validMoves && G.validMoves.has(`${col},${row}`)) {
    hexPath(x, y); ctx.fillStyle = 'rgba(80,220,200,0.2)'; ctx.fill(); return;
  }
  if (G.fireArc && G.fireArc.arcHexes.get(`${col},${row}`)?.kind === 'target') {
    hexPath(x, y); ctx.fillStyle = 'rgba(255,120,40,0.18)'; ctx.fill(); return;
  }
  if (G.fireArc?.boardingTargets) {
    for (const [, { ship: s }] of G.fireArc.boardingTargets) {
      if (shipHexes(s).some(h => h.col === col && h.row === row)) {
        hexPath(x, y); ctx.fillStyle = 'rgba(180,80,255,0.22)'; ctx.fill(); return;
      }
    }
  }
  hexPath(x, y); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(200,220,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
}

function drawSelectionRing() {
  if (G.selected === null) return;
  const ship = ships.find(s => s.id === G.selected); if (!ship) return;
  const isPrev = G.movePreview?.shipId === ship.id;
  const pulse = (Math.sin(G.t * 5) + 1) * .5;
  const color = isPrev ? `rgba(40,200,180,${.35 + pulse * .35})` : `rgba(232,200,74,${.3 + pulse * .35})`;
  const lw = isPrev ? 2.5 : 2;
  if (!DEFS[ship.type].twoHex) {
    const { x, y } = shipOrigin(ship);
    hexPath(x, y, S - 1); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  } else {
    shipHexes(ship).forEach(h => {
      const hc = hexCenter(h.col, h.row);
      hexPath(hc.x, hc.y, S - 1); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    });
  }
}

function drawShip(ship, alpha) {
  const { x, y } = shipOrigin(ship);
  const isSel = G.selected === ship.id && !G.movePreview;
  const def = DEFS[ship.type], L = shipL(ship.type), W = S * def.wFrac;
  const angle = ship.facing * 60 * Math.PI / 180;
  const hullD = ship.player === 1 ? '#7a1414' : '#102880';
  const hullM = ship.player === 1 ? '#a41c1c' : '#1848b0';
  const deck  = ship.player === 1 ? 'rgba(190,60,50,.3)' : 'rgba(40,100,200,.28)';

  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);

  // Shadow
  ctx.beginPath(); ctx.ellipse(3, 3, W * 1.1, L * 1.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();

  if (isSel) { const p = (Math.sin(G.t * 5) + 1) * .5; ctx.shadowColor = '#e8c84a'; ctx.shadowBlur = 14 + p * 14; }

  // Hull outer
  ctx.beginPath();
  ctx.moveTo(0, -L); ctx.bezierCurveTo(W * .85, -L * .5, W, L * .2, W * .6, L);
  ctx.lineTo(-W * .6, L); ctx.bezierCurveTo(-W, L * .2, -W * .85, -L * .5, 0, -L);
  ctx.closePath(); ctx.fillStyle = hullM; ctx.fill();
  ctx.strokeStyle = isSel ? '#e8c84a' : hullD; ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

  // Hull inner
  ctx.beginPath();
  ctx.moveTo(0, -L * .92); ctx.bezierCurveTo(W * .65, -L * .45, W * .9, L * .15, W * .52, L * .88);
  ctx.lineTo(-W * .52, L * .88); ctx.bezierCurveTo(-W * .9, L * .15, -W * .65, -L * .45, 0, -L * .92);
  ctx.closePath(); ctx.fillStyle = hullD; ctx.fill();

  // Deck
  ctx.beginPath();
  ctx.moveTo(0, -L * .72); ctx.bezierCurveTo(W * .52, -L * .36, W * .68, L * .1, W * .44, L * .62);
  ctx.lineTo(-W * .44, L * .62); ctx.bezierCurveTo(-W * .68, L * .1, -W * .52, -L * .36, 0, -L * .72);
  ctx.closePath(); ctx.fillStyle = deck; ctx.fill();

  // Gunports
  const numP = def.twoHex ? 2 : 1, spc = def.twoHex ? L * .55 : 0;
  for (let i = 0; i < numP; i++) {
    const py = (i - (numP - 1) / 2) * spc;
    [-1, 1].forEach(side => {
      ctx.fillStyle = '#080808'; ctx.fillRect(side * W * .82 - 2.5, py - 2.5, 5, 5);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(side * W * .82 - 1.5, py - 1.5, 3, 3);
    });
  }

  // Masts and sails
  const mastY = def.twoHex
    ? (ship.type === 'frigate' ? [-L * .52, 0, L * .52] : [-L * .45, L * .45])
    : [0];
  mastY.forEach(my => {
    ctx.beginPath(); ctx.moveTo(-W * .58, my); ctx.lineTo(W * .58, my);
    ctx.strokeStyle = '#4a380c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.rect(-W * .5, my - 5, W, 10);
    ctx.fillStyle = 'rgba(220,210,180,.45)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, my - 7); ctx.lineTo(0, my + 5);
    ctx.strokeStyle = '#5a4010'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, my, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#7a5c14'; ctx.fill();
  });

  // Bowsprit
  ctx.beginPath(); ctx.moveTo(0, -L - 9); ctx.lineTo(-5, -L - 1); ctx.lineTo(5, -L - 1);
  ctx.closePath(); ctx.fillStyle = isSel ? '#e8c84a' : 'rgba(255,255,255,.75)'; ctx.fill();

  ctx.restore();
  if (alpha !== undefined) ctx.globalAlpha = 1;

  // HP pips below stern
  const pip = 4, gap = 2, tw = ship.maxHealth * (pip + gap) - gap;
  const anchor = def.twoHex ? hexCenter(sternHex(ship).col, sternHex(ship).row) : { x, y };
  const sx = anchor.x - tw / 2, sy = anchor.y + S * .72;
  const pct = ship.health / ship.maxHealth;
  const fc = pct > .6 ? '#1ea040' : pct > .3 ? '#c08818' : '#b02020';
  for (let i = 0; i < ship.maxHealth; i++) {
    ctx.fillStyle = i < ship.health ? fc : '#0a1820';
    ctx.fillRect(sx + i * (pip + gap), sy, pip, pip);
  }

  // Dim overlay when ship has acted this round
  if (ship.moved || ship.fired) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.rect(-W, -L, W * 2, L * 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.restore();
  }
}

function drawMoveGhost() {
  if (!G.movePreview) return;
  const pr = G.movePreview, ship = ships.find(s => s.id === pr.shipId);
  const [sc, sr, sf] = [ship.col, ship.row, ship.facing];
  ship.col = pr.fromCol; ship.row = pr.fromRow; ship.facing = pr.fromFacing;
  drawShip(ship, 0.2);
  ship.col = sc; ship.row = sr; ship.facing = sf;
}

function drawShotResult() {
  if (!G.shotAnim) return;
  if (G.t >= G.shotAnim.until) {
    G.shotAnim = null;
    if (G.afterAnim) { const fn = G.afterAnim; G.afterAnim = null; fn(); }
    return;
  }
  const rem = G.shotAnim.until - G.t, alpha = rem < .8 ? rem / .8 : 1;
  const cx = canvas.width / 2, cy = canvas.height * .27, w = 320, h = 76;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(4,12,28,0.94)'; ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8d878'; ctx.font = 'bold 14px Georgia'; ctx.fillText(G.shotAnim.main, cx, cy - 8);
  ctx.fillStyle = '#7090a8'; ctx.font = '11px Georgia'; ctx.fillText(G.shotAnim.sub, cx, cy + 14);
  ctx.restore();
}

function drawGameOver() {
  if (G.phase !== 'gameover') return;
  const red = G.winner === 'Red Fleet';
  const accent = red ? '#e8604a' : '#4aa8e8';
  // Fade + pop-in driven by the timestamp stored in setGameOver().
  const p = Math.min((G.t - (G.overAt || 0)) / 0.6, 1);
  const ease = 1 - (1 - p) * (1 - p);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const survivors = ships.filter(s => s.player === (red ? 1 : 2) && !s.sunk).length;
  const pulse = (Math.sin(G.t * 3) + 1) * .5;

  ctx.save();
  // Dim the whole battlefield
  ctx.fillStyle = `rgba(2,6,16,${0.82 * p})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Panel — pops from 92% to full size, matching the shot-result card style
  ctx.globalAlpha = p;
  ctx.translate(cx, cy); ctx.scale(0.92 + 0.08 * ease, 0.92 + 0.08 * ease);
  const w = 460, h = 220;
  ctx.fillStyle = 'rgba(4,12,28,0.96)';
  ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); ctx.stroke();
  // Accent hairline in the winning fleet's color
  ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.globalAlpha = p * 0.5;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 9); ctx.stroke();
  ctx.globalAlpha = p;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a6220'; ctx.font = '22px Georgia';
  ctx.fillText('⚔', 0, -h / 2 + 38);
  ctx.fillStyle = '#e8d878'; ctx.font = 'bold 40px Georgia';
  ctx.fillText('VICTORY', 0, -18);
  ctx.fillStyle = accent; ctx.font = 'bold 22px Georgia';
  ctx.fillText(`${G.winner} wins the day!`, 0, 20);
  ctx.fillStyle = '#7090a8'; ctx.font = '13px Georgia';
  ctx.fillText(`All enemy ships sunk · ${survivors} still afloat`, 0, 46);
  ctx.fillStyle = `rgba(200,160,48,${0.55 + pulse * 0.45})`; ctx.font = '13px Georgia';
  ctx.fillText('Click, or press Enter, to play again', 0, h / 2 - 22);
  ctx.restore();
}

function render() {
  drawBackground(); drawGrid(); drawOvalEdge(); drawWaves(); drawIslands();
  drawMoveHighlights(); drawFireArc();
  drawHoverHighlight(); drawHoverFacingArrow();
  drawMoveGhost(); drawSelectionRing();
  ships.filter(s => !s.sunk).forEach(s => drawShip(s));
  drawShotResult();
  drawGameOver();
}

function loop(ts) { G.t = ts / 1000; render(); requestAnimationFrame(loop); }

function resize() {
  const sb = document.getElementById('sb');
  canvas.width = window.innerWidth - sb.offsetWidth;
  canvas.height = window.innerHeight;
  const sW = (canvas.width - 60) / (1.5 * (COLS - 1) + 2);
  const sH = (canvas.height - 60) / (SQ3 * (ROWS + .5));
  S = Math.floor(Math.min(sW, sH, MAP_CONFIG.maxHexSize));
  const gW = 1.5 * S * (COLS - 1) + 2 * S, gH = SQ3 * S * (ROWS - 1) + SQ3 * S;
  OX = (canvas.width - gW) / 2; OY = (canvas.height - gH) / 2;
}
