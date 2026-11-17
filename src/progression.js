"use strict";
const { Decimal, dec, PRESTIGE_REQUIREMENT } = require("./economy");

// Presentation-only helpers; never award IC or mutate persistent state here.
function prestigeProgress(player) {
  const balance = Decimal.max(dec(player.balance), 0);
  if (balance.gte(PRESTIGE_REQUIREMENT))
    return { percent: 100, filled: 10, remaining: dec(0), ready: true };
  const percent = Math.max(0, Math.min(99,
    balance.div(PRESTIGE_REQUIREMENT).times(100).floor().toNumber()));
  return { percent, filled: Math.floor(percent / 10),
    remaining: PRESTIGE_REQUIREMENT.minus(balance), ready: false };
}
function nextStep(player, readiness) {
  if (prestigeProgress(player).ready)
    return "Prestige is ready. Claim your permanent production boost.";
  if (readiness.daily.ready) return "Claim your daily supplies.";
  if (readiness.mine.ready) return "Mine for materials and mining XP.";
  const hasOperations = (player.generators || []).some((entry) => Number(entry.quantity) > 0);
  if (!hasOperations) return "Recruit your first Operation to start passive IC production.";
  if (dec(player.rate).lte(0)) return "Expand your Operations to increase passive IC production.";
  return "Explore the World Map or complete Contracts while activities recharge.";
}
module.exports = { prestigeProgress, nextStep };
