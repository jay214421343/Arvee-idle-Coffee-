"use strict";
const generators = require("./data/generators.json").catalogue
  .filter((entry) => entry.available !== false && entry.alias && entry.baseCost && entry.baseIncome)
  .map((entry) => Object.freeze({
    id: entry.alias.toUpperCase(),
    name: entry.name,
    description: entry.desc || "",
    cost: entry.baseCost,
    income: entry.baseIncome
  }));
const byId = new Map(generators.map((entry) => [entry.id, entry]));
if (byId.size !== generators.length) throw new Error("Duplicate generator ID in catalogue");

const items = Object.freeze({
  ore: { name: "Rune Ore", emoji: "🪨", rarity: "Common", description: "Ore extracted from ARVEE mines. Used at the Forge." },
  silver: { name: "Moonsteel", emoji: "🥈", rarity: "Uncommon", description: "A refined ore used in forging and trading." },
  gold: { name: "Sunforged Gold", emoji: "🥇", rarity: "Rare", description: "Rare metal for advanced ARVEE forging." },
  coffee: { name: "Campfire Brew", emoji: "☕", rarity: "Common", description: "A warm brew shared by adventurers at an ARVEE campfire.", use: "Gain 50 IC.", effect: { bp: "50" } },
  cookie: { name: "Traveler's Ration", emoji: "🍪", rarity: "Common", description: "A reliable snack before a dungeon expedition.", use: "Gain 250 IC.", effect: { bp: "250" } },
  lucky_charm: { name: "Fate Charm", emoji: "🍀", rarity: "Epic", description: "A charm marked with runes from an ancient ARVEE expedition.", use: "Double your next mining reward.", effect: { nextMine: "2" } },
  lootbox: { name: "Supply Cache", emoji: "📦", rarity: "Common", description: "Contains a random selection of useful items.", use: "Open with /idle open." },
  rare_lootbox: { name: "Rare Supply Cache", emoji: "🎁", rarity: "Rare", description: "A better selection of loot.", use: "Open with /idle open." },
  legendary_lootbox: { name: "Mythic Supply Cache", emoji: "🌟", rarity: "Legendary", description: "A rare box full of precious items.", use: "Open with /idle open." },
  apple: { name: "Herbal Ration", emoji: "🍎", rarity: "Common", description: "An herb-packed adventurer ration.", use: "Gain 100 IC.", effect: { bp: "100" } },
  bread: { name: "Traveler Bread", emoji: "🍞", rarity: "Common", description: "Bread prepared for a journey through the ARVEE realms.", use: "Gain 150 IC.", effect: { bp: "150" } },
  bacon: { name: "Hunter\'s Feast", emoji: "🥓", rarity: "Uncommon", description: "A feast for weary dungeon hunters.", use: "Gain 600 IC.", effect: { bp: "600" } },
  cola: { name: "Spark Tonic", emoji: "🥤", rarity: "Uncommon", description: "Sparkling energy from an alchemist workshop.", use: "Boost your next mine by 25%.", effect: { nextMine: "1.25" } },
  starfruit: { name: "Starshard Fruit", emoji: "⭐", rarity: "Rare", description: "A fruit infused with astral energy.", use: "Boost your next mine by 50%.", effect: { nextMine: "1.5" } },
  golden_apple: { name: "Golden Starfruit", emoji: "🍏", rarity: "Epic", description: "A highly prized enchanted snack.", use: "Boost your next mine by 100%.", effect: { nextMine: "2" } },
  strange_matter: { name: "Void Essence", emoji: "✨", rarity: "Rare", description: "Used in rare experiments and crafting." },
  foxtail_amulet: { name: "Foxfire Charm", emoji: "🦊", rarity: "Epic", description: "A charm beloved by miners.", use: "Boost your next mine by 200%.", effect: { nextMine: "3" } },
  tinkers_gizmo: { name: "Artificer's Tool", emoji: "🔧", rarity: "Epic", description: "A crafted tool for experienced ARVEE prospectors.", use: "Gain 20 mining XP.", effect: { xp: 20 } },
  orb_of_almanac: { name: "Astral Sigil", emoji: "🔮", rarity: "Legendary", description: "A permanent improvement to your idle empire.", use: "Permanently gain +10% generator output (max 20 orbs).", effect: { orb: 1 } },
  gem: { name: "Astral Gem", emoji: "💎", rarity: "Legendary", description: "A precious gemstone for advanced crafting." },
  pickperk: { name: "Rune Fragment", emoji: "🧩", rarity: "Rare", description: "Upgrade one of your permanent pickaxe perks with /idle perks." },
  pumpkin_spice_latte: { name: "Harvest Brew", emoji: "🎃", rarity: "Rare", description: "A seasonal harvest potion brewed in the ARVEE realm.", use: "Boost your next mine by 75%.", effect: { nextMine: "1.75" } },
  bohemian_cocktail: { name: "Moonshadow Elixir", emoji: "🍹", rarity: "Epic", description: "Moonlit alchemy distilled by ARVEE artificers.", use: "Receive 1 Rare Supply Cache.", effect: { grant: "rare_lootbox", grantAmount: 1 } },
  jungle_juice: { name: "Forest Tonic", emoji: "🧃", rarity: "Rare", description: "A burst of concentrated energy.", use: "Gain 10 mining XP.", effect: { xp: 10 } },
  gilded_slurry: { name: "Golden Elixir", emoji: "🏺", rarity: "Epic", description: "Expensive but fruitful alchemy.", use: "Receive an Astral Gem.", effect: { grant: "gem", grantAmount: 1 } }
});
const recipes = Object.freeze({
  coffee: { ore: 3, silver: 1 },
  cookie: { coffee: 2, ore: 2 },
  lucky_charm: { gold: 2, silver: 8, cookie: 1 },
  golden_apple: { gold: 2, apple: 3, strange_matter: 1 },
  foxtail_amulet: { silver: 12, strange_matter: 4, starfruit: 1 },
  tinkers_gizmo: { silver: 10, gold: 3, strange_matter: 2 },
  orb_of_almanac: { gem: 5, strange_matter: 15, gold: 10 },
  rare_lootbox: { lootbox: 5, silver: 4 },
  legendary_lootbox: { rare_lootbox: 4, gem: 2 },
  bohemian_cocktail: { coffee: 4, gold: 2, strange_matter: 3 },
  gilded_slurry: { gold: 8, strange_matter: 3 }
});
const perks = Object.freeze({
  miner: { name: "Power Strike", description: "+10% mining IC per level", max: 10 },
  fortune: { name: "Treasure Hunter", description: "Better mineral loot at each level", max: 10 },
  sprinter: { name: "Quick Hands", description: "-6 seconds mining cooldown per level", max: 10 },
  investor: { name: "Idle Savant", description: "+3% passive IC income per level", max: 10 },
  scavenger: { name: "Scavenger", description: "+3% Supply Cache chance per level", max: 10 }
});
for (const [id, recipe] of Object.entries(recipes)) {
  if (!Object.hasOwn(items, id)) throw new Error("Undefined recipe output " + id);
  for (const k of Object.keys(recipe)) if (!Object.hasOwn(items, k)) throw new Error("Undefined recipe ingredient " + k);
}
module.exports = { generators, byId, items, recipes, perks };
