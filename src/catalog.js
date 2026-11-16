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
  ore: { name: "Ore", description: "Raw ore from mining" },
  silver: { name: "Silver", description: "A tradeable mineral" },
  gold: { name: "Gold", description: "Rare mineral" },
  coffee: { name: "Coffee", description: "Crafted from ore and silver" },
  cookie: { name: "Cookie", description: "A café favourite" },
  lucky_charm: { name: "Lucky Charm", description: "A collectible craftable item" },
  lootbox: { name: "Lootbox", description: "Open for random supplies" }
});
const recipes = Object.freeze({
  coffee: { ore: 3, silver: 1 },
  cookie: { coffee: 2, ore: 2 },
  lucky_charm: { gold: 2, silver: 8, cookie: 1 }
});
module.exports = { generators, byId, items, recipes };
