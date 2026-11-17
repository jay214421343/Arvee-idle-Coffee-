"use strict";
const crypto = require("node:crypto");
const companions = require("./companions");
const REGIONS = Object.freeze([
  Object.freeze({ id: "forest", name: "Whispering Forest", icon: "🌲",
    description: "Scout forgotten paths and gather the first expedition supplies.",
    crew: 1, xp: 0, durationSeconds: 120, credits: 450, experience: 35, success: 0.86,
    drops: [{ id: "ore", weight: 70, min: 3, max: 6 }, { id: "silver", weight: 25, min: 1, max: 3 },
      { id: "lootbox", weight: 5, min: 1, max: 1 }] }),
  Object.freeze({ id: "mines", name: "Forgotten Mines", icon: "⛏️",
    description: "Explore abandoned tunnels where Moonsteel and rare minerals await.",
    crew: 3, xp: 70, durationSeconds: 480, credits: 1650, experience: 70, success: 0.76,
    drops: [{ id: "silver", weight: 60, min: 3, max: 6 }, { id: "gold", weight: 30, min: 1, max: 2 },
      { id: "rare_lootbox", weight: 10, min: 1, max: 1 }] }),
  Object.freeze({ id: "ruins", name: "Ancient Ruins", icon: "🏛️",
    description: "Recover relics from a dangerous, long-lost civilization.",
    crew: 8, xp: 210, durationSeconds: 1500, credits: 4900, experience: 125, success: 0.63,
    drops: [{ id: "gold", weight: 55, min: 2, max: 5 }, { id: "strange_matter", weight: 35, min: 2, max: 4 },
      { id: "gem", weight: 10, min: 1, max: 1 }] })
]);
const GEAR = Object.freeze([
  Object.freeze({ id: "kit", name: "Trailblazer's Kit", icon: "🎒",
    description: "Reduces expedition duration by 7% per level.", max: 5 }),
  Object.freeze({ id: "compass", name: "Astral Compass", icon: "🧭",
    description: "Increases loot quantity by 12% per level.", max: 5 }),
  Object.freeze({ id: "ward", name: "Guardian Ward", icon: "🛡️",
    description: "Adds 5 percentage points to mission success chance per level.", max: 5 })
]);
const regionById = new Map(REGIONS.map((r) => [r.id, r]));
const gearById = new Map(GEAR.map((g) => [g.id, g]));
function levels(rows = []) {
  const result = { kit: 0, compass: 0, ward: 0 };
  for (const row of rows) {
    if (Object.hasOwn(result, row.gear_id) && Number.isInteger(Number(row.level))) {
      result[row.gear_id] = Math.max(0, Math.min(5, Number(row.level)));
    }
  }
  return result;
}
function unlocked(region, crew, xp) {
  return Number(crew) >= region.crew && Number(xp) >= region.xp;
}
function duration(region, gear = {}, pet = null) {
  const petFactor = 1 - companions.effectPct(pet, "expedition_speed") / 100;
  return Math.max(60, Math.ceil(region.durationSeconds *
    (1 - Math.min(5, gear.kit || 0) * 0.07) * petFactor));
}
function chance(region, gear = {}, pet = null) {
  return Math.min(0.98, region.success + Math.min(5, gear.ward || 0) * 0.05 +
    companions.effectPct(pet, "expedition_success") / 200);
}
function upgradeCost(id, currentLevel) {
  const index = GEAR.findIndex((g) => g.id === id);
  if (index === -1 || !Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= 5)
    throw new Error("Unknown equipment or maximum level reached.");
  const n = currentLevel + 1;
  return { credits: n * (index + 1) * 100,
    materials: { ore: (4 + index * 2) * n, silver: (index + 1) * n,
      ...(currentLevel >= 2 ? { gold: currentLevel - 1 } : {}) } };
}
function reward(region, gear, rng = () => crypto.randomInt(0, 1000000) / 1000000, pet = null) {
  if (!region || !regionById.has(region.id)) throw new Error("Unknown expedition region.");
  const success = rng() < chance(region, gear, pet);
  let roll = rng() * 100;
  const drop = region.drops.find((d) => (roll -= d.weight) < 0) || region.drops.at(-1);
  const baseQty = drop.min + Math.floor(rng() * (drop.max - drop.min + 1));
  let quantity = Math.max(1, Math.floor(baseQty * (1 + 0.12 * (gear.compass || 0))));
  if (companions.effectPct(pet, "expedition_loot") > 0)
    quantity = Math.ceil(quantity * (1 + companions.effectPct(pet, "expedition_loot") / 100));
  return { outcome: success ? "success" : "setback",
    credits: Math.floor(region.credits * (success ? 1 : 0.35)),
    experience: success ? region.experience : Math.floor(region.experience / 2),
    itemId: drop.id, quantity: success ? quantity : 1 };
}
module.exports = { REGIONS, GEAR, regionById, gearById, levels, unlocked, duration, chance, upgradeCost, reward };
