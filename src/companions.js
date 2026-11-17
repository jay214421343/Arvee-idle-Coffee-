"use strict";
const crypto = require("node:crypto");
const PETS = Object.freeze([
  Object.freeze({ id: "ember_fox", name: "Ember Fox", role: "Mining", rarity: "Common", description: "Mining earnings.", effect: "mine_income", starter: true, power: 1 }),
  Object.freeze({ id: "moss_wisp", name: "Moss Wisp", role: "Expedition", rarity: "Uncommon", description: "Faster world-map expeditions.", effect: "expedition_speed", starter: true, power: 1 }),
  Object.freeze({ id: "moon_owl", name: "Moon Owl", role: "Treasure", rarity: "Rare", description: "More world-map expedition materials.", effect: "expedition_loot", starter: true, power: 1 }),
  Object.freeze({ id: "cave_ferret", name: "Cave Ferret", role: "Treasure", rarity: "Common", description: "Find extra expedition materials.", effect: "expedition_loot", starter: false, power: 0.7 }),
  Object.freeze({ id: "iron_cub", name: "Iron Cub", role: "Boss", rarity: "Common", description: "Deal more World Boss damage.", effect: "boss_power", starter: false, power: 0.8 }),
  Object.freeze({ id: "clockwork_sparrow", name: "Clockwork Sparrow", role: "Boss", rarity: "Uncommon", description: "Shorter World Boss attack cooldown.", effect: "boss_haste", starter: false, power: 0.75 }),
  Object.freeze({ id: "trail_sprite", name: "Trail Sprite", role: "Expedition", rarity: "Uncommon", description: "Improve expedition success odds.", effect: "expedition_success", starter: false, power: 0.6 }),
  Object.freeze({ id: "zephyr_finch", name: "Zephyr Finch", role: "Expedition", rarity: "Rare", description: "Faster world-map expeditions.", effect: "expedition_speed", starter: false, power: 1.05 }),
  Object.freeze({ id: "ash_wolf", name: "Ash Wolf", role: "Boss", rarity: "Rare", description: "Deal more World Boss damage.", effect: "boss_power", starter: false, power: 1 }),
  Object.freeze({ id: "nest_fox", name: "Nest Fox", role: "Eggs", rarity: "Rare", description: "Find companion eggs more often.", effect: "egg_luck", starter: false, power: 0.7 }),
  Object.freeze({ id: "tempest_roc", name: "Tempest Roc", role: "Expedition", rarity: "Epic", description: "Faster world-map expeditions.", effect: "expedition_speed", starter: false, power: 1.2 }),
  Object.freeze({ id: "gem_serpent", name: "Gem Serpent", role: "Treasure", rarity: "Epic", description: "Bring back more expedition materials.", effect: "expedition_loot", starter: false, power: 1.3 }),
  Object.freeze({ id: "void_moth", name: "Void Moth", role: "Boss", rarity: "Epic", description: "Shorten World Boss attack cooldown.", effect: "boss_haste", starter: false, power: 1 }),
  Object.freeze({ id: "rune_gecko", name: "Rune Gecko", role: "Runes", rarity: "Epic", description: "Earn Rune Fragment milestones faster while mining.", effect: "rune_progress", starter: false, power: 1 }),
  Object.freeze({ id: "phoenix_drake", name: "Phoenix Drake", role: "Mining", rarity: "Legendary", description: "Empower mining rewards and World Boss attacks.", effect: "mine_income", starter: false, power: 1.3 }),
  Object.freeze({ id: "runebound_golem", name: "Runebound Golem", role: "Boss", rarity: "Legendary", description: "Deal more World Boss damage.", effect: "boss_power", starter: false, power: 1.35 }),
  Object.freeze({ id: "star_stag", name: "Star Stag", role: "Expedition", rarity: "Legendary", description: "Protect expeditions from setbacks.", effect: "expedition_success", starter: false, power: 1.25 }),
  Object.freeze({ id: "hatchling_drake", name: "Hatchling Drake", role: "Eggs", rarity: "Mythic", description: "Increase companion egg discovery chances.", effect: "egg_luck", starter: false, power: 1.4 })
]);
const byId = new Map(PETS.map((pet) => [pet.id, pet]));
const STARTERS = Object.freeze(PETS.filter((pet) => pet.starter));
const RARITY_WEIGHTS = Object.freeze({ Common: 60, Uncommon: 40, Rare: 25, Epic: 12, Legendary: 5, Mythic: 2 });
const MAX_LEVEL = 30;
const MAX_XP = 50 * MAX_LEVEL * (MAX_LEVEL - 1);
const FRAGMENT_GOAL = 20;
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
function effectPct(pet, effect) {
  const type = pet && byId.get(pet.id);
  if (!type || type.effect !== effect) return 0;
  const pct = boostPct(pet.level) * type.power;
  return Math.round(Math.min(effect === "boss_haste" ? 20 : 25, pct) * 100) / 100;
}
function runeProgress(pet) { return effectPct(pet, "rune_progress") > 0 ? 2 : 1; }
function bonus(pet) {
  const type = pet && byId.get(pet.id);
  if (!type) return null;
  const pct = effectPct(pet, type.effect);
  const desc = {
    mine_income: "+" + pct + "% mined IC and World Boss power",
    expedition_speed: "-" + pct + "% expedition duration",
    expedition_loot: "+" + pct + "% expedition material quantity",
    boss_power: "+" + pct + "% World Boss attack power",
    boss_haste: "-" + pct + "% World Boss attack cooldown",
    expedition_success: "+" + Math.round(pct / 2 * 100) / 100 + " percentage points expedition success",
    egg_luck: "+" + Math.round(pct / 2 * 100) / 100 + " percentage points egg discovery",
    rune_progress: "2 progress per mine toward guaranteed Rune Fragments"
  };
  return { role: type.role, percent: pct, description: desc[type.effect] };
}
function eventXp(type, metadata = {}) {
  if (type === "mine") return 10;
  if (type === "daily") return 25;
  if (type === "expedition_complete") return 65;
  if (type === "world_boss_attack") return 15;
  if (type === "craft") return 10 * Math.max(1, Math.min(5, Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1));
  if (type === "open_lootbox") return 5 * Math.max(1, Math.min(5, Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1));
  return 0;
}
function eggDrop(regionId, success, rng = (limit) => crypto.randomInt(limit), pet = null) {
  const chance = ({ forest: 12, mines: 18, ruins: 25 })[regionId];
  if (chance === undefined) throw new Error("Unknown egg region.");
  const extra = effectPct(pet,"egg_luck") / 2;
  return success && rng(10000) < Math.round(Math.min(40,chance + extra) * 100);
}
function hatch(owned = [], rng = (limit) => crypto.randomInt(limit)) {
  const ids = new Set(owned);
  const weights = PETS.map((pet) => [pet, RARITY_WEIGHTS[pet.rarity] * (ids.has(pet.id) ? 1 : 2)]);
  const total = weights.reduce((sum,[,weight]) => sum + weight,0);
  const roll = rng(total);
  if (!Number.isInteger(roll) || roll < 0 || roll >= total) throw new Error("Invalid companion egg roll.");
  let left = roll;
  for (const [pet, weight] of weights) {
    if (left < weight) return pet;
    left -= weight;
  }
  throw new Error("Could not hatch companion.");
}
module.exports = { PETS, STARTERS, byId, RARITY_WEIGHTS, MAX_LEVEL, MAX_XP, FRAGMENT_GOAL,
  xpFor, level, stage, bonus, boostPct, effectPct, runeProgress, eventXp, eggDrop, hatch };
