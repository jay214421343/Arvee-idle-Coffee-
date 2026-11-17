"use strict";
const { items } = require("./catalog");
const SEASON = Object.freeze({
  id: "founders_2026",
  name: "Founders' Journey",
  subtitle: "The First Expedition",
  startsAt: "2026-11-17T00:00:00.000Z",
  endsAt: "2027-01-16T00:00:00.000Z",
  claimUntil: "2027-01-23T00:00:00.000Z",
  xpPerTier: 250
});
const rewards = Object.freeze([
  { kind: "ic", amount: 200 },
  { kind: "item", item: "lootbox", quantity: 2 },
  { kind: "item", item: "ore", quantity: 8 },
  { kind: "ic", amount: 400 },
  { kind: "item", item: "rare_lootbox", quantity: 1 },
  { kind: "item", item: "silver", quantity: 4 },
  { kind: "ic", amount: 750 },
  { kind: "item", item: "coffee", quantity: 3 },
  { kind: "item", item: "gold", quantity: 2 },
  { kind: "item", item: "pickperk", quantity: 1 },
  { kind: "ic", amount: 1250 },
  { kind: "item", item: "rare_lootbox", quantity: 2 },
  { kind: "item", item: "silver", quantity: 10 },
  { kind: "ic", amount: 1750 },
  { kind: "item", item: "gem", quantity: 1 },
  { kind: "item", item: "gold", quantity: 5 },
  { kind: "ic", amount: 2500 },
  { kind: "item", item: "legendary_lootbox", quantity: 1 },
  { kind: "item", item: "pickperk", quantity: 2 },
  { kind: "item", item: "orb_of_almanac", quantity: 1 },
  // Tiers 21–40: The Frontier
  { kind: "ic", amount: 3000 },
  { kind: "item", item: "lootbox", quantity: 3 },
  { kind: "item", item: "ore", quantity: 20 },
  { kind: "item", item: "coffee", quantity: 4 },
  { kind: "item", item: "rare_lootbox", quantity: 2 },
  { kind: "item", item: "silver", quantity: 12 },
  { kind: "item", item: "bread", quantity: 3 },
  { kind: "item", item: "gold", quantity: 5 },
  { kind: "item", item: "companion_egg", quantity: 1 },
  { kind: "item", item: "pickperk", quantity: 1 },
  { kind: "ic", amount: 4500 },
  { kind: "item", item: "cola", quantity: 2 },
  { kind: "item", item: "silver", quantity: 15 },
  { kind: "item", item: "lootbox", quantity: 4 },
  { kind: "item", item: "rare_lootbox", quantity: 2 },
  { kind: "item", item: "strange_matter", quantity: 5 },
  { kind: "item", item: "crafting_materials", quantity: 2 },
  { kind: "item", item: "gem", quantity: 1 },
  { kind: "item", item: "rare_companion_egg", quantity: 1 },
  { kind: "item", item: "legendary_lootbox", quantity: 1 },
  // Tiers 41–60: The Artificer
  { kind: "ic", amount: 6000 },
  { kind: "item", item: "ore", quantity: 30 },
  { kind: "item", item: "rare_lootbox", quantity: 2 },
  { kind: "item", item: "starfruit", quantity: 2 },
  { kind: "item", item: "pickperk", quantity: 2 },
  { kind: "item", item: "silver", quantity: 20 },
  { kind: "item", item: "gold", quantity: 8 },
  { kind: "item", item: "companion_egg", quantity: 2 },
  { kind: "item", item: "pathfinder_charm", quantity: 1 },
  { kind: "item", item: "rare_companion_egg", quantity: 1 },
  { kind: "ic", amount: 8000 },
  { kind: "item", item: "coffee", quantity: 5 },
  { kind: "item", item: "strange_matter", quantity: 8 },
  { kind: "item", item: "rare_lootbox", quantity: 3 },
  { kind: "item", item: "pickperk", quantity: 2 },
  { kind: "item", item: "lootbox", quantity: 5 },
  { kind: "item", item: "prospector_charm", quantity: 1 },
  { kind: "item", item: "gem", quantity: 2 },
  { kind: "item", item: "legendary_lootbox", quantity: 1 },
  { kind: "item", item: "orb_of_almanac", quantity: 1 },
  // Tiers 61–80: The Astral Trail
  { kind: "ic", amount: 10000 },
  { kind: "item", item: "gold", quantity: 12 },
  { kind: "item", item: "rare_lootbox", quantity: 3 },
  { kind: "item", item: "jungle_juice", quantity: 2 },
  { kind: "item", item: "pickperk", quantity: 2 },
  { kind: "item", item: "silver", quantity: 24 },
  { kind: "item", item: "rare_companion_egg", quantity: 2 },
  { kind: "item", item: "gnome", quantity: 1 },
  { kind: "item", item: "gem", quantity: 2 },
  { kind: "item", item: "legendary_lootbox", quantity: 2 },
  { kind: "ic", amount: 15000 },
  { kind: "item", item: "strange_matter", quantity: 12 },
  { kind: "item", item: "warcaller_charm", quantity: 1 },
  { kind: "item", item: "starfruit", quantity: 3 },
  { kind: "item", item: "mythic_companion_egg", quantity: 1 },
  { kind: "item", item: "gold", quantity: 15 },
  { kind: "item", item: "lootbox", quantity: 6 },
  { kind: "item", item: "pickperk", quantity: 3 },
  { kind: "item", item: "gem", quantity: 3 },
  { kind: "item", item: "legendary_lootbox", quantity: 2 },
  // Tiers 81–100: The Founders' Summit
  { kind: "ic", amount: 20000 },
  { kind: "item", item: "silver", quantity: 30 },
  { kind: "item", item: "rare_companion_egg", quantity: 2 },
  { kind: "item", item: "cola", quantity: 3 },
  { kind: "item", item: "pickperk", quantity: 3 },
  { kind: "item", item: "gold", quantity: 20 },
  { kind: "item", item: "legendary_lootbox", quantity: 2 },
  { kind: "item", item: "golden_apple", quantity: 1 },
  { kind: "item", item: "gem", quantity: 3 },
  { kind: "item", item: "mythic_companion_egg", quantity: 1 },
  { kind: "ic", amount: 30000 },
  { kind: "item", item: "rare_lootbox", quantity: 4 },
  { kind: "item", item: "gnome", quantity: 1 },
  { kind: "item", item: "strange_matter", quantity: 20 },
  { kind: "item", item: "pickperk", quantity: 4 },
  { kind: "item", item: "legendary_lootbox", quantity: 2 },
  { kind: "item", item: "rare_companion_egg", quantity: 3 },
  { kind: "item", item: "gem", quantity: 4 },
  { kind: "item", item: "mythic_companion_egg", quantity: 1 },
  { kind: "item", item: "orb_of_almanac", quantity: 1 }
].map((reward) => Object.freeze(reward)));
const missions = Object.freeze([
  { id: "prospector", event: "mine", label: "Prospector's Route", goal: 3 },
  { id: "recruiter", event: "generator_purchase", label: "Growing the Guild", goal: 2 },
  { id: "artisan", event: "craft", label: "The Artificer's Call", goal: 1 }
].map((mission) => Object.freeze(mission)));
function phase(now = new Date()) {
  const value = new Date(now).getTime();
  if (value < Date.parse(SEASON.startsAt)) return "upcoming";
  if (value < Date.parse(SEASON.endsAt)) return "active";
  if (value < Date.parse(SEASON.claimUntil)) return "claim_only";
  return "finished";
}
function unlocked(xp) {
  const n = Number(xp);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid season XP.");
  return Math.min(rewards.length, Math.floor(n / SEASON.xpPerTier));
}
function eventXp(type, metadata = {}) {
  const qty = Math.max(1, Math.min(5, Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1));
  if (type === "mine") return 20;
  if (type === "daily") return 100;
  if (type === "generator_purchase") return 15 * qty;
  if (type === "craft") return 25 * qty;
  if (type === "open_lootbox") return 10 * qty;
  if (type === "pickaxe_upgrade") return 75;
  if (type === "perk_upgrade") return 40;
  if (type === "prestige") return 250;
  if (type === "expedition_complete") return 60;
  if (type === "world_boss_attack") return 15;
  if (type === "world_boss_reward") return 80;
  if (type === "expedition_gear_upgrade") return 35;
  return 0;
}
function label(reward) {
  if (reward.kind === "ic") return reward.amount.toLocaleString("en-US") + " Idle Credits";
  if (reward.kind === "item" && items[reward.item]) return reward.quantity + "× " + items[reward.item].name;
  throw new Error("Invalid season reward.");
}
function tierNeeded(tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > rewards.length) throw new Error("Invalid season tier.");
  return tier * SEASON.xpPerTier;
}
module.exports = { SEASON, rewards, missions, phase, unlocked, eventXp, tierNeeded, label };
