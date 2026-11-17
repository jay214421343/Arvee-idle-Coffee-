"use strict";
const crypto = require("node:crypto");
const PETS = Object.freeze([
  Object.freeze({ id: "ember_fox", name: "Ember Fox", role: "Mining", rarity: "Common", description: "Increases earned IC when mining." }),
  Object.freeze({ id: "moss_wisp", name: "Moss Wisp", role: "Exploration", rarity: "Uncommon", description: "Reduces expedition time." }),
  Object.freeze({ id: "moon_owl", name: "Moon Owl", role: "Treasure", rarity: "Rare", description: "Increases expedition material drops." })
]);
const byId = new Map(PETS.map((pet) => [pet.id, pet]));
const MAX_LEVEL = 30;
const MAX_XP = 50 * MAX_LEVEL * (MAX_LEVEL - 1);
function xpFor(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new Error("Invalid companion level.");
  return 50 * level * (level - 1);
}
function level(xp) {
  const value = Number(xp);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid companion XP.");
  let current = 1;
  while (current < MAX_LEVEL && value >= xpFor(current + 1)) current++;
  return current;
}
function stage(lvl) { return lvl >= 20 ? "Evolved" : lvl >= 10 ? "Awakened" : "Young"; }
function boostPct(lvl) {
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > MAX_LEVEL) throw new Error("Invalid companion level.");
  return (500 + (lvl - 1) * 50) / 100;
}
function bonus(pet) {
  if (!pet || !byId.has(pet.id)) return null;
  const pct = boostPct(pet.level);
  return { role: byId.get(pet.id).role, percent: pct,
    description: pet.id === "ember_fox" ? "+" + pct + "% mined IC" :
      pet.id === "moss_wisp" ? "-" + pct + "% expedition time" :
      "+" + pct + "% expedition material quantity" };
}
function eventXp(type, metadata = {}) {
  if (type === "mine") return 10;
  if (type === "daily") return 25;
  if (type === "expedition_complete") return 65;
  if (type === "craft") return 10 * Math.max(1, Math.min(5, Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1));
  if (type === "open_lootbox") return 5 * Math.max(1, Math.min(5, Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1));
  return 0;
}
function eggDrop(regionId, success, rng = (limit) => crypto.randomInt(limit)) {
  const chance = ({ forest: 12, mines: 18, ruins: 25 })[regionId];
  if (chance === undefined) throw new Error("Unknown egg region.");
  return success && rng(100) < chance;
}
function hatch(owned = [], rng = (limit) => crypto.randomInt(limit)) {
  const ids = new Set(owned);
  const weights = PETS.map((pet, i) => [pet, [40, 35, 25][i] * (ids.has(pet.id) ? 1 : 2)]);
  const total = weights.reduce((n, [, w]) => n + w, 0);
  const roll = rng(total);
  if (!Number.isInteger(roll) || roll < 0 || roll >= total) throw new Error("Invalid companion egg roll.");
  let left = roll;
  for (const [pet, weight] of weights) {
    if (left < weight) return pet;
    left -= weight;
  }
  throw new Error("Could not hatch companion.");
}
module.exports = { PETS, byId, MAX_LEVEL, MAX_XP, xpFor, level, stage, bonus, boostPct, eventXp, eggDrop, hatch };
