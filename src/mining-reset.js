"use strict";
const { items } = require("./catalog");
const { dec } = require("./economy");

// Prefer the cheapest/commonest reset. Rare consumables require an explicit
// click displaying their own item name; nothing is consumed by rendering.
const RESET_ORDER = Object.freeze([
  "coffee", "cola", "pumpkin_spice_latte", "gnome", "rebirth_cocktail"
]);
function isUsableReset(player, itemId, remainingSeconds) {
  if (!Number.isFinite(Number(remainingSeconds)) || Number(remainingSeconds) <= 0 ||
      !RESET_ORDER.includes(itemId)) return false;
  const e = items[itemId]?.effect;
  if (!e?.cooldownReset) return false;
  const nextMine = dec(player?.mineBonus ?? 1);
  const charges = Number(player?.mineBoostCharges || 0);
  const foodFactor = charges > 0 ? dec(player?.mineBoostMultiplier ?? 1) : dec(1);
  if (e.mineBoost && (charges > 0 || nextMine.times(e.mineBoost.multiplier).gt(20)))
    return false;
  if (e.nextMine && nextMine.times(foodFactor).times(e.nextMine).gt(20))
    return false;
  return true;
}
function eligibleMiningReset(player, remainingSeconds) {
  const inventory = player?.inventory || [];
  return RESET_ORDER.find(id => inventory.some(row =>
    row.item_id === id && Number(row.quantity) > 0) &&
    isUsableReset(player, id, remainingSeconds)) || null;
}
module.exports = { RESET_ORDER, isUsableReset, eligibleMiningReset };
