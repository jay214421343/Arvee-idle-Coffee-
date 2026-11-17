"use strict";
// Each successful prestige has only one optional roll: no items are guaranteed.
// Probabilities: 5% cocktail, 5% lunchbox, 10% rare cache,
// 30% regular cache, 50% no bonus.
function rollRebirthBonus(roll) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
    throw new RangeError("Invalid rebirth bonus roll.");
  if (roll < 0.05) return "rebirth_cocktail";
  if (roll < 0.10) return "lunchbox";
  if (roll < 0.20) return "rare_lootbox";
  if (roll < 0.50) return "lootbox";
  return null;
}
module.exports = { rollRebirthBonus };
