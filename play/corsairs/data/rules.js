// ── Combat Rules ───────────────────────────────────────────────────────────────
// These constants drive all combat calculations. Change values here to
// rebalance without touching any logic code.

const COMBAT_RULES = {
  // Cannon fire
  hitMin:        4,   // minimum d6 roll required to score a hit
  fullRangeMax:  3,   // hexes ≤ this distance use full cannon count as dice
  maxRange:      6,   // hexes beyond this are out of range entirely

  // Boarding
  // Both attacker and defender each roll dice equal to their ship's cannon count.
  // Attacker wins ties → no, ties are stalemates (see doBoarding in combat.js).
  // boardingLethal: if true, a boarding victory instantly sinks the defender.
  boardingLethal: true,
};
