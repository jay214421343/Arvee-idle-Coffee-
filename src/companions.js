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
  Object.freeze({ id: "rune_gecko", name: "Rune Gecko", role: "Runes", rarity: "Epic", description: "Senses hidden Supply Caches while mining.", effect: "cache_luck", starter: false, power: 1 }),
  Object.freeze({ id: "phoenix_drake", name: "Phoenix Drake", role: "Mining", rarity: "Legendary", description: "Empower mining rewards and World Boss attacks.", effect: "mine_income", starter: false, power: 1.3 }),
  Object.freeze({ id: "runebound_golem", name: "Runebound Golem", role: "Boss", rarity: "Legendary", description: "Deal more World Boss damage.", effect: "boss_power", starter: false, power: 1.35 }),
  Object.freeze({ id: "star_stag", name: "Star Stag", role: "Expedition", rarity: "Legendary", description: "Protect expeditions from setbacks.", effect: "expedition_success", starter: false, power: 1.25 }),
  Object.freeze({ id: "hatchling_drake", name: "Hatchling Drake", role: "Eggs", rarity: "Mythic", description: "Increase companion egg discovery chances.", effect: "egg_luck", starter: false, power: 1.4 }),
  Object.freeze({ id: "twilight_lynx", name: "Twilight Lynx", role: "Omni", rarity: "Mythic", description: "Balanced boosts to every companion stat and passive IC income.", effect: "all_stats", starter: false, power: 0.45 }),
  Object.freeze({ id: "aurora_gryphon", name: "Aurora Gryphon", role: "Omni", rarity: "Mythic", description: "Strong boosts to every companion stat and passive IC income.", effect: "all_stats", starter: false, power: 0.65 }),
  Object.freeze({ id: "eclipse_leviathan", name: "Eclipse Leviathan", role: "Omni", rarity: "Mythic", description: "The strongest all-round Mythic, empowering every stat and passive IC income.", effect: "all_stats", starter: false, power: 0.9 }),
  Object.freeze({ id: "eternal_sovereign", name: "Eternal Sovereign", role: "Omni", rarity: "Secret", description: "A nearly impossible legend whose power strengthens every stat.", effect: "all_stats", starter: false, power: 1.6 })
]);
const byId = new Map(PETS.map((pet) => [pet.id, pet]));
const STARTERS = Object.freeze(PETS.filter((pet) => pet.starter));
const RARITY_WEIGHTS = Object.freeze({ Common: 60, Uncommon: 40, Rare: 25, Epic: 12, Legendary: 5, Mythic: 2, Secret: 0 });
const SECRET_POOL = 1000000;
const ALL_EFFECTS = Object.freeze(["mine_income","idle_income","expedition_speed","expedition_loot",
  "expedition_success","boss_power","boss_haste","egg_luck","cache_luck"]);
// Non-omni companions have differentiated specializations: one full-strength
// signature and 1–2 supporting bonuses. Mythics/Secret keep their all-stat role.
const SPECIALIST_TRAITS = Object.freeze({
  ember_fox: Object.freeze({"mine_income":1,"boss_power":0.42}),
  moss_wisp: Object.freeze({"expedition_speed":1,"expedition_success":0.55}),
  moon_owl: Object.freeze({"expedition_loot":1,"egg_luck":0.5}),
  cave_ferret: Object.freeze({"expedition_loot":1,"cache_luck":0.7}),
  iron_cub: Object.freeze({"boss_power":1,"mine_income":0.52}),
  clockwork_sparrow: Object.freeze({"boss_haste":1,"idle_income":0.6}),
  trail_sprite: Object.freeze({"expedition_success":1,"expedition_speed":0.62}),
  zephyr_finch: Object.freeze({"expedition_speed":1,"boss_haste":0.55}),
  ash_wolf: Object.freeze({"boss_power":1,"cache_luck":0.5}),
  nest_fox: Object.freeze({"egg_luck":1,"cache_luck":0.7}),
  tempest_roc: Object.freeze({"expedition_speed":1,"boss_power":0.6}),
  gem_serpent: Object.freeze({"expedition_loot":1,"mine_income":0.52}),
  void_moth: Object.freeze({"boss_haste":1,"expedition_success":0.55}),
  rune_gecko: Object.freeze({"cache_luck":1,"egg_luck":0.55}),
  phoenix_drake: Object.freeze({"mine_income":1,"boss_power":0.6,"idle_income":0.35}),
  runebound_golem: Object.freeze({"boss_power":1,"idle_income":0.58}),
  star_stag: Object.freeze({"expedition_success":1,"expedition_loot":0.6}),
  hatchling_drake: Object.freeze({"egg_luck":1,"cache_luck":0.65,"mine_income":0.3}),
});
const STAT_LABELS = Object.freeze({
  mine_income:"Mining IC",idle_income:"Passive IC",expedition_speed:"Expedition speed",
  expedition_loot:"Expedition loot",expedition_success:"Expedition success",
  boss_power:"Boss power",boss_haste:"Boss haste",egg_luck:"Egg discovery",
  cache_luck:"Supply Cache chance"
});
const TALENTS = Object.freeze({
  focus: Object.freeze({name:"Focus",description:"Stronger natural companion ability"}),
  tracker: Object.freeze({name:"Tracker",description:"Better Supply Cache and companion egg discovery"}),
  vanguard: Object.freeze({name:"Vanguard",description:"Bonus World Boss attack power"})
});
const CHARMS = Object.freeze({
  prospector_charm: Object.freeze({name:"Prospector Charm",effect:"mine_income",power:5}),
  pathfinder_charm: Object.freeze({name:"Pathfinder Charm",effect:"expedition_speed",power:5}),
  warcaller_charm: Object.freeze({name:"Warcaller Charm",effect:"boss_power",power:5})
});
const EGG_TIERS = Object.freeze({
  companion_egg: Object.freeze({name:"Companion Egg",weights:{Common:1,Uncommon:1,Rare:1,Epic:1,Legendary:1,Mythic:1,Secret:0},secretChance:10}),
  rare_companion_egg: Object.freeze({name:"Enchanted Egg",weights:{Common:0,Uncommon:0.2,Rare:1.5,Epic:3,Legendary:3,Mythic:2,Secret:0},secretChance:40}),
  mythic_companion_egg: Object.freeze({name:"Astral Egg",weights:{Common:0,Uncommon:0,Rare:0.2,Epic:2,Legendary:5,Mythic:10,Secret:0},secretChance:200})
});
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
function effectPct(pet, effect) {
  const type = pet && byId.get(pet.id);
  if (!type) return 0;
  const multiplier=type.effect==="all_stats" ? (ALL_EFFECTS.includes(effect)?1:0) :
    Number(SPECIALIST_TRAITS[type.id]?.[effect] || 0);
  let pct=boostPct(pet.level)*type.power*multiplier;
  const mastery = pet.level >= 20 ? 2 : pet.level >= 10 ? 1 : 0;
  if (mastery && pet.talentId === "focus" && multiplier>0)
    pct *= mastery === 2 ? 1.35 : 1.2;
  if (mastery && pet.talentId === "tracker" && (effect === "cache_luck" || effect === "egg_luck"))
    pct += mastery === 2 ? 12 : 6;
  if (mastery && pet.talentId === "vanguard" && effect === "boss_power")
    pct += mastery === 2 ? 10 : 6;
  const charm = CHARMS[pet.charmId];
  if (charm && charm.effect === effect) pct += charm.power;
  return Math.round(Math.min(effect === "boss_haste" ? 20 : 25, pct) * 100) / 100;
}
function bonus(pet) {
  const type = pet && byId.get(pet.id);
  if (!type) return null;
  const pct = effectPct(pet, type.effect === "all_stats" ? "mine_income" : type.effect);
  const desc = {
    mine_income: "+" + pct + "% mined IC and World Boss power",
    expedition_speed: "-" + pct + "% expedition duration",
    expedition_loot: "+" + pct + "% expedition material quantity",
    boss_power: "+" + pct + "% World Boss attack power",
    boss_haste: "-" + pct + "% World Boss attack cooldown",
    expedition_success: "+" + Math.round(pct / 2 * 100) / 100 + " percentage points expedition success",
    egg_luck: "+" + Math.round(pct / 2 * 100) / 100 + " percentage points egg discovery",
    cache_luck: "+" + Math.round(pct / 3 * 100) / 100 + " percentage points Supply Cache chance"
  };
  const suffix = [
    pet.level >= 10 && TALENTS[pet.talentId] ? "Talent: " + TALENTS[pet.talentId].name : "",
    CHARMS[pet.charmId] ? "Charm: " + CHARMS[pet.charmId].name : ""
  ].filter(Boolean).join(" · ");
  const allRound = type.effect === "all_stats" ?
    "All 9 buffs · +" + pct + "% mining, idle income, loot and boss power · -" +
    effectPct(pet,"boss_haste") + "% boss cooldown · faster expeditions and more luck" :
    Object.keys(SPECIALIST_TRAITS[type.id] || {}).map(effect=>
      (["boss_haste","expedition_speed"].includes(effect) ? "−" : "+") +
      (effectPct(pet,effect)) + "% " + STAT_LABELS[effect]).join(" · ");
  return { role: type.role, percent: pct,
    description: allRound + (suffix ? " · " + suffix : "") };
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
function hatch(owned = [], rng = (limit) => crypto.randomInt(limit), eggType = "companion_egg") {
  const tier = EGG_TIERS[eggType];
  if (!tier) throw new Error("Unknown companion egg type.");
  const ids = new Set(owned);
  const weights = PETS.map((pet) => [pet,
    Math.round(RARITY_WEIGHTS[pet.rarity] * tier.weights[pet.rarity] * 10) *
      (ids.has(pet.id) ? 1 : 2)]).filter(([,weight]) => weight > 0);
  const total = weights.reduce((sum,[,weight]) => sum + weight,0);
  const roll = rng(total);
  if (!Number.isInteger(roll) || roll < 0 || roll >= total) throw new Error("Invalid companion egg roll.");
  // A separate, unbiased Secret roll does not increase through duplicate protection.
  // Common 1/100,000; Enchanted 1/25,000; Astral 1/5,000.
  const secretRoll = rng(SECRET_POOL);
  if (!Number.isInteger(secretRoll) || secretRoll < 0 || secretRoll >= SECRET_POOL)
    throw new Error("Invalid secret egg roll.");
  if (secretRoll >= SECRET_POOL - tier.secretChance) return byId.get("eternal_sovereign");
  let left = roll;
  for (const [pet, weight] of weights) {
    if (left < weight) return pet;
    left -= weight;
  }
  throw new Error("Could not hatch companion.");
}
module.exports = { PETS, STARTERS, byId, RARITY_WEIGHTS, SECRET_POOL, ALL_EFFECTS, SPECIALIST_TRAITS, STAT_LABELS, TALENTS, CHARMS, EGG_TIERS, MAX_LEVEL, MAX_XP,
  xpFor, level, stage, bonus, boostPct, effectPct, eventXp, eggDrop, hatch };
