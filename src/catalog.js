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
  ore: { name: "Ore", emoji: "🪨", rarity: "Common", description: "Ore extracted from mines. Used in crafting." },
  silver: { name: "Silver", emoji: "🥈", rarity: "Uncommon", description: "A useful mineral for trading and crafting." },
  gold: { name: "Gold", emoji: "🥇", rarity: "Rare", description: "Precious metal for advanced crafts." },
  coffee: { name: "Coffee", emoji: "☕", rarity: "Common", description: "A warm cup of Coffee. Restores your ambition.", use: "Gain 50 BP.", effect: { bp: "50" } },
  cookie: { name: "Cookie", emoji: "🍪", rarity: "Common", description: "A sweet side to Coffee.", use: "Gain 250 BP.", effect: { bp: "250" } },
  lucky_charm: { name: "Lucky Charm", emoji: "🍀", rarity: "Epic", description: "An enchanted trinket.", use: "Double your next mining reward.", effect: { nextMine: "2" } },
  lootbox: { name: "Lootbox", emoji: "📦", rarity: "Common", description: "Contains a random selection of useful items.", use: "Open with /coffee open." },
  rare_lootbox: { name: "Rare Lootbox", emoji: "🎁", rarity: "Rare", description: "A better selection of loot.", use: "Open with /coffee open." },
  legendary_lootbox: { name: "Legendary Lootbox", emoji: "🌟", rarity: "Legendary", description: "A rare box full of precious items.", use: "Open with /coffee open." },
  apple: { name: "Apple", emoji: "🍎", rarity: "Common", description: "A healthy mining snack.", use: "Gain 100 BP.", effect: { bp: "100" } },
  bread: { name: "Bread", emoji: "🍞", rarity: "Common", description: "Freshly baked bread.", use: "Gain 150 BP.", effect: { bp: "150" } },
  bacon: { name: "Bacon", emoji: "🥓", rarity: "Uncommon", description: "An energy-packed snack.", use: "Gain 600 BP.", effect: { bp: "600" } },
  cola: { name: "Cola", emoji: "🥤", rarity: "Uncommon", description: "Fuel for late-night mining.", use: "Boost your next mine by 25%.", effect: { nextMine: "1.25" } },
  starfruit: { name: "Starfruit", emoji: "⭐", rarity: "Rare", description: "A mysterious glowing fruit.", use: "Boost your next mine by 50%.", effect: { nextMine: "1.5" } },
  golden_apple: { name: "Golden Apple", emoji: "🍏", rarity: "Epic", description: "A highly prized enchanted snack.", use: "Boost your next mine by 100%.", effect: { nextMine: "2" } },
  strange_matter: { name: "Strange Matter", emoji: "✨", rarity: "Rare", description: "Used in rare experiments and crafting." },
  foxtail_amulet: { name: "Foxtail Amulet", emoji: "🦊", rarity: "Epic", description: "A charm beloved by miners.", use: "Boost your next mine by 200%.", effect: { nextMine: "3" } },
  tinkers_gizmo: { name: "Tinker's Gizmo", emoji: "🔧", rarity: "Epic", description: "An invention for master miners.", use: "Gain 20 mining XP.", effect: { xp: 20 } },
  orb_of_almanac: { name: "Orb of Almanac", emoji: "🔮", rarity: "Legendary", description: "A permanent improvement to your idle empire.", use: "Permanently gain +10% generator output (max 20 orbs).", effect: { orb: 1 } },
  gem: { name: "Gem", emoji: "💎", rarity: "Legendary", description: "A precious gemstone for advanced crafting." },
  pickperk: { name: "Pickperk Token", emoji: "🧩", rarity: "Rare", description: "Upgrade one of your permanent pickaxe perks with /coffee perks." },
  pumpkin_spice_latte: { name: "Pumpkin Spice Latte", emoji: "🎃", rarity: "Rare", description: "A seasonal café treat.", use: "Boost your next mine by 75%.", effect: { nextMine: "1.75" } },
  bohemian_cocktail: { name: "Bohemian Cocktail", emoji: "🍹", rarity: "Epic", description: "A fine alchemical blend.", use: "Receive 1 Rare Lootbox.", effect: { grant: "rare_lootbox", grantAmount: 1 } },
  jungle_juice: { name: "Jungle Juice", emoji: "🧃", rarity: "Rare", description: "A burst of concentrated energy.", use: "Gain 10 mining XP.", effect: { xp: 10 } },
  gilded_slurry: { name: "Gilded Slurry", emoji: "🏺", rarity: "Epic", description: "Expensive but fruitful alchemy.", use: "Receive a Gem.", effect: { grant: "gem", grantAmount: 1 } }
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
  miner: { name: "Power Strike", description: "+10% mining BP per level", max: 10 },
  fortune: { name: "Treasure Hunter", description: "Better mineral loot at each level", max: 10 },
  sprinter: { name: "Quick Hands", description: "-15 seconds mining cooldown per level", max: 10 },
  investor: { name: "Idle Savant", description: "+3% passive BP income per level", max: 10 },
  scavenger: { name: "Scavenger", description: "+3% lootbox chance per level", max: 10 }
});
for (const [id, recipe] of Object.entries(recipes)) {
  if (!Object.hasOwn(items, id)) throw new Error("Undefined recipe output " + id);
  for (const k of Object.keys(recipe)) if (!Object.hasOwn(items, k)) throw new Error("Undefined recipe ingredient " + k);
}
module.exports = { generators, byId, items, recipes, perks };
