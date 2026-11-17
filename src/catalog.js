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
  silver: { name: "Moonsteel", emoji: "<a:silver:1572284313511141477>", rarity: "Uncommon", description: "A refined ore used in forging and trading." },
  gold: { name: "Sunforged Gold", emoji: "🥇", rarity: "Rare", description: "Rare metal for advanced ARVEE forging." },
  coffee: { name: "Campfire Brew", emoji: "☕", rarity: "Common", description: "A warm brew shared by adventurers at an ARVEE campfire.", use: "Gain 50 IC and reset the mining cooldown so you can dig again.", effect: {"bp":"50","cooldownReset":true} },
  cookie: { name: "Traveler's Ration", emoji: "🍪", rarity: "Common", description: "A reliable snack before a dungeon expedition.", use: "Gain 250 IC.", effect: { bp: "250" } },
  lucky_charm: { name: "Fate Charm", emoji: "🍀", rarity: "Epic", description: "A charm marked with runes from an ancient ARVEE expedition.", use: "Double your next mining reward.", effect: { nextMine: "2" } },
  lootbox: { name: "Supply Cache", emoji: "📦", rarity: "Common", description: "Contains a random selection of useful items.", use: "Open with /idle open." },
  lunchbox: { name: "Adventurer's Lunchbox", emoji: "🥪", rarity: "Rare", description: "An extra meal packed for a brave new beginning. Contains one ration and one tonic.", use: "Open with /idle open to find two useful consumables." },
  rare_lootbox: { name: "Rare Supply Cache", emoji: "🎁", rarity: "Rare", description: "A better selection of loot.", use: "Open with /idle open." },
  legendary_lootbox: { name: "Mythic Supply Cache", emoji: "🌟", rarity: "Legendary", description: "A rare box full of precious items.", use: "Open with /idle open." },
  apple: { name: "Herbal Ration", emoji: "🍎", rarity: "Common", description: "An herb-packed adventurer ration.", use: "Gain 100 IC and +60% mining profit for the next 3 successful digs. Food buffs do not stack.", effect: {"bp":"100","mineBoost":{"multiplier":"1.6","charges":3}} },
  bread: { name: "Traveler Bread", emoji: "🍞", rarity: "Common", description: "Bread prepared for a journey through the ARVEE realms.", use: "Gain 150 IC and +25% mining profit for the next 2 successful digs. Food buffs do not stack.", effect: {"bp":"150","mineBoost":{"multiplier":"1.25","charges":2}} },
  bacon: { name: "Hunter\'s Feast", emoji: "🥓", rarity: "Uncommon", description: "A feast for weary dungeon hunters.", use: "Gain 600 IC and +20% mining profit for the next 4 successful digs. Food buffs do not stack.", effect: {"bp":"600","mineBoost":{"multiplier":"1.2","charges":4}} },
  cola: { name: "Spark Tonic", emoji: "🥤", rarity: "Uncommon", description: "Sparkling energy from an alchemist workshop.", use: "Reset the mining cooldown and boost the next dig by 25%.", effect: {"nextMine":"1.25","cooldownReset":true} },
  starfruit: { name: "Starshard Fruit", emoji: "⭐", rarity: "Rare", description: "A fruit infused with astral energy.", use: "Shorten the mining cooldown by up to 45s and boost the next dig by 50%.", effect: {"nextMine":"1.5","cooldownReduceSeconds":45} },
  golden_apple: { name: "Golden Starfruit", emoji: "🍏", rarity: "Epic", description: "A highly prized enchanted snack.", use: "Boost your next 6 successful digs by 100%. Food buffs do not stack.", effect: {"mineBoost":{"multiplier":"2","charges":6}} },
  strange_matter: { name: "Void Essence", emoji: "✨", rarity: "Rare", description: "Used in rare experiments and crafting." },
  foxtail_amulet: { name: "Foxfire Charm", emoji: "🦊", rarity: "Epic", description: "A charm beloved by miners.", use: "Boost your next mine by 200%.", effect: { nextMine: "3" } },
  tinkers_gizmo: { name: "Artificer's Tool", emoji: "🔧", rarity: "Epic", description: "A crafted tool for experienced ARVEE prospectors.", use: "Gain 20 mining XP.", effect: { xp: 20 } },
  orb_of_almanac: { name: "Astral Sigil", emoji: "🔮", rarity: "Legendary", description: "A permanent improvement to your idle empire.", use: "Permanently gain +10% generator output (max 20 orbs).", effect: { orb: 1 } },
  gem: { name: "Astral Gem", emoji: "💎", rarity: "Legendary", description: "A precious gemstone for advanced crafting." },
  pickperk: { name: "Rune Fragment", emoji: "🧩", rarity: "Rare", description: "Upgrade one of your permanent pickaxe perks with /idle perks." },
  companion_egg: { name: "Companion Egg", emoji: "🥚", rarity: "Rare", description: "Hatch a companion through /idle companions. Earned from expeditions and challenges." },
  rare_companion_egg: { name: "Enchanted Egg", emoji: "🥚", rarity: "Epic", description: "An enchanted egg that favors rare, epic and legendary companions." },
  mythic_companion_egg: { name: "Astral Egg", emoji: "🥚", rarity: "Legendary", description: "A luminous egg with improved legendary and mythic companion odds." },
  prospector_charm: { name: "Prospector Charm", emoji: "🪬", rarity: "Rare", description: "A reusable companion charm that improves mining rewards by 5%. Equip from Companion Mastery." },
  pathfinder_charm: { name: "Pathfinder Charm", emoji: "🪬", rarity: "Rare", description: "A reusable companion charm that shortens expedition times by 5%. Equip from Companion Mastery." },
  warcaller_charm: { name: "Warcaller Charm", emoji: "🪬", rarity: "Epic", description: "A reusable companion charm that increases World Boss power by 5%. Equip from Companion Mastery." },
  pumpkin_spice_latte: { name: "Harvest Brew", emoji: "🎃", rarity: "Rare", description: "A seasonal harvest potion brewed in the ARVEE realm.", use: "Reset mining cooldown and boost the next dig by 75%.", effect: {"nextMine":"1.75","cooldownReset":true} },
  bohemian_cocktail: { name: "Moonshadow Elixir", emoji: "🍹", rarity: "Epic", description: "Moonlit alchemy distilled by ARVEE artificers.", use: "Receive 1 Rare Supply Cache.", effect: { grant: "rare_lootbox", grantAmount: 1 } },
  jungle_juice: { name: "Forest Tonic", emoji: "🧃", rarity: "Rare", description: "A burst of concentrated energy.", use: "Gain 10 mining XP and shorten the current cooldown by half its normal duration.", effect: {"xp":10,"cooldownReduceFraction":"0.5"} },
  gilded_slurry: { name: "Golden Elixir", emoji: "🏺", rarity: "Epic", description: "Expensive but fruitful alchemy.", use: "Receive an Astral Gem.", effect: { grant: "gem", grantAmount: 1 } },
  creditus_deletus: { name: "Creditus Deletus", emoji: "🪄", rarity: "Epic", description: "A mysterious scroll whose spellwork looks terrifying, but only creates dramatic smoke.", use: "Make a dramatic fake IC deletion. Your credits and progress stay intact.", effect: { prank: true } },
  arthurs_tablet: { name: "Arthur's Tablet", emoji: "📜", rarity: "Rare", description: "An ancient stone tablet filled with lessons for patient miners.", use: "Gain 32 mining XP.", effect: {"xp":32} },
  crafting_materials: { name: "Crafting Supply Bundle", emoji: "🎒", rarity: "Common", description: "A sturdy satchel of ore and Moonsteel gathered by frontier traders.", use: "Unpack 4 Rune Ore and 2 Moonsteel.", effect: {"materials":{"ore":4,"silver":2}} },
  genreset: { name: "Crew Reboot Voucher", emoji: "🎟️", rarity: "Epic", description: "A royal recruitment voucher that brings one new adventurer to your crew.", use: "Recruit one Rookie Adventurer without deleting existing Operations.", effect: {"crew":"MSPS"} },
  gnome: { name: "Gnome's Rocket Brew", emoji: "🧪", rarity: "Epic", description: "An extremely suspicious gnome-made tonic. It smells like heroic decisions.", use: "Reset mining cooldown and boost the next mine by 4x (subject to boost cap).", effect: {"nextMine":"4","cooldownReset":true} },
  kingstones_stone: { name: "Kingstone's Stone", emoji: "🪨", rarity: "Uncommon", description: "A chipped rune stone with a surprising amount of practical mining wisdom.", use: "Gain 5 mining XP.", effect: {"xp":5} },
  mine_alert: { name: "Mine Alert", emoji: "⏰", rarity: "Uncommon", description: "A pocket clock that displays your live mining cooldown. Reusable, with no disruptive pings.", use: "Check whether mining is ready or see when it returns. This does not send alerts.", effect: {"timer":true} },
  nametag: { name: "Pickaxe Nametag", emoji: "🏷️", rarity: "Rare", description: "Engrave a permanent custom name on your pickaxe, or choose a short preset.", use: "Use the Customize action, or /idle use item:nametag name:YourName.", effect: {"renamePickaxe":true} },
  payment: { name: "Merchant Pay Slip", emoji: "🪙", rarity: "Uncommon", description: "A properly accounted payment from the old guild treasury. The clerk insists the math is correct.", use: "Redeem a fixed 500 IC payment.", effect: {"bp":"500"} },
  pick_skin: { name: "Pickaxe Skin Token", emoji: "🎨", rarity: "Epic", description: "A rare cosmetic token that cycles your pickaxe's visible finish. It changes no mining stats.", use: "Switch your pickaxe's appearance between Copper, Obsidian and Astral.", effect: {"skin":true} },
  reward: { name: "Miner's Reward", emoji: "🥨", rarity: "Uncommon", description: "A morale booster issued for productive expeditions. Accounting calls it a performance incentive.", use: "Boost your next 3 successful digs by 60%. Food buffs do not stack.", effect: {"mineBoost":{"multiplier":"1.6","charges":3}} },
  stat_card: { name: "Stat Card", emoji: "📊", rarity: "Rare", description: "A reusable field ledger that opens your achievements and gameplay records.", use: "Open your player statistics without consuming the card.", effect: {"stats":true} },
  tag: { name: "Profile Tag", emoji: "🎗️", rarity: "Epic", description: "A single-use badge that sets a persistent title under your player name.", use: "Choose a profile title with Customize, or /idle use item:tag name:YourTitle.", effect: {"tag":true} },
  rebirth_cocktail: { name: "Rebirth Cocktail", emoji: "🍹", rarity: "Legendary", description: "A celebratory draught awarded for a successful prestige. One toast to a new beginning.", use: "Reset mining cooldown and boost your next 3 successful digs by 100%. Cannot stack with another food boost.", effect: { mineBoost: { multiplier: "2", charges: 3 }, cooldownReset: true } }
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
  gilded_slurry: { gold: 8, strange_matter: 3 },
  creditus_deletus: { strange_matter: 10, silver: 15, cookie: 1 },
  arthurs_tablet: { strange_matter: 5, silver: 12, gold: 2 },
  crafting_materials: { ore: 8, silver: 4 },
  genreset: { gold: 12, strange_matter: 12, gem: 1 },
  gnome: { cola: 3, jungle_juice: 2, gold: 2 },
  kingstones_stone: { ore: 15, silver: 2 },
  mine_alert: { ore: 5, silver: 8 },
  nametag: { silver: 10, gold: 3 },
  payment: { silver: 5, gold: 1 },
  pick_skin: { strange_matter: 8, gem: 1, silver: 15 },
  reward: { bread: 2, ore: 5 },
  stat_card: { silver: 8, coffee: 2 },
  tag: { gold: 10, strange_matter: 8 },
  rare_companion_egg: { companion_egg: 3, silver: 12, gold: 3 },
  mythic_companion_egg: { rare_companion_egg: 3, strange_matter: 8, gem: 2 },
  prospector_charm: { silver: 14, gold: 3, ore: 20 },
  pathfinder_charm: { silver: 12, gold: 3, strange_matter: 3 },
  warcaller_charm: { gold: 8, strange_matter: 5, silver: 20 }
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
